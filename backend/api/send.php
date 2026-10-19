<?php
require_once __DIR__ . '/bootstrap.php';

use Advantage\SmtpClient;

$account = requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendError('Método no permitido', 405);
}

// Soporta tanto multipart/form-data (para adjuntos) como JSON directo
$to = $_POST['to'] ?? '';
$cc = $_POST['cc'] ?? '';
$bcc = $_POST['bcc'] ?? '';
$subject = $_POST['subject'] ?? '';
$bodyHtml = $_POST['body_html'] ?? '';
$bodyText = $_POST['body_text'] ?? '';
$inReplyTo = $_POST['in_reply_to'] ?? '';
$references = $_POST['references'] ?? '';

if (empty($to)) {
    // Intentar leer JSON si vino como application/json
    $json = getJsonInput();
    $to = $json['to'] ?? '';
    $cc = $json['cc'] ?? '';
    $bcc = $json['bcc'] ?? '';
    $subject = $json['subject'] ?? '';
    $bodyHtml = $json['body_html'] ?? '';
    $bodyText = $json['body_text'] ?? '';
    $inReplyTo = $json['in_reply_to'] ?? '';
    $references = $json['references'] ?? '';
}

if (empty($to)) {
    sendError('Debe especificar al menos un destinatario');
}

$files = [];
if (!empty($_FILES['attachments'])) {
    if (is_array($_FILES['attachments']['name'])) {
        for ($i = 0; $i < count($_FILES['attachments']['name']); $i++) {
            if ($_FILES['attachments']['error'][$i] === UPLOAD_ERR_OK) {
                $files[] = [
                    'name' => $_FILES['attachments']['name'][$i],
                    'tmp_name' => $_FILES['attachments']['tmp_name'][$i],
                    'size' => $_FILES['attachments']['size'][$i]
                ];
            }
        }
    }
}

try {
    $smtp = new SmtpClient($account);
    $smtp->send([
        'to' => $to,
        'cc' => $cc,
        'bcc' => $bcc,
        'subject' => $subject,
        'body_html' => $bodyHtml,
        'body_text' => $bodyText,
        'in_reply_to' => $inReplyTo,
        'references' => $references
    ], $files);

    sendJson(['success' => true, 'message' => 'Correo enviado exitosamente']);
} catch (\Exception $e) {
    sendError('Error al enviar correo: ' . $e->getMessage(), 500);
}
