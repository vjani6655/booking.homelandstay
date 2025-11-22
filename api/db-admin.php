<?php
// Start output buffering to catch any errors
ob_start();

// Disable error display (log them instead)
ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once 'config.php';

// Security: Only allow in development or with proper authentication
// Uncomment this in production and implement proper auth
// if (!isset($_SESSION['admin']) || $_SESSION['admin'] !== true) {
//     echo json_encode(['success' => false, 'message' => 'Unauthorized access']);
//     exit;
// }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid request method']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$sql = isset($input['sql']) ? trim($input['sql']) : '';

if (empty($sql)) {
    echo json_encode(['success' => false, 'message' => 'No SQL query provided']);
    exit;
}

try {
    $conn = getDBConnection();
    
    // Security check: Prevent dangerous operations
    $dangerous_keywords = ['DROP DATABASE', 'DROP USER', 'GRANT', 'REVOKE'];
    foreach ($dangerous_keywords as $keyword) {
        if (stripos($sql, $keyword) !== false) {
            echo json_encode([
                'success' => false, 
                'message' => "Operation '$keyword' is not allowed for security reasons"
            ]);
            exit;
        }
    }
    
    // Determine query type
    $query_type = strtoupper(substr(ltrim($sql), 0, 6));
    
    // Execute the query
    $result = $conn->query($sql);
    
    if ($result === false) {
        throw new Exception($conn->error);
    }
    
    $response = ['success' => true];
    
    // Handle different query types
    if ($query_type === 'SELECT' || $query_type === 'SHOW' || $query_type === 'DESC' || $query_type === 'DESCRI') {
        // Fetch results for SELECT queries
        $rows = [];
        while ($row = $result->fetch_assoc()) {
            $rows[] = $row;
        }
        $response['results'] = $rows;
        $response['message'] = 'Query executed successfully';
    } else {
        // For INSERT, UPDATE, DELETE, ALTER, CREATE, DROP
        $response['affected_rows'] = $conn->affected_rows;
        
        if ($query_type === 'INSERT') {
            $response['insert_id'] = $conn->insert_id;
            $response['message'] = 'Data inserted successfully';
        } elseif ($query_type === 'UPDATE') {
            $response['message'] = 'Data updated successfully';
        } elseif ($query_type === 'DELETE') {
            $response['message'] = 'Data deleted successfully';
        } elseif ($query_type === 'CREATE') {
            $response['message'] = 'Table created successfully';
        } elseif ($query_type === 'ALTER') {
            $response['message'] = 'Table altered successfully';
        } elseif ($query_type === 'DROP T') {
            $response['message'] = 'Table dropped successfully';
        } else {
            $response['message'] = 'Query executed successfully';
        }
    }
    
    if (is_object($result)) {
        $result->free();
    }
    
    // Clean any output buffer and send JSON
    ob_clean();
    echo json_encode($response);
    
} catch (Exception $e) {
    // Clean any output buffer and send error JSON
    ob_clean();
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}

$conn->close();
ob_end_flush();
?>
