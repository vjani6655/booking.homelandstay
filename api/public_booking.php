<?php
// Public booking endpoint without authentication requirement
session_start();

header('Content-Type: application/json');

// Database Configuration
define('DB_PATH', __DIR__ . '/homeland.db');

// Constants
define('MAX_GUESTS', 20);
define('MIN_BOOKING_DAYS', 1);
define('MAX_BOOKING_DAYS', 90);

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

function sanitizeInput($data, $maxLength = 255) {
    $data = trim($data);
    $data = substr($data, 0, $maxLength);
    return htmlspecialchars(strip_tags($data), ENT_QUOTES, 'UTF-8');
}

function validateEmail($email) {
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return false;
    }
    if (preg_match('/[\r\n]/', $email)) {
        return false;
    }
    return true;
}

function verifyCSRFToken($token) {
    return isset($_SESSION['csrf_token']) && hash_equals($_SESSION['csrf_token'], $token);
}

// Rate limiting for public endpoint
function checkPublicRateLimit() {
    $key = 'public_booking_' . $_SERVER['REMOTE_ADDR'];
    
    if (!isset($_SESSION[$key])) {
        $_SESSION[$key] = [];
    }
    
    // Allow 5 bookings per IP per hour
    $_SESSION[$key] = array_filter($_SESSION[$key], function($time) {
        return $time > time() - 3600;
    });
    
    if (count($_SESSION[$key]) >= 5) {
        http_response_code(429);
        echo json_encode(['success' => false, 'message' => 'Too many requests. Please try again later.']);
        exit;
    }
    
    $_SESSION[$key][] = time();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

checkPublicRateLimit();

$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid JSON format']);
    exit;
}

// CSRF validation
$csrfToken = $data['csrf_token'] ?? '';
if (!verifyCSRFToken($csrfToken)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Invalid security token. Please refresh and try again.']);
    exit;
}

// Sanitize and validate inputs
$customerName = sanitizeInput($data['customer_name'] ?? '', 100);
$customerPhone = sanitizeInput($data['customer_phone'] ?? '', 20);
$customerEmail = sanitizeInput($data['customer_email'] ?? '', 255);
$checkInDate = sanitizeInput($data['check_in_date'] ?? '', 10);
$checkOutDate = sanitizeInput($data['check_out_date'] ?? '', 10);
$numAdults = (int)($data['num_adults'] ?? 1);
$numKids = (int)($data['num_kids'] ?? 0);
$message = sanitizeInput($data['message'] ?? '', 1000);

// Validate required fields
if (empty($customerName) || empty($customerPhone) || empty($customerEmail) || empty($checkInDate) || empty($checkOutDate)) {
    echo json_encode(['success' => false, 'message' => 'Please fill in all required fields']);
    exit;
}

// Validate email
if (!validateEmail($customerEmail)) {
    echo json_encode(['success' => false, 'message' => 'Please enter a valid email address']);
    exit;
}

// Validate phone number
if (!preg_match('/^[+]?[0-9]{10,15}$/', str_replace([' ', '-', '(', ')'], '', $customerPhone))) {
    echo json_encode(['success' => false, 'message' => 'Please enter a valid phone number (10-15 digits)']);
    exit;
}

// Validate guest counts
if ($numAdults < 1) {
    echo json_encode(['success' => false, 'message' => 'At least 1 adult is required']);
    exit;
}

if ($numAdults > MAX_GUESTS || $numKids > MAX_GUESTS) {
    echo json_encode(['success' => false, 'message' => 'Maximum ' . MAX_GUESTS . ' guests per booking']);
    exit;
}

// Validate dates
$checkIn = strtotime($checkInDate);
$checkOut = strtotime($checkOutDate);
$today = strtotime(date('Y-m-d'));

if (!$checkIn || !$checkOut) {
    echo json_encode(['success' => false, 'message' => 'Invalid date format']);
    exit;
}

if ($checkIn < $today) {
    echo json_encode(['success' => false, 'message' => 'Check-in date cannot be in the past']);
    exit;
}

if ($checkOut <= $checkIn) {
    echo json_encode(['success' => false, 'message' => 'Check-out date must be after check-in date']);
    exit;
}

$nights = ($checkOut - $checkIn) / (60 * 60 * 24);
if ($nights < MIN_BOOKING_DAYS) {
    echo json_encode(['success' => false, 'message' => 'Minimum ' . MIN_BOOKING_DAYS . ' night(s) required']);
    exit;
}

if ($nights > MAX_BOOKING_DAYS) {
    echo json_encode(['success' => false, 'message' => 'Maximum ' . MAX_BOOKING_DAYS . ' nights allowed']);
    exit;
}

try {
    $db = getDB();
    
    // Generate booking reference
    $bookingReference = 'HLST' . strtoupper(substr(uniqid(), -8));
    
    // Insert booking with default partner_id = 1 (Direct Booking)
    $stmt = $db->prepare("INSERT INTO bookings (status, partner_id, booking_reference, customer_name, customer_phone, customer_email, check_in_date, check_out_date, num_adults, num_kids, message) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    
    $stmt->execute([
        'Enquiry',
        1, // Direct booking partner ID
        $bookingReference,
        $customerName,
        $customerPhone,
        $customerEmail,
        $checkInDate,
        $checkOutDate,
        $numAdults,
        $numKids,
        $message
    ]);
    
    $bookingId = $db->lastInsertId();
    
    // Create notification
    $notifStmt = $db->prepare("INSERT INTO notifications (type, title, message, booking_id) VALUES (?, ?, ?, ?)");
    $notifStmt->execute([
        'pending_request',
        'New Booking Request',
        "New booking request from {$customerName} (Check-in: {$checkInDate})",
        $bookingId
    ]);
    
    // Refresh CSRF token for next request
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    
    echo json_encode([
        'success' => true,
        'message' => 'Your booking request has been received! We will contact you shortly.',
        'booking_reference' => $bookingReference
    ]);
    
} catch (Exception $e) {
    error_log('Booking creation error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'An error occurred. Please try again.']);
}
?>
