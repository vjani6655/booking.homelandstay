<?php
/**
 * Migration script to add customer_state column to bookings table
 * Run this once on production server
 */

header('Content-Type: application/json');

require_once 'config.php';

try {
    $conn = getDB();
    
    // Check if column already exists
    $result = $conn->query("SHOW COLUMNS FROM bookings LIKE 'customer_state'");
    
    if ($result->fetch()) {
        echo json_encode([
            'success' => true,
            'message' => 'Column customer_state already exists. No migration needed.'
        ]);
        exit;
    }
    
    // Add the customer_state column
    $sql = "ALTER TABLE bookings ADD COLUMN customer_state VARCHAR(100) DEFAULT NULL AFTER customer_email";
    
    $conn->exec($sql);
    
    echo json_encode([
        'success' => true,
        'message' => 'Successfully added customer_state column to bookings table'
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Migration failed: ' . $e->getMessage()
    ]);
}
?>
