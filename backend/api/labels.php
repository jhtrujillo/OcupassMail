<?php
require_once __DIR__ . '/bootstrap.php';

use Advantage\Database;

$account = requireAuth();
$pdo = Database::getConnection();

if (!$pdo) {
    sendError('Base de datos no disponible', 500);
}

$action = $_GET['action'] ?? ($_POST['action'] ?? 'list');

// 1. Listar todas las etiquetas del usuario
if ($action === 'list') {
    $stmt = $pdo->query("
        SELECT l.*, COUNT(el.id) as count 
        FROM labels l
        LEFT JOIN email_labels el ON l.id = el.label_id
        GROUP BY l.id
        ORDER BY l.name ASC
    ");
    $labels = $stmt->fetchAll(PDO::FETCH_ASSOC);
    sendJson(['labels' => $labels]);
}

// 2. Crear nueva etiqueta
if ($action === 'create' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = getJsonInput();
    $name = mb_substr(trim($input['name'] ?? ''), 0, 60);
    $color = trim($input['color'] ?? '#3b82f6');
    if (!preg_match('/^#[0-9a-fA-F]{3,8}$/', $color)) {
        $color = '#3b82f6';
    }

    if (empty($name)) {
        sendError('El nombre de la etiqueta es requerido');
    }

    try {
        $stmt = $pdo->prepare("INSERT INTO labels (name, color) VALUES (?, ?)");
        $stmt->execute([$name, $color]);
        $id = $pdo->lastInsertId();
        sendJson(['success' => true, 'label' => ['id' => (int)$id, 'name' => $name, 'color' => $color, 'count' => 0]]);
    } catch (\Exception $e) {
        error_log('[OctupassMail] Crear etiqueta: ' . $e->getMessage());
        sendError('Ya existe una etiqueta con este nombre o hubo un error');
    }
}

// 3. Eliminar etiqueta
if ($action === 'delete' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = getJsonInput();
    $id = (int)($input['id'] ?? 0);
    if (!$id) {
        sendError('ID de etiqueta requerido');
    }
    $pdo->prepare("DELETE FROM labels WHERE id = ?")->execute([$id]);
    sendJson(['success' => true]);
}

// 4. Asignar o quitar etiqueta a una conversación (por clean_subject)
if ($action === 'toggle' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = getJsonInput();
    $cleanSubject = trim($input['clean_subject'] ?? '');
    $labelId = (int)($input['label_id'] ?? 0);

    if (empty($cleanSubject) || !$labelId) {
        sendError('Asunto y etiqueta requeridos');
    }

    // Verificar si ya está asignada
    $chk = $pdo->prepare("SELECT id FROM email_labels WHERE clean_subject = ? AND label_id = ?");
    $chk->execute([$cleanSubject, $labelId]);
    $existing = $chk->fetchColumn();

    if ($existing) {
        $pdo->prepare("DELETE FROM email_labels WHERE clean_subject = ? AND label_id = ?")->execute([$cleanSubject, $labelId]);
        $applied = false;
    } else {
        $pdo->prepare("INSERT INTO email_labels (clean_subject, label_id) VALUES (?, ?)")->execute([$cleanSubject, $labelId]);
        $applied = true;
    }

    sendJson(['success' => true, 'applied' => $applied]);
}

// 5. Asignación masiva (varios clean_subjects o uids a una o varias etiquetas)
if ($action === 'bulk_assign' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = getJsonInput();
    $cleanSubjects = $input['clean_subjects'] ?? [];
    $labelId = (int)($input['label_id'] ?? 0);
    $operation = $input['operation'] ?? 'add'; // 'add' o 'remove'

    if (empty($cleanSubjects) || !$labelId) {
        sendError('Datos incompletos');
    }

    if ($operation === 'add') {
        $stmt = $pdo->prepare("INSERT OR IGNORE INTO email_labels (clean_subject, label_id) VALUES (?, ?)");
        foreach ($cleanSubjects as $cs) {
            $stmt->execute([$cs, $labelId]);
        }
    } else {
        $stmt = $pdo->prepare("DELETE FROM email_labels WHERE clean_subject = ? AND label_id = ?");
        foreach ($cleanSubjects as $cs) {
            $stmt->execute([$cs, $labelId]);
        }
    }

    sendJson(['success' => true]);
}

sendError('Acción no soportada');
