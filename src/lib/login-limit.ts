import { createHash } from "crypto";
import { getStore } from "./store";

/** Intentos fallidos permitidos por IP dentro de la ventana; después se bloquea hasta que la ventana vence. */
const MAX_FAILS = 5;
const WINDOW_MS = 15 * 60000;
const MAX_TRACKED = 200;

/** la IP no se guarda tal cual: alcanza con un hash para contar intentos */
function key(ip: string): string {
  return createHash("sha256").update(`login:${ip}`).digest("hex").slice(0, 16);
}

type Fails = Record<string, { count: number; first: string }>;

function alive(fails: Fails | undefined, now: number): Fails {
  return Object.fromEntries(Object.entries(fails ?? {}).filter(([, f]) => now - new Date(f.first).getTime() < WINDOW_MS));
}

/** Minutos que faltan para poder volver a intentar, o 0 si la IP puede intentar. */
export async function loginBlockedFor(ip: string): Promise<number> {
  const now = Date.now();
  const f = alive((await (await getStore()).getSettings()).login_fails, now)[key(ip)];
  if (!f || f.count < MAX_FAILS) return 0;
  return Math.max(1, Math.ceil((new Date(f.first).getTime() + WINDOW_MS - now) / 60000));
}

export async function recordLoginFailure(ip: string): Promise<void> {
  const now = Date.now();
  const k = key(ip);
  await (await getStore()).updateSettings((s) => {
    const fails = alive(s.login_fails, now);
    const prev = fails[k];
    fails[k] = prev ? { ...prev, count: prev.count + 1 } : { count: 1, first: new Date(now).toISOString() };
    // tope de entradas para que la configuración no crezca sin límite
    const entries = Object.entries(fails).sort((a, b) => b[1].first.localeCompare(a[1].first)).slice(0, MAX_TRACKED);
    return { login_fails: Object.fromEntries(entries) };
  });
}

export async function clearLoginFailures(ip: string): Promise<void> {
  const k = key(ip);
  await (await getStore()).updateSettings((s) => {
    if (!s.login_fails?.[k]) return null;
    const { [k]: _gone, ...rest } = s.login_fails;
    void _gone;
    return { login_fails: rest };
  });
}
