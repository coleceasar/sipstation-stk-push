import { useState } from 'react';
import { supabase } from './lib/supabase';

interface PaymentResponse {
  success: boolean;
  message: string;
  checkout_request_id?: string;
}

function App() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [amount, setAmount] = useState(100);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');

  const validatePhoneNumber = (phone: string): boolean => {
    // Validate Kenyan phone numbers (07xxxxxxxx or 2547xxxxxxxx)
    return /^(07|2547)\d{8}$/.test(phone);
  };

  const formatPhoneNumber = (phone: string): string => {
    // Convert 07xxxxxxxx to 2547xxxxxxxx
    if (phone.startsWith('0')) {
      return '254' + phone.substring(1);
    }
    return phone;
  };

  const handlePayment = async () => {
    if (!phoneNumber || !amount) {
      setMessage('Please enter both phone number and amount.');
      setMessageType('error');
      return;
    }

    if (amount <= 0) {
      setMessage('Please enter a valid amount greater than 0.');
      setMessageType('error');
      return;
    }

    if (!validatePhoneNumber(phoneNumber)) {
      setMessage('Please enter a valid Kenyan phone number (e.g., 0712345678 or 254712345678).');
      setMessageType('error');
      return;
    }

    setIsLoading(true);
    setMessage('Initiating payment... Please wait.');
    setMessageType('info');

    try {
      const formattedPhone = formatPhoneNumber(phoneNumber);
      
      // Call the Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('initiate-stk-push', {
        body: {
          phone: formattedPhone,
          amount: amount
        }
      });

      if (error) {
        throw error;
      }

      const response: PaymentResponse = data;

      if (response.success) {
        setMessage(response.message);
        setMessageType('success');
      } else {
        setMessage(response.message);
        setMessageType('error');
      }
    } catch (error) {
      console.error('Payment error:', error);
      setMessage('An error occurred while initiating payment. Please try again.');
      setMessageType('error');
    } finally {
      setIsLoading(false);
    }
  };

  const getMessageColor = () => {
    switch (messageType) {
      case 'success': return 'text-green-600';
      case 'error': return 'text-red-600';
      case 'info': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={{
        backgroundImage: 'url(/beer2.webp)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Background overlay for better readability */}
      <div className="absolute inset-0 bg-black bg-opacity-40"></div>
      
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Bablaz SIP APP</h1>
          <div className="w-full h-48 bg-gray-100 rounded-lg mb-4 overflow-hidden">
            <img 
              src="/beer.webp" 
              alt="Premium Beer" 
              className="w-full h-full object-cover"
              onError={(e) => {
                // Fallback to placeholder if beer.webp fails
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent) {
                  parent.innerHTML = `
                    <div class="flex items-center justify-center h-full">
                      <div class="text-center">
                        <svg class="w-16 h-16 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p class="text-gray-500 text-sm">Product Image</p>
                      </div>
                    </div>
                  `;
                }
              }}
            />
          </div>
          <p className="text-lg font-semibold text-gray-700">Price: KES {amount}</p>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              id="phone"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="Enter your phone number (e.g., 0712345678)"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
              disabled={isLoading}
            />
          </div>

          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
              Amount (KES)
            </label>
            <input
              type="number"
              id="amount"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              placeholder="Enter amount"
              min="1"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
              disabled={isLoading}
            />
          </div>

          <button
            onClick={handlePayment}
            disabled={isLoading}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 transform hover:scale-[1.02] disabled:scale-100 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </>
            ) : (
              'Pay with M-Pesa'
            )}
          </button>

          {message && (
            <div className={`p-4 rounded-lg border ${
              messageType === 'success' ? 'bg-green-50 border-green-200' :
              messageType === 'error' ? 'bg-red-50 border-red-200' :
              'bg-blue-50 border-blue-200'
            }`}>
              <p className={`text-sm ${getMessageColor()}`}>
                {message}
              </p>
            </div>
          )}
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            Secure payment powered by M-Pesa
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;