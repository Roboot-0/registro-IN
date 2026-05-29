import { createClient } from "@supabase/supabase-js";

// Cliente de Supabase para el SERVIDOR.
// Usa la service_role key, que bypasea RLS — por eso NUNCA debe importarse
// desde un componente del cliente. Solo desde Route Handlers (/api/*) y scripts.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  throw new Error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local",
  );
}

export const supabaseServer = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
