import { createClient } from "@supabase/supabase-js";

// Variables de entorno publicas (definidas en .env.local).
// El prefijo NEXT_PUBLIC_ las hace visibles en el navegador, que es donde corre la app.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Falla temprano y con un mensaje claro si falta la configuracion.
  throw new Error(
    "Faltan las variables de Supabase. Revisa que exista .env.local con NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.",
  );
}

// Cliente de Supabase compartido por toda la app.
// La anon key es publica por diseno; la proteccion real de los datos
// la imponen las politicas RLS de la base de datos (ver schema.sql).
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
