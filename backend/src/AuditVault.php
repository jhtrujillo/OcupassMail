<?php
namespace Advantage;

use PDO;
use Exception;

/**
 * AuditVault - Sistema de Retención Forense y Auditoría Inmutable
 *
 * Captura y custodia permanentemente todo correo eliminado (papelera o borrado permanente),
 * preservando cuerpo íntegro (HTML/Texto) y descargando la totalidad de los archivos adjuntos
 * binarios a la base de datos segura antes de que el servidor IMAP los expurgue.
 */
class AuditVault {

    /**
     * Resguarda de forma inmutable un correo y todos sus adjuntos en la base de datos de auditoría.
     *
     * @param PDO $pdo Conexión SQLite del buzón
     * @param ImapClient $imap Cliente IMAP activo
     * @param int $uid UID del mensaje
     * @param string $folder Carpeta actual del mensaje
     * @param string $deletionType 'trash' o 'permanent_delete'
     * @return bool
     */
    public static function archiveMessage(PDO $pdo, ?object $imap, int $uid, string $folder, string $deletionType = 'trash'): bool {
        try {
            // 1. Obtener detalles completos del correo (desde caché o directamente de IMAP)
            $cachedStmt = $pdo->prepare("
                SELECT * FROM emails_cache WHERE folder = ? AND uid = ?
            ");
            $cachedStmt->execute([$folder, $uid]);
            $cached = $cachedStmt->fetch(PDO::FETCH_ASSOC);

            $detail = null;
            $needsImapDetail = false;

            if ($cached && (!empty($cached['body_html']) || !empty($cached['body_plain']))) {
                $attachmentsList = !empty($cached['attachments_json']) ? json_decode($cached['attachments_json'], true) : [];
                $detail = [
                    'uid' => (int)$cached['uid'],
                    'msgNum' => (int)$cached['msg_no'],
                    'messageId' => $cached['message_id'],
                    'inReplyTo' => $cached['in_reply_to'],
                    'references' => $cached['email_references'],
                    'from' => [
                        'name' => $cached['from_name'],
                        'email' => $cached['from_email']
                    ],
                    'to' => [],
                    'cc' => [],
                    'subject' => $cached['subject'],
                    'cleanSubject' => $cached['clean_subject'],
                    'snippet' => $cached['snippet'],
                    'html' => $cached['body_html'],
                    'plain' => $cached['body_plain'],
                    'attachments' => is_array($attachmentsList) ? $attachmentsList : [],
                    'date' => $cached['date']
                ];
            } else {
                $needsImapDetail = true;
            }

            // Si faltaba el cuerpo o no estaba en caché, extraer directo del servidor IMAP
            if ($needsImapDetail) {
                $detail = $imap->getMessageDetail($uid, $folder);
            }

            if (!$detail) {
                // Si no se pudo obtener ningún detalle, registrar al menos el UID y carpeta
                $detail = [
                    'uid' => $uid,
                    'msgNum' => 0,
                    'messageId' => '',
                    'inReplyTo' => '',
                    'references' => '',
                    'from' => ['name' => '', 'email' => ''],
                    'to' => [],
                    'cc' => [],
                    'subject' => '(Mensaje sin detalle recuperable)',
                    'cleanSubject' => '',
                    'snippet' => '',
                    'html' => '',
                    'plain' => '',
                    'attachments' => [],
                    'date' => date('Y-m-d H:i:s')
                ];
            }

            // 2. Extraer metadatos de auditoría
            $ipAddress = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? ($_SERVER['REMOTE_ADDR'] ?? '');
            $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';
            $deletedAt = date('Y-m-d H:i:s');
            $attachmentsMeta = !empty($detail['attachments']) ? json_encode($detail['attachments'], JSON_UNESCAPED_UNICODE) : null;
            $toRecipients = !empty($detail['to']) ? json_encode($detail['to'], JSON_UNESCAPED_UNICODE) : null;
            $ccRecipients = !empty($detail['cc']) ? json_encode($detail['cc'], JSON_UNESCAPED_UNICODE) : null;

            // 3. Insertar registro de correo en deleted_emails_archive
            $archiveStmt = $pdo->prepare("
                INSERT INTO deleted_emails_archive (
                    original_folder, uid, msg_no, message_id, in_reply_to, email_references,
                    from_name, from_email, to_recipients, cc_recipients,
                    subject, clean_subject, snippet, body_html, body_plain,
                    attachments_meta, date, deleted_at, deletion_type, ip_address, user_agent
                ) VALUES (
                    ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?
                )
            ");

            $archiveStmt->execute([
                $folder,
                $detail['uid'] ?? $uid,
                $detail['msgNum'] ?? 0,
                $detail['messageId'] ?? '',
                $detail['inReplyTo'] ?? '',
                $detail['references'] ?? '',
                $detail['from']['name'] ?? '',
                $detail['from']['email'] ?? '',
                $toRecipients,
                $ccRecipients,
                $detail['subject'] ?? '',
                $detail['cleanSubject'] ?? '',
                $detail['snippet'] ?? '',
                $detail['html'] ?? '',
                $detail['plain'] ?? '',
                $attachmentsMeta,
                $detail['date'] ?? $deletedAt,
                $deletedAt,
                $deletionType,
                $ipAddress,
                $userAgent
            ]);

            $archiveId = (int)$pdo->lastInsertId();

            // 4. Descargar y almacenar CADA archivo adjunto como binario (BLOB)
            if (!empty($detail['attachments']) && is_array($detail['attachments'])) {
                $attStmt = $pdo->prepare("
                    INSERT INTO deleted_attachments_archive (
                        archive_id, filename, filesize, mime_type, file_data
                    ) VALUES (?, ?, ?, ?, ?)
                ");

                foreach ($detail['attachments'] as $att) {
                    $partNum = $att['part'] ?? '';
                    $filename = $att['filename'] ?? 'adjunto';
                    $encoding = (int)($att['encoding'] ?? 0);
                    $mimeType = $att['type'] ?? 'application/octet-stream';

                    if (!empty($partNum)) {
                        try {
                            $binaryData = $imap->getAttachment($uid, $partNum, $encoding, $folder);
                            if ($binaryData !== false && $binaryData !== null) {
                                $filesize = strlen($binaryData);
                                $attStmt->bindParam(1, $archiveId, PDO::PARAM_INT);
                                $attStmt->bindParam(2, $filename, PDO::PARAM_STR);
                                $attStmt->bindParam(3, $filesize, PDO::PARAM_INT);
                                $attStmt->bindParam(4, $mimeType, PDO::PARAM_STR);
                                $attStmt->bindParam(5, $binaryData, PDO::PARAM_LOB);
                                $attStmt->execute();
                            }
                        } catch (Exception $eAtt) {
                            error_log("Error al respaldar adjunto {$filename} del mensaje UID {$uid}: " . $eAtt->getMessage());
                        }
                    }
                }
            }

            return true;
        } catch (Exception $e) {
            error_log("Error crítico en AuditVault::archiveMessage para UID {$uid}: " . $e->getMessage());
            return false;
        }
    }
}
