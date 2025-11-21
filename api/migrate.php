<?php
// Database migration script to optimize schema
require_once 'config.php';

echo "Starting database migration...\n";

$db = getDB();

try {
    // Start transaction
    $db->beginTransaction();
    
    // Add indexes for better query performance
    echo "Adding indexes...\n";
    
    $db->exec("CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_bookings_check_in ON bookings(check_in_date)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON bookings(payment_status)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_bookings_partner ON bookings(partner_id)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_bookings_property ON bookings(property_id)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_notifications_booking ON notifications(booking_id)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_guest_ratings_booking ON guest_ratings(booking_id)");
    
    echo "Indexes created successfully.\n";
    
    // Update any Paid bookings that don't have amount_paid set
    echo "Updating payment amounts...\n";
    $db->exec("UPDATE bookings SET amount_paid = total_amount WHERE payment_status = 'Paid' AND (amount_paid IS NULL OR amount_paid = 0)");
    
    // Fix any bookings with payment_status mismatch
    echo "Fixing payment status mismatches...\n";
    $db->exec("UPDATE bookings SET payment_status = 'Paid' WHERE amount_paid >= total_amount AND total_amount > 0 AND payment_status != 'Paid'");
    $db->exec("UPDATE bookings SET payment_status = 'Partial Paid' WHERE amount_paid > 0 AND amount_paid < total_amount AND payment_status NOT IN ('Paid', 'Partial Paid')");
    $db->exec("UPDATE bookings SET payment_status = 'Pending' WHERE (amount_paid IS NULL OR amount_paid = 0) AND payment_status NOT IN ('Pending', 'Quote')");
    
    // Ensure notification column is named correctly (is_read not read)
    echo "Checking notification table structure...\n";
    $columns = $db->query("PRAGMA table_info(notifications)")->fetchAll(PDO::FETCH_ASSOC);
    $hasIsRead = false;
    $hasRead = false;
    
    foreach ($columns as $col) {
        if ($col['name'] === 'is_read') $hasIsRead = true;
        if ($col['name'] === 'read') $hasRead = true;
    }
    
    if ($hasRead && !$hasIsRead) {
        echo "Renaming notification column from 'read' to 'is_read'...\n";
        // SQLite doesn't support column rename directly, need to recreate table
        $db->exec("
            CREATE TABLE notifications_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                booking_id INTEGER,
                is_read INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (booking_id) REFERENCES bookings(id)
            )
        ");
        $db->exec("INSERT INTO notifications_new SELECT id, type, title, message, booking_id, read, created_at FROM notifications");
        $db->exec("DROP TABLE notifications");
        $db->exec("ALTER TABLE notifications_new RENAME TO notifications");
        $db->exec("CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read)");
        $db->exec("CREATE INDEX IF NOT EXISTS idx_notifications_booking ON notifications(booking_id)");
        echo "Notification table updated.\n";
    } else {
        echo "Notification table structure is correct.\n";
    }
    
    // Add properties table fields if missing
    echo "Checking properties table...\n";
    $propColumns = $db->query("PRAGMA table_info(properties)")->fetchAll(PDO::FETCH_ASSOC);
    $propColNames = array_column($propColumns, 'name');
    
    if (!in_array('extra_adult_cost', $propColNames)) {
        echo "Adding extra_adult_cost to properties...\n";
        $db->exec("ALTER TABLE properties ADD COLUMN extra_adult_cost REAL DEFAULT 0");
    }
    
    if (!in_array('owner_name', $propColNames)) {
        echo "Adding owner fields to properties...\n";
        $db->exec("ALTER TABLE properties ADD COLUMN owner_name TEXT");
        $db->exec("ALTER TABLE properties ADD COLUMN owner_mobile TEXT");
        $db->exec("ALTER TABLE properties ADD COLUMN owner_email TEXT");
    }
    
    // Commit transaction
    $db->commit();
    
    echo "\nMigration completed successfully!\n";
    echo "Summary:\n";
    echo "- Database indexes created\n";
    echo "- Payment amounts normalized\n";
    echo "- Payment status mismatches fixed\n";
    echo "- Schema optimizations applied\n";
    
} catch (Exception $e) {
    $db->rollBack();
    echo "\nMigration failed: " . $e->getMessage() . "\n";
    exit(1);
}
?>
