/**
 * Credenciales de Supabase. Acepta tanto los nombres propios del proyecto como los que carga
 * la integración de Supabase en Vercel (SUPABASE_SECRET_KEY, NEXT_PUBLIC_SUPABASE_URL, POSTGRES_URL…).
 */
export function supabaseEnv() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
  const pg = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || process.env.DATABASE_URL || "";
  return { url, key, pg, ok: !!(url && key) };
}
