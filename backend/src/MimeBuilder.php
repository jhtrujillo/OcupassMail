<?php
namespace Advantage;

/**
 * MimeBuilder - Generador de mensajes estándar RFC 2822 / MIME
 *
 * Reconstruye correos electrónicos en formato MIME estándar con partes
 * multipart/mixed y multipart/alternative, codificando adjuntos en base64
 * para su re-inyección en servidores IMAP mediante imap_append().
 */
class MimeBuilder {

    /**
     * Construye un mensaje de correo electrónico en formato RFC 2822.
     *
     * @param array $headers Encabezados (From, To, Cc, Subject, Date, Message-ID)
     * @param string $html Contenido HTML
     * @param string $plain Contenido Texto Plano
     * @param array $attachments Lista de adjuntos [['filename' => '...', 'mime_type' => '...', 'data' => binary]]
     * @return string Raw MIME message
     */
    public static function build(array $headers, string $html = '', string $plain = '', array $attachments = []): string {
        $boundaryMixed = '=_Mixed_' . md5(uniqid((string)mt_rand(), true));
        $boundaryAlt = '=_Alt_' . md5(uniqid((string)mt_rand(), true));

        $from = $headers['from'] ?? 'webmail@localhost';
        $to = $headers['to'] ?? '';
        $cc = $headers['cc'] ?? '';
        $subject = $headers['subject'] ?? '(Sin asunto)';
        $date = !empty($headers['date']) ? date('r', strtotime($headers['date'])) : date('r');
        $messageId = !empty($headers['message_id']) ? $headers['message_id'] : ('<' . md5(uniqid((string)mt_rand(), true)) . '@octupassmail>');

        $hasAttachments = !empty($attachments);

        $out = [];
        $out[] = "Date: {$date}";
        $out[] = "From: {$from}";
        if (!empty($to)) {
            $out[] = "To: {$to}";
        }
        if (!empty($cc)) {
            $out[] = "Cc: {$cc}";
        }
        $out[] = "Subject: =?UTF-8?B?" . base64_encode($subject) . "?=";
        $out[] = "Message-ID: {$messageId}";
        $out[] = "MIME-Version: 1.0";

        if ($hasAttachments) {
            $out[] = "Content-Type: multipart/mixed; boundary=\"{$boundaryMixed}\"";
            $out[] = "";
            $out[] = "--{$boundaryMixed}";
        }

        // Bloque del cuerpo del mensaje (HTML / Texto)
        $out[] = "Content-Type: multipart/alternative; boundary=\"{$boundaryAlt}\"";
        $out[] = "";

        // Parte Texto Plano
        $plainText = !empty($plain) ? $plain : strip_tags($html);
        $out[] = "--{$boundaryAlt}";
        $out[] = "Content-Type: text/plain; charset=UTF-8";
        $out[] = "Content-Transfer-Encoding: base64";
        $out[] = "";
        $out[] = chunk_split(base64_encode($plainText));

        // Parte HTML
        if (!empty($html)) {
            $out[] = "--{$boundaryAlt}";
            $out[] = "Content-Type: text/html; charset=UTF-8";
            $out[] = "Content-Transfer-Encoding: base64";
            $out[] = "";
            $out[] = chunk_split(base64_encode($html));
        }

        $out[] = "--{$boundaryAlt}--";

        // Adjuntos
        if ($hasAttachments) {
            foreach ($attachments as $att) {
                $filename = basename($att['filename'] ?? 'archivo');
                $mimeType = $att['mime_type'] ?? 'application/octet-stream';
                $data = $att['data'] ?? '';

                $out[] = "";
                $out[] = "--{$boundaryMixed}";
                $out[] = "Content-Type: {$mimeType}; name=\"=?UTF-8?B?" . base64_encode($filename) . "?=\"";
                $out[] = "Content-Disposition: attachment; filename=\"=?UTF-8?B?" . base64_encode($filename) . "?=\"";
                $out[] = "Content-Transfer-Encoding: base64";
                $out[] = "";
                $out[] = chunk_split(base64_encode($data));
            }
            $out[] = "";
            $out[] = "--{$boundaryMixed}--";
        }

        return implode("\r\n", $out);
    }
}
