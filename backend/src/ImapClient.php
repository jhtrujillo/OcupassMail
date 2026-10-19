<?php
namespace Advantage;

class ImapClient {
    private $stream = null;
    private $account;
    private $currentFolder = 'INBOX';

    public function __construct(array $account) {
        $this->account = $account;
    }

    private function getMailboxString(string $folder = 'INBOX'): string {
        return Security::imapRef($this->account) . $folder;
    }

    public function connect(string $folder = 'INBOX'): bool {
        if ($this->stream && $this->currentFolder === $folder) {
            return true;
        }

        $mailbox = $this->getMailboxString($folder);

        if ($this->stream) {
            $reopened = @imap_reopen($this->stream, $mailbox, 0, 1);
            if ($reopened) {
                $this->currentFolder = $folder;
                return true;
            }
        }

        $this->stream = @imap_open(
            $mailbox,
            $this->account['email'],
            $this->account['password'],
            0,
            1,
            ['DISABLE_AUTHENTICATOR' => 'GSSAPI']
        );

        if (!$this->stream) {
            $err = imap_last_error();
            throw new \Exception('Error al conectar con IMAP: ' . ($err ?: 'Credenciales inválidas o servidor inalcanzable'));
        }

        $this->currentFolder = $folder;
        return true;
    }

    public function getStream() {
        return $this->stream;
    }

    public function appendMessage(string $folder, string $rawMime, string $options = "\\Seen"): bool {
        $this->connect($folder);
        $mailbox = $this->getMailboxString($folder);
        return @imap_append($this->stream, $mailbox, $rawMime, $options);
    }

    public function getFolders(): array {
        if (!$this->stream) {
            $this->connect('INBOX');
        }

        $ref = Security::imapRef($this->account);
        $list = @imap_getmailboxes($this->stream, $ref, "*");
        
        $folders = [];
        if (is_array($list)) {
            foreach ($list as $box) {
                $rawName = $box->name;
                $cleanName = str_replace($ref, '', $rawName);
                
                // Mapeo amigable
                $friendlyName = preg_replace('/^INBOX\./i', '', $cleanName);
                $type = 'custom';
                $icon = 'folder';

                if (strcasecmp($cleanName, 'INBOX') === 0) {
                    $friendlyName = 'Recibidos';
                    $type = 'inbox';
                    $icon = 'inbox';
                } elseif (preg_match('/sent/i', $cleanName)) {
                    $friendlyName = 'Enviados';
                    $type = 'sent';
                    $icon = 'send';
                } elseif (preg_match('/draft/i', $cleanName)) {
                    $friendlyName = 'Borradores';
                    $type = 'drafts';
                    $icon = 'file';
                } elseif (preg_match('/trash|bin|papelera/i', $cleanName)) {
                    $friendlyName = 'Papelera';
                    $type = 'trash';
                    $icon = 'trash';
                } elseif (preg_match('/spam|junk/i', $cleanName)) {
                    $friendlyName = 'Spam';
                    $type = 'spam';
                    $icon = 'alert-octagon';
                } elseif (preg_match('/starred|destacados/i', $cleanName)) {
                    $friendlyName = 'Destacados';
                    $type = 'starred';
                    $icon = 'star';
                } elseif (preg_match('/important|importantes/i', $cleanName)) {
                    $friendlyName = 'Importantes';
                    $type = 'important';
                    $icon = 'bookmark';
                } elseif (preg_match('/all mail|todos/i', $cleanName)) {
                    $friendlyName = 'Todos';
                    $type = 'all';
                    $icon = 'archive';
                }

                $status = @imap_status($this->stream, $rawName, SA_ALL);
                $unseen = $status ? $status->unseen : 0;
                $messages = $status ? $status->messages : 0;

                $folders[] = [
                    'id' => $cleanName,
                    'raw' => $rawName,
                    'name' => $friendlyName,
                    'type' => $type,
                    'icon' => $icon,
                    'unseen' => $unseen,
                    'total' => $messages
                ];
            }
        }
        return $folders;
    }

    public function getMessages(string $folder = 'INBOX', int $page = 1, int $perPage = 25, string $search = ''): array {
        $this->connect($folder);

        if (!empty($search)) {
            // Búsqueda IMAP
            $search = mb_substr(str_replace(["\r", "\n", "\0", '"', '\\'], ' ', $search), 0, 200);
            $criteria = 'TEXT "' . $search . '"';
            $msgNums = @imap_search($this->stream, $criteria);
            if (!$msgNums) {
                return ['messages' => [], 'total' => 0, 'page' => $page, 'perPage' => $perPage];
            }
            rsort($msgNums);
            $total = count($msgNums);
            $slice = array_slice($msgNums, ($page - 1) * $perPage, $perPage);
        } else {
            $total = @imap_num_msg($this->stream);
            if ($total <= 0) {
                return ['messages' => [], 'total' => 0, 'page' => $page, 'perPage' => $perPage];
            }
            $start = max(1, $total - ($page * $perPage) + 1);
            $end = max(1, $total - (($page - 1) * $perPage));
            $slice = [];
            for ($i = $end; $i >= $start; $i--) {
                $slice[] = $i;
            }
        }

        if (empty($slice)) {
            return ['messages' => [], 'total' => $total, 'page' => $page, 'perPage' => $perPage];
        }

        // Obtener encabezados de todos los mensajes de la página en un solo viaje de red IMAP
        // IMAP RFC requiere rangos en orden ascendente 'min:max' o lista ordenada
        $minMsg = min($slice);
        $maxMsg = max($slice);
        $sequence = ($minMsg === $maxMsg) ? (string)$minMsg : "{$minMsg}:{$maxMsg}";
        $overviews = @imap_fetch_overview($this->stream, $sequence, 0);
        if (!is_array($overviews)) {
            $overviews = [];
        }

        // Indexar por msgno para preservar el orden descendente
        $overviewMap = [];
        foreach ($overviews as $ov) {
            $overviewMap[$ov->msgno] = $ov;
        }

        $messages = [];
        foreach ($slice as $msgNum) {
            if (!isset($overviewMap[$msgNum])) continue;
            $ov = $overviewMap[$msgNum];

            $fromRaw = $ov->from ?? '';
            // Parsear remitente
            $fromName = '';
            $fromEmail = '';
            if (preg_match('/(.*)<(.*)>/', $fromRaw, $matches)) {
                $fromName = trim($this->decodeMimeString(trim($matches[1], '"\' ')));
                $fromEmail = trim($matches[2]);
            } else {
                $fromEmail = trim($fromRaw);
                $fromName = explode('@', $fromEmail)[0];
            }

            $subject = isset($ov->subject) ? $this->decodeMimeString($ov->subject) : '(Sin asunto)';
            $date = isset($ov->date) ? date('Y-m-d H:i:s', strtotime($ov->date)) : '';
            $isUnseen = empty($ov->seen);
            $isFlagged = !empty($ov->flagged);
            $messageId = $ov->message_id ?? '';

            $cleanSubject = trim(preg_replace('/^(re|fwd|rv):\s*/i', '', $subject));
            $inReplyTo = $ov->in_reply_to ?? '';
            $references = $ov->references ?? '';

            $messages[] = [
                'msgNum' => $msgNum,
                'uid' => $ov->uid ?? $msgNum,
                'from' => [
                    'name' => $fromName ?: $fromEmail,
                    'email' => $fromEmail
                ],
                'subject' => $subject,
                'cleanSubject' => $cleanSubject,
                'messageId' => $messageId,
                'inReplyTo' => $inReplyTo,
                'references' => $references,
                'date' => $date,
                'unseen' => $isUnseen,
                'flagged' => $isFlagged,
                'snippet' => $subject,
                'hasAttachments' => false
            ];
        }

        return [
            'messages' => $messages,
            'total' => $total,
            'page' => $page,
            'perPage' => $perPage
        ];
    }

    /**
     * Obtiene una tajada de mensajes por rango de números de mensaje (startMsg a endMsg inclusive)
     */
    public function getMessagesSlice(string $folder, int $startMsg, int $endMsg): array {
        $this->connect($folder);
        $total = @imap_num_msg($this->stream);
        if ($total <= 0 || $startMsg > $total || $endMsg < 1) {
            return [];
        }

        $start = max(1, $startMsg);
        $end = min($total, $endMsg);
        if ($start > $end) {
            return [];
        }

        $sequence = "{$start}:{$end}";
        $overviews = @imap_fetch_overview($this->stream, $sequence, 0);
        if (!is_array($overviews)) {
            return [];
        }

        $overviewMap = [];
        foreach ($overviews as $ov) {
            $overviewMap[$ov->msgno] = $ov;
        }

        $messages = [];
        // Orden descendente (de más nuevo a más viejo)
        for ($i = $end; $i >= $start; $i--) {
            if (!isset($overviewMap[$i])) continue;
            $ov = $overviewMap[$i];

            $fromRaw = $ov->from ?? '';
            $fromName = '';
            $fromEmail = '';
            if (preg_match('/(.*)<(.*)>/', $fromRaw, $matches)) {
                $fromName = trim($this->decodeMimeString(trim($matches[1], '"\' ')));
                $fromEmail = trim($matches[2]);
            } else {
                $fromEmail = trim($fromRaw);
                $fromName = explode('@', $fromEmail)[0];
            }

            $subject = isset($ov->subject) ? $this->decodeMimeString($ov->subject) : '(Sin asunto)';
            $date = isset($ov->date) ? date('Y-m-d H:i:s', strtotime($ov->date)) : '';
            $isUnseen = empty($ov->seen);
            $isFlagged = !empty($ov->flagged);
            $messageId = $ov->message_id ?? '';

            $cleanSubject = trim(preg_replace('/^(re|fwd|rv):\s*/i', '', $subject));
            $inReplyTo = $ov->in_reply_to ?? '';
            $references = $ov->references ?? '';

            $messages[] = [
                'msgNum' => $i,
                'uid' => $ov->uid ?? $i,
                'from' => [
                    'name' => $fromName ?: $fromEmail,
                    'email' => $fromEmail
                ],
                'subject' => $subject,
                'cleanSubject' => $cleanSubject,
                'messageId' => $messageId,
                'inReplyTo' => $inReplyTo,
                'references' => $references,
                'date' => $date,
                'unseen' => $isUnseen,
                'flagged' => $isFlagged,
                'snippet' => $subject,
                'hasAttachments' => false
            ];
        }

        return $messages;
    }

    public function getMessageDetail(int $uid, string $folder = 'INBOX'): ?array {
        $this->connect($folder);
        $msgNum = @imap_msgno($this->stream, $uid);
        if (!$msgNum) {
            return null;
        }

        $header = @imap_headerinfo($this->stream, $msgNum);
        $structure = @imap_fetchstructure($this->stream, $msgNum);

        $fromList = [];
        if (!empty($header->from)) {
            foreach ($header->from as $f) {
                $fromList[] = [
                    'name' => isset($f->personal) ? $this->decodeMimeString($f->personal) : '',
                    'email' => ($f->mailbox ?? '') . '@' . ($f->host ?? '')
                ];
            }
        }

        $toList = [];
        if (!empty($header->to)) {
            foreach ($header->to as $t) {
                $toList[] = [
                    'name' => isset($t->personal) ? $this->decodeMimeString($t->personal) : '',
                    'email' => ($t->mailbox ?? '') . '@' . ($t->host ?? '')
                ];
            }
        }

        $ccList = [];
        if (!empty($header->cc)) {
            foreach ($header->cc as $c) {
                $ccList[] = [
                    'name' => isset($c->personal) ? $this->decodeMimeString($c->personal) : '',
                    'email' => ($c->mailbox ?? '') . '@' . ($c->host ?? '')
                ];
            }
        }

        $bodyData = $this->getBodyAndAttachments($uid, $structure);
        $subject = isset($header->subject) ? $this->decodeMimeString($header->subject) : '(Sin asunto)';
        $cleanSubject = trim(preg_replace('/^(re|fwd|rv):\s*/i', '', $subject));

        return [
            'uid' => $uid,
            'msgNum' => $msgNum,
            'messageId' => $header->message_id ?? '',
            'inReplyTo' => $header->in_reply_to ?? '',
            'references' => $header->references ?? '',
            'subject' => $subject,
            'cleanSubject' => $cleanSubject,
            'from' => $fromList[0] ?? ['name' => '', 'email' => ''],
            'to' => $toList,
            'cc' => $ccList,
            'date' => isset($header->date) ? date('r', strtotime($header->date)) : '',
            'html' => $bodyData['html'],
            'plain' => $bodyData['plain'],
            'attachments' => $bodyData['attachments']
        ];
    }

    public function markMessage(int $uid, string $action, string $folder = 'INBOX'): bool {
        $this->connect($folder);
        switch ($action) {
            case 'read':
                @imap_setflag_full($this->stream, (string)$uid, "\\Seen", ST_UID);
                break;
            case 'unread':
                @imap_clearflag_full($this->stream, (string)$uid, "\\Seen", ST_UID);
                break;
            case 'star':
                @imap_setflag_full($this->stream, (string)$uid, "\\Flagged", ST_UID);
                break;
            case 'unstar':
                @imap_clearflag_full($this->stream, (string)$uid, "\\Flagged", ST_UID);
                break;
            case 'trash':
                // En DreamHost es 'INBOX.Trash', en Gmail es '[Gmail]/Trash' o '[Gmail]/Papelera', en otros 'Trash'
                $candidates = ['INBOX.Trash', '[Gmail]/Trash', '[Gmail]/Papelera', 'Trash', 'Papelera'];
                $moved = false;
                foreach ($candidates as $cand) {
                    $moved = @imap_mail_move($this->stream, (string)$uid, $cand, CP_UID);
                    if ($moved) break;
                }
                @imap_expunge($this->stream);
                break;
            case 'restore':
                // Mover desde Papelera de vuelta a 'INBOX'
                $moved = @imap_mail_move($this->stream, (string)$uid, 'INBOX', CP_UID);
                if (!$moved) {
                    $moved = @imap_mail_move($this->stream, (string)$uid, 'INBOX', 0);
                }
                @imap_expunge($this->stream);
                break;
            case 'delete':
                @imap_delete($this->stream, $uid, FT_UID);
                @imap_expunge($this->stream);
                break;
        }
        return true;
    }

    /**
     * Mueve un correo desde la carpeta actual a una carpeta de destino
     */
    public function moveMessage(int $uid, string $fromFolder, string $targetFolder): bool {
        $this->connect($fromFolder);
        $res = @imap_mail_move($this->stream, (string)$uid, $targetFolder, CP_UID);
        @imap_expunge($this->stream);
        return (bool)$res;
    }

    public function getAttachment(int $uid, string $partNum, string $encoding, string $folder = 'INBOX') {
        $this->connect($folder);
        $data = @imap_fetchbody($this->stream, $uid, $partNum, FT_UID);
        return $this->decodeBody($data, (int)$encoding);
    }

    private function getBodyAndAttachments(int $uid, $structure): array {
        $html = '';
        $plain = '';
        $attachments = [];

        if (empty($structure->parts)) {
            // Mensaje simple sin partes
            $data = @imap_body($this->stream, $uid, FT_UID);
            $decoded = $this->decodeBody($data, $structure->encoding ?? 0);
            if ($structure->subtype == 'HTML') {
                $html = $decoded;
            } else {
                $plain = $decoded;
            }
        } else {
            $this->parseParts($uid, $structure->parts, '', $html, $plain, $attachments);
        }

        return [
            'html' => $html,
            'plain' => $plain,
            'attachments' => $attachments
        ];
    }

    private function parseParts(int $uid, array $parts, string $prefix, &$html, &$plain, &$attachments) {
        foreach ($parts as $idx => $part) {
            $partNum = empty($prefix) ? (string)($idx + 1) : $prefix . '.' . ($idx + 1);

            $isAttachment = false;
            $filename = '';

            if ($part->ifdparameters) {
                foreach ($part->dparameters as $param) {
                    if (strtolower($param->attribute) == 'filename') {
                        $isAttachment = true;
                        $filename = $this->decodeMimeString($param->value);
                    }
                }
            }
            if (!$filename && $part->ifparameters) {
                foreach ($part->parameters as $param) {
                    if (strtolower($param->attribute) == 'name') {
                        $isAttachment = true;
                        $filename = $this->decodeMimeString($param->value);
                    }
                }
            }

            if ($isAttachment) {
                $attachments[] = [
                    'part' => $partNum,
                    'filename' => $filename,
                    'size' => $part->bytes ?? 0,
                    'encoding' => $part->encoding ?? 0,
                    'type' => ($part->type ?? 0) . '/' . ($part->subtype ?? '')
                ];
            } else {
                if ($part->type == 0) { // Text
                    $data = @imap_fetchbody($this->stream, $uid, $partNum, FT_UID);
                    $decoded = $this->decodeBody($data, $part->encoding ?? 0);
                    if (strtoupper($part->subtype) == 'HTML') {
                        $html = $decoded;
                    } elseif (strtoupper($part->subtype) == 'PLAIN') {
                        $plain = $decoded;
                    }
                } elseif (!empty($part->parts)) {
                    $this->parseParts($uid, $part->parts, $partNum, $html, $plain, $attachments);
                }
            }
        }
    }

    private function getSnippetPreview(int $msgNum, $structure): string {
        $body = @imap_fetchbody($this->stream, $msgNum, '1');
        if (!$body) {
            $body = @imap_body($this->stream, $msgNum);
        }
        $encoding = 0;
        if (!empty($structure->parts[0]->encoding)) {
            $encoding = $structure->parts[0]->encoding;
        } elseif (!empty($structure->encoding)) {
            $encoding = $structure->encoding;
        }
        $text = strip_tags($this->decodeBody($body, $encoding));
        $clean = trim(preg_replace('/\s+/', ' ', $text));
        return mb_substr($clean, 0, 120, 'UTF-8');
    }

    private function hasAttachments($structure): bool {
        if (!empty($structure->parts)) {
            foreach ($structure->parts as $part) {
                if ($part->ifdparameters || $part->ifdisposition && strtolower($part->disposition) == 'attachment') {
                    return true;
                }
                if (!empty($part->parts) && $this->hasAttachments($part)) {
                    return true;
                }
            }
        }
        return false;
    }

    private function decodeBody($data, int $encoding) {
        switch ($encoding) {
            case 3: return base64_decode($data);
            case 4: return quoted_printable_decode($data);
            default: return $data;
        }
    }

    private function decodeMimeString(string $string): string {
        $elements = @imap_mime_header_decode($string);
        if (!$elements) {
            return $string;
        }
        $result = '';
        foreach ($elements as $element) {
            $charset = $element->charset;
            $text = $element->text;
            if ($charset !== 'default' && $charset !== 'utf-8' && function_exists('mb_convert_encoding')) {
                $text = @mb_convert_encoding($text, 'UTF-8', $charset);
            }
            $result .= $text;
        }
        return $result;
    }

    public function close() {
        if ($this->stream) {
            @imap_close($this->stream);
            $this->stream = null;
        }
    }

    public function __destruct() {
        $this->close();
    }
}
