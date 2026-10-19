<?php
// Sin CORS: el frontend y la API viven en el mismo dominio.
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('Referrer-Policy: no-referrer');
header('Cache-Control: no-store, private');

require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../src/Security.php';
require_once __DIR__ . '/../src/Session.php';
require_once __DIR__ . '/../src/Database.php';
require_once __DIR__ . '/../src/ImapClient.php';
require_once __DIR__ . '/../src/SmtpClient.php';
require_once __DIR__ . '/../src/AuditVault.php';
require_once __DIR__ . '/../src/MimeBuilder.php';

use Advantage\Session;

function sendJson($data, int $code = 200) {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function sendError(string $message, int $code = 400) {
    sendJson(['error' => true, 'message' => $message], $code);
}

/** Registra el detalle técnico en el log del servidor y devuelve un mensaje genérico. */
function sendServerError(string $publicMessage, \Throwable $e, int $code = 500) {
    error_log('[OctupassMail] ' . $publicMessage . ' :: ' . $e->getMessage());
    sendError($publicMessage, $code);
}

// Protección CSRF: toda petición que modifica datos debe venir de nuestra propia app.
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if (!in_array($method, ['GET', 'HEAD'], true)) {
    if (($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'OctupassMail') {
        sendError('Solicitud no permitida', 403);
    }
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '') {
        $originHost = parse_url($origin, PHP_URL_HOST) . (parse_url($origin, PHP_URL_PORT) ? ':' . parse_url($origin, PHP_URL_PORT) : '');
        if (strcasecmp($originHost, $_SERVER['HTTP_HOST'] ?? '') !== 0) {
            sendError('Origen no permitido', 403);
        }
    }
}

function requireAuth(): array {
    $account = Session::getAccount();
    if (!$account) {
        sendError('No autenticado. Por favor inicia sesión con tu cuenta corporativa.', 401);
    }
    return $account;
}

function getJsonInput(): array {
    $raw = file_get_contents('php://input');
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}
