<?php
require_once 'config.php';
header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {
    validateContentType();
    checkRateLimit('send_invoice', 10, 60);
    
    $data = getJsonInput();
    
    // CSRF validation
    $csrfToken = $data['csrf_token'] ?? '';
    if (!verifyCSRFToken($csrfToken)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Invalid CSRF token']);
        exit;
    }
    
    $bookingId = (int)($data['booking_id'] ?? 0);
    $email = sanitizeInput($data['email'] ?? '', 255);
    $customerName = sanitizeInput($data['customer_name'] ?? '', 100);
    $invoiceHTML = $data['invoice_html'] ?? '';
    
    if (empty($email) || empty($invoiceHTML)) {
        echo json_encode(['success' => false, 'message' => 'Missing required fields']);
        exit;
    }
    
    // Validate email with security checks
    if (!validateEmail($email)) {
        echo json_encode(['success' => false, 'message' => 'Invalid email address']);
        exit;
    }
    
    // Validate invoice HTML length
    if (strlen($invoiceHTML) > 500000) {
        echo json_encode(['success' => false, 'message' => 'Invoice data too large']);
        exit;
    }
    
    // Get booking and property details from database
    $db = getDB();
    $stmt = $db->prepare("
        SELECT b.*, 
               pr.name as property_name,
               pr.address as property_address,
               pr.owner_name as property_owner_name,
               pr.owner_mobile as property_owner_mobile,
               pr.owner_email as property_owner_email
        FROM bookings b 
        LEFT JOIN properties pr ON b.property_id = pr.id
        WHERE b.id = ?
    ");
    $stmt->execute([$bookingId]);
    $booking = $stmt->fetch();
    
    $propertyName = $booking['property_name'] ?? 'Our Property';
    $propertyAddress = $booking['property_address'] ?? '';
    $ownerMobile = $booking['property_owner_mobile'] ?? '';
    $ownerEmail = $booking['property_owner_email'] ?? '';
    $ownerName = $booking['property_owner_name'] ?? '';
    
    // Validate and sanitize owner email
    if ($ownerEmail && !validateEmail($ownerEmail)) {
        $ownerEmail = '';
    }
    
    // Sanitize property name for email headers (prevent header injection)
    $propertyName = preg_replace('/[\r\n\t]/', '', $propertyName);
    $propertyName = substr($propertyName, 0, 50);
    
    // Prepare email
    $subject = "Your Booking Quote" . ($propertyName ? " from {$propertyName}" : '');
    $subject = preg_replace('/[\r\n]/', '', $subject); // Prevent header injection
    
    // Set email headers with property data
    $fromEmail = $ownerEmail ?: 'noreply@property.com';
    $replyToEmail = $ownerEmail ?: '';
    $fromName = $propertyName ?: 'Property Rental';
    
    $headers = [
        'MIME-Version: 1.0',
        'Content-type: text/html; charset=utf-8',
        'From: ' . $fromName . ' <' . $fromEmail . '>',
        'X-Mailer: PHP/' . phpversion()
    ];
    
    if ($replyToEmail && validateEmail($replyToEmail)) {
        $headers[] = 'Reply-To: ' . $replyToEmail;
    }
    
    // Format address for email
    $formattedAddress = $propertyAddress ? str_replace("\n", "<br>", $propertyAddress) : '';
    
    // Build contact info
    $contactInfo = [];
    if ($ownerMobile) {
        $contactInfo[] = "📞 {$ownerMobile}";
    }
    if ($ownerEmail) {
        $contactInfo[] = "📧 {$ownerEmail}";
    }
    $contactLine = !empty($contactInfo) ? implode(' | ', $contactInfo) : '';
    
    // Build confirmation instructions
    $confirmInstructions = '<ul>';
    if ($ownerEmail) {
        $confirmInstructions .= '<li>Reply to this email with your confirmation</li>';
    }
    if ($ownerMobile) {
        $confirmInstructions .= "<li>Call us at {$ownerMobile}</li>";
        $confirmInstructions .= '<li>Or send a WhatsApp message</li>';
    }
    if (!$ownerEmail && !$ownerMobile) {
        $confirmInstructions .= '<li>Contact the property owner to confirm</li>';
    }
    $confirmInstructions .= '</ul>';
    
    $emailBody = "
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .email-wrapper { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2c5f7d; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8f9fa; padding: 20px; }
            .invoice-container { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; }
            .footer { background: #2c5f7d; color: white; padding: 15px; text-align: center; font-size: 12px; border-radius: 0 0 8px 8px; }
        </style>
    </head>
    <body>
        <div class='email-wrapper'>
            <div class='header'>
                <h1 style='margin: 0;'>{$propertyName}</h1>
                <p style='margin: 10px 0 0 0;'>Your Booking Quote</p>
            </div>
            <div class='content'>
                <p>Dear {$customerName},</p>
                <p>Thank you for your interest in {$propertyName}! We're excited to potentially host you.</p>
                <p>Please find your booking quote attached below. This quote is valid for <strong>3 days</strong> from the date of issue.</p>
                <p>To confirm your booking, please:</p>
                {$confirmInstructions}
                <p>A 50% advance payment is required to secure your booking.</p>
            </div>
            <div class='invoice-container'>
                {$invoiceHTML}
            </div>
            " . ($propertyName || $formattedAddress || $contactLine ? "
            <div class='footer'>
                " . ($propertyName ? "<p style='margin: 5px 0; font-weight: 600;'>{$propertyName}</p>" : '') . "
                " . ($formattedAddress ? "<p style='margin: 5px 0; opacity: 0.95;'>{$formattedAddress}</p>" : '') . "
                " . ($contactLine ? "<p style='margin: 5px 0; opacity: 0.95;'>{$contactLine}</p>" : '') . "
            </div>" : '') . "
        </div>
    </body>
    </html>
    ";
    
    // Send email
    $result = mail($email, $subject, $emailBody, implode("\r\n", $headers));
    
    if ($result) {
        // Log the email send
        $stmt = $db->prepare("INSERT INTO notifications (type, title, message, booking_id) VALUES (?, ?, ?, ?)");
        $stmt->execute([
            'invoice_sent',
            'Invoice Sent',
            "Quote for {$propertyName} sent to {$customerName} at {$email}",
            $bookingId
        ]);
        
        echo json_encode([
            'success' => true,
            'message' => 'Invoice sent successfully'
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'message' => 'Failed to send email. Please check your mail server configuration.'
        ]);
    }
    exit;
}

echo json_encode(['success' => false, 'message' => 'Invalid request']);
?>
