<?php
// Error Reporting Configuration
error_reporting(E_ALL);
ini_set('display_errors', 0); // Don't display errors to browser (prevents HTML in JSON responses)
ini_set('log_errors', 1); // Log errors instead
ini_set('error_log', __DIR__ . '/error.log'); // Error log file

// Database Configuration
define('DB_PATH', __DIR__ . '/homeland.db');

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
        $db = new PDO('sqlite:' . DB_PATH);
        $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
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
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT,
        phone TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");
    
    // Properties table
    $db->exec("CREATE TABLE IF NOT EXISTS properties (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        address TEXT,
        per_day_cost REAL DEFAULT 0,
        per_adult_cost REAL DEFAULT 0,
        per_kid_cost REAL DEFAULT 0,
        logo TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");
    
    // Partners table
    $db->exec("CREATE TABLE IF NOT EXISTS partners (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        commission REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");
    
    // Bookings table
    $db->exec("CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        status TEXT NOT NULL,
        partner_id INTEGER,
        booking_reference TEXT,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        customer_email TEXT NOT NULL,
        enquiry_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        check_in_date DATE NOT NULL,
        check_out_date DATE NOT NULL,
        num_adults INTEGER DEFAULT 1,
        extra_adults INTEGER DEFAULT 0,
        num_kids INTEGER DEFAULT 0,
        per_night_cost REAL DEFAULT 0,
        per_adult_cost REAL DEFAULT 0,
        per_kid_cost REAL DEFAULT 0,
        discount REAL DEFAULT 0,
        gst REAL DEFAULT 0,
        tax_withhold REAL DEFAULT 0,
        total_amount REAL DEFAULT 0,
        payment_status TEXT DEFAULT 'Pending',
        payment_method TEXT,
        aadhar_proof TEXT,
        pan_proof TEXT,
        passport_proof TEXT,
        message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (partner_id) REFERENCES partners(id)
    )");
    
    // Notifications table
    $db->exec("CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        booking_id INTEGER,
        read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (booking_id) REFERENCES bookings(id)
    )");
    
    // Guest Ratings table
    $db->exec("CREATE TABLE IF NOT EXISTS guest_ratings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        booking_id INTEGER NOT NULL,
        rating INTEGER CHECK(rating >= 1 AND rating <= 5),
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (booking_id) REFERENCES bookings(id)
    )");
    
    // Create default admin user if not exists
    $stmt = $db->prepare("SELECT COUNT(*) as count FROM users WHERE username = ?");
    $stmt->execute(['admin']);
    $result = $stmt->fetch();
    
    if ($result['count'] == 0) {
        $hashedPassword = password_hash('admin123', PASSWORD_BCRYPT);
        $stmt = $db->prepare("INSERT INTO users (username, password, name) VALUES (?, ?, ?)");
        $stmt->execute(['admin', $hashedPassword, 'Administrator']);
    }
    
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
if (!file_exists(DB_PATH)) {
    initializeDatabase();
}
?>
