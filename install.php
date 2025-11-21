<?php
/**
 * Homeland Stay - Installation Script
 * This script sets up the database and creates initial admin user
 */

// Check if already installed
$lockFile = __DIR__ . '/api/.installed.lock';
if (file_exists($lockFile)) {
    die('
    <!DOCTYPE html>
    <html>
    <head>
        <title>Already Installed</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; background: #f5f5f5; }
            .card { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center; }
            h1 { color: #dc3545; }
            .btn { display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
        </style>
    </head>
    <body>
        <div class="card">
            <h1>⚠️ Already Installed</h1>
            <p>The application has already been installed.</p>
            <p>To reinstall, delete the file: <code>api/.installed.lock</code></p>
            <a href="index.html" class="btn">Go to Application</a>
        </div>
    </body>
    </html>
    ');
}

$step = isset($_GET['step']) ? (int)$_GET['step'] : 1;
$error = '';
$success = '';

// Step 2: Process installation
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $step === 2) {
    try {
        // Load database config
        $dbConfig = require __DIR__ . '/api/db_config.php';
        
        // Create database connection
        $dsn = 'mysql:host=' . $dbConfig['host'] . ';port=' . $dbConfig['port'] . ';dbname=' . $dbConfig['database'] . ';charset=' . $dbConfig['charset'];
        $db = new PDO($dsn, $dbConfig['username'], $dbConfig['password'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]);
        
        // Create tables using MySQL syntax
        $sql = "
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(255) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            name VARCHAR(255) NOT NULL,
            phone VARCHAR(50),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        CREATE TABLE IF NOT EXISTS partners (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            commission DECIMAL(5,2) DEFAULT 0,
            contact_person VARCHAR(255),
            email VARCHAR(255),
            phone VARCHAR(50),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        CREATE TABLE IF NOT EXISTS properties (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            address TEXT,
            per_day_cost DECIMAL(10,2) DEFAULT 0,
            per_adult_cost DECIMAL(10,2) DEFAULT 0,
            per_kid_cost DECIMAL(10,2) DEFAULT 0,
            extra_adult_cost DECIMAL(10,2) DEFAULT 0,
            logo VARCHAR(500),
            owner_name VARCHAR(255),
            owner_mobile VARCHAR(50),
            owner_email VARCHAR(255),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        CREATE TABLE IF NOT EXISTS bookings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            status VARCHAR(50) DEFAULT 'Enquiry',
            property_id INT,
            partner_id INT,
            booking_reference VARCHAR(100),
            customer_name VARCHAR(255) NOT NULL,
            customer_phone VARCHAR(50) NOT NULL,
            customer_email VARCHAR(255),
            customer_state VARCHAR(100),
            enquiry_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            check_in_date DATE NOT NULL,
            check_out_date DATE NOT NULL,
            num_adults INT DEFAULT 1,
            extra_adults INT DEFAULT 0,
            num_kids INT DEFAULT 0,
            per_night_cost DECIMAL(10,2) DEFAULT 0,
            per_adult_cost DECIMAL(10,2) DEFAULT 0,
            extra_adult_cost DECIMAL(10,2) DEFAULT 0,
            per_kid_cost DECIMAL(10,2) DEFAULT 0,
            discount DECIMAL(10,2) DEFAULT 0,
            discount_type VARCHAR(20) DEFAULT 'fixed',
            gst DECIMAL(10,2) DEFAULT 0,
            gst_type VARCHAR(20) DEFAULT 'fixed',
            tax_withhold DECIMAL(10,2) DEFAULT 0,
            tax_withhold_type VARCHAR(20) DEFAULT 'fixed',
            message TEXT,
            total_amount DECIMAL(10,2) DEFAULT 0,
            payment_status VARCHAR(50) DEFAULT 'Pending',
            payment_method VARCHAR(50),
            aadhar_proof VARCHAR(500),
            pan_proof VARCHAR(500),
            passport_proof VARCHAR(500),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL,
            FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        CREATE TABLE IF NOT EXISTS notifications (
            id INT AUTO_INCREMENT PRIMARY KEY,
            type VARCHAR(50) NOT NULL,
            title VARCHAR(255) NOT NULL,
            message TEXT NOT NULL,
            booking_id INT,
            `read` TINYINT(1) DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        CREATE TABLE IF NOT EXISTS guest_ratings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            booking_id INT NOT NULL,
            rating INT CHECK(rating >= 1 AND rating <= 5),
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ";
        
        // Execute each statement separately for MySQL
        foreach (explode(';', $sql) as $statement) {
            $statement = trim($statement);
            if (!empty($statement)) {
                $db->exec($statement);
            }
        }
        
        // Insert only Direct Booking partner (ID 1)
        $stmt = $db->prepare("INSERT IGNORE INTO partners (id, name, commission) VALUES (?, ?, ?)");
        $stmt->execute([1, 'Direct Booking', 0]);
        
        // Create admin user
        $username = trim($_POST['username']);
        $password = trim($_POST['password']);
        $name = trim($_POST['name']);
        
        if (empty($username) || empty($password) || empty($name)) {
            throw new Exception('All fields are required');
        }
        
        if (strlen($password) < 6) {
            throw new Exception('Password must be at least 6 characters');
        }
        
        // Check if username already exists
        $stmt = $db->prepare("SELECT COUNT(*) as count FROM users WHERE username = ?");
        $stmt->execute([$username]);
        if ($stmt->fetch()['count'] > 0) {
            throw new Exception("Username '$username' already exists. Please choose a different username or delete existing data from the database.");
        }
        
        $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
        
        $stmt = $db->prepare("INSERT INTO users (username, password, name) VALUES (?, ?, ?)");
        $stmt->execute([$username, $hashedPassword, $name]);
        
        // Create lock file
        file_put_contents($lockFile, date('Y-m-d H:i:s'));
        
        $success = true;
        
    } catch (Exception $e) {
        $error = $e->getMessage();
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Install Homeland Stay</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        
        .container {
            background: white;
            max-width: 600px;
            width: 100%;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 2rem;
            margin-bottom: 10px;
        }
        
        .header p {
            opacity: 0.9;
            font-size: 1rem;
        }
        
        .content {
            padding: 40px 30px;
        }
        
        .step-indicator {
            display: flex;
            justify-content: center;
            margin-bottom: 30px;
            gap: 10px;
        }
        
        .step {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: #e0e0e0;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            color: #666;
        }
        
        .step.active {
            background: #667eea;
            color: white;
        }
        
        .step.completed {
            background: #10b981;
            color: white;
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
            color: #333;
        }
        
        input {
            width: 100%;
            padding: 12px 16px;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            font-size: 1rem;
            transition: border-color 0.3s;
        }
        
        input:focus {
            outline: none;
            border-color: #667eea;
        }
        
        .btn {
            width: 100%;
            padding: 14px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        
        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(102, 126, 234, 0.4);
        }
        
        .btn:active {
            transform: translateY(0);
        }
        
        .alert {
            padding: 12px 16px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        
        .alert-error {
            background: #fee;
            color: #c33;
            border: 1px solid #fcc;
        }
        
        .alert-success {
            background: #efe;
            color: #3c3;
            border: 1px solid #cfc;
        }
        
        .info-box {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            border-left: 4px solid #667eea;
        }
        
        .info-box h3 {
            margin-bottom: 10px;
            color: #667eea;
        }
        
        .info-box ul {
            margin-left: 20px;
            color: #666;
        }
        
        .info-box li {
            margin-bottom: 8px;
        }
        
        .success-box {
            text-align: center;
        }
        
        .success-box .icon {
            font-size: 4rem;
            margin-bottom: 20px;
        }
        
        .success-box h2 {
            color: #10b981;
            margin-bottom: 10px;
        }
        
        .success-box p {
            color: #666;
            margin-bottom: 20px;
        }
        
        .credentials {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            text-align: left;
        }
        
        .credentials p {
            margin-bottom: 10px;
            font-family: monospace;
        }
        
        .credentials strong {
            color: #667eea;
        }
        
        small {
            color: #999;
            font-size: 0.875rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏠 Homeland Stay</h1>
            <p>Property Management System - Installation</p>
        </div>
        
        <div class="content">
            <?php if ($step === 1): ?>
                <div class="step-indicator">
                    <div class="step active">1</div>
                    <div class="step">2</div>
                </div>
                
                <div class="info-box">
                    <h3>📋 Before You Begin</h3>
                    <ul>
                        <li>Make sure PHP 7.4 or higher is installed</li>
                        <li>MySQL database and credentials ready</li>
                        <li>Write permissions on the <code>api/</code> directory</li>
                        <li>This will create tables in your MySQL database</li>
                    </ul>
                </div>
                
                <h2 style="margin-bottom: 20px;">Ready to Install</h2>
                <p style="color: #666; margin-bottom: 30px;">
                    Click the button below to proceed with the installation. You'll create your admin account in the next step.
                </p>
                
                <form method="GET" action="install.php">
                    <input type="hidden" name="step" value="2">
                    <button type="submit" class="btn">Continue to Setup →</button>
                </form>
            
            <?php elseif ($step === 2 && !$success): ?>
                <div class="step-indicator">
                    <div class="step completed">✓</div>
                    <div class="step active">2</div>
                </div>
                
                <h2 style="margin-bottom: 20px;">Create Admin Account</h2>
                
                <?php if ($error): ?>
                    <div class="alert alert-error">
                        <strong>Error:</strong> <?php echo htmlspecialchars($error); ?>
                    </div>
                <?php endif; ?>
                
                <form method="POST" action="install.php?step=2">
                    <div class="form-group">
                        <label for="name">Full Name *</label>
                        <input type="text" id="name" name="name" required placeholder="Enter your full name">
                    </div>
                    
                    <div class="form-group">
                        <label for="username">Username *</label>
                        <input type="text" id="username" name="username" required placeholder="Choose a username">
                        <small>This will be used for login</small>
                    </div>
                    
                    <div class="form-group">
                        <label for="password">Password *</label>
                        <input type="password" id="password" name="password" required minlength="6" placeholder="Choose a secure password">
                        <small>Minimum 6 characters</small>
                    </div>
                    
                    <button type="submit" class="btn">Install Database & Create Account</button>
                </form>
            
            <?php elseif ($success): ?>
                <div class="step-indicator">
                    <div class="step completed">✓</div>
                    <div class="step completed">✓</div>
                </div>
                
                <div class="success-box">
                    <div class="icon">🎉</div>
                    <h2>Installation Complete!</h2>
                    <p>Your Homeland Stay application has been successfully installed.</p>
                    
                    <div class="credentials">
                        <p><strong>Username:</strong> <?php echo htmlspecialchars($_POST['username']); ?></p>
                        <p><strong>Password:</strong> (the one you just created)</p>
                    </div>
                    
                    <div class="info-box">
                        <h3>✅ What's Been Set Up</h3>
                        <ul>
                            <li>MySQL tables created successfully</li>
                            <li>All required tables created</li>
                            <li>Default partners added (Direct Booking, MakeMyTrip, Airbnb, etc.)</li>
                            <li>Admin account created</li>
                            <li>Installation locked to prevent reinstallation</li>
                        </ul>
                    </div>
                    
                    <a href="index.html" class="btn" style="display: block; text-align: center; text-decoration: none; margin-top: 20px;">Go to Login Page →</a>
                    
                    <p style="margin-top: 20px; color: #999; font-size: 0.875rem;">
                        <strong>Security Note:</strong> For production, consider deleting <code>install.php</code> after installation.
                    </p>
                </div>
            <?php endif; ?>
        </div>
    </div>
</body>
</html>
