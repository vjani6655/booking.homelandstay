<?php
require_once 'config.php';
header('Content-Type: application/json');
requireAuth();

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'list':
        $db = getDB();
        $stmt = $db->query("SELECT * FROM partners ORDER BY name");
        $partners = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'success' => true,
            'partners' => $partners
        ]);
        break;
        
    case 'add':
        validateContentType();
        checkRateLimit('partner_add', 30, 60);
        $data = getJsonInput();
        
        // CSRF validation
        $csrfToken = $data['csrf_token'] ?? '';
        if (!verifyCSRFToken($csrfToken)) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Invalid CSRF token']);
            exit;
        }
        
        // Sanitize and validate input
        $name = sanitizeInput($data['name'] ?? '', 100);
        $commission = floatval($data['commission'] ?? 0);
        
        if (empty($name)) {
            echo json_encode(['success' => false, 'message' => 'Partner name is required']);
            exit;
        }
        
        if ($commission < 0 || $commission > 100) {
            echo json_encode(['success' => false, 'message' => 'Commission must be between 0 and 100']);
            exit;
        }
        
        try {
            $db = getDB();
            $stmt = $db->prepare("INSERT INTO partners (name, commission) VALUES (?, ?)");
            $stmt->execute([$name, $commission]);
            
            echo json_encode([
                'success' => true,
                'message' => 'Partner added successfully',
                'id' => $db->lastInsertId()
            ]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        break;
        
    case 'update':
        validateContentType();
        checkRateLimit('partner_update', 30, 60);
        $data = getJsonInput();
        
        // CSRF validation
        $csrfToken = $data['csrf_token'] ?? '';
        if (!verifyCSRFToken($csrfToken)) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Invalid CSRF token']);
            exit;
        }
        
        // Sanitize and validate input
        $id = (int)($data['id'] ?? 0);
        $name = sanitizeInput($data['name'] ?? '', 100);
        $commission = floatval($data['commission'] ?? 0);
        
        if (empty($name)) {
            echo json_encode(['success' => false, 'message' => 'Partner name is required']);
            exit;
        }
        
        if ($commission < 0 || $commission > 100) {
            echo json_encode(['success' => false, 'message' => 'Commission must be between 0 and 100']);
            exit;
        }
        
        try {
            $db = getDB();
            $stmt = $db->prepare("UPDATE partners SET name = ?, commission = ? WHERE id = ?");
            $stmt->execute([$name, $commission, $id]);
            
            echo json_encode(['success' => true, 'message' => 'Partner updated successfully']);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        break;
        
    case 'delete':
        validateContentType();
        checkRateLimit('partner_delete', 30, 60);
        $id = $_GET['id'] ?? 0;
        $data = getJsonInput();
        
        // CSRF validation
        $csrfToken = $data['csrf_token'] ?? '';
        if (!verifyCSRFToken($csrfToken)) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Invalid CSRF token']);
            exit;
        }
        
        try {
            $db = getDB();
            $stmt = $db->prepare("DELETE FROM partners WHERE id = ?");
            $stmt->execute([$id]);
            
            echo json_encode(['success' => true, 'message' => 'Partner deleted successfully']);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        break;
        
    default:
        echo json_encode(['success' => false, 'message' => 'Invalid action']);
}
