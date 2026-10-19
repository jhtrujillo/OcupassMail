<?php
namespace Advantage;

use DirectoryTree\ImapEngine\Mailbox;
use DirectoryTree\ImapEngine\Folder;
use DirectoryTree\ImapEngine\FolderInterface;
use DirectoryTree\ImapEngine\Enums\ImapFetchIdentifier;
use DirectoryTree\ImapEngine\MessageParser;

class ImapClient {
    private ?Mailbox $mailbox = null;
    private array $account;
    private string $currentFolder = 'INBOX';
    private ?FolderInterface $folderObj = null;

    public function __construct(array $account) {
        $this->account = $account;
    }

    public function connect(string $folder = 'INBOX'): bool {
        if ($this->mailbox && $this->mailbox->connected()) {
            if ($this->currentFolder === $folder && $this->folderObj) {
                return true;
            }
            $this->selectFolder($folder);
            return true;
        }

        $config = [
            'host' => $this->account['imap_host'],
            'port' => (int)($this->account['imap_port'] ?? 993),
            'encryption' => !empty($this->account['imap_ssl']) ? 'ssl' : 'none',
            'validate_cert' => !empty(Security::config()['validate_cert']),
            'username' => $this->account['email'],
            'password' => $this->account['password'],
            'timeout' => 30,
        ];

        try {
            $this->mailbox = new Mailbox($config);
            $this->mailbox->connect();
        } catch (\Throwable $e) {
            $this->mailbox = null;
            throw new \Exception('Error al conectar con IMAP: ' . $e->getMessage(), (int)$e->getCode(), $e);
        }

        $this->selectFolder($folder);
        return true;
    }

    private function selectFolder(string $folder): void {
        $this->currentFolder = $folder;
        if (!$this->mailbox || !$this->mailbox->connected()) {
            return;
        }

        try {
            $this->folderObj = $this->mailbox->folders()->find($folder);
            if (!$this->folderObj) {
                $this->folderObj = new Folder($this->mailbox, $folder);
            }
            $this->mailbox->select($this->folderObj);
        } catch (\Throwable $e) {
            try {
                $this->mailbox->connection()->select($folder);
                $this->folderObj = new Folder($this->mailbox, $folder);
            } catch (\Throwable $ex) {
                // Silenciar o registrar si la carpeta no existe
            }
        }
    }

    public function getNumMsg(string $folder = 'INBOX'): int {
        if (!$this->mailbox || !$this->mailbox->connected()) {
            $this->connect($folder);
        } elseif ($this->currentFolder !== $folder) {
            $this->selectFolder($folder);
        }

        try {
            $status = $this->folderObj ? $this->folderObj->status() : $this->mailbox->connection()->status($folder);
            if (is_array($status) && isset($status['MESSAGES'])) {
                return (int)$status['MESSAGES'];
            }
        } catch (\Throwable $e) {
            try {
                if ($this->folderObj) {
                    return $this->folderObj->messages()->count();
                }
            } catch (\Throwable $e2) {}
        }
        return 0;
    }

    public function getStream() {
        return $this->mailbox;
    }

    public function getMailbox(): ?Mailbox {
        return $this->mailbox;
    }

    public function appendMessage(string $folder, string $rawMime, string $options = "\\Seen"): bool {
        $this->connect($folder);
        $flags = array_filter(array_map('trim', explode(' ', $options)));
        try {
            $this->mailbox->connection()->append($folder, $rawMime, $flags);
            return true;
        } catch (\Throwable $e) {
            error_log('[OctupassMail] Error in appendMessage: ' . $e->getMessage());
            return false;
        }
    }

    public function createFolder(string $folderName): bool {
        if (!$this->mailbox || !$this->mailbox->connected()) {
            $this->connect('INBOX');
        }
        try {
            $this->mailbox->folders()->create($folderName);
            return true;
        } catch (\Throwable $e) {
            error_log('[OctupassMail] Error in createFolder: ' . $e->getMessage());
            return false;
        }
    }

    public function getFolders(): array {
        if (!$this->mailbox || !$this->mailbox->connected()) {
            $this->connect('INBOX');
        }

        $folders = [];
        try {
            $list = $this->mailbox->folders()->get('*');
            foreach ($list as $folder) {
                $rawName = $folder->path();
                $cleanName = preg_replace('/^INBOX\./i', '', $rawName);

                $friendlyName = $cleanName;
                $type = 'custom';
                $icon = 'folder';

                if (strcasecmp($cleanName, 'INBOX') === 0 || strcasecmp($rawName, 'INBOX') === 0) {
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

                $unseen = 0;
                $messages = 0;

                // Evitar pedir status en carpetas marcadas como \NoSelect
                $flags = $folder->flags();
                $noSelect = false;
                foreach ($flags as $f) {
                    if (strcasecmp($f, '\\NoSelect') === 0) {
                        $noSelect = true;
                        break;
                    }
                }

                if (!$noSelect) {
                    try {
                        $st = $folder->status();
                        $unseen = (int)($st['UNSEEN'] ?? 0);
                        $messages = (int)($st['MESSAGES'] ?? 0);
                    } catch (\Throwable $e) {}
                }

                $folders[] = [
                    'id' => $rawName,
                    'raw' => $rawName,
                    'name' => $friendlyName,
                    'type' => $type,
                    'icon' => $icon,
                    'unseen' => $unseen,
                    'total' => $messages
                ];
            }
        } catch (\Throwable $e) {
            error_log('[OctupassMail] Error in getFolders: ' . $e->getMessage());
        }

        return $folders;
    }

    public function getMessages(string $folder = 'INBOX', int $page = 1, int $perPage = 25, string $search = ''): array {
        $this->connect($folder);

        if (!empty($search)) {
            $search = mb_substr(str_replace(["\r", "\n", "\0", '"', '\\'], ' ', $search), 0, 200);
            try {
                $folderObj = $this->folderObj ?: new Folder($this->mailbox, $folder);
                $query = $folderObj->messages()->whereText($search);
                $allUids = $query->get()->map(fn($m) => $m->uid())->all();
                rsort($allUids);
                $total = count($allUids);
                $sliceUids = array_slice($allUids, ($page - 1) * $perPage, $perPage);
                if (empty($sliceUids)) {
                    return ['messages' => [], 'total' => $total, 'page' => $page, 'perPage' => $perPage];
                }

                $messagesObj = $folderObj->messages()->withHeaders()->withFlags()->whereKey($sliceUids)->get();
                $messages = [];
                foreach ($messagesObj as $m) {
                    $parsed = $m->parse();
                    $fromParts = $parsed->getHeader('From')?->getParts() ?? [];
                    $fromName = !empty($fromParts) ? ($fromParts[0]->getName() ?? '') : '';
                    $fromEmail = !empty($fromParts) ? ($fromParts[0]->getEmail() ?? '') : '';
                    $subject = $m->subject() ?: '(Sin asunto)';
                    $cleanSubject = trim(preg_replace('/^(re|fwd|rv):\s*/i', '', $subject));
                    $dateStr = $m->date() ? $m->date()->format('Y-m-d H:i:s') : '';

                    $messages[] = [
                        'msgNum' => $m->uid(),
                        'uid' => $m->uid(),
                        'from' => [
                            'name' => $fromName ?: $fromEmail,
                            'email' => $fromEmail
                        ],
                        'subject' => $subject,
                        'cleanSubject' => $cleanSubject,
                        'messageId' => $m->messageId() ?? '',
                        'inReplyTo' => implode(', ', $m->inReplyTo() ?? []),
                        'references' => $parsed->getHeaderValue('References') ?? '',
                        'date' => $dateStr,
                        'unseen' => !$m->seen(),
                        'flagged' => $m->flagged(),
                        'snippet' => $subject,
                        'hasAttachments' => $m->hasAttachments()
                    ];
                }

                return ['messages' => $messages, 'total' => $total, 'page' => $page, 'perPage' => $perPage];
            } catch (\Throwable $e) {
                error_log('[OctupassMail] Error in search getMessages: ' . $e->getMessage());
                return ['messages' => [], 'total' => 0, 'page' => $page, 'perPage' => $perPage];
            }
        }

        $total = $this->getNumMsg($folder);
        if ($total <= 0) {
            return ['messages' => [], 'total' => 0, 'page' => $page, 'perPage' => $perPage];
        }

        $start = max(1, $total - ($page * $perPage) + 1);
        $end = max(1, $total - (($page - 1) * $perPage));
        if ($start > $end) {
            return ['messages' => [], 'total' => $total, 'page' => $page, 'perPage' => $perPage];
        }

        $slice = $this->getMessagesSlice($folder, $start, $end);
        return [
            'messages' => $slice,
            'total' => $total,
            'page' => $page,
            'perPage' => $perPage
        ];
    }

    public function getMessagesSlice(string $folder, int $startMsg, int $endMsg): array {
        $this->connect($folder);
        $total = $this->getNumMsg($folder);
        if ($total <= 0 || $startMsg > $total || $endMsg < 1) {
            return [];
        }

        $start = max(1, $startMsg);
        $end = min($total, $endMsg);
        if ($start > $end) {
            return [];
        }

        try {
            $responses = $this->mailbox->connection()->fetch(
                ['UID', 'FLAGS', 'BODY.PEEK[HEADER]'],
                $start,
                $end,
                ImapFetchIdentifier::MessageNumber
            );

            $messages = [];
            foreach ($responses as $response) {
                $msgNum = (int)$response->tokenAt(1)->value;
                $data = $response->tokenAt(3);
                if (!$data) continue;

                $uid = (int)($data->lookup('UID')?->value ?? $msgNum);
                $flags = $data->lookup('FLAGS')?->values() ?? [];
                $isUnseen = !in_array('\\Seen', $flags, true);
                $isFlagged = in_array('\\Flagged', $flags, true);
                $headRaw = $data->lookup('[HEADER]')?->value ?? '';

                $parsed = !empty($headRaw) ? MessageParser::parse($headRaw) : null;
                $subject = $parsed ? ($parsed->getHeaderValue('Subject') ?? '(Sin asunto)') : '(Sin asunto)';
                $cleanSubject = trim(preg_replace('/^(re|fwd|rv):\s*/i', '', $subject));

                $fromName = '';
                $fromEmail = '';
                if ($parsed) {
                    $fromParts = $parsed->getHeader('From')?->getParts() ?? [];
                    if (!empty($fromParts)) {
                        $fromName = $fromParts[0]->getName() ?? '';
                        $fromEmail = $fromParts[0]->getEmail() ?? '';
                    }
                }
                if (empty($fromEmail)) {
                    $fromEmail = $this->account['email'];
                }

                $dateStr = '';
                if ($parsed && ($dateH = $parsed->getHeader('Date'))) {
                    $ts = strtotime($dateH->getValue());
                    $dateStr = $ts ? date('Y-m-d H:i:s', $ts) : '';
                }

                $messages[$msgNum] = [
                    'msgNum' => $msgNum,
                    'uid' => $uid,
                    'from' => [
                        'name' => $fromName ?: $fromEmail,
                        'email' => $fromEmail
                    ],
                    'subject' => $subject,
                    'cleanSubject' => $cleanSubject,
                    'messageId' => $parsed ? ($parsed->getHeaderValue('Message-ID') ?? '') : '',
                    'inReplyTo' => $parsed ? ($parsed->getHeaderValue('In-Reply-To') ?? '') : '',
                    'references' => $parsed ? ($parsed->getHeaderValue('References') ?? '') : '',
                    'date' => $dateStr,
                    'unseen' => $isUnseen,
                    'flagged' => $isFlagged,
                    'snippet' => $subject,
                    'hasAttachments' => false
                ];
            }

            // Orden descendente (de mayor msgNum al menor)
            krsort($messages);
            return array_values($messages);
        } catch (\Throwable $e) {
            error_log('[OctupassMail] Error in getMessagesSlice: ' . $e->getMessage());
            return [];
        }
    }

    public function getMessageDetail(int $uid, string $folder = 'INBOX'): ?array {
        $this->connect($folder);
        $folderObj = $this->folderObj ?: new Folder($this->mailbox, $folder);

        try {
            $message = $folderObj->messages()->withHeaders()->withBody()->find($uid);
            if (!$message) {
                return null;
            }

            $parsed = $message->parse();

            $fromParts = $parsed->getHeader('From')?->getParts() ?? [];
            $from = [
                'name' => isset($fromParts[0]) ? ($fromParts[0]->getName() ?? '') : '',
                'email' => isset($fromParts[0]) ? ($fromParts[0]->getEmail() ?? '') : '',
            ];

            $toParts = $parsed->getHeader('To')?->getParts() ?? [];
            $toList = [];
            foreach ($toParts as $p) {
                $toList[] = [
                    'name' => $p->getName() ?? '',
                    'email' => $p->getEmail() ?? ''
                ];
            }

            $ccParts = $parsed->getHeader('Cc')?->getParts() ?? [];
            $ccList = [];
            foreach ($ccParts as $p) {
                $ccList[] = [
                    'name' => $p->getName() ?? '',
                    'email' => $p->getEmail() ?? ''
                ];
            }

            $subject = $parsed->getHeaderValue('Subject') ?? '(Sin asunto)';
            $cleanSubject = trim(preg_replace('/^(re|fwd|rv):\s*/i', '', $subject));
            $dateHeader = $parsed->getHeader('Date');
            $date = $dateHeader ? date('r', strtotime($dateHeader->getValue())) : '';

            $html = $parsed->getHtmlContent() ?? '';
            $plain = $parsed->getTextContent() ?? '';

            // Adjuntos
            $attachments = [];
            $allParts = $parsed->getAllAttachmentParts();
            foreach ($allParts as $idx => $part) {
                $fn = $part->getFilename() ?: ('adjunto_' . ($idx + 1));
                $stream = $part->getContentStream();
                $size = $stream ? $stream->getSize() : 0;
                $attachments[] = [
                    'part' => (string)$idx,
                    'filename' => $fn,
                    'size' => $size ?: 0,
                    'encoding' => 0,
                    'type' => $part->getContentType() ?: 'application/octet-stream'
                ];
            }

            return [
                'uid' => $uid,
                'msgNum' => $message->uid(),
                'messageId' => $parsed->getHeaderValue('Message-ID') ?? '',
                'inReplyTo' => $parsed->getHeaderValue('In-Reply-To') ?? '',
                'references' => $parsed->getHeaderValue('References') ?? '',
                'subject' => $subject,
                'cleanSubject' => $cleanSubject,
                'from' => $from,
                'to' => $toList,
                'cc' => $ccList,
                'date' => $date,
                'html' => $html,
                'plain' => $plain,
                'attachments' => $attachments
            ];
        } catch (\Throwable $e) {
            error_log('[OctupassMail] Error in getMessageDetail: ' . $e->getMessage());
            return null;
        }
    }

    public function markMessage(int $uid, string $action, string $folder = 'INBOX'): bool {
        $this->connect($folder);
        $conn = $this->mailbox->connection();

        try {
            switch ($action) {
                case 'read':
                    $conn->store(['\\Seen'], (array)$uid, mode: '+');
                    break;
                case 'unread':
                    $conn->store(['\\Seen'], (array)$uid, mode: '-');
                    break;
                case 'star':
                    $conn->store(['\\Flagged'], (array)$uid, mode: '+');
                    break;
                case 'unstar':
                    $conn->store(['\\Flagged'], (array)$uid, mode: '-');
                    break;
                case 'trash':
                    $candidates = ['INBOX.Trash', '[Gmail]/Trash', '[Gmail]/Papelera', 'Trash', 'Papelera'];
                    $moved = false;
                    foreach ($candidates as $cand) {
                        try {
                            $conn->move($cand, (array)$uid);
                            $moved = true;
                            break;
                        } catch (\Throwable $e) {
                            try {
                                $conn->copy($cand, (array)$uid);
                                $conn->store(['\\Deleted'], (array)$uid, mode: '+');
                                $moved = true;
                                break;
                            } catch (\Throwable $e2) {}
                        }
                    }
                    $conn->expunge();
                    break;
                case 'restore':
                    try {
                        $conn->move('INBOX', (array)$uid);
                    } catch (\Throwable $e) {
                        $conn->copy('INBOX', (array)$uid);
                        $conn->store(['\\Deleted'], (array)$uid, mode: '+');
                    }
                    $conn->expunge();
                    break;
                case 'delete':
                    $conn->store(['\\Deleted'], (array)$uid, mode: '+');
                    $conn->expunge();
                    break;
            }
            return true;
        } catch (\Throwable $e) {
            error_log('[OctupassMail] Error in markMessage: ' . $e->getMessage());
            return false;
        }
    }

    public function moveMessage(int $uid, string $fromFolder, string $targetFolder): bool {
        $this->connect($fromFolder);
        $conn = $this->mailbox->connection();
        try {
            try {
                $conn->move($targetFolder, (array)$uid);
            } catch (\Throwable $e) {
                $conn->copy($targetFolder, (array)$uid);
                $conn->store(['\\Deleted'], (array)$uid, mode: '+');
            }
            $conn->expunge();
            return true;
        } catch (\Throwable $e) {
            error_log('[OctupassMail] Error in moveMessage: ' . $e->getMessage());
            return false;
        }
    }

    public function getAttachment(int $uid, string $partNum, string $encoding, string $folder = 'INBOX') {
        $this->connect($folder);
        $folderObj = $this->folderObj ?: new Folder($this->mailbox, $folder);

        try {
            $message = $folderObj->messages()->withBody()->find($uid);
            if (!$message) {
                return false;
            }

            $parsed = $message->parse();
            $allParts = $parsed->getAllAttachmentParts();

            // 1. Intentar coincidencia por índice numérico
            if (isset($allParts[(int)$partNum])) {
                return $allParts[(int)$partNum]->getContent();
            }

            // 2. Intentar coincidencia por nombre de archivo
            foreach ($allParts as $p) {
                if ($p->getFilename() === $partNum) {
                    return $p->getContent();
                }
            }

            // 3. Si solo hay 1 archivo adjunto, entregarlo
            if (count($allParts) === 1) {
                return $allParts[0]->getContent();
            }

            return false;
        } catch (\Throwable $e) {
            error_log('[OctupassMail] Error in getAttachment: ' . $e->getMessage());
            return false;
        }
    }

    public function close(): void {
        if ($this->mailbox) {
            try {
                $this->mailbox->disconnect();
            } catch (\Throwable $e) {}
            $this->mailbox = null;
            $this->folderObj = null;
        }
    }

    public function __destruct() {
        $this->close();
    }
}
