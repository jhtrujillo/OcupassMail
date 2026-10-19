<?php
namespace Advantage;

/**
 * Utilidades de seguridad: configuración, cifrado, límite de intentos y logs.
 */
class Security {
    private static ?array $config = null;

    public static function config(): array {
        if (self::$config === null) {
            self::$config = require __DIR__ . '/../config.php';
        }
        return self::$config;
    }

    public static function dataDir(): string {
        $dir = rtrim(self::config()['data_dir'], '/');
        if (!is_dir($dir)) {
            @mkdir($dir, 0700, true);
        }
        if (!file_exists($dir . '/.htaccess')) {
            @file_put_contents($dir . '/.htaccess', "<IfModule mod_authz_core.c>\n    Require all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\n    Order deny,allow\n    Deny from all\n</IfModule>\n");
        }
        return $dir;
    }

    /** Resuelve el servidor de correo a partir del dominio del email (nunca del cliente). */
    public static function resolveProvider(string $email): ?array {
        $cfg = self::config();
        $domain = strtolower(substr(strrchr($email, '@') ?: '', 1));
        if ($domain === '') {
            return null;
        }
        if (!empty($cfg['allowed_domains']) && !in_array($domain, array_map('strtolower', $cfg['allowed_domains']), true)) {
            return null;
        }
        $key = $cfg['domain_providers'][$domain] ?? $cfg['default_provider'];
        return $cfg['providers'][$key] ?? null;
    }

    /** Cadena de servidor IMAP para c-client, con validación de certificado. */
    public static function imapRef(array $account): string {
        $flags = !empty(self::config()['validate_cert']) ? '/imap/ssl/validate-cert' : '/imap/ssl/novalidate-cert';
        return '{' . $account['imap_host'] . ':' . (int)$account['imap_port'] . $flags . '}';
    }

    /** Llave de cifrado de 32 bytes guardada en la carpeta privada. */
    private static function key(): string {
        $file = self::dataDir() . '/.app_key';
        if (!file_exists($file)) {
            $key = random_bytes(32);
            @file_put_contents($file, base64_encode($key), LOCK_EX);
            @chmod($file, 0600);
        }
        $key = base64_decode((string)@file_get_contents($file), true);
        if ($key === false || strlen($key) !== 32) {
            throw new \RuntimeException('Llave de cifrado inválida');
        }
        return $key;
    }

    public static function encrypt(string $plain): string {
        $iv = random_bytes(12);
        $tag = '';
        $cipher = openssl_encrypt($plain, 'aes-256-gcm', self::key(), OPENSSL_RAW_DATA, $iv, $tag);
        return base64_encode($iv . $tag . $cipher);
    }

    public static function decrypt(string $payload): ?string {
        $raw = base64_decode($payload, true);
        if ($raw === false || strlen($raw) < 29) {
            return null;
        }
        $plain = openssl_decrypt(substr($raw, 28), 'aes-256-gcm', self::key(), OPENSSL_RAW_DATA, substr($raw, 0, 12), substr($raw, 12, 16));
        return $plain === false ? null : $plain;
    }

    /** IP real del cliente (no se confía en X-Forwarded-For, que el cliente puede falsificar). */
    public static function clientIp(): string {
        return $_SERVER['REMOTE_ADDR'] ?? '';
    }

    /**
     * Límite de intentos fallidos. Devuelve segundos de espera restantes (0 = permitido).
     */
    public static function rateLimitWait(string $bucket, int $max, int $window): int {
        $data = self::readAttempts($bucket);
        $now = time();
        $data = array_values(array_filter($data, fn($t) => $t > $now - $window));
        if (count($data) >= $max) {
            return max(1, $window - ($now - min($data)));
        }
        return 0;
    }

    public static function rateLimitHit(string $bucket): void {
        $file = self::attemptsFile($bucket);
        $data = self::readAttempts($bucket);
        $data[] = time();
        $data = array_slice($data, -50);
        @file_put_contents($file, json_encode($data), LOCK_EX);
    }

    public static function rateLimitReset(string $bucket): void {
        @unlink(self::attemptsFile($bucket));
    }

    private static function attemptsFile(string $bucket): string {
        $dir = self::dataDir() . '/ratelimit';
        if (!is_dir($dir)) {
            @mkdir($dir, 0700, true);
        }
        return $dir . '/' . hash('sha256', $bucket) . '.json';
    }

    private static function readAttempts(string $bucket): array {
        $file = self::attemptsFile($bucket);
        if (!file_exists($file)) {
            return [];
        }
        $d = json_decode((string)@file_get_contents($file), true);
        return is_array($d) ? $d : [];
    }

    /** Quita saltos de línea para evitar inyección de cabeceras. */
    public static function oneLine(?string $value): string {
        return trim(str_replace(["\r", "\n", "\0"], ' ', (string)$value));
    }

    /** Nombre de archivo seguro para Content-Disposition. */
    public static function safeFilename(?string $name): string {
        $name = basename(self::oneLine($name));
        $name = str_replace(['"', '\\', '/'], '_', $name);
        return $name !== '' ? $name : 'archivo';
    }
}
