# Supabase Edge Function Deployment Guide
# Run these commands from the project root directory

# Step 1: Login to Supabase CLI
npx supabase login
# This opens a browser window - follow the instructions to authenticate

# Step 2: Link the project (if not already linked)
npx supabase link --project-ref imkzkvlktrixaxougqie

# Step 3: Deploy the fixed edge function
npx supabase functions deploy create-mp-preference --project-ref imkzkvlktrixaxougqie

# Step 4: Deploy the webhook function too (if needed)
npx supabase functions deploy mp-webhook --project-ref imkzkvlktrixaxougqie

# Step 5: Set the required secrets
# Replace the values below with your actual credentials
npx supabase secrets set --project-ref imkzkvlktrixaxougqie \
  MERCADOPAGO_ACCESS_TOKEN=TEST-your-token-here \
  APP_URL=https://sulmotors.com.br

# Step 6: Run the RLS fix SQL in the Supabase Dashboard SQL Editor:
# Go to: https://supabase.com/dashboard/project/imkzkvlktrixaxougqie/sql
# Paste and run the contents of: supabase/migrations/20260308_fix_pagamentos_rls.sql
