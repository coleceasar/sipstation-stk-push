function makePayment() {
    const phoneNumber = document.getElementById('phone').value;
    const amount = document.getElementById('amount').value;
    const responseDiv = document.getElementById('response');

    if (!phoneNumber || !amount) {
        responseDiv.textContent = 'Please enter both phone number and amount.';
        responseDiv.style.color = 'red';
        return;
    }

    // Basic phone number validation (for Kenyan numbers starting with 07 or 2547)
    if (!/^(07|2547)\d{8}$/.test(phoneNumber)) {
        responseDiv.textContent = 'Please enter a valid Kenyan phone number (e.g., 0712345678 or 254712345678).';
        responseDiv.style.color = 'red';
        return;
    }

    responseDiv.textContent = 'Initiating payment... Please wait.';
    responseDiv.style.color = 'blue';

    fetch('initiate_stk.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            phone: phoneNumber,
            amount: amount
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            responseDiv.textContent = data.message;
            responseDiv.style.color = 'green';
        } else {
            responseDiv.textContent = data.message;
            responseDiv.style.color = 'red';
        }
    })
    .catch(error => {
        console.error('Error:', error);
        responseDiv.textContent = 'An error occurred while initiating payment.';
        responseDiv.style.color = 'red';
    });
}