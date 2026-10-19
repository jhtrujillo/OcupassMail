<?php
namespace Advantage;

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

class SmtpClient {
    private $account;

    public function __construct(array $account) {
        $this->account = $account;
    }

    public function send(array $data, array $files = []): bool {
        $mail = new PHPMailer(true);

        try {
            // Server settings
            $mail->isSMTP();
            $mail->Host       = $this->account['smtp_host'];
            $mail->SMTPAuth   = true;
            $mail->Username   = $this->account['email'];
            $mail->Password   = $this->account['password'];

            if ($this->account['smtp_port'] == 465 || $this->account['smtp_secure'] === 'ssl') {
                $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
            } else {
                $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
            }
            $mail->Port       = $this->account['smtp_port'];
            $mail->CharSet    = 'UTF-8';

            // Sender
            $mail->setFrom($this->account['email'], $this->account['display_name'] ?? '');

            // Recipients (To)
            $toList = is_array($data['to']) ? $data['to'] : explode(',', $data['to']);
            foreach ($toList as $to) {
                $to = trim($to);
                if (!empty($to)) {
                    $mail->addAddress($to);
                }
            }

            // CC
            if (!empty($data['cc'])) {
                $ccList = is_array($data['cc']) ? $data['cc'] : explode(',', $data['cc']);
                foreach ($ccList as $cc) {
                    $cc = trim($cc);
                    if (!empty($cc)) {
                        $mail->addCC($cc);
                    }
                }
            }

            // BCC
            if (!empty($data['bcc'])) {
                $bccList = is_array($data['bcc']) ? $data['bcc'] : explode(',', $data['bcc']);
                foreach ($bccList as $bcc) {
                    $bcc = trim($bcc);
                    if (!empty($bcc)) {
                        $mail->addBCC($bcc);
                    }
                }
            }

            // Attachments
            if (!empty($files)) {
                foreach ($files as $file) {
                    if (isset($file['tmp_name']) && is_uploaded_file($file['tmp_name'])) {
                        $mail->addAttachment($file['tmp_name'], $file['name']);
                    }
                }
            }

            // In-Reply-To y References para hilos de conversación RFC-2822
            if (!empty($data['in_reply_to'])) {
                $mail->addCustomHeader('In-Reply-To', trim($data['in_reply_to']));
            }
            if (!empty($data['references'])) {
                $mail->addCustomHeader('References', trim($data['references']));
            }

            // Content
            $mail->isHTML(true);
            $mail->Subject = $data['subject'] ?? '(Sin asunto)';
            $mail->Body    = $data['body_html'] ?? nl2br($data['body_text'] ?? '');
            $mail->AltBody = $data['body_text'] ?? strip_tags($data['body_html'] ?? '');

            $mail->send();

            // Guardar copia en la carpeta de Enviados (INBOX.Sent en DreamHost)
            try {
                $ref = "{" . $this->account['imap_host'] . ":" . $this->account['imap_port'] . "/imap/ssl/novalidate-cert}";
                $imapStream = @imap_open($ref, $this->account['email'], $this->account['password']);
                if ($imapStream) {
                    $sentFolder = $ref . "INBOX.Sent";
                    $rfcMessage = $mail->getSentMIMEMessage();
                    if (!empty($rfcMessage)) {
                        @imap_append($imapStream, $sentFolder, $rfcMessage, "\\Seen");
                    }
                    @imap_close($imapStream);
                }
            } catch (\Exception $appendEx) {
                // Si falla el guardado en Sent, no interrumpir el éxito del envío
            }

            return true;
        } catch (Exception $e) {
            throw new \Exception("Error al enviar correo por SMTP: {$mail->ErrorInfo}");
        }
    }
}
