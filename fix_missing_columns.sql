-- Add missing columns to bookings table
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10,2) DEFAULT 0 AFTER payment_method;

ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS discount_type VARCHAR(20) DEFAULT 'fixed' AFTER discount;

ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS gst_type VARCHAR(20) DEFAULT 'fixed' AFTER gst;

-- Verify columns exist
SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'homeland_local' 
AND TABLE_NAME = 'bookings' 
AND COLUMN_NAME IN ('amount_paid', 'discount_type', 'gst_type', 'customer_state', 'tax_withhold_type')
ORDER BY COLUMN_NAME;
