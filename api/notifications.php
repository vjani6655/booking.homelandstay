<?php
require_once 'config.php';
header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];
$action = isset($_GET['action']) ? $_GET['action'] : '';

if ($action === 'list') {
    requireAuth();
    
    $db = getDB();
    $stmt = $db->prepare("SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50");
    $stmt->execute();
    $notifications = $stmt->fetchAll();
    
    echo json_encode([
        'success' => true,
        'notifications' => $notifications
    ]);
    exit;
}

if ($method === 'POST' && $action === 'mark-read') {
    requireAuth();
    
    $data = json_decode(file_get_contents('php://input'), true);
    
    // CSRF validation
    $csrfToken = $data['csrf_token'] ?? '';
    if (!verifyCSRFToken($csrfToken)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Invalid CSRF token']);
        exit;
    }
    
    $id = (int)($data['id'] ?? 0);
    
    if ($id > 0) {
        $db = getDB();
        $stmt = $db->prepare("UPDATE notifications SET read = 1 WHERE id = ?");
        $stmt->execute([$id]);
        
        echo json_encode(['success' => true, 'message' => 'Notification marked as read']);
        exit;
    }
}

echo json_encode(['success' => false, 'message' => 'Invalid request']);
?>
