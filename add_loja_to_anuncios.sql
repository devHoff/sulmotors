-- Add loja column to anuncios table
ALTER TABLE anuncios ADD COLUMN IF NOT EXISTS loja text;

-- Optional: Update some existing ads to belong to stores for demo purposes
-- UPDATE anuncios SET loja = 'AutoPrime' LIMIT 2;
