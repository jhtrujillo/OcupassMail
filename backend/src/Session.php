<?php
namespace Advantage;

class Session {
    public static function start() {
        if (session_status() === PHP_SESSION_NONE) {
            ini_set('session.cookie_httponly', 1);
            ini_set('session.use_only_cookies', 1);
            session_start();
        }
    }

    public static function setAccount(array $config) {
        self::start();
        $_SESSION['mail_account'] = [
            'email' => $config['email'],
            'password' => $config['password'],
            'display_name' => $config['display_name'] ?? explode('@', $config['email'])[0],
            'imap_host' => $config['imap_host'] ?? 'imap.dreamhost.com',
            'imap_port' => (int)($config['imap_port'] ?? 993),
            'imap_ssl' => (bool)($config['imap_ssl'] ?? true),
            'smtp_host' => $config['smtp_host'] ?? 'smtp.dreamhost.com',
            'smtp_port' => (int)($config['smtp_port'] ?? 587),
            'smtp_secure' => $config['smtp_secure'] ?? 'tls', // 'tls' or 'ssl'
        ];
    }

    public static function getAccount(): ?array {
        self::start();
        return $_SESSION['mail_account'] ?? null;
    }

    public static function isAuthenticated(): bool {
        return self::getAccount() !== null;
    }

    public static function destroy() {
        self::start();
        $_SESSION = [];
        if (ini_get("session.use_cookies")) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000,
                $params["path"], $params["domain"],
                $params["secure"], $params["httponly"]
            );
        }
        session_destroy();
    }
}
