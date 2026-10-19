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

    $ref = \Advantage\Security::imapRef($account);

    // Obtener las carpetas actuales para detectar si el servidor usa el namespace INBOX.
    $existingBoxes = @imap_getmailboxes($imap->getStream(), $ref, "*");
    $usesInboxPrefix = false;
    if (is_array($existingBoxes)) {
        foreach ($existingBoxes as $b) {
            $c = str_replace($ref, '', $b->name);
            if (stripos($c, 'INBOX.') === 0) {
                $usesInboxPrefix = true;
                break;
            }
        }
    }

    if ($action === 'create') {
        // Sanitizar nombre de carpeta
        $cleanFolderName = trim(\Advantage\Security::oneLine($folderName), " \t\n\r\0\x0B/.");
        if ($cleanFolderName === '' || mb_strlen($cleanFolderName) > 100 || preg_match('/[*%{}]/', $cleanFolderName)) {
            sendError('Nombre de carpeta inválido');
        }

        // Determinar candidatos de nombre según namespace
        $candidates = [];
        if ($usesInboxPrefix) {
            $candidates[] = 'INBOX.' . $cleanFolderName;
            $candidates[] = $cleanFolderName;
        } else {
            $candidates[] = $cleanFolderName;
            $candidates[] = 'INBOX.' . $cleanFolderName;
        }

        $created = false;
        $lastErr = '';

        foreach ($candidates as $candidate) {
            $targetMailbox = $ref . $candidate;
            $res = @imap_createmailbox($imap->getStream(), $targetMailbox);
            if ($res) {
                $created = true;
                $folderName = $candidate;
                break;
            } else {
                $lastErr = imap_last_error();
            }
        }

        if (!$created) {
            throw new \Exception('No se pudo crear la carpeta: ' . ($lastErr ?: 'Error desconocido'));
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
