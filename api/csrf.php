<?php
// Public endpoint to get CSRF token without authentication
session_start();

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');

function generateCSRFToken() {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

$token = generateCSRFToken();

echo json_encode([
    'success' => true,
    'csrf_token' => $token
]);
?>
