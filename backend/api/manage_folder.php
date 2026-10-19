<?php
require_once __DIR__ . '/bootstrap.php';

use Advantage\ImapClient;

$account = requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendError('Método no permitido', 405);
}

$action = $_POST['action'] ?? '';
$folderName = trim($_POST['name'] ?? '');

if (empty($action) || empty($folderName)) {
    sendError('Acción y nombre de carpeta requeridos');
}

try {
    $imap = new ImapClient($account);
    $imap->connect('INBOX');

    if ($action === 'create') {
        // Sanitizar nombre de carpeta
        $cleanFolderName = trim(\Advantage\Security::oneLine($folderName), " \t\n\r\0\x0B/.");
        if ($cleanFolderName === '' || mb_strlen($cleanFolderName) > 100 || preg_match('/[*%{}]/', $cleanFolderName)) {
            sendError('Nombre de carpeta inválido');
        }

        // Obtener carpetas para ver si el servidor usa el prefijo INBOX.
        $existing = $imap->getFolders();
        $usesInboxPrefix = false;
        foreach ($existing as $b) {
            if (stripos($b['raw'] ?? '', 'INBOX.') === 0) {
                $usesInboxPrefix = true;
                break;
            }
        }

        $candidates = [];
        if ($usesInboxPrefix) {
            $candidates[] = 'INBOX.' . $cleanFolderName;
            $candidates[] = $cleanFolderName;
        } else {
            $candidates[] = $cleanFolderName;
            $candidates[] = 'INBOX.' . $cleanFolderName;
        }

        $created = false;
        foreach ($candidates as $cand) {
            if ($imap->createFolder($cand)) {
                $created = true;
                $folderName = $cand;
                break;
            }
        }

        if (!$created) {
            throw new \Exception('No se pudo crear la carpeta en el servidor de correo');
        }

        // Invalidar caché de carpetas en sesión
        unset($_SESSION['folders_cache']);
        unset($_SESSION['folders_cache_time']);
    }

    $imap->close();
    sendJson(['success' => true, 'message' => "Carpeta '{$folderName}' creada"]);
} catch (\Exception $e) {
    sendServerError('No se pudo crear la carpeta', $e);
}
