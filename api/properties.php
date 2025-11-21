<?php
require_once 'config.php';
header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];
$action = isset($_GET['action']) ? $_GET['action'] : '';

if ($action === 'list') {
    requireAuth();
    
    $db = getDB();
    $stmt = $db->prepare("SELECT * FROM properties ORDER BY created_at DESC");
    $stmt->execute();
    $properties = $stmt->fetchAll();
    
    echo json_encode([
        'success' => true,
        'properties' => $properties
    ]);
    exit;
}

if ($method === 'POST' && $action === 'add') {
    requireAuth();
    validateContentType();
    checkRateLimit('property_add', 20, 60);
    
    $data = getJsonInput();
    
    // CSRF validation
    $csrfToken = $data['csrf_token'] ?? '';
    if (!verifyCSRFToken($csrfToken)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Invalid CSRF token']);
        exit;
    }
    
    $name = sanitizeInput($data['name'] ?? '', 100);
    $address = sanitizeInput($data['address'] ?? '', 500);
    $ownerName = sanitizeInput($data['owner_name'] ?? '', 100);
    $ownerMobile = sanitizeInput($data['owner_mobile'] ?? '', 20);
    $ownerEmail = sanitizeInput($data['owner_email'] ?? '', 255);
    $perDayCost = (float)($data['per_day_cost'] ?? 0);
    $perAdultCost = (float)($data['per_adult_cost'] ?? 0);
    $extraAdultCost = (float)($data['extra_adult_cost'] ?? 0);
    $perKidCost = (float)($data['per_kid_cost'] ?? 0);
    $logo = sanitizeInput($data['logo'] ?? '', 500);
    
    if (empty($name)) {
        echo json_encode(['success' => false, 'message' => 'Property name is required']);
        exit;
    }
    
    // Validate email if provided
    if (!empty($ownerEmail) && !validateEmail($ownerEmail)) {
        echo json_encode(['success' => false, 'message' => 'Invalid owner email address']);
        exit;
    }
    
    $db = getDB();
    $stmt = $db->prepare("INSERT INTO properties (name, address, owner_name, owner_mobile, owner_email, per_day_cost, per_adult_cost, extra_adult_cost, per_kid_cost, logo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([$name, $address, $ownerName, $ownerMobile, $ownerEmail, $perDayCost, $perAdultCost, $extraAdultCost, $perKidCost, $logo]);
    
    echo json_encode([
        'success' => true,
        'message' => 'Property added successfully',
        'property_id' => $db->lastInsertId()
    ]);
    exit;
}

if ($method === 'POST' && $action === 'update') {
    requireAuth();
    validateContentType();
    checkRateLimit('property_update', 30, 60);
    
    $data = getJsonInput();
    
    // CSRF validation
    $csrfToken = $data['csrf_token'] ?? '';
    if (!verifyCSRFToken($csrfToken)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Invalid CSRF token']);
        exit;
    }
    
    $id = (int)($data['id'] ?? 0);
    $name = sanitizeInput($data['name'] ?? '', 100);
    $address = sanitizeInput($data['address'] ?? '', 500);
    $ownerName = sanitizeInput($data['owner_name'] ?? '', 100);
    $ownerMobile = sanitizeInput($data['owner_mobile'] ?? '', 20);
    $ownerEmail = sanitizeInput($data['owner_email'] ?? '', 255);
    $perDayCost = (float)($data['per_day_cost'] ?? 0);
    $perAdultCost = (float)($data['per_adult_cost'] ?? 0);
    $extraAdultCost = (float)($data['extra_adult_cost'] ?? 0);
    $perKidCost = (float)($data['per_kid_cost'] ?? 0);
    $logo = sanitizeInput($data['logo'] ?? '', 500);
    
    if ($id <= 0 || empty($name)) {
        echo json_encode(['success' => false, 'message' => 'Invalid data']);
        exit;
    }
    
    // Validate email if provided
    if (!empty($ownerEmail) && !validateEmail($ownerEmail)) {
        echo json_encode(['success' => false, 'message' => 'Invalid owner email address']);
        exit;
    }
    
    $db = getDB();
    $stmt = $db->prepare("UPDATE properties SET name = ?, address = ?, owner_name = ?, owner_mobile = ?, owner_email = ?, per_day_cost = ?, per_adult_cost = ?, extra_adult_cost = ?, per_kid_cost = ?, logo = ? WHERE id = ?");
    $stmt->execute([$name, $address, $ownerName, $ownerMobile, $ownerEmail, $perDayCost, $perAdultCost, $extraAdultCost, $perKidCost, $logo, $id]);
    
    echo json_encode([
        'success' => true,
        'message' => 'Property updated successfully'
    ]);
    exit;
}

if ($method === 'POST' && $action === 'delete') {
    requireAuth();
    validateContentType();
    checkRateLimit('property_delete', 20, 60);
    
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
        echo json_encode(['success' => false, 'message' => 'Invalid property ID']);
        exit;
    }
    
    $db = getDB();
    $stmt = $db->prepare("DELETE FROM properties WHERE id = ?");
    $stmt->execute([$id]);
    
    echo json_encode([
        'success' => true,
        'message' => 'Property deleted successfully'
    ]);
    exit;
}

echo json_encode(['success' => false, 'message' => 'Invalid request']);
?>
