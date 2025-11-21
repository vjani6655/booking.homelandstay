<?php
// Error Reporting Configuration
error_reporting(E_ALL);
ini_set('display_errors', 0); // Don't display errors to browser (prevents HTML in JSON responses)
ini_set('log_errors', 1); // Log errors instead
ini_set('error_log', __DIR__ . '/error.log'); // Error log file

// Database Configuration
$dbConfig = require __DIR__ . '/db_config.php';
define('DB_HOST', $dbConfig['host']);
define('DB_PORT', $dbConfig['port']);
define('DB_NAME', $dbConfig['database']);
define('DB_USER', $dbConfig['username']);
define('DB_PASS', $dbConfig['password']);
define('DB_CHARSET', $dbConfig['charset']);

// Security Headers
header('X-Frame-Options: DENY');
header('X-Content-Type-Options: nosniff');
header('X-XSS-Protection: 1; mode=block');
header('Referrer-Policy: strict-origin-when-cross-origin');
header("Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none';");

// Session Configuration
ini_set('session.cookie_httponly', 1);
ini_set('session.cookie_secure', 1);
ini_set('session.cookie_samesite', 'Strict');
ini_set('session.use_strict_mode', 1);

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Database Connection
function getDB() {
    try {
        $dsn = 'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;
        $db = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false
        ]);
        return $db;
    } catch (PDOException $e) {
        error_log('Database connection failed: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Database connection failed']);
        exit;
    }
}

// CSRF Token Functions
function generateCSRFToken() {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function verifyCSRFToken($token) {
    return isset($_SESSION['csrf_token']) && hash_equals($_SESSION['csrf_token'], $token);
}

// Initialize Database
function initializeDatabase() {
    $db = getDB();
    
    // Users table
    $db->exec("CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        phone VARCHAR(50),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    
    // Properties table
    $db->exec("CREATE TABLE IF NOT EXISTS properties (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        address TEXT,
        per_day_cost DECIMAL(10,2) DEFAULT 0,
        per_adult_cost DECIMAL(10,2) DEFAULT 0,
        per_kid_cost DECIMAL(10,2) DEFAULT 0,
        extra_adult_cost DECIMAL(10,2) DEFAULT 0,
        logo VARCHAR(500),
        owner_name VARCHAR(255),
        owner_mobile VARCHAR(50),
        owner_email VARCHAR(255),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    
    // Partners table
    $db->exec("CREATE TABLE IF NOT EXISTS partners (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        commission DECIMAL(5,2) DEFAULT 0,
        contact_person VARCHAR(255),
        email VARCHAR(255),
        phone VARCHAR(50),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    
    // Bookings table
    $db->exec("CREATE TABLE IF NOT EXISTS bookings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        status VARCHAR(50) NOT NULL,
        property_id INT,
        partner_id INT,
        booking_reference VARCHAR(100),
        customer_name VARCHAR(255) NOT NULL,
        customer_phone VARCHAR(50) NOT NULL,
        customer_email VARCHAR(255) NOT NULL,
        enquiry_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        check_in_date DATE NOT NULL,
        check_out_date DATE NOT NULL,
        num_adults INT DEFAULT 1,
        extra_adults INT DEFAULT 0,
        num_kids INT DEFAULT 0,
        per_night_cost DECIMAL(10,2) DEFAULT 0,
        per_adult_cost DECIMAL(10,2) DEFAULT 0,
        per_kid_cost DECIMAL(10,2) DEFAULT 0,
        discount DECIMAL(10,2) DEFAULT 0,
        gst DECIMAL(10,2) DEFAULT 0,
        tax_withhold DECIMAL(10,2) DEFAULT 0,
        total_amount DECIMAL(10,2) DEFAULT 0,
        payment_status VARCHAR(50) DEFAULT 'Pending',
        payment_method VARCHAR(50),
        aadhar_proof VARCHAR(500),
        pan_proof VARCHAR(500),
        passport_proof VARCHAR(500),
        message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE SET NULL,
        FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    
    // Notifications table
    $db->exec("CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        booking_id INT,
        `read` TINYINT(1) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    
    // Guest Ratings table
    $db->exec("CREATE TABLE IF NOT EXISTS guest_ratings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        booking_id INT NOT NULL,
        rating INT CHECK(rating >= 1 AND rating <= 5),
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    
    // Create default Direct Booking partner with ID 1 if not exists
    $stmt = $db->prepare("SELECT COUNT(*) as count FROM partners WHERE id = 1");
    $stmt->execute();
    $result = $stmt->fetch();
    
    if ($result['count'] == 0) {
        // Insert with explicit ID
        $db->exec("INSERT INTO partners (id, name, commission) VALUES (1, 'Direct Booking', 0)");
    }
}

// Check if user is authenticated
function requireAuth() {
    if (!isset($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Unauthorized']);
        exit;
    }
}

// Sanitize input with length validation
function sanitizeInput($data, $maxLength = 255) {
    $data = trim($data);
    $data = substr($data, 0, $maxLength);
    return htmlspecialchars(strip_tags($data), ENT_QUOTES, 'UTF-8');
}

// Rate limiting function
function checkRateLimit($action, $limit = 60, $window = 60) {
    $key = 'rate_limit_' . $action . '_' . ($_SESSION['user_id'] ?? $_SERVER['REMOTE_ADDR']);
    
    if (!isset($_SESSION[$key])) {
        $_SESSION[$key] = [];
    }
    
    // Clean old attempts
    $_SESSION[$key] = array_filter($_SESSION[$key], function($time) use ($window) {
        return $time > time() - $window;
    });
    
    if (count($_SESSION[$key]) >= $limit) {
        http_response_code(429);
        echo json_encode(['success' => false, 'message' => 'Rate limit exceeded. Please try again later.']);
        exit;
    }
    
    $_SESSION[$key][] = time();
}

// Validate email with security checks
function validateEmail($email) {
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return false;
    }
    
    // Check for email header injection
    if (preg_match('/[\r\n]/', $email)) {
        return false;
    }
    
    return true;
}

// Validate JSON input
function getJsonInput() {
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid JSON format']);
        exit;
    }
    
    return $data;
}

// Validate Content-Type for POST requests
function validateContentType() {
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
        if (!str_contains($contentType, 'application/json')) {
            http_response_code(415);
            echo json_encode(['success' => false, 'message' => 'Content-Type must be application/json']);
            exit;
        }
    }
}

// Initialize database on first load
$lockFile = __DIR__ . '/.installed.lock';
if (file_exists($lockFile)) {
    // Tables already created, just ensure connection works
    try {
        getDB();
    } catch (Exception $e) {
        error_log('Database connection check failed: ' . $e->getMessage());
    }
}
?>
