<?php
require_once __DIR__ . '/bootstrap.php';

use Advantage\Session;
use Advantage\Security;
use Advantage\ImapClient;

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Verificar si hay sesión activa
    $account = Session::getAccount();
    if ($account) {
        unset($account['password']);
        sendJson(['authenticated' => true, 'account' => $account]);
    } else {
        sendJson(['authenticated' => false]);
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = getJsonInput();

    $email = strtolower(trim($data['email'] ?? ''));
    $password = (string)($data['password'] ?? '');
    $displayName = Security::oneLine(mb_substr(trim($data['display_name'] ?? ''), 0, 80));

    if (empty($email) || $password === '') {
        sendError('Correo electrónico y contraseña requeridos');
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        sendError('Correo electrónico inválido');
    }

    // Límite de intentos: 5 por cuenta y 20 por IP cada 15 minutos
    $ip = Security::clientIp();
    $wait = max(
        Security::rateLimitWait('login:email:' . $email, 5, 900),
        Security::rateLimitWait('login:ip:' . $ip, 20, 900)
    );
    if ($wait > 0) {
        sendError('Demasiados intentos fallidos. Intenta de nuevo en ' . ceil($wait / 60) . ' minuto(s).', 429);
    }

    // El servidor de correo se decide en el backend según el dominio.
    // Los campos imap_host / smtp_host que envíe el navegador se ignoran.
    $provider = Security::resolveProvider($email);
    if (!$provider) {
        sendError('Este dominio de correo no está habilitado en este webmail.', 403);
    }

    $accountConfig = array_merge($provider, [
        'email' => $email,
        'password' => $password,
        'display_name' => $displayName ?: explode('@', $email)[0],
        'imap_ssl' => true,
    ]);

    // Probar conexión IMAP
    try {
        $imap = new ImapClient($accountConfig);
        $imap->connect('INBOX');
        $imap->close();
    } catch (\Exception $e) {
        Security::rateLimitHit('login:email:' . $email);
        Security::rateLimitHit('login:ip:' . $ip);
        error_log('[OctupassMail] Login fallido para ' . $email . ' desde ' . $ip . ' :: ' . $e->getMessage());
        sendError('Correo o contraseña incorrectos, o el servidor de correo no está disponible.', 401);
    }

    Security::rateLimitReset('login:email:' . $email);

    // Guardar en sesión (contraseña cifrada, ID de sesión regenerado)
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

sendError('Método no permitido', 405);
