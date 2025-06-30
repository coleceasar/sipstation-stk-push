<?php
include 'db_connect.php'; // Include your database connection file

date_default_timezone_set('Africa/Nairobi');

// Read the M-Pesa callback data
$stkCallbackResponse = file_get_contents('php://input');

// Log the raw callback response for debugging
$logFile = "stkPushCallback.log";
$log = fopen($logFile, "a");
fwrite($log, "[" . date('Y-m-d H:i:s') . "] Callback received: " . $stkCallbackResponse . "\n\n");
fclose($log);

$callbackData = json_decode($stkCallbackResponse);

// Check if the callback data is valid and contains stkCallback body
if ($callbackData && isset($callbackData->Body->stkCallback)) {
    $stkCallback = $callbackData->Body->stkCallback;
    $ResultCode = $stkCallback->ResultCode;
    $CheckoutRequestID = $stkCallback->CheckoutRequestID;

    if ($ResultCode == 0) {
        // Payment was successful
        $MpesaReceiptNumber = null;
        $TransactionDate = null;
        $Amount = null;
        $PhoneNumber = null;

        // Extract specific details from CallbackMetadata if available
        if (isset($stkCallback->CallbackMetadata->Item)) {
            foreach ($stkCallback->CallbackMetadata->Item as $item) {
                switch ($item->Name) {
                    case 'MpesaReceiptNumber':
                        $MpesaReceiptNumber = $item->Value;
                        break;
                    case 'Amount':
                        $Amount = $item->Value;
                        break;
                    case 'TransactionDate':
                        $TransactionDate = $item->Value;
                        break;
                    case 'PhoneNumber':
                        $PhoneNumber = $item->Value;
                        break;
                }
            }
        }

        // Format TransactionDate to YYYY-MM-DD HH:MM:SS for MySQL DATETIME
        $formattedTransactionDate = null;
        if ($TransactionDate) {
            $dateTime = DateTime::createFromFormat('YmdHis', $TransactionDate);
            if ($dateTime) {
                $formattedTransactionDate = $dateTime->format('Y-m-d H:i:s');
            }
        }

        // Update your database for a successful transaction
        try {
            $stmt = $pdo->prepare(
                "UPDATE transactions
                 SET mpesa_receipt_number = ?, transaction_date = ?, status = 'Completed', amount = ?, phone_number = ?
                 WHERE checkout_request_id = ?"
            );
            $stmt->execute([
                $MpesaReceiptNumber,
                $formattedTransactionDate,
                $Amount, // Use the amount from callback for accuracy
                $PhoneNumber, // Use phone from callback for accuracy
                $CheckoutRequestID
            ]);
            error_log("Successfully updated transaction for CheckoutRequestID: " . $CheckoutRequestID . " - Receipt: " . $MpesaReceiptNumber);
        } catch (PDOException $e) {
            error_log("Database update error (success case) in callback.php for CheckoutRequestID " . $CheckoutRequestID . ": " . $e->getMessage());
        }

    } else {
        // Payment failed or was cancelled
        $ResultDesc = $stkCallback->ResultDesc;

        try {
            $stmt = $pdo->prepare(
                "UPDATE transactions
                 SET status = ?, transaction_date = NOW()
                 WHERE checkout_request_id = ?"
            );
            $stmt->execute(['Failed - ' . $ResultDesc, $CheckoutRequestID]);
            error_log("Updated transaction to failed for CheckoutRequestID: " . $CheckoutRequestID . ". Reason: " . $ResultDesc);
        } catch (PDOException $e) {
            error_log("Database update error (failure case) in callback.php for CheckoutRequestID " . $CheckoutRequestID . ": " . $e->getMessage());
        }
    }
} else {
    error_log("Invalid or malformed M-Pesa callback data received in callback.php.");
}

// Always respond with an empty JSON object to M-Pesa to acknowledge receipt
echo json_encode([]);
?>