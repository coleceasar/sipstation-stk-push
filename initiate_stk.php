<?php
// INCLUDE THE ACCESS TOKEN FILE
include 'Token.php'; // This will execute accessToken.php and make $access_token available
include 'db_connect.php'; // Include your database connection file

header('Content-Type: application/json');

// Ensure $access_token is set from Token.php
if (!isset($access_token) || empty($access_token)) {
    echo json_encode(['success' => false, 'message' => 'Error: Access token not generated. Check Token.php for issues.']);
    exit();
}

date_default_timezone_set('Africa/Nairobi');

$processrequestUrl = 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';
// Make sure your callback URL is publicly accessible and correctly configured with ngrok or similar
$callbackurl = 'https://f3ba-102-213-49-29.ngrok-free.app/MPEsa-Daraja-Api/callback.php'; // removed leading whitespace
$passkey = "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919";
$BusinessShortCode = '174379';

$Timestamp = date('YmdHis');
$Password = base64_encode($BusinessShortCode . $passkey . $Timestamp);

// Get data from the frontend
$input = json_decode(file_get_contents('php://input'), true);
$phone = isset($input['phone']) ? $input['phone'] : '';
$amount = isset($input['amount']) ? $input['amount'] : '';

// Validate inputs
if (empty($phone) || empty($amount) || !is_numeric($amount) || $amount <= 0) {
    echo json_encode(['success' => false, 'message' => 'Invalid phone number or amount.']);
    exit();
}

// Format phone number to 2547...
if (substr($phone, 0, 1) === '0') {
    $phone = '254' . substr($phone, 1);
} elseif (substr($phone, 0, 3) !== '254') {
    echo json_encode(['success' => false, 'message' => 'Invalid phone number format. Use 07xxxxxxxx or 2547xxxxxxxx.']);
    exit();
}

$PartyA = $phone;
$PartyB = $BusinessShortCode;
$AccountReference = 'Bablaz Sipjoint';
$TransactionDesc = 'STK Push Payment';
$Amount = (int)$amount;

try {
    $stmt = $pdo->prepare("INSERT INTO transactions (phone_number, amount, status) VALUES (?, ?, 'Pending')");
    $stmt->execute([$phone, $amount]);
    $lastInsertId = $pdo->lastInsertId();
} catch (PDOException $e) {
    error_log("Database error on insert: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Database error during transaction initiation.']);
    exit();
}

$stkpushheader = ['Content-Type:application/json', 'Authorization:Bearer ' . $access_token];

// INITIATE CURL
$curl = curl_init();
curl_setopt($curl, CURLOPT_URL, $processrequestUrl);
curl_setopt($curl, CURLOPT_HTTPHEADER, $stkpushheader);
curl_setopt($curl, CURLOPT_RETURNTRANSFER, true);
curl_setopt($curl, CURLOPT_POST, true);

$curl_post_data = array(
    'BusinessShortCode' => $BusinessShortCode,
    'Password' => $Password,
    'Timestamp' => $Timestamp,
    'TransactionType' => 'CustomerPayBillOnline',
    'Amount' => $Amount,
    'PartyA' => $PartyA,
    'PartyB' => $PartyB,
    'PhoneNumber' => $PartyA,
    'CallBackURL' => $callbackurl,
    'AccountReference' => $AccountReference,
    'TransactionDesc' => $TransactionDesc
);

$data_string = json_encode($curl_post_data);
curl_setopt($curl, CURLOPT_POSTFIELDS, $data_string);

$curl_response = curl_exec($curl);
$http_code = curl_getinfo($curl, CURLINFO_HTTP_CODE);

if (curl_errno($curl)) {
    error_log('Curl error: ' . curl_error($curl));
    $stmt = $pdo->prepare("UPDATE transactions SET status = 'Failed - CURL Error' WHERE id = ?");
    $stmt->execute([$lastInsertId]);
    echo json_encode(['success' => false, 'message' => 'Network error during payment initiation.']);
} else {
    $data = json_decode($curl_response);

    if ($http_code == 200 && isset($data->ResponseCode)) {
        $ResponseCode = $data->ResponseCode;
        $CheckoutRequestID = $data->CheckoutRequestID ?? null;

        if ($CheckoutRequestID) {
            $stmt = $pdo->prepare("UPDATE transactions SET checkout_request_id = ? WHERE id = ?");
            $stmt->execute([$CheckoutRequestID, $lastInsertId]);
        }

        if ($ResponseCode === "0") {
            echo json_encode([
                'success' => true,
                'message' => 'STK push initiated successfully. Please check your phone to complete the transaction.',
                'checkout_request_id' => $CheckoutRequestID
            ]);
        } else {
            $errorMessage = $data->ResponseDescription ?? 'Unknown M-Pesa error.';
            $stmt = $pdo->prepare("UPDATE transactions SET status = ?, checkout_request_id = ? WHERE id = ?");
            $stmt->execute(['Failed - ' . $errorMessage, $CheckoutRequestID, $lastInsertId]);

            echo json_encode([
                'success' => false,
                'message' => 'Error initiating STK push: ' . $errorMessage
            ]);
        }
    } else {
        $stmt = $pdo->prepare("UPDATE transactions SET status = 'Failed - Invalid M-Pesa Response' WHERE id = ?");
        $stmt->execute([$lastInsertId]);
        echo json_encode(['success' => false, 'message' => 'Error: Could not decode M-Pesa response or response structure is unexpected.']);
    }
}

curl_close($curl);
?>
