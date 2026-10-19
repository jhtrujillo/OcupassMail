<?php
require_once __DIR__ . '/bootstrap.php';

use Advantage\Database;
use Advantage\ImapClient;
use Advantage\MimeBuilder;

$account = requireAuth();
$pdo = Database::getConnection();

if (!$pdo) {
    sendError('Base de datos no disponible', 500);
}

$action = $_GET['action'] ?? '';

// 1. Desbloqueo de la Bóveda con PIN o Contraseña Maestra
if ($action === 'unlock' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = getJsonInput();
    $pin = (string)($input['pin'] ?? '');
    $bucket = 'vault:' . $account['email'];

    // Máximo 5 intentos cada 15 minutos
    $wait = \Advantage\Security::rateLimitWait($bucket, 5, 900);
    if ($wait > 0) {
        sendError('Demasiados intentos. La bóveda está bloqueada por ' . ceil($wait / 60) . ' minuto(s).', 429);
    }

    // Se acepta el PIN maestro configurado (como hash en config.php) o la contraseña del buzón.
    $pinHash = (string)(\Advantage\Security::config()['vault_pin_hash'] ?? '');
    $okPin = $pin !== '' && $pinHash !== '' && password_verify($pin, $pinHash);
    $okPassword = $pin !== '' && hash_equals((string)$account['password'], $pin);

    if ($okPin || $okPassword) {
        \Advantage\Security::rateLimitReset($bucket);
        session_regenerate_id(true);
        $_SESSION['vault_unlocked'] = time();
        sendJson(['success' => true, 'message' => 'Bóveda de seguridad desbloqueada']);
    } else {
        \Advantage\Security::rateLimitHit($bucket);
        error_log('[OctupassMail] Intento fallido de desbloqueo de bóveda para ' . $account['email'] . ' desde ' . \Advantage\Security::clientIp());
        sendError('PIN o contraseña maestra de seguridad inválida', 401);
    }
}

// 2. Estado de autenticación de la Bóveda
// La bóveda se vuelve a bloquear sola tras 15 minutos
if (!empty($_SESSION['vault_unlocked']) && (time() - (int)$_SESSION['vault_unlocked']) > 900) {
    unset($_SESSION['vault_unlocked']);
}

if ($action === 'status') {
    sendJson(['unlocked' => !empty($_SESSION['vault_unlocked'])]);
}

// 3. Bloqueo manual de la Bóveda
if ($action === 'lock' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    unset($_SESSION['vault_unlocked']);
    sendJson(['success' => true, 'unlocked' => false]);
}

// Barrera de Seguridad: Todas las acciones siguientes requieren que la bóveda esté desbloqueada
if (empty($_SESSION['vault_unlocked'])) {
    sendError('Bóveda bloqueada. Se requiere autorización de seguridad.', 403);
}

// 4. Listar correos eliminados custodiados
if ($action === 'list') {
    $page = max(1, (int)($_GET['page'] ?? 1));
    $perPage = max(1, min(100, (int)($_GET['perPage'] ?? 25)));
    $search = trim($_GET['search'] ?? '');
    $offset = ($page - 1) * $perPage;

    $where = [];
    $params = [];

    if (!empty($search)) {
        $where[] = "(subject LIKE ? OR from_name LIKE ? OR from_email LIKE ? OR snippet LIKE ?)";
        $term = "%{$search}%";
        $params = array_fill(0, 4, $term);
    }

    $whereSql = !empty($where) ? "WHERE " . implode(" AND ", $where) : "";

    $countStmt = $pdo->prepare("SELECT COUNT(*) FROM deleted_emails_archive {$whereSql}");
    $countStmt->execute($params);
    $total = (int)$countStmt->fetchColumn();

    $stmt = $pdo->prepare("
        SELECT 
            e.id, e.original_folder, e.uid, e.from_name, e.from_email,
            e.subject, e.clean_subject, e.snippet, e.date, e.deleted_at,
            e.deletion_type, e.ip_address,
            COUNT(a.id) AS attachments_count
        FROM deleted_emails_archive e
        LEFT JOIN deleted_attachments_archive a ON a.archive_id = e.id
        {$whereSql}
        GROUP BY e.id
        ORDER BY e.deleted_at DESC
        LIMIT ? OFFSET ?
    ");

    $execParams = array_merge($params, [$perPage, $offset]);
    $stmt->execute($execParams);
    $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);

    sendJson([
        'messages' => $messages,
        'total' => $total,
        'page' => $page,
        'perPage' => $perPage
    ]);
}

// 5. Ver detalle completo de un correo archivado
if ($action === 'detail') {
    $id = (int)($_GET['id'] ?? 0);
    if (!$id) {
        sendError('ID de archivo requerido');
    }

    $stmt = $pdo->prepare("SELECT * FROM deleted_emails_archive WHERE id = ?");
    $stmt->execute([$id]);
    $emailRow = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$emailRow) {
        sendError('Correo no encontrado en la bóveda', 404);
    }

    $attStmt = $pdo->prepare("
        SELECT id, filename, filesize, mime_type, created_at 
        FROM deleted_attachments_archive 
        WHERE archive_id = ?
    ");
    $attStmt->execute([$id]);
    $attachments = $attStmt->fetchAll(PDO::FETCH_ASSOC);

    $emailRow['attachments'] = $attachments;
    $emailRow['to'] = !empty($emailRow['to_recipients']) ? json_decode($emailRow['to_recipients'], true) : [];
    $emailRow['cc'] = !empty($emailRow['cc_recipients']) ? json_decode($emailRow['cc_recipients'], true) : [];

    sendJson(['message' => $emailRow]);
}

// 6. Descargar archivo adjunto recuperado
if ($action === 'download_attachment') {
    $attachmentId = (int)($_GET['attachment_id'] ?? 0);
    if (!$attachmentId) {
        sendError('ID de adjunto requerido');
    }

    $stmt = $pdo->prepare("SELECT filename, filesize, mime_type, file_data FROM deleted_attachments_archive WHERE id = ?");
    $stmt->execute([$attachmentId]);
    $att = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$att) {
        sendError('Archivo adjunto no encontrado', 404);
    }

    $filename = \Advantage\Security::safeFilename($att['filename']);
    $data = $att['file_data'];

    // Siempre como descarga binaria: nunca se interpreta como HTML en nuestro dominio
    header('Content-Type: application/octet-stream');
    header("Content-Security-Policy: default-src 'none'; sandbox");
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Content-Length: ' . strlen($data));
    header('Expires: 0');
    header('Cache-Control: must-revalidate');
    header('Pragma: public');
    echo $data;
    exit;
}

// 7. Restaurar correo eliminado al buzón activo (re-inyección IMAP)
if ($action === 'restore' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = getJsonInput();
    $archiveId = (int)($input['archive_id'] ?? 0);
    $targetFolder = \Advantage\Security::oneLine($input['target_folder'] ?? 'INBOX') ?: 'INBOX';

    if (!$archiveId) {
        sendError('ID de archivo requerido');
    }

    // Obtener correo
    $stmt = $pdo->prepare("SELECT * FROM deleted_emails_archive WHERE id = ?");
    $stmt->execute([$archiveId]);
    $emailRow = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$emailRow) {
        sendError('Correo archivado no encontrado', 404);
    }

    // Obtener adjuntos
    $attStmt = $pdo->prepare("SELECT filename, mime_type, file_data AS data FROM deleted_attachments_archive WHERE archive_id = ?");
    $attStmt->execute([$archiveId]);
    $attachments = $attStmt->fetchAll(PDO::FETCH_ASSOC);

    // Formatear destinatarios
    $to = '';
    if (!empty($emailRow['to_recipients'])) {
        $toList = json_decode($emailRow['to_recipients'], true);
        if (is_array($toList)) {
            $formattedTo = [];
            foreach ($toList as $t) {
                $formattedTo[] = !empty($t['name']) ? "{$t['name']} <{$t['email']}>" : ($t['email'] ?? '');
            }
            $to = implode(', ', array_filter($formattedTo));
        }
    }

    $fromFormatted = !empty($emailRow['from_name']) 
        ? "{$emailRow['from_name']} <{$emailRow['from_email']}>" 
        : $emailRow['from_email'];

    $headers = [
        'from' => $fromFormatted,
        'to' => $to,
        'subject' => $emailRow['subject'],
        'date' => $emailRow['date'],
        'message_id' => $emailRow['message_id']
    ];

    $rawMime = MimeBuilder::build($headers, $emailRow['body_html'] ?? '', $emailRow['body_plain'] ?? '', $attachments);

    try {
        $imap = new ImapClient($account);
        $success = $imap->appendMessage($targetFolder, $rawMime, "\\Seen");
        $imap->close();

        if (!$success) {
            sendError('El servidor IMAP no pudo aceptar el mensaje restaurado', 500);
        }

        // Si se restauró con éxito, limpiar la sesión de carpetas para que refresque conteos
        unset($_SESSION['folders_cache']);

        sendJson([
            'success' => true,
            'message' => "Correo '{$emailRow['subject']}' restaurado exitosamente a {$targetFolder}"
        ]);
    } catch (\Exception $e) {
        sendServerError('Error al restaurar el correo en el servidor', $e);
    }
}

sendError('Acción de bóveda no reconocida');
