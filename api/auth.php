<?php
require_once 'config.php';

header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];
$action = isset($_GET['action']) ? $_GET['action'] : '';

// CSRF token endpoint (GET request, no auth needed for login page)
if ($method === 'GET' && $action === 'csrf') {
    $token = generateCSRFToken();
    echo json_encode([
        'success' => true,
        'csrf_token' => $token
    ]);
    exit;
}

if ($method === 'POST') {
    // Skip Content-Type validation for logout (no body required)
    if ($action !== 'logout') {
        validateContentType();
        $data = getJsonInput();
    }
    
    if ($action === 'login') {
        // CSRF validation for login
        $csrfToken = $data['csrf_token'] ?? '';
        if (!verifyCSRFToken($csrfToken)) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Invalid CSRF token']);
            exit;
        }
        
        $username = sanitizeInput($data['username'] ?? '', 50);
        $password = $data['password'] ?? '';
        
        if (empty($username) || empty($password)) {
            echo json_encode(['success' => false, 'message' => 'Username and password are required']);
            exit;
        }
        
        // Input length validation
        if (strlen($password) > 255) {
            echo json_encode(['success' => false, 'message' => 'Invalid input length']);
            exit;
        }
        
        // Rate limiting check
        checkRateLimit('login', 5, 900);
        
        $db = getDB();
        $stmt = $db->prepare("SELECT * FROM users WHERE username = ?");
        $stmt->execute([$username]);
        $user = $stmt->fetch();
        
        if ($user && password_verify($password, $user['password'])) {
            session_regenerate_id(true);
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['username'] = $user['username'];
            $_SESSION['name'] = $user['name'];
            $_SESSION['login_attempts'] = []; // Reset attempts on success
            
            // Generate CSRF token for the session
            $csrfToken = generateCSRFToken();
            
            echo json_encode([
                'success' => true,
                'message' => 'Login successful',
                'csrf_token' => $csrfToken,
                'user' => [
                    'id' => $user['id'],
                    'username' => $user['username'],
                    'name' => $user['name']
                ]
            ]);
        } else {
            $_SESSION['login_attempts'][] = time();
            echo json_encode(['success' => false, 'message' => 'Invalid username or password']);
        }
        exit;
    }
    
    if ($action === 'logout') {
        session_destroy();
        echo json_encode(['success' => true, 'message' => 'Logged out successfully']);
        exit;
    }
    
    if ($action === 'change-password') {
        requireAuth();
        
        // Get data if not already loaded
        if (!isset($data)) {
            $data = getJsonInput();
        }
        
        // CSRF validation
        $csrfToken = $data['csrf_token'] ?? '';
        if (!verifyCSRFToken($csrfToken)) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Invalid CSRF token']);
            exit;
        }
        
        $currentPassword = $data['currentPassword'] ?? '';
        $newPassword = $data['newPassword'] ?? '';
        
        if (empty($currentPassword) || empty($newPassword)) {
            echo json_encode(['success' => false, 'message' => 'All fields are required']);
            exit;
        }
        
        if (strlen($newPassword) < 6) {
            echo json_encode(['success' => false, 'message' => 'Password must be at least 6 characters']);
            exit;
        }
        
        $db = getDB();
        $stmt = $db->prepare("SELECT password FROM users WHERE id = ?");
        $stmt->execute([$_SESSION['user_id']]);
        $user = $stmt->fetch();
        
        if (!password_verify($currentPassword, $user['password'])) {
            echo json_encode(['success' => false, 'message' => 'Current password is incorrect']);
            exit;
        }
        
        $hashedPassword = password_hash($newPassword, PASSWORD_BCRYPT);
        $stmt = $db->prepare("UPDATE users SET password = ? WHERE id = ?");
        $stmt->execute([$hashedPassword, $_SESSION['user_id']]);
        
        echo json_encode(['success' => true, 'message' => 'Password changed successfully']);
        exit;
    }
}

if ($method === 'GET' && $action === 'check') {
    if (isset($_SESSION['user_id'])) {
        echo json_encode([
            'success' => true,
            'authenticated' => true,
            'csrf_token' => generateCSRFToken(),
            'user' => [
                'id' => $_SESSION['user_id'],
                'username' => $_SESSION['username'],
                'name' => $_SESSION['name']
            ]
        ]);
    } else {
        echo json_encode(['success' => true, 'authenticated' => false]);
    }
    exit;
}

echo json_encode(['success' => false, 'message' => 'Invalid request']);
?>
