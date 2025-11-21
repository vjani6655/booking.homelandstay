<?php
require_once 'config.php';
header('Content-Type: application/json');

requireAuth();

$method = $_SERVER['REQUEST_METHOD'];
$action = isset($_GET['action']) ? $_GET['action'] : '';

if ($action === 'list') {
    $db = getDB();
    $stmt = $db->prepare("
        SELECT r.*, b.customer_name, b.check_in_date, b.check_out_date 
        FROM guest_ratings r 
        JOIN bookings b ON r.booking_id = b.id 
        ORDER BY r.created_at DESC
    ");
    $stmt->execute();
    $ratings = $stmt->fetchAll();
    
    echo json_encode([
        'success' => true,
        'ratings' => $ratings
    ]);
    exit;
}

if ($action === 'get') {
    $bookingId = $_GET['booking_id'] ?? 0;
    $db = getDB();
    
    $stmt = $db->prepare("SELECT * FROM guest_ratings WHERE booking_id = ?");
    $stmt->execute([$bookingId]);
    $rating = $stmt->fetch();
    
    echo json_encode([
        'success' => true,
        'rating' => $rating
    ]);
    exit;
}

if ($method === 'POST' && $action === 'create') {
    validateContentType();
    checkRateLimit('rating_create', 30, 60);
    
    $data = getJsonInput();
    
    // CSRF validation
    $csrfToken = $data['csrf_token'] ?? '';
    if (!verifyCSRFToken($csrfToken)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Invalid CSRF token']);
        exit;
    }
    
    $bookingId = (int)($data['booking_id'] ?? 0);
    $rating = (int)($data['rating'] ?? 0);
    $notes = sanitizeInput($data['notes'] ?? '', 1000);
    
    if ($bookingId <= 0) {
        echo json_encode(['success' => false, 'message' => 'Invalid booking ID']);
        exit;
    }
    
    if ($rating < 1 || $rating > 5) {
        echo json_encode(['success' => false, 'message' => 'Rating must be between 1 and 5']);
        exit;
    }
    
    $db = getDB();
    
    // Check if rating already exists
    $stmt = $db->prepare("SELECT id FROM guest_ratings WHERE booking_id = ?");
    $stmt->execute([$bookingId]);
    
    if ($stmt->fetch()) {
        echo json_encode(['success' => false, 'message' => 'Rating already exists for this booking']);
        exit;
    }
    
    // Insert rating
    $stmt = $db->prepare("INSERT INTO guest_ratings (booking_id, rating, notes) VALUES (?, ?, ?)");
    $stmt->execute([$bookingId, $rating, $notes]);
    
    echo json_encode([
        'success' => true,
        'message' => 'Guest rating saved successfully',
        'rating_id' => $db->lastInsertId()
    ]);
    exit;
}

if ($method === 'POST' && $action === 'update') {
    validateContentType();
    checkRateLimit('rating_update', 30, 60);
    
    $data = getJsonInput();
    
    // CSRF validation
    $csrfToken = $data['csrf_token'] ?? '';
    if (!verifyCSRFToken($csrfToken)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Invalid CSRF token']);
        exit;
    }
    
    $id = (int)($data['id'] ?? 0);
    $rating = (int)($data['rating'] ?? 0);
    $notes = sanitizeInput($data['notes'] ?? '', 1000);
    
    if ($id <= 0) {
        echo json_encode(['success' => false, 'message' => 'Invalid rating ID']);
        exit;
    }
    
    if ($rating < 1 || $rating > 5) {
        echo json_encode(['success' => false, 'message' => 'Rating must be between 1 and 5']);
        exit;
    }
    
    $db = getDB();
    $stmt = $db->prepare("UPDATE guest_ratings SET rating = ?, notes = ? WHERE id = ?");
    $stmt->execute([$rating, $notes, $id]);
    
    echo json_encode([
        'success' => true,
        'message' => 'Guest rating updated successfully'
    ]);
    exit;
}

if ($method === 'POST' && $action === 'delete') {
    validateContentType();
    checkRateLimit('rating_delete', 30, 60);
    
    $data = getJsonInput();
    
    // CSRF validation
    $csrfToken = $data['csrf_token'] ?? '';
    if (!verifyCSRFToken($csrfToken)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Invalid CSRF token']);
        exit;
    }
    
    $id = (int)($data['id'] ?? 0);
    
    if ($id <= 0) {
        echo json_encode(['success' => false, 'message' => 'Invalid rating ID']);
        exit;
    }
    
    $db = getDB();
    $stmt = $db->prepare("DELETE FROM guest_ratings WHERE id = ?");
    $stmt->execute([$id]);
    
    echo json_encode([
        'success' => true,
        'message' => 'Guest rating deleted successfully'
    ]);
    exit;
}

echo json_encode(['success' => false, 'message' => 'Invalid request']);
?>
