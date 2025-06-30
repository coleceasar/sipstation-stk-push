import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CallbackMetadataItem {
  Name: string;
  Value: string | number;
}

interface STKCallback {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResultCode: number;
  ResultDesc: string;
  CallbackMetadata?: {
    Item: CallbackMetadataItem[];
  };
}

interface MPesaCallbackData {
  Body: {
    stkCallback: STKCallback;
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const callbackData: MPesaCallbackData = await req.json();
    
    // Log the callback for debugging
    console.log('M-Pesa Callback received:', JSON.stringify(callbackData, null, 2));

    if (!callbackData?.Body?.stkCallback) {
      console.error('Invalid callback data structure');
      return new Response(JSON.stringify({}), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const stkCallback = callbackData.Body.stkCallback;
    const { ResultCode, CheckoutRequestID, ResultDesc } = stkCallback;

    if (ResultCode === 0) {
      // Payment was successful
      let mpesaReceiptNumber = null;
      let transactionDate = null;
      let amount = null;
      let phoneNumber = null;

      // Extract metadata if available
      if (stkCallback.CallbackMetadata?.Item) {
        for (const item of stkCallback.CallbackMetadata.Item) {
          switch (item.Name) {
            case 'MpesaReceiptNumber':
              mpesaReceiptNumber = item.Value as string;
              break;
            case 'Amount':
              amount = item.Value as number;
              break;
            case 'TransactionDate':
              // Convert from YmdHis format to ISO string
              const dateStr = item.Value.toString();
              const year = dateStr.substring(0, 4);
              const month = dateStr.substring(4, 6);
              const day = dateStr.substring(6, 8);
              const hour = dateStr.substring(8, 10);
              const minute = dateStr.substring(10, 12);
              const second = dateStr.substring(12, 14);
              transactionDate = `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
              break;
            case 'PhoneNumber':
              phoneNumber = item.Value as string;
              break;
          }
        }
      }

      // Update transaction as successful
      const { error } = await supabaseClient
        .from('transactions')
        .update({
          status: 'Completed',
          mpesa_receipt_number: mpesaReceiptNumber,
          transaction_date: transactionDate,
          amount: amount || undefined,
          phone_number: phoneNumber || undefined,
          updated_at: new Date().toISOString()
        })
        .eq('checkout_request_id', CheckoutRequestID);

      if (error) {
        console.error('Database update error (success):', error);
      } else {
        console.log(`Transaction completed successfully: ${CheckoutRequestID} - Receipt: ${mpesaReceiptNumber}`);
      }

    } else {
      // Payment failed or was cancelled
      const { error } = await supabaseClient
        .from('transactions')
        .update({
          status: `Failed - ${ResultDesc}`,
          transaction_date: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('checkout_request_id', CheckoutRequestID);

      if (error) {
        console.error('Database update error (failure):', error);
      } else {
        console.log(`Transaction failed: ${CheckoutRequestID}. Reason: ${ResultDesc}`);
      }
    }

  } catch (error) {
    console.error('Callback processing error:', error);
  }

  // Always respond with empty JSON to acknowledge receipt
  return new Response(JSON.stringify({}), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});