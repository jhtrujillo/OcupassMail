<?php
require_once __DIR__ . '/bootstrap.php';

use Advantage\ImapClient;

$account = requireAuth();

$uid = (int)($_GET['uid'] ?? 0);
$part = $_GET['part'] ?? '';
$filename = $_GET['name'] ?? 'attachment';
$encoding = (int)($_GET['encoding'] ?? 0);
$folder = $_GET['folder'] ?? 'INBOX';
$inline = isset($_GET['inline']) && $_GET['inline'] === '1';

if (!$uid || !$part) {
    sendError('Parámetros de adjunto incompletos');
}

try {
    $imap = new ImapClient($account);
    $data = $imap->getAttachment($uid, $part, $encoding, $folder);
    $imap->close();

    $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
    $mimeType = 'application/octet-stream';

    switch ($ext) {
        case 'pdf': $mimeType = 'application/pdf'; break;
        case 'png': $mimeType = 'image/png'; break;
        case 'jpg':
        case 'jpeg': $mimeType = 'image/jpeg'; break;
        case 'gif': $mimeType = 'image/gif'; break;
        case 'webp': $mimeType = 'image/webp'; break;
        case 'txt': $mimeType = 'text/plain; charset=utf-8'; break;
    }

    $disposition = $inline ? 'inline' : 'attachment';

    header('Content-Type: ' . $mimeType);
    header('Content-Disposition: ' . $disposition . '; filename="' . basename($filename) . '"');
    header('Expires: 0');
    header('Cache-Control: must-revalidate, post-check=0, pre-check=0');
    header('Pragma: public');
    header('Content-Length: ' . strlen($data));
    echo $data;
    exit;
} catch (\Exception $e) {
    sendError('Error al descargar archivo adjunto: ' . $e->getMessage(), 500);
}
