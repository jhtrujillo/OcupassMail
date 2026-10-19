<?php
require_once __DIR__ . '/bootstrap.php';

use Advantage\Database;
use Advantage\ImapClient;

$account = requireAuth();
$email = $account['email'];
$pdo = Database::getConnection();

// GET: Listar contactos (de la BD + auto-extraídos del historial)
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $contacts = [];

    // 1. Obtener los contactos guardados en la base de datos SQLite del buzón
    if ($pdo) {
        $stmt = $pdo->prepare("SELECT id, name, email, phone, company, notes FROM contacts ORDER BY name ASC");
        $stmt->execute();
        $contacts = $stmt->fetchAll();
    }

    // 2. Si hay pocos contactos en BD, complementar automáticamente con los remitentes recientes de la bandeja
    $indexed = [];
    foreach ($contacts as $c) {
        $indexed[strtolower($c['email'])] = true;
    }

    try {
        $imap = new ImapClient($account);
        $imap->connect('INBOX');
        $result = $imap->getMessages('INBOX', 1, 30);
        $imap->close();

        foreach ($result['messages'] as $msg) {
            $fromEmail = strtolower($msg['from']['email'] ?? '');
            $fromName = $msg['from']['name'] ?? '';
            if ($fromEmail && filter_var($fromEmail, FILTER_VALIDATE_EMAIL) && !isset($indexed[$fromEmail])) {
                $contacts[] = [
                    'id' => null,
                    'name' => $fromName ?: explode('@', $fromEmail)[0],
                    'email' => $fromEmail,
                    'phone' => '',
                    'company' => '',
                    'notes' => 'Detectado del buzón'
                ];
                $indexed[$fromEmail] = true;
            }
        }
    } catch (\Exception $e) {
        // Ignorar fallo de IMAP si ya hay contactos
    }

    sendJson(['contacts' => $contacts]);
}

// POST: Crear o actualizar contacto
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = getJsonInput();
    $contactName = trim($data['name'] ?? '');
    $contactEmail = trim($data['email'] ?? '');
    $phone = trim($data['phone'] ?? '');
    $company = trim($data['company'] ?? '');
    $notes = trim($data['notes'] ?? '');

    if (empty($contactName) || empty($contactEmail) || !filter_var($contactEmail, FILTER_VALIDATE_EMAIL)) {
        sendError('Nombre y correo electrónico válido requeridos');
    }

    if (!$pdo) {
        sendError('Base de datos no disponible');
    }

    try {
        $stmt = $pdo->prepare("
            INSERT INTO contacts (name, email, phone, company, notes)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(email) DO UPDATE SET 
                name = excluded.name,
                phone = excluded.phone,
                company = excluded.company,
                notes = excluded.notes
        ");
        $stmt->execute([$contactName, $contactEmail, $phone, $company, $notes]);

        sendJson(['success' => true, 'message' => "Contacto '{$contactName}' guardado exitosamente"]);
    } catch (\Exception $e) {
        sendServerError('Error al guardar el contacto', $e);
    }
}

// DELETE: Eliminar contacto
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $id = (int)($_GET['id'] ?? 0);
    if (!$id || !$pdo) {
        sendError('ID de contacto inválido');
    }

    try {
        $stmt = $pdo->prepare("DELETE FROM contacts WHERE id = ?");
        $stmt->execute([$id]);

        sendJson(['success' => true, 'message' => 'Contacto eliminado']);
    } catch (\Exception $e) {
        sendServerError('Error al eliminar el contacto', $e);
    }
}
