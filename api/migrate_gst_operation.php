<?php
/**
 * Migration script to add gst_operation column to bookings table
 * Run this once on production server
 */

header('Content-Type: application/json');

require_once 'config.php';

try {
    $conn = getDB();
    
    // Check if column already exists
    $result = $conn->query("SHOW COLUMNS FROM bookings LIKE 'gst_operation'");
    
    if ($result->fetch()) {
        echo json_encode([
            'success' => true,
            'message' => 'Column gst_operation already exists. No migration needed.'
        ]);
        exit;
    }
    
    // Add the gst_operation column
    $sql = "ALTER TABLE bookings ADD COLUMN gst_operation VARCHAR(20) DEFAULT 'add' AFTER gst_type";
    
    $conn->exec($sql);
    
    echo json_encode([
        'success' => true,
        'message' => 'Successfully added gst_operation column to bookings table'
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Migration failed: ' . $e->getMessage()
    ]);
}
?>
