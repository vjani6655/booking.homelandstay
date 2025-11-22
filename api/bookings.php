<?php
// Enable error reporting and output buffering
ini_set('display_errors', 0);
error_reporting(E_ALL);

// Start output buffering to catch any errors
ob_start();

// Set error handler to catch fatal errors
register_shutdown_function(function() {
    $error = error_get_last();
    if ($error !== null && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        ob_clean();
        header('Content-Type: application/json');
        echo json_encode([
            'success' => false,
            'message' => 'Server error: ' . $error['message'] . ' in ' . $error['file'] . ' on line ' . $error['line']
        ]);
    }
});

require_once 'config.php';
header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];
$action = isset($_GET['action']) ? $_GET['action'] : '';

if ($action === 'dashboard') {
    requireAuth();
    
    $db = getDB();
    $currentMonth = date('Y-m');
    $today = date('Y-m-d');
    
    // Get pending requests
    $stmt = $db->prepare("SELECT * FROM bookings WHERE status = 'Enquiry' ORDER BY created_at DESC");
    $stmt->execute();
    $pendingRequests = $stmt->fetchAll();
    
    // Get upcoming bookings this month
    $firstDay = date('Y-m-01');
    $lastDay = date('Y-m-t');
    $stmt = $db->prepare("SELECT * FROM bookings WHERE status = 'Confirmed' AND check_in_date BETWEEN ? AND ? AND check_in_date >= ? ORDER BY check_in_date ASC");
    $stmt->execute([$firstDay, $lastDay, $today]);
    $upcomingBookings = $stmt->fetchAll();
    
    // Get pending payments
    $stmt = $db->prepare("SELECT * FROM bookings WHERE status = 'Confirmed' AND payment_status IN ('Pending', 'Partial Paid') ORDER BY check_in_date ASC");
    $stmt->execute();
    $pendingPaymentBookings = $stmt->fetchAll();
    $pendingPaymentsCount = count($pendingPaymentBookings);
    
    // Calculate occupancy rate (simplified)
    $stmt = $db->prepare("SELECT COUNT(*) as count FROM bookings WHERE status = 'Confirmed' AND check_in_date BETWEEN ? AND ?");
    $stmt->execute([$firstDay, $lastDay]);
    $confirmedCount = $stmt->fetch()['count'];
    $occupancyRate = min(100, $confirmedCount * 10); // Simplified calculation
    
    // Calculate average booking value
    $stmt = $db->prepare("SELECT AVG(total_amount) as avg FROM bookings WHERE status = 'Confirmed' AND check_in_date BETWEEN ? AND ?");
    $stmt->execute([$firstDay, $lastDay]);
    $avgBookingValue = (int)($stmt->fetch()['avg'] ?? 0);
    
    // Calculate month revenue
    $stmt = $db->prepare("SELECT SUM(total_amount) as total FROM bookings WHERE status = 'Confirmed' AND payment_status = 'Paid' AND check_in_date BETWEEN ? AND ?");
    $stmt->execute([$firstDay, $lastDay]);
    $monthRevenue = (int)($stmt->fetch()['total'] ?? 0);
    
    echo json_encode([
        'success' => true,
        'stats' => [
            'occupancyRate' => $occupancyRate,
            'avgBookingValue' => $avgBookingValue,
            'monthRevenue' => $monthRevenue,
            'pendingPayments' => $pendingPaymentsCount
        ],
        'pendingRequests' => $pendingRequests,
        'upcomingBookings' => $upcomingBookings,
        'pendingPayments' => $pendingPaymentBookings
    ]);
    exit;
}

if ($action === 'list') {
    requireAuth();
    
    $db = getDB();
    $stmt = $db->prepare("SELECT b.*, p.name as partner_name FROM bookings b LEFT JOIN partners p ON b.partner_id = p.id ORDER BY b.created_at DESC");
    $stmt->execute();
    $bookings = $stmt->fetchAll();
    
    echo json_encode([
        'success' => true,
        'bookings' => $bookings
    ]);
    exit;
}

if ($action === 'calendar') {
    requireAuth();
    
    $db = getDB();
    $stmt = $db->prepare("SELECT * FROM bookings WHERE status IN ('Confirmed', 'Enquiry', 'Personal') AND check_out_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)");
    $stmt->execute();
    $bookings = $stmt->fetchAll();
    
    echo json_encode([
        'success' => true,
        'bookings' => $bookings
    ]);
    exit;
}

if ($action === 'get') {
    requireAuth();
    
    $id = $_GET['id'] ?? 0;
    $db = getDB();
    
    // Join with both partners and properties tables
    $stmt = $db->prepare("
        SELECT b.*, 
               p.name as partner_name,
               pr.name as property_name,
               pr.address as property_address,
               pr.logo as property_logo,
               pr.owner_name as property_owner_name,
               pr.owner_mobile as property_owner_mobile,
               pr.owner_email as property_owner_email,
               pr.per_day_cost as property_per_night_cost,
               pr.per_adult_cost as property_per_adult_cost,
               pr.extra_adult_cost as property_extra_adult_cost,
               pr.per_kid_cost as property_per_kid_cost
        FROM bookings b 
        LEFT JOIN partners p ON b.partner_id = p.id
        LEFT JOIN properties pr ON b.property_id = pr.id
        WHERE b.id = ?
    ");
    $stmt->execute([$id]);
    $booking = $stmt->fetch();
    
    if ($booking) {
        echo json_encode([
            'success' => true,
            'booking' => $booking
        ]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Booking not found']);
    }
    exit;
}

if ($method === 'POST' && $action === 'create') {
    requireAuth(); // ADD AUTHENTICATION REQUIREMENT
    validateContentType();
    checkRateLimit('booking_create', 20, 60);
    
    $data = getJsonInput();
    
    // CSRF validation
    $csrfToken = $data['csrf_token'] ?? '';
    if (!verifyCSRFToken($csrfToken)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Invalid CSRF token']);
        exit;
    }
    
    // Sanitize inputs with length validation
    $status = sanitizeInput($data['status'] ?? 'Enquiry', 50);
    $propertyId = isset($data['property_id']) && $data['property_id'] ? (int)$data['property_id'] : null;
    $partnerId = (int)($data['partner_id'] ?? 1);
    $bookingReference = sanitizeInput($data['booking_reference'] ?? '', 50);
    $customerName = sanitizeInput($data['customer_name'], 100);
    $customerPhone = sanitizeInput($data['customer_phone'], 20);
    $customerEmail = sanitizeInput($data['customer_email'], 255);
    $customerState = sanitizeInput($data['customer_state'] ?? '', 100);
    $checkInDate = sanitizeInput($data['check_in_date'], 10);
    $checkOutDate = sanitizeInput($data['check_out_date'], 10);
    $numAdults = (int)($data['num_adults'] ?? 1);
    $extraAdults = (int)($data['extra_adults'] ?? 0);
    $numKids = (int)($data['num_kids'] ?? 0);
    $perNightCost = (float)($data['per_night_cost'] ?? 0);
    $perAdultCost = (float)($data['per_adult_cost'] ?? 0);
    $extraAdultCost = (float)($data['extra_adult_cost'] ?? 0);
    $perKidCost = (float)($data['per_kid_cost'] ?? 0);
    $message = sanitizeInput($data['message'] ?? '', 1000);
    
    // Validate email
    if (!validateEmail($customerEmail)) {
        echo json_encode(['success' => false, 'message' => 'Invalid email address']);
        exit;
    }
    
    // Validate phone number format - allow international formats
    $cleanPhone = preg_replace('/[\s\-\(\)]/', '', $customerPhone);
    if (!preg_match('/^[+]?[0-9]{7,15}$/', $cleanPhone)) {
        echo json_encode(['success' => false, 'message' => 'Invalid phone number']);
        exit;
    }
    
    // Validate guest counts
    if ($numAdults < 1 || $numAdults > 50 || $numKids < 0 || $numKids > 50) {
        echo json_encode(['success' => false, 'message' => 'Invalid guest count']);
        exit;
    }
    
    if (empty($customerName) || empty($customerPhone) || empty($customerEmail) || empty($checkInDate) || empty($checkOutDate)) {
        echo json_encode(['success' => false, 'message' => 'Required fields are missing']);
        exit;
    }
    
    $db = getDB();
    $stmt = $db->prepare("INSERT INTO bookings (status, property_id, partner_id, booking_reference, customer_name, customer_phone, customer_email, customer_state, check_in_date, check_out_date, num_adults, extra_adults, num_kids, per_night_cost, per_adult_cost, extra_adult_cost, per_kid_cost, message) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    
    $stmt->execute([$status, $propertyId, $partnerId, $bookingReference, $customerName, $customerPhone, $customerEmail, $customerState, $checkInDate, $checkOutDate, $numAdults, $extraAdults, $numKids, $perNightCost, $perAdultCost, $extraAdultCost, $perKidCost, $message]);
    
    $bookingId = $db->lastInsertId();
    
    // Create notification for new booking request
    if ($status === 'Enquiry') {
        $notifStmt = $db->prepare("INSERT INTO notifications (type, title, message, booking_id) VALUES (?, ?, ?, ?)");
        $notifStmt->execute([
            'pending_request',
            'New Booking Request',
            "New booking request from {$customerName}",
            $bookingId
        ]);
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Booking created successfully',
        'booking_id' => $bookingId
    ]);
    exit;
}

if ($method === 'POST' && $action === 'update') {
    try {
        requireAuth();
        validateContentType();
        checkRateLimit('booking_update', 30, 60);
        
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
        echo json_encode(['success' => false, 'message' => 'Invalid booking ID']);
        exit;
    }
    
    $db = getDB();
    
    // Check if this is a payment-only update (only payment fields provided)
    $isPaymentOnlyUpdate = !isset($data['customer_name']) && !isset($data['check_in_date']) 
                          && (isset($data['payment_status']) || isset($data['amount_paid']));
    
    if ($isPaymentOnlyUpdate) {
        // Payment-only update - don't require customer/booking fields
        $sql = "UPDATE bookings SET id = ?";
        $params = [$id];
    } else {
        // Full booking update - require all fields
        $status = sanitizeInput($data['status'] ?? 'Enquiry');
        $bookingReference = sanitizeInput($data['booking_reference'] ?? '');
        $customerName = sanitizeInput($data['customer_name']);
        $customerPhone = sanitizeInput($data['customer_phone']);
        $customerEmail = sanitizeInput($data['customer_email']);
        $checkInDate = sanitizeInput($data['check_in_date']);
        $checkOutDate = sanitizeInput($data['check_out_date']);
        $numAdults = (int)($data['num_adults'] ?? 1);
        $numKids = (int)($data['num_kids'] ?? 0);
        $message = sanitizeInput($data['message'] ?? '');
        
        if (empty($customerName) || empty($customerPhone) || empty($customerEmail) || empty($checkInDate) || empty($checkOutDate)) {
            echo json_encode(['success' => false, 'message' => 'Required fields are missing']);
            exit;
        }
        
        // Base update query for full update
        $sql = "UPDATE bookings SET status = ?, booking_reference = ?, customer_name = ?, customer_phone = ?, customer_email = ?, check_in_date = ?, check_out_date = ?, num_adults = ?, num_kids = ?, message = ?";
        $params = [$status, $bookingReference, $customerName, $customerPhone, $customerEmail, $checkInDate, $checkOutDate, $numAdults, $numKids, $message];
        
        // Add customer_state if provided
        if (isset($data['customer_state'])) {
            $sql .= ", customer_state = ?";
            $params[] = sanitizeInput($data['customer_state']);
        }
    }
    
    // Add pricing fields if provided (for both full and payment-only updates)
    if (isset($data['per_night_cost'])) {
        $sql .= ", per_night_cost = ?";
        $params[] = (float)$data['per_night_cost'];
    }
    if (isset($data['per_adult_cost'])) {
        $sql .= ", per_adult_cost = ?";
        $params[] = (float)$data['per_adult_cost'];
    }
    if (isset($data['extra_adult_cost'])) {
        $sql .= ", extra_adult_cost = ?";
        $params[] = (float)$data['extra_adult_cost'];
    }
    if (isset($data['per_kid_cost'])) {
        $sql .= ", per_kid_cost = ?";
        $params[] = (float)$data['per_kid_cost'];
    }
    if (isset($data['discount'])) {
        $sql .= ", discount = ?";
        $params[] = (float)$data['discount'];
    }
    if (isset($data['discount_type'])) {
        $sql .= ", discount_type = ?";
        $params[] = sanitizeInput($data['discount_type']);
    }
    if (isset($data['gst'])) {
        $sql .= ", gst = ?";
        $params[] = (float)$data['gst'];
    }
    if (isset($data['gst_type'])) {
        $sql .= ", gst_type = ?";
        $params[] = sanitizeInput($data['gst_type']);
    }
    if (isset($data['tax_withhold'])) {
        $sql .= ", tax_withhold = ?";
        $params[] = (float)$data['tax_withhold'];
    }
    if (isset($data['tax_withhold_type'])) {
        $sql .= ", tax_withhold_type = ?";
        $params[] = sanitizeInput($data['tax_withhold_type']);
    }
    if (isset($data['total_amount'])) {
        $sql .= ", total_amount = ?";
        $params[] = (float)$data['total_amount'];
    }
    if (isset($data['payment_status'])) {
        $sql .= ", payment_status = ?";
        $params[] = sanitizeInput($data['payment_status']);
    }
    if (isset($data['payment_method'])) {
        $sql .= ", payment_method = ?";
        $params[] = sanitizeInput($data['payment_method']);
    }
    if (isset($data['amount_paid'])) {
        $sql .= ", amount_paid = ?";
        $params[] = (float)$data['amount_paid'];
    }
    
    $sql .= " WHERE id = ?";
    $params[] = $id;
    
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    
    // Check if payment status changed to Partial Paid and amount is less than total
    if (isset($data['payment_status']) && $data['payment_status'] === 'Partial Paid' && isset($data['amount_paid']) && isset($data['total_amount'])) {
        $amountPaid = (float)$data['amount_paid'];
        $totalAmount = (float)$data['total_amount'];
        $pendingAmount = $totalAmount - $amountPaid;
        
        if ($pendingAmount > 0) {
            // Get booking details for notification
            $bookingStmt = $db->prepare("SELECT customer_name, check_in_date FROM bookings WHERE id = ?");
            $bookingStmt->execute([$id]);
            $bookingInfo = $bookingStmt->fetch(PDO::FETCH_ASSOC);
            
            // Check if notification already exists
            $notifCheck = $db->prepare("SELECT id FROM notifications WHERE booking_id = ? AND type = 'pending_payment' AND is_read = 0");
            $notifCheck->execute([$id]);
            
            if (!$notifCheck->fetch() && $bookingInfo) {
                $notifStmt = $db->prepare("INSERT INTO notifications (type, title, message, booking_id) VALUES (?, ?, ?, ?)");
                $notifStmt->execute([
                    'pending_payment',
                    'Pending Payment Alert',
                    "₹{$pendingAmount} pending for {$bookingInfo['customer_name']}'s booking (Check-in: {$bookingInfo['check_in_date']})",
                    $id
                ]);
            }
        }
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Booking updated successfully'
    ]);
    exit;
    
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Database error: ' . $e->getMessage()
        ]);
        exit;
    }
}

echo json_encode(['success' => false, 'message' => 'Invalid request']);
?>
