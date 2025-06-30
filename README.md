# M-Pesa STK Push Application

A modern React application for processing M-Pesa STK Push payments, built with Vite, TypeScript, Tailwind CSS, and Supabase.

## Features

- 🚀 Modern React with TypeScript
- 💳 M-Pesa STK Push integration
- 🎨 Beautiful UI with Tailwind CSS
- 🔒 Secure backend with Supabase Edge Functions
- 📱 Responsive design
- ☁️ Ready for Netlify deployment

## Setup Instructions

### 1. Supabase Setup

1. **Create a Supabase project** at [supabase.com](https://supabase.com)
2. **Click "Connect to Supabase"** in the top right of this interface
3. **Run the database migration** - The transactions table will be created automatically
4. **Deploy the Edge Functions** - The M-Pesa integration functions will be deployed automatically

### 2. Environment Variables

Create a `.env` file in the root directory with your Supabase credentials:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. M-Pesa Configuration

The application is currently configured for M-Pesa Sandbox. For production:

1. Update the M-Pesa credentials in `supabase/functions/initiate-stk-push/index.ts`
2. Change the API URLs from sandbox to production
3. Update the callback URL to your production domain

### 4. Development

```bash
npm install
npm run dev
```

### 5. Deployment to Netlify

1. Build the project: `npm run build`
2. Deploy the `dist` folder to Netlify
3. Set up environment variables in Netlify dashboard
4. Update the callback URL in the Edge Function to your production domain

## Project Structure

```
├── src/
│   ├── components/          # React components
│   ├── lib/                # Utilities and configurations
│   └── App.tsx             # Main application component
├── supabase/
│   ├── functions/          # Edge Functions for M-Pesa integration
│   └── migrations/         # Database schema
└── public/                 # Static assets
```

## How It Works

1. **User Input**: Customer enters phone number and confirms amount
2. **STK Push**: Application calls Supabase Edge Function to initiate M-Pesa STK Push
3. **Database**: Transaction is recorded in Supabase database
4. **Callback**: M-Pesa sends callback to update transaction status
5. **Completion**: User receives confirmation of payment status

## Security Features

- Row Level Security (RLS) enabled on database
- Secure API endpoints with proper CORS handling
- Environment variables for sensitive data
- Input validation and sanitization

## Support

For issues or questions, please check the documentation or create an issue in the repository.