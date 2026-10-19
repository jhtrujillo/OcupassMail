<?php
require_once __DIR__ . '/bootstrap.php';

use Advantage\ImapClient;

$account = requireAuth();

$uid = (int)($_GET['uid'] ?? 0);
$folder = $_GET['folder'] ?? 'INBOX';

if (!$uid) {
    sendError('UID del mensaje requerido');
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        $pdo = \Advantage\Database::getConnection();
        $message = null;

        // 1. Verificar si ya tenemos el cuerpo completo en caché de base de datos SQLite (< 2ms)
        if ($pdo) {
            $stmt = $pdo->prepare("
                SELECT folder, uid, msg_no AS msgNum, message_id AS messageId, in_reply_to AS inReplyTo, 
                       email_references AS `references`, from_name, from_email, subject, clean_subject AS cleanSubject, 
                       snippet, body_html AS html, body_plain AS plain, attachments_json, date
                FROM emails_cache
                WHERE folder = ? AND uid = ?
            ");
            $stmt->execute([$folder, $uid]);
            $cachedRow = $stmt->fetch();

            if ($cachedRow && (!empty($cachedRow['html']) || !empty($cachedRow['plain']))) {
                $attachments = !empty($cachedRow['attachments_json']) ? json_decode($cachedRow['attachments_json'], true) : [];
                $message = [
                    'uid' => (int)$cachedRow['uid'],
                    'msgNum' => (int)$cachedRow['msgNum'],
                    'messageId' => $cachedRow['messageId'],
                    'inReplyTo' => $cachedRow['inReplyTo'],
                    'references' => $cachedRow['references'],
                    'subject' => $cachedRow['subject'],
                    'cleanSubject' => $cachedRow['cleanSubject'],
                    'from' => [
                        'name' => $cachedRow['from_name'] ?: $cachedRow['from_email'],
                        'email' => $cachedRow['from_email']
                    ],
                    'to' => [],
                    'cc' => [],
                    'date' => $cachedRow['date'],
                    'html' => $cachedRow['html'],
                    'plain' => $cachedRow['plain'],
                    'attachments' => is_array($attachments) ? $attachments : [],
                    'folder' => $folder
                ];

                // Marcar como leído en BD
                $pdo->prepare("UPDATE emails_cache SET is_unseen = 0 WHERE folder = ? AND uid = ?")
                    ->execute([$folder, $uid]);
            }
        }

        // 2. Si no estaba en caché, descargarlo de IMAP y guardarlo en BD para siempre
        if (!$message) {
            $imap = new ImapClient($account);
            $message = $imap->getMessageDetail($uid, $folder);
            if (!$message) {
                $imap->close();
                sendError('Mensaje no encontrado', 404);
            }
            $message['folder'] = $folder;

            // Marcar como leído en IMAP
            @$imap->markMessage($uid, 'read', $folder);
            $imap->close();

            // Guardar cuerpo completo en SQLite
            if ($pdo) {
                $attJson = !empty($message['attachments']) ? json_encode($message['attachments'], JSON_UNESCAPED_UNICODE) : null;
                $pdo->prepare("
                    UPDATE emails_cache 
                    SET body_html = ?, body_plain = ?, attachments_json = ?, is_unseen = 0
                    WHERE folder = ? AND uid = ?
                ")->execute([
                    $message['html'],
                    $message['plain'],
                    $attJson,
                    $folder,
                    $uid
                ]);
            }
        }

        // 3. Cargar todos los mensajes del hilo instantáneamente desde SQLite
        $threadMessages = [];
        if ($pdo) {
            $cleanSubject = $message['cleanSubject'] ?? '';
            if (!empty($cleanSubject)) {
                $thStmt = $pdo->prepare("
                    SELECT folder, uid, msg_no AS msgNum, message_id AS messageId, in_reply_to AS inReplyTo, 
                           email_references AS `references`, from_name, from_email, subject, clean_subject AS cleanSubject, 
                           snippet, body_html AS html, body_plain AS plain, attachments_json, date
                    FROM emails_cache
                    WHERE clean_subject = ? AND folder IN (?, 'INBOX.Sent')
                    ORDER BY date ASC, id ASC
                ");
                $thStmt->execute([$cleanSubject, $folder]);
                $threadRows = $thStmt->fetchAll();

                foreach ($threadRows as $tRow) {
                    if ((int)$tRow['uid'] === $uid && $tRow['folder'] === $folder) {
                        $threadMessages[] = $message;
                    } else {
                        $att = !empty($tRow['attachments_json']) ? json_decode($tRow['attachments_json'], true) : [];
                        $threadMessages[] = [
                            'uid' => (int)$tRow['uid'],
                            'msgNum' => (int)$tRow['msgNum'],
                            'messageId' => $tRow['messageId'],
                            'inReplyTo' => $tRow['inReplyTo'],
                            'references' => $tRow['references'],
                            'subject' => $tRow['subject'],
                            'cleanSubject' => $tRow['cleanSubject'],
                            'from' => [
                                'name' => $tRow['from_name'] ?: $tRow['from_email'],
                                'email' => $tRow['from_email']
                            ],
                            'to' => [],
                            'cc' => [],
                            'date' => $tRow['date'],
                            'html' => $tRow['html'],
                            'plain' => $tRow['plain'] ?: $tRow['snippet'],
                            'attachments' => is_array($att) ? $att : [],
                            'folder' => $tRow['folder']
                        ];
                    }
                }
            }
        }

        if (empty($threadMessages)) {
            $message['folder'] = $folder;
            $threadMessages = [$message];
        }

        // Obtener etiquetas asignadas a la conversación
        $labels = [];
        if ($pdo && !empty($message['cleanSubject'])) {
            $lblStmt = $pdo->prepare("
                SELECT l.id, l.name, l.color 
                FROM labels l 
                JOIN email_labels el ON l.id = el.label_id 
                WHERE el.clean_subject = ?
            ");
            $lblStmt->execute([$message['cleanSubject']]);
            $labels = $lblStmt->fetchAll(PDO::FETCH_ASSOC);
        }
        $message['labels'] = $labels;

        sendJson([
            'message' => $message,
            'thread' => $threadMessages,
            'labels' => $labels
        ]);
    } catch (\Exception $e) {
        sendError('Error al leer mensaje: ' . $e->getMessage(), 500);
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = getJsonInput();
    $action = $data['action'] ?? ''; // 'read', 'unread', 'star', 'unstar', 'trash', 'restore', 'delete', 'move'
    $targetFolder = trim($data['targetFolder'] ?? '');
    $allInConversation = !empty($data['allInConversation']);

    if (!in_array($action, ['read', 'unread', 'star', 'unstar', 'trash', 'restore', 'delete', 'move'])) {
        sendError('Acción inválida');
    }

    if ($action === 'move' && empty($targetFolder)) {
        sendError('Carpeta destino requerida para mover');
    }

    try {
        $imap = new ImapClient($account);
        $pdo = \Advantage\Database::getConnection();

        // Determinar qué mensajes se van a afectar:
        // Si allInConversation = true, buscar todos los mensajes del hilo (por clean_subject)
        $targets = []; // cada elemento: ['uid' => int, 'folder' => string]

        if ($allInConversation && $pdo) {
            // Buscar clean_subject del mensaje seleccionado
            $subjStmt = $pdo->prepare("SELECT clean_subject FROM emails_cache WHERE folder = ? AND uid = ?");
            $subjStmt->execute([$folder, $uid]);
            $cleanSubject = $subjStmt->fetchColumn();

            if (!empty($cleanSubject)) {
                // Obtener todos los mensajes de la conversación en esta carpeta (o en el buzón)
                $thStmt = $pdo->prepare("SELECT uid, folder FROM emails_cache WHERE clean_subject = ? AND folder = ?");
                $thStmt->execute([$cleanSubject, $folder]);
                $targets = $thStmt->fetchAll(PDO::FETCH_ASSOC);
            }
        }

        // Si no es hilo o no se encontraron otros mensajes, afectar solo el UID indicado
        if (empty($targets)) {
            $targets = [['uid' => $uid, 'folder' => $folder]];
        }

        foreach ($targets as $target) {
            $tUid = (int)$target['uid'];
            $tFolder = $target['folder'];

            // SISTEMA DE SEGURIDAD Y AUDITORÍA FORENSE:
            // Si el usuario envía a la papelera ('trash') o elimina permanentemente ('delete'),
            // resguardar de forma inmutable el correo completo y todos sus archivos adjuntos.
            if ($pdo && in_array($action, ['trash', 'delete'])) {
                \Advantage\AuditVault::archiveMessage(
                    $pdo,
                    $imap,
                    $tUid,
                    $tFolder,
                    $action === 'delete' ? 'permanent_delete' : 'trash'
                );
            }

            if ($action === 'move') {
                $imap->moveMessage($tUid, $tFolder, $targetFolder);
            } else {
                $imap->markMessage($tUid, $action, $tFolder);
            }

            // Actualizar la caché del usuario
            if ($pdo) {
                if ($action === 'read') {
                    $pdo->prepare("UPDATE emails_cache SET is_unseen = 0 WHERE folder = ? AND uid = ?")->execute([$tFolder, $tUid]);
                } elseif ($action === 'unread') {
                    $pdo->prepare("UPDATE emails_cache SET is_unseen = 1 WHERE folder = ? AND uid = ?")->execute([$tFolder, $tUid]);
                } elseif ($action === 'star') {
                    $pdo->prepare("UPDATE emails_cache SET is_flagged = 1 WHERE folder = ? AND uid = ?")->execute([$tFolder, $tUid]);
                } elseif ($action === 'unstar') {
                    $pdo->prepare("UPDATE emails_cache SET is_flagged = 0 WHERE folder = ? AND uid = ?")->execute([$tFolder, $tUid]);
                } elseif ($action === 'trash' || $action === 'delete' || $action === 'restore' || $action === 'move') {
                    $pdo->prepare("DELETE FROM emails_cache WHERE folder = ? AND uid = ?")->execute([$tFolder, $tUid]);
                }
            }
        }

        $imap->close();

        // Limpiar caché de sesión de carpetas para forzar recálculo inmediato de totales
        unset($_SESSION['folders_cache']);
        unset($_SESSION['folders_cache_time']);

        sendJson(['success' => true, 'action' => $action, 'affectedCount' => count($targets)]);
    } catch (\Exception $e) {
        sendError('Error al actualizar mensaje: ' . $e->getMessage(), 500);
    }
}
