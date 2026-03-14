#!/usr/bin/env bash
# Opens the Supabase SQL Editor with each migration URL
PROJECT_REF="imkzkvlktrixaxougqie"
BASE="https://supabase.com/dashboard/project/$PROJECT_REF/sql/new"

echo "Open these URLs in your browser to apply migrations:"
echo ""
echo "1. $BASE"
echo "   (Paste: supabase/migrations/001_monetization.sql)"
echo ""
echo "2. $BASE"
echo "   (Paste: supabase/migrations/002_production_architecture.sql)"
echo ""
echo "3. $BASE"
echo "   (Paste: supabase/migrations/003_payment_tables.sql)"
echo ""
echo "4. $BASE"
echo "   (Paste: supabase/migrations/003_payment_system.sql)"
