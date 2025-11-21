<?php
require_once 'config.php';
header('Content-Type: application/json');
requireAuth();

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

if ($method === 'POST' && $action === 'generate') {
    validateContentType();
    checkRateLimit('report_generate', 10, 60);
    
    $data = getJsonInput();
    
    // CSRF validation
    $csrfToken = $data['csrf_token'] ?? '';
    if (!verifyCSRFToken($csrfToken)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Invalid CSRF token']);
        exit;
    }
    
    $reportType = sanitizeInput($data['type'] ?? 'monthly', 20);
    $period = sanitizeInput($data['period'] ?? date('Y-m'), 10);
    $format = sanitizeInput($data['format'] ?? 'pdf', 10);
    
    $db = getDB();
    
    // Parse period (YYYY-MM format)
    $year = substr($period, 0, 4);
    $month = substr($period, 5, 2);
    $periodStart = "{$year}-{$month}-01";
    $periodEnd = date('Y-m-t', strtotime($periodStart));
    
    $reportData = [];
    
    switch ($reportType) {
        case 'monthly':
            $reportData = generateMonthlyReport($db, $periodStart, $periodEnd, $year, $month);
            break;
            
        case 'partner':
            $reportData = generatePartnerReport($db, $periodStart, $periodEnd);
            break;
            
        case 'booking':
            $reportData = generateBookingReport($db, $periodStart, $periodEnd);
            break;
            
        case 'custom':
            $customStart = sanitizeInput($data['start_date'] ?? $periodStart, 10);
            $customEnd = sanitizeInput($data['end_date'] ?? $periodEnd, 10);
            $reportData = generateCustomReport($db, $customStart, $customEnd);
            break;
            
        default:
            echo json_encode(['success' => false, 'message' => 'Invalid report type']);
            exit;
    }
    
    echo json_encode([
        'success' => true,
        'report' => $reportData,
        'format' => $format
    ]);
    exit;
}

function generateMonthlyReport($db, $start, $end, $year, $month) {
    // Get all bookings for the period
    $stmt = $db->prepare("
        SELECT 
            b.*,
            p.name as partner_name,
            p.commission as partner_commission,
            pr.name as property_name
        FROM bookings b
        LEFT JOIN partners p ON b.partner_id = p.id
        LEFT JOIN properties pr ON b.property_id = pr.id
        WHERE b.check_in_date >= ? AND b.check_in_date <= ?
        AND b.status = 'Confirmed'
        ORDER BY b.check_in_date
    ");
    $stmt->execute([$start, $end]);
    $bookings = $stmt->fetchAll();
    
    // Calculate metrics
    $totalRevenue = 0;
    $totalCommission = 0;
    $netRevenue = 0;
    $bookingCount = count($bookings);
    $partnerBreakdown = [];
    $propertyBreakdown = [];
    $dailyRevenue = [];
    
    foreach ($bookings as $booking) {
        $amount = floatval($booking['total_amount']);
        $commission = $amount * (floatval($booking['partner_commission']) / 100);
        
        $totalRevenue += $amount;
        $totalCommission += $commission;
        
        // Partner breakdown
        $partnerId = $booking['partner_id'];
        $partnerName = $booking['partner_name'] ?: 'Direct';
        if (!isset($partnerBreakdown[$partnerId])) {
            $partnerBreakdown[$partnerId] = [
                'name' => $partnerName,
                'bookings' => 0,
                'revenue' => 0,
                'commission' => 0
            ];
        }
        $partnerBreakdown[$partnerId]['bookings']++;
        $partnerBreakdown[$partnerId]['revenue'] += $amount;
        $partnerBreakdown[$partnerId]['commission'] += $commission;
        
        // Property breakdown
        $propertyId = $booking['property_id'] ?: 0;
        $propertyName = $booking['property_name'] ?: 'Not Specified';
        if (!isset($propertyBreakdown[$propertyId])) {
            $propertyBreakdown[$propertyId] = [
                'name' => $propertyName,
                'bookings' => 0,
                'revenue' => 0
            ];
        }
        $propertyBreakdown[$propertyId]['bookings']++;
        $propertyBreakdown[$propertyId]['revenue'] += $amount;
        
        // Daily revenue
        $date = $booking['check_in_date'];
        if (!isset($dailyRevenue[$date])) {
            $dailyRevenue[$date] = 0;
        }
        $dailyRevenue[$date] += $amount;
    }
    
    $netRevenue = $totalRevenue - $totalCommission;
    $avgBookingValue = $bookingCount > 0 ? $totalRevenue / $bookingCount : 0;
    
    // Payment status breakdown
    $paidStmt = $db->prepare("
        SELECT payment_status, COUNT(*) as count, SUM(total_amount) as amount
        FROM bookings
        WHERE check_in_date >= ? AND check_in_date <= ?
        AND status = 'Confirmed'
        GROUP BY payment_status
    ");
    $paidStmt->execute([$start, $end]);
    $paymentBreakdown = $paidStmt->fetchAll();
    
    return [
        'period' => date('F Y', strtotime($start)),
        'year' => $year,
        'month' => $month,
        'summary' => [
            'total_bookings' => $bookingCount,
            'total_revenue' => round($totalRevenue, 2),
            'total_commission' => round($totalCommission, 2),
            'net_revenue' => round($netRevenue, 2),
            'average_booking_value' => round($avgBookingValue, 2)
        ],
        'partner_breakdown' => array_values($partnerBreakdown),
        'property_breakdown' => array_values($propertyBreakdown),
        'payment_breakdown' => $paymentBreakdown,
        'daily_revenue' => $dailyRevenue,
        'bookings' => $bookings
    ];
}

function generatePartnerReport($db, $start, $end) {
    $stmt = $db->prepare("
        SELECT 
            p.id,
            p.name,
            p.commission,
            COUNT(b.id) as booking_count,
            SUM(b.total_amount) as total_revenue,
            SUM(b.total_amount * p.commission / 100) as total_commission
        FROM partners p
        LEFT JOIN bookings b ON b.partner_id = p.id 
            AND b.check_in_date >= ? 
            AND b.check_in_date <= ?
            AND b.status = 'Confirmed'
        GROUP BY p.id
        ORDER BY total_revenue DESC
    ");
    $stmt->execute([$start, $end]);
    $partners = $stmt->fetchAll();
    
    return [
        'period' => date('F Y', strtotime($start)),
        'partners' => $partners
    ];
}

function generateBookingReport($db, $start, $end) {
    $stmt = $db->prepare("
        SELECT 
            status,
            COUNT(*) as count,
            SUM(total_amount) as revenue
        FROM bookings
        WHERE check_in_date >= ? AND check_in_date <= ?
        GROUP BY status
    ");
    $stmt->execute([$start, $end]);
    $statusBreakdown = $stmt->fetchAll();
    
    $stmt = $db->prepare("
        SELECT 
            DATE(check_in_date) as date,
            COUNT(*) as bookings,
            SUM(num_adults) as guests
        FROM bookings
        WHERE check_in_date >= ? AND check_in_date <= ?
        GROUP BY DATE(check_in_date)
        ORDER BY date
    ");
    $stmt->execute([$start, $end]);
    $dailyBookings = $stmt->fetchAll();
    
    return [
        'period' => date('F Y', strtotime($start)),
        'status_breakdown' => $statusBreakdown,
        'daily_bookings' => $dailyBookings
    ];
}

function generateCustomReport($db, $start, $end) {
    return generateMonthlyReport($db, $start, $end, date('Y', strtotime($start)), date('m', strtotime($start)));
}

echo json_encode(['success' => false, 'message' => 'Invalid request']);
?>
