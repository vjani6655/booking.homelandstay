<?php
// Error Reporting Configuration
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/error.log');

// Database Configuration
define('DB_PATH', __DIR__ . '/homeland.db');

// Security Headers
header('Content-Type: application/json');
header('X-Frame-Options: DENY');
header('X-Content-Type-Options: nosniff');
header('X-XSS-Protection: 1; mode=block');

// Session Configuration
ini_set('session.cookie_httponly', 1);
ini_set('session.cookie_secure', 1);
ini_set('session.cookie_samesite', 'Strict');

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

// Check if user is logged in (require authentication)
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized. Please login first.']);
    exit;
}

// Get request data
$data = json_decode(file_get_contents('php://input'), true);
$confirmationText = $data['confirmation'] ?? '';

// Require explicit confirmation
if ($confirmationText !== 'DELETE ALL DATA') {
    http_response_code(400);
    echo json_encode([
        'success' => false, 
        'message' => 'Please type "DELETE ALL DATA" to confirm uninstallation'
    ]);
    exit;
}

try {
    // Load database config
    $dbConfig = require __DIR__ . '/db_config.php';
    
    // Create database connection
    $dsn = 'mysql:host=' . $dbConfig['host'] . ';port=' . $dbConfig['port'] . ';dbname=' . $dbConfig['database'] . ';charset=' . $dbConfig['charset'];
    $db = new PDO($dsn, $dbConfig['username'], $dbConfig['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);

    // Close any open connections by destroying the session
    session_destroy();

    // Drop all tables in correct order (respecting foreign keys)
    $tables = ['guest_ratings', 'notifications', 'bookings', 'properties', 'partners', 'users'];
    
    foreach ($tables as $table) {
        $db->exec("DROP TABLE IF EXISTS `$table`");
    }
    
    // Delete the lock file
    $lockFile = __DIR__ . '/.installed.lock';
    if (file_exists($lockFile)) {
        @unlink($lockFile);
    }
    
    // Delete the error log if it exists
    $errorLogPath = __DIR__ . '/error.log';
    if (file_exists($errorLogPath)) {
        @unlink($errorLogPath);
    }

    echo json_encode([
        'success' => true,
        'message' => 'All tables dropped successfully. All data has been removed.'
    ]);

} catch (Exception $e) {
    error_log('Uninstall error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error during uninstallation: ' . $e->getMessage()
    ]);
}
