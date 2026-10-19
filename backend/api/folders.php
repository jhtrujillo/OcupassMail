<?php
require_once __DIR__ . '/bootstrap.php';

use Advantage\ImapClient;
use Advantage\Database;

$account = requireAuth();
$forceRefresh = isset($_GET['refresh']) && $_GET['refresh'] === '1';

try {
    $folders = null;

    // Si no se fuerza refresco, intentar obtener las carpetas
    if (!$forceRefresh && !empty($_SESSION['folders_cache']) && !empty($_SESSION['folders_cache_time'])) {
        if (time() - $_SESSION['folders_cache_time'] < 600) {
            $folders = $_SESSION['folders_cache'];
        }
    }

    if (!$folders) {
        $imap = new ImapClient($account);
        $folders = $imap->getFolders();
        $imap->close();
    }

    // Complementar y sincronizar con los conteos exactos de SQLite
    try {
        $pdo = Database::getConnection($account['email']);
        $cacheCounts = $pdo->query("
            SELECT folder, COUNT(*) as total, COUNT(DISTINCT clean_subject) as threads, SUM(is_unseen) as unseen
            FROM emails_cache
            GROUP BY folder
        ")->fetchAll();

        $map = [];
        foreach ($cacheCounts as $row) {
            $map[$row['folder']] = [
                'total' => (int)$row['total'],
                'threads' => (int)$row['threads'],
                'unseen' => (int)($row['unseen'] ?? 0)
            ];
        }

        foreach ($folders as &$f) {
            $fId = $f['id'];
            if (isset($map[$fId])) {
                // Si la BD tiene un conteo mayor o más reciente, asegurar que no quede en 0 si hay emails
                $f['total'] = max((int)($f['total'] ?? 0), $map[$fId]['total']);
                $f['threads'] = $map[$fId]['threads'];
                // El unseen de la BD local refleja con precisión el estado actual de lectura
                $f['unseen'] = $map[$fId]['unseen'];
            } else {
                $f['threads'] = (int)($f['total'] ?? 0);
            }
        }
        unset($f);
    } catch (\Exception $dbEx) {
        // En caso de fallo con SQLite, mantenemos los conteos originales de IMAP
    }

    // Guardar en sesión
    $_SESSION['folders_cache'] = $folders;
    $_SESSION['folders_cache_time'] = time();

    sendJson(['folders' => $folders, 'source' => $forceRefresh ? 'live' : 'cached_or_synced']);
} catch (\Exception $e) {
    sendServerError('Error al obtener carpetas', $e);
}

