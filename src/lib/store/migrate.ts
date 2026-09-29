import { promises as fs } from "fs";
import path from "path";
import { Client } from "pg";
import { supabaseEnv } from "./env";

/**
 * Crea las tablas corriendo supabase/schema.sql por conexión directa a Postgres.
 * Solo se usa si la base de Supabase está vacía y hay una URL de Postgres (la integración de Vercel la carga).
 */
export async function runSchema(): Promise<void> {
  const { pg } = supabaseEnv();
  if (!pg) throw new Error("La base de Supabase no tiene las tablas y falta POSTGRES_URL para crearlas: corré supabase/schema.sql en el SQL Editor.");
  const sql = await fs.readFile(path.join(process.cwd(), "supabase", "schema.sql"), "utf8");
  const conn = pg.replace(/([?&])sslmode=[^&]*&?/, "$1").replace(/[?&]$/, "");
  const client = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}
