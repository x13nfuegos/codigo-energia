import { getStore } from "./store";

/**
 * Locks entre instancias de Vercel, guardados en la configuración (settings.locks) con escritura atómica.
 * Evitan que dos instancias hagan a la vez la misma tarea en segundo plano (scrapeo, resumen, Instagram…).
 * Cada lock vence solo: si una instancia se corta a mitad de camino, otra puede tomarlo pasado `ttlMs`.
 */
export async function tryLock(name: string, ttlMs: number): Promise<boolean> {
  const store = await getStore();
  const now = Date.now();
  const res = await store.updateSettings((s) => {
    const locks = s.locks ?? {};
    const until = locks[name] ? new Date(locks[name]).getTime() : 0;
    if (until > now) return null; // lo tiene otra instancia
    // de paso se limpian los vencidos
    const alive = Object.fromEntries(Object.entries(locks).filter(([, v]) => new Date(v).getTime() > now));
    return { locks: { ...alive, [name]: new Date(now + ttlMs).toISOString() } };
  });
  return res !== null;
}

export async function releaseLock(name: string): Promise<void> {
  const store = await getStore();
  await store.updateSettings((s) => {
    if (!s.locks?.[name]) return null;
    const { [name]: _gone, ...rest } = s.locks;
    void _gone;
    return { locks: rest };
  });
}

/** Corre `fn` solo si consigue el lock; si no, devuelve { ran: false } sin hacer nada. */
export async function withLock<T>(name: string, ttlMs: number, fn: () => Promise<T>): Promise<{ ran: true; value: T } | { ran: false }> {
  if (!(await tryLock(name, ttlMs))) return { ran: false };
  try {
    return { ran: true, value: await fn() };
  } finally {
    await releaseLock(name).catch((e) => console.error(`lock ${name}: no se pudo liberar`, e));
  }
}
