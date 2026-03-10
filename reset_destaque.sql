-- Run this in Supabase SQL editor to reset all cars that were
-- incorrectly seeded with destaque=true without a paid impulsionamento.
-- After running this, only cars that pay for impulsionamento will appear
-- in the Destaque / Featured section on the Home page.

-- Step 1: Reset ALL cars to destaque=false, impulsionado=false (clean slate)
UPDATE anuncios
SET
    destaque        = false,
    impulsionado    = false,
    impulsionado_ate = NULL,
    prioridade      = 0
WHERE destaque = true
   OR impulsionado = true;

-- Step 2: Verify result
SELECT id, marca, modelo, destaque, impulsionado, prioridade
FROM anuncios
ORDER BY created_at DESC;
