<?php
/**
 * Complete migration script to add all missing columns to bookings table
 * Run this once on production server
 */

header('Content-Type: application/json');

require_once 'config.php';

try {
    $conn = getDB();
    
    $migrations = [
        'customer_state' => "ALTER TABLE bookings ADD COLUMN customer_state VARCHAR(100) DEFAULT NULL AFTER customer_email",
        'extra_adult_cost' => "ALTER TABLE bookings ADD COLUMN extra_adult_cost DECIMAL(10,2) DEFAULT 0 AFTER per_adult_cost",
        'discount_type' => "ALTER TABLE bookings ADD COLUMN discount_type VARCHAR(20) DEFAULT 'percentage' AFTER discount",
        'gst_type' => "ALTER TABLE bookings ADD COLUMN gst_type VARCHAR(20) DEFAULT 'percentage' AFTER gst",
        'tax_withhold_type' => "ALTER TABLE bookings ADD COLUMN tax_withhold_type VARCHAR(20) DEFAULT 'percentage' AFTER tax_withhold",
        'amount_paid' => "ALTER TABLE bookings ADD COLUMN amount_paid DECIMAL(10,2) DEFAULT 0 AFTER payment_method",
        'property_id' => "ALTER TABLE bookings ADD COLUMN property_id INT DEFAULT NULL AFTER partner_id"
    ];
    
    $results = [];
    
    foreach ($migrations as $column => $sql) {
        // Check if column already exists
        $check = $conn->query("SHOW COLUMNS FROM bookings LIKE '$column'");
        
        if ($check->fetch()) {
            $results[] = "Column '$column' already exists - skipped";
        } else {
            try {
                $conn->exec($sql);
                $results[] = "Column '$column' added successfully";
            } catch (Exception $e) {
                $results[] = "Failed to add '$column': " . $e->getMessage();
            }
        }
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Migration completed',
        'results' => $results
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Migration failed: ' . $e->getMessage()
    ]);
}
?>
