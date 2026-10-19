<?php
require_once __DIR__ . '/bootstrap.php';

use Advantage\Session;
use Advantage\ImapClient;

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Verificar si hay sesión activa
    $account = Session::getAccount();
    if ($account) {
        // Ocultar contraseña en la respuesta
        unset($account['password']);
        sendJson(['authenticated' => true, 'account' => $account]);
    } else {
        sendJson(['authenticated' => false]);
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = getJsonInput();

    $email = trim($data['email'] ?? '');
    $password = $data['password'] ?? '';
    $displayName = trim($data['display_name'] ?? '');

    // Servidores por defecto para DreamHost
    $imapHost = trim($data['imap_host'] ?? 'imap.dreamhost.com');
    $imapPort = (int)($data['imap_port'] ?? 993);
    $smtpHost = trim($data['smtp_host'] ?? 'smtp.dreamhost.com');
    $smtpPort = (int)($data['smtp_port'] ?? 587);

    if (empty($email) || empty($password)) {
        sendError('Correo electrónico y contraseña requeridos');
    }

    $accountConfig = [
        'email' => $email,
        'password' => $password,
        'display_name' => $displayName ?: explode('@', $email)[0],
        'imap_host' => $imapHost,
        'imap_port' => $imapPort,
        'imap_ssl' => true,
        'smtp_host' => $smtpHost,
        'smtp_port' => $smtpPort,
        'smtp_secure' => ($smtpPort == 465 ? 'ssl' : 'tls')
    ];

    // Probar conexión IMAP
    try {
        $imap = new ImapClient($accountConfig);
        $imap->connect('INBOX');
        $imap->close();
    } catch (\Exception $e) {
        sendError('Error de autenticación con el servidor de correo: ' . $e->getMessage(), 401);
    }

    // Guardar en sesión
    Session::setAccount($accountConfig);
    unset($accountConfig['password']);

    sendJson([
        'success' => true,
        'message' => 'Inicio de sesión exitoso',
        'account' => $accountConfig
    ]);
}

if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    Session::destroy();
    sendJson(['success' => true, 'message' => 'Sesión cerrada']);
}
