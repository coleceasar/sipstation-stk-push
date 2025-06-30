/*
  # Create transactions table for M-Pesa payments

  1. New Tables
    - `transactions`
      - `id` (uuid, primary key)
      - `phone_number` (text) - Customer phone number
      - `amount` (decimal) - Transaction amount
      - `status` (text) - Transaction status (Pending, Completed, Failed, etc.)
      - `checkout_request_id` (text) - M-Pesa checkout request ID
      - `mpesa_receipt_number` (text) - M-Pesa receipt number
      - `transaction_date` (timestamptz) - When transaction was completed
      - `created_at` (timestamptz) - When record was created
      - `updated_at` (timestamptz) - When record was last updated

  2. Security
    - Enable RLS on `transactions` table
    - Add policy for public read access (for transaction status checking)
    - Add policy for service role to manage transactions
*/

CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL,
  amount decimal(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'Pending',
  checkout_request_id text,
  mpesa_receipt_number text,
  transaction_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Allow public read access for transaction status checking
CREATE POLICY "Allow public read access to transactions"
  ON transactions
  FOR SELECT
  TO public
  USING (true);

-- Allow service role to manage all transactions
CREATE POLICY "Allow service role to manage transactions"
  ON transactions
  FOR ALL
  TO service_role
  USING (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_transactions_checkout_request_id 
  ON transactions(checkout_request_id);

CREATE INDEX IF NOT EXISTS idx_transactions_phone_number 
  ON transactions(phone_number);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_transactions_updated_at 
  BEFORE UPDATE ON transactions 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();