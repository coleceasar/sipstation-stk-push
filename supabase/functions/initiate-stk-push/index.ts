import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface STKPushRequest {
  phone: string;
  amount: number;
}

interface MPesaTokenResponse {
  access_token: string;
  expires_in: string;
}

interface STKPushResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
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

    const { phone, amount }: STKPushRequest = await req.json();

    // Validate inputs
    if (!phone || !amount || amount <= 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Invalid phone number or amount.'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // M-Pesa credentials (use environment variables in production)
    const consumerKey = 'l3JmJeNfFx19Ga5VmyCFXoaSjjnzSqfgMISPZDMGp1NuKjyy';
    const consumerSecret = 'qQgQAvfJCfXS2PrmsaCl8PHGUTIzphyBfo52BpCHGO9RFtZYdmzATGjGth4NjHj8';
    const businessShortCode = '174379';
    const passkey = 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';
    const callbackUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/mpesa-callback`;

    // Step 1: Get access token
    const tokenUrl = 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
    const tokenAuth = btoa(`${consumerKey}:${consumerSecret}`);
    
    const tokenResponse = await fetch(tokenUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${tokenAuth}`,
        'Content-Type': 'application/json'
      }
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to get M-Pesa access token');
    }

    const tokenData: MPesaTokenResponse = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Step 2: Insert transaction record
    const { data: transaction, error: dbError } = await supabaseClient
      .from('transactions')
      .insert({
        phone_number: phone,
        amount: amount,
        status: 'Pending'
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Database error during transaction initiation.'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Step 3: Prepare STK Push
    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    const password = btoa(`${businessShortCode}${passkey}${timestamp}`);

    const stkPushData = {
      BusinessShortCode: businessShortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.floor(amount),
      PartyA: phone,
      PartyB: businessShortCode,
      PhoneNumber: phone,
      CallBackURL: callbackUrl,
      AccountReference: 'Bablaz Sipjoint',
      TransactionDesc: 'STK Push Payment'
    };

    // Step 4: Initiate STK Push
    const stkPushUrl = 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';
    
    const stkResponse = await fetch(stkPushUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(stkPushData)
    });

    const stkData: STKPushResponse = await stkResponse.json();

    if (stkData.ResponseCode === '0') {
      // Update transaction with checkout request ID
      await supabaseClient
        .from('transactions')
        .update({ checkout_request_id: stkData.CheckoutRequestID })
        .eq('id', transaction.id);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'STK push initiated successfully. Please check your phone to complete the transaction.',
          checkout_request_id: stkData.CheckoutRequestID
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    } else {
      // Update transaction status to failed
      await supabaseClient
        .from('transactions')
        .update({ 
          status: `Failed - ${stkData.ResponseDescription}`,
          checkout_request_id: stkData.CheckoutRequestID 
        })
        .eq('id', transaction.id);

      return new Response(
        JSON.stringify({
          success: false,
          message: `Error initiating STK push: ${stkData.ResponseDescription}`
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

  } catch (error) {
    console.error('STK Push error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'An error occurred while processing your request.'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});