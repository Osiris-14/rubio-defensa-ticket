import { createClient } from '@supabase/supabase-js'

// Cliente para Server Actions / Server Components.
// Usa la service role key si está disponible y válida; si no, fallback
// a anon (RLS está deshabilitada en las tablas de producción y las RPC
// son SECURITY DEFINER con grants a anon, así que anon funciona igual).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const key = serviceKey && serviceKey.startsWith('eyJ') ? serviceKey : anonKey

export const supabaseAdmin = createClient(supabaseUrl, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})
