<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../vendor/autoload.php';
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
