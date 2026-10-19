<?php
namespace Advantage;

class Session {
    public static function isHttps(): bool {
        return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
            || (($_SERVER['SERVER_PORT'] ?? '') == 443);
    }

    public static function start() {
        if (session_status() === PHP_SESSION_NONE) {
            ini_set('session.use_strict_mode', '1');
            ini_set('session.use_only_cookies', '1');
            ini_set('session.cookie_httponly', '1');
            session_name('OCTUPASSSID');
            session_set_cookie_params([
                'lifetime' => 0,
                'path' => '/',
                'secure' => self::isHttps(),
                'httponly' => true,
                'samesite' => 'Strict',
            ]);
            session_start();

            // Cierre automático por inactividad
            $timeout = (int)(Security::config()['session_idle_timeout'] ?? 28800);
            if (!empty($_SESSION['last_activity']) && (time() - $_SESSION['last_activity']) > $timeout) {
                $_SESSION = [];
                session_regenerate_id(true);
            }
            $_SESSION['last_activity'] = time();
        }
    }

    public static function setAccount(array $config) {
        self::start();
        // Nueva sesión limpia al iniciar sesión (evita fijación de sesión)
        $_SESSION = ['last_activity' => time()];
        session_regenerate_id(true);

        $_SESSION['mail_account'] = [
            'email' => $config['email'],
            // La contraseña se guarda cifrada (AES-256-GCM), nunca en texto plano
            'password_enc' => Security::encrypt($config['password']),
            'display_name' => $config['display_name'] ?? explode('@', $config['email'])[0],
            'imap_host' => $config['imap_host'],
            'imap_port' => (int)$config['imap_port'],
            'imap_ssl' => true,
            'smtp_host' => $config['smtp_host'],
            'smtp_port' => (int)$config['smtp_port'],
            'smtp_secure' => $config['smtp_secure'] ?? 'tls',
        ];
    }

    public static function getAccount(): ?array {
        self::start();
        $acc = $_SESSION['mail_account'] ?? null;
        if (!$acc || empty($acc['password_enc'])) {
            // Sesiones antiguas (contraseña en texto plano) se invalidan
            if ($acc) {
                unset($_SESSION['mail_account']);
            }
            return null;
        }
        $password = Security::decrypt($acc['password_enc']);
        if ($password === null) {
            unset($_SESSION['mail_account']);
            return null;
        }
        unset($acc['password_enc']);
        $acc['password'] = $password;
        return $acc;
    }

    public static function isAuthenticated(): bool {
        return self::getAccount() !== null;
    }

    public static function destroy() {
        self::start();
        $_SESSION = [];
        if (ini_get("session.use_cookies")) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', [
                'expires' => time() - 42000,
                'path' => $params['path'],
                'domain' => $params['domain'],
                'secure' => $params['secure'],
                'httponly' => $params['httponly'],
                'samesite' => 'Strict',
            ]);
        }
        session_destroy();
    }
}
