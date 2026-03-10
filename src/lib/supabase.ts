import { createClient } from '@supabase/supabase-js';

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase URL and Anon Key are required environment variables.');
}

/**
 * Primary client — used for auth-aware operations (insert, update, delete,
 * and queries that need the logged-in user's JWT, e.g. MeusAnuncios).
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Public (anon-only) client — always uses the anon key, never injects a
 * user JWT.  Use this for SELECT queries that must return ALL rows regardless
 * of who is logged in (Estoque, Home destaque, DetalheCarro, etc.).
 *
 * This bypasses any RLS policy that accidentally filters authenticated users
 * to only their own rows, while still respecting policies written as
 * `using (true)` for public reads.
 */
export const supabasePublic = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession:  false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
    },
    global: {
        headers: {
            // Explicitly pass anon key as Authorization so no user JWT leaks in
            Authorization: `Bearer ${supabaseAnonKey}`,
        },
    },
});
