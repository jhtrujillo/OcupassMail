<?php
/**
 * Configuración del servidor de Octupass Mail.
 *
 * IMPORTANTE: los servidores IMAP/SMTP se definen SOLO aquí. El navegador ya no
 * puede elegir a qué servidor conectarse (eso permitía suplantar cuentas).
 */
return [
    // Proveedores de correo permitidos
    'providers' => [
        'dreamhost' => [
            'imap_host' => 'imap.dreamhost.com',
            'imap_port' => 993,
            'smtp_host' => 'smtp.dreamhost.com',
            'smtp_port' => 587,
            'smtp_secure' => 'tls',
        ],
        'gmail' => [
            'imap_host' => 'imap.gmail.com',
            'imap_port' => 993,
            'smtp_host' => 'smtp.gmail.com',
            'smtp_port' => 465,
            'smtp_secure' => 'ssl',
        ],
    ],

    // Dominio de correo => proveedor. Los dominios no listados usan 'default_provider'.
    'domain_providers' => [
        'gmail.com' => 'gmail',
        'googlemail.com' => 'gmail',
    ],
    'default_provider' => 'dreamhost',

    // Si no está vacío, SOLO estos dominios pueden iniciar sesión.
    // Ejemplo: ['gytc.com.co', 'advantascience.com']
    'allowed_domains' => [],

    // Validar certificados TLS de IMAP (déjalo en true en producción).
    'validate_cert' => true,

    // PIN maestro de la bóveda de auditoría, guardado como HASH (nunca en texto plano).
    // Para generarlo:  php -r "echo password_hash('TU_PIN_LARGO', PASSWORD_DEFAULT), PHP_EOL;"
    // Si se deja vacío, la bóveda solo se desbloquea con la contraseña del buzón.
    'vault_pin_hash' => '',

    // Carpeta privada para bases SQLite, llave de cifrado y contadores de intentos.
    // Recomendado en DreamHost: una carpeta FUERA de la raíz web, ej. '/home/usuario/octupass_data'
    'data_dir' => __DIR__ . '/data',

    // Cierre de sesión automático por inactividad (segundos)
    'session_idle_timeout' => 8 * 3600,
];
