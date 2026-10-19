<?php
require_once __DIR__ . '/bootstrap.php';

use Advantage\ImapClient;
use Advantage\Database;

$account = requireAuth();

$folder = $_GET['folder'] ?? 'INBOX';
$page = max(1, min(10000, (int)($_GET['page'] ?? 1)));
$perPage = max(1, min(100, (int)($_GET['perPage'] ?? 25)));
$search = mb_substr(trim($_GET['search'] ?? ''), 0, 200);
$forceRefresh = isset($_GET['refresh']) && $_GET['refresh'] === '1';

$pdo = Database::getConnection();
$email = $account['email'];
$offset = ($page - 1) * $perPage;

// Helper para obtener el total de mensajes de la carpeta desde la sesión de carpetas o IMAP
$folderTotalMessages = null;
if (!empty($_SESSION['folders_cache'])) {
    foreach ($_SESSION['folders_cache'] as $f) {
        if ($f['id'] === $folder) {
            $folderTotalMessages = (int)$f['total'];
            break;
        }
    }
}

// Función auxiliar para extraer los hilos agrupados y paginados desde SQLite de forma ultra-rápida
$fetchCachedThreads = function(\PDO $pdo, string $folder, int $perPage, int $offset): array {
    $listStmt = $pdo->prepare("
        SELECT 
            clean_subject AS cleanSubject,
            folderMsgCount,
            latestDate,
            unreadCount,
            isFlagged,
            hasAttachments,
            uid,
            msg_no AS msgNum,
            from_name,
            from_email,
            subject,
            snippet,
            sendersSummary
        FROM (
            SELECT 
                clean_subject,
                COUNT(*) OVER (PARTITION BY clean_subject) AS folderMsgCount,
                MAX(date) OVER (PARTITION BY clean_subject) AS latestDate,
                SUM(is_unseen) OVER (PARTITION BY clean_subject) AS unreadCount,
                MAX(is_flagged) OVER (PARTITION BY clean_subject) AS isFlagged,
                MAX(has_attachments) OVER (PARTITION BY clean_subject) AS hasAttachments,
                GROUP_CONCAT(COALESCE(NULLIF(from_name, ''), from_email)) OVER (PARTITION BY clean_subject) AS sendersSummary,
                uid,
                msg_no,
                from_name,
                from_email,
                subject,
                snippet,
                ROW_NUMBER() OVER (PARTITION BY clean_subject ORDER BY date DESC, id DESC) AS rn
            FROM emails_cache
            WHERE folder = :folder
        )
        WHERE rn = 1
        ORDER BY latestDate DESC
        LIMIT :limit OFFSET :offset
    ");
    $listStmt->bindValue(':folder', $folder, PDO::PARAM_STR);
    $listStmt->bindValue(':limit', $perPage, PDO::PARAM_INT);
    $listStmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $listStmt->execute();

    $cachedMessages = $listStmt->fetchAll();
    if (empty($cachedMessages)) {
        return [];
    }

    $formatted = [];
    $totThStmt = $pdo->prepare("SELECT COUNT(*) FROM emails_cache WHERE clean_subject = ? AND folder IN ('INBOX', 'INBOX.Sent')");

    foreach ($cachedMessages as $row) {
        $totThStmt->execute([$row['cleanSubject']]);
        $totalInConversation = (int)$totThStmt->fetchColumn();

        // Obtener etiquetas asignadas a este hilo
        $lblStmt = $pdo->prepare("
            SELECT l.id, l.name, l.color 
            FROM labels l 
            JOIN email_labels el ON l.id = el.label_id 
            WHERE el.clean_subject = ?
        ");
        $lblStmt->execute([$row['cleanSubject']]);
        $msgLabels = $lblStmt->fetchAll(PDO::FETCH_ASSOC);

        // Formatear lista de remitentes sin duplicados
        $rawSenders = explode(',', $row['sendersSummary'] ?? '');
        $uniqueSenders = array_values(array_unique(array_filter(array_map('trim', $rawSenders))));
        $sendersText = !empty($uniqueSenders) ? implode(', ', $uniqueSenders) : ($row['from_name'] ?: $row['from_email']);

        $formatted[] = [
            'uid' => (int)$row['uid'],
            'msgNum' => (int)$row['msgNum'],
            'from' => [
                'name' => $row['from_name'] ?: $row['from_email'],
                'email' => $row['from_email']
            ],
            'subject' => $row['subject'],
            'cleanSubject' => $row['cleanSubject'],
            'date' => $row['latestDate'],
            'unseen' => ((int)$row['unreadCount']) > 0,
            'unreadCount' => (int)$row['unreadCount'],
            'flagged' => (bool)$row['isFlagged'],
            'snippet' => $row['snippet'],
            'hasAttachments' => (bool)$row['hasAttachments'],
            'threadCount' => max((int)$row['folderMsgCount'], $totalInConversation),
            'sendersSummary' => $sendersText,
            'labels' => $msgLabels
        ];
    }
    return $formatted;
};

// 1. ENTREGA INSTANTÁNEA (< 10ms): Si tenemos correos en base de datos SQLite y no es un refresco forzado ni búsqueda
if ($pdo && !$forceRefresh && empty($search)) {
    try {
        $countStmt = $pdo->prepare("SELECT COUNT(*) FROM emails_cache WHERE folder = ?");
        $countStmt->execute([$folder]);
        $totalInCache = (int)$countStmt->fetchColumn();

        if ($totalInCache > 0) {
            $threadCountStmt = $pdo->prepare("SELECT COUNT(DISTINCT clean_subject) FROM emails_cache WHERE folder = ?");
            $threadCountStmt->execute([$folder]);
            $totalThreadsInCache = (int)$threadCountStmt->fetchColumn();

            // Si el offset solicitado cabe dentro de los hilos que tenemos en caché:
            if ($offset < $totalThreadsInCache) {
                $formatted = $fetchCachedThreads($pdo, $folder, $perPage, $offset);
                if (!empty($formatted)) {
                    $effectiveTotal = max($totalThreadsInCache, $folderTotalMessages ?? 0);

                    sendJson([
                        'messages' => $formatted,
                        'total' => $effectiveTotal,
                        'totalThreads' => $totalThreadsInCache,
                        'page' => $page,
                        'perPage' => $perPage,
                        'source' => 'cache_instant'
                    ]);
                }
            }
        }
    } catch (\Exception $e) {
        // En caso de cualquier excepción, continuar a IMAP
    }
}

// 2. Si no estaba en caché, se requiere una página más profunda, o se solicitó refresco: conectar a IMAP
try {
    $imap = new ImapClient($account);
    
    // Obtener total de mensajes del servidor
    $realTotal = $imap->getNumMsg($folder);
    if ($realTotal <= 0) {
        $realTotal = 0;
    }

    // Actualizar la sesión de carpetas con el conteo real
    if (!empty($_SESSION['folders_cache'])) {
        foreach ($_SESSION['folders_cache'] as &$f) {
            if ($f['id'] === $folder) {
                $f['total'] = $realTotal;
                break;
            }
        }
    }

    if (!empty($search)) {
        $result = $imap->getMessages($folder, $page, $perPage, $search);
        $imap->close();
        sendJson($result);
    }

    // Si la base de datos no estuviera disponible, servir directamente desde IMAP
    if (!$pdo) {
        $result = $imap->getMessages($folder, $page, $perPage, $search);
        $imap->close();
        sendJson($result);
    }

    // 1. Averiguar el mayor y menor msg_no que tenemos en caché
    $statStmt = $pdo->prepare("SELECT MIN(msg_no), MAX(msg_no) FROM emails_cache WHERE folder = ?");
    $statStmt->execute([$folder]);
    [$minCached, $maxCached] = $statStmt->fetch(PDO::FETCH_NUM);

    $insertStmt = $pdo->prepare("
        INSERT INTO emails_cache 
        (folder, uid, msg_no, message_id, in_reply_to, email_references, from_name, from_email, subject, clean_subject, snippet, date, is_unseen, is_flagged, has_attachments)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(folder, uid) DO UPDATE SET 
            msg_no = excluded.msg_no,
            message_id = excluded.message_id,
            in_reply_to = excluded.in_reply_to,
            email_references = excluded.email_references,
            is_unseen = excluded.is_unseen,
            is_flagged = excluded.is_flagged,
            updated_at = CURRENT_TIMESTAMP
    ");

    // 2. Si entraron correos nuevos más arriba de nuestro último msg_no en caché:
    // Solo descargamos la diferencia exacta (típicamente 1 a 5 correos en < 200ms)
    if ($maxCached !== null && $realTotal > (int)$maxCached) {
        $sliceMessages = $imap->getMessagesSlice($folder, (int)$maxCached + 1, $realTotal);
        if (!empty($sliceMessages)) {
            foreach ($sliceMessages as $msg) {
                $dateVal = !empty($msg['date']) ? date('Y-m-d H:i:s', strtotime($msg['date'])) : date('Y-m-d H:i:s');
                $insertStmt->execute([
                    $folder,
                    $msg['uid'],
                    $msg['msgNum'],
                    $msg['messageId'] ?? '',
                    $msg['inReplyTo'] ?? '',
                    $msg['references'] ?? '',
                    $msg['from']['name'] ?? '',
                    $msg['from']['email'] ?? '',
                    $msg['subject'] ?? '',
                    $msg['cleanSubject'] ?? '',
                    $msg['snippet'] ?? '',
                    $dateVal,
                    $msg['unseen'] ? 1 : 0,
                    $msg['flagged'] ? 1 : 0,
                    $msg['hasAttachments'] ? 1 : 0
                ]);
            }
        }
    }

    // 3. Comprobar si necesitamos descargar más páginas hacia atrás para cubrir la paginación solicitada
    $targetThreadsNeeded = $offset + $perPage;
    $chkStmt = $pdo->prepare("SELECT COUNT(DISTINCT clean_subject) FROM emails_cache WHERE folder = ?");
    $chkStmt->execute([$folder]);
    $currentThreads = (int)$chkStmt->fetchColumn();

    if ($currentThreads < $targetThreadsNeeded && $realTotal > 0) {
        $nextEndMsg = ($minCached !== false && $minCached !== null && (int)$minCached > 1) 
            ? ((int)$minCached - 1) 
            : $realTotal;

        $batchSize = 50;
        $loops = 0;
        while ($nextEndMsg >= 1 && $loops < 3 && $currentThreads < $targetThreadsNeeded) {
            $loops++;
            $nextStartMsg = max(1, $nextEndMsg - $batchSize + 1);
            $sliceMessages = $imap->getMessagesSlice($folder, $nextStartMsg, $nextEndMsg);

            if (empty($sliceMessages)) {
                break;
            }

            foreach ($sliceMessages as $msg) {
                $dateVal = !empty($msg['date']) ? date('Y-m-d H:i:s', strtotime($msg['date'])) : date('Y-m-d H:i:s');
                $insertStmt->execute([
                    $folder,
                    $msg['uid'],
                    $msg['msgNum'],
                    $msg['messageId'] ?? '',
                    $msg['inReplyTo'] ?? '',
                    $msg['references'] ?? '',
                    $msg['from']['name'] ?? '',
                    $msg['from']['email'] ?? '',
                    $msg['subject'] ?? '',
                    $msg['cleanSubject'] ?? '',
                    $msg['snippet'] ?? '',
                    $dateVal,
                    $msg['unseen'] ? 1 : 0,
                    $msg['flagged'] ? 1 : 0,
                    $msg['hasAttachments'] ? 1 : 0
                ]);
            }

            $nextEndMsg = $nextStartMsg - 1;
            $chkStmt->execute([$folder]);
            $currentThreads = (int)$chkStmt->fetchColumn();
        }
    }

    $imap->close();

    // Consultar los hilos resultantes de la BD
    $threadCountStmt = $pdo->prepare("SELECT COUNT(DISTINCT clean_subject) FROM emails_cache WHERE folder = ?");
    $threadCountStmt->execute([$folder]);
    $totalThreadsInCache = (int)$threadCountStmt->fetchColumn();

    $formatted = $fetchCachedThreads($pdo, $folder, $perPage, $offset);

    $effectiveTotal = max($totalThreadsInCache, $realTotal);

    sendJson([
        'messages' => $formatted,
        'total' => $effectiveTotal,
        'totalThreads' => $totalThreadsInCache,
        'page' => $page,
        'perPage' => $perPage,
        'source' => 'live_synced_grouped'
    ]);
} catch (\Exception $e) {
    sendServerError('Error al obtener mensajes', $e);
}
