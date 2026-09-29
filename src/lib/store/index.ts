import type { Article, ArticleQuery, Settings, TableName, Tables } from "../types";
import { supabaseEnv } from "./env";

export interface Store {
  readonly kind: "supabase" | "json";
  list<T extends TableName>(table: T): Promise<Tables[T][]>;
  get<T extends TableName>(table: T, id: string): Promise<Tables[T] | null>;
  upsert<T extends TableName>(table: T, rows: Tables[T][]): Promise<void>;
  patch<T extends TableName>(table: T, id: string, patch: Partial<Tables[T]>): Promise<void>;
  remove(table: TableName, id: string): Promise<void>;
  /** inserta solo las notas cuyo id no existe; devuelve cuántas entraron */
  insertNewArticles(rows: Article[]): Promise<Article[]>;
  existingArticleIds(ids: string[]): Promise<Set<string>>;
  queryArticles(q: ArticleQuery): Promise<Article[]>;
  countArticles(q: ArticleQuery): Promise<number>;
  incrementViews(id: string): Promise<void>;
  deleteArticlesBefore(iso: string): Promise<number>;
  getSettings(): Promise<Settings>;
  saveSettings(patch: Partial<Settings>): Promise<Settings>;
}

const g = globalThis as { __ceStore?: Promise<Store>; __ceStoreAt?: number };
const RETRY_SUPABASE_MS = 5 * 60000;

export function getStore(): Promise<Store> {
  // si se cayó a almacenamiento temporal, se reintenta Supabase cada 5 minutos (no en cada visita)
  if (g.__ceStore && storeWarning && Date.now() - (g.__ceStoreAt ?? 0) > RETRY_SUPABASE_MS) g.__ceStore = undefined;
  if (!g.__ceStore) {
    g.__ceStoreAt = Date.now();
    g.__ceStore = createStore();
  }
  return g.__ceStore;
}

/** Si Supabase está configurado pero no se puede usar, se informa en el tablero del back office. */
export let storeWarning: string | null = null;

async function createStore(): Promise<Store> {
  const env = supabaseEnv();
  if (env.ok) {
    const { SupabaseStore } = await import("./supabase");
    const sb = new SupabaseStore(env.url, env.key);
    try {
      await sb.ready();
      storeWarning = null;
      return sb;
    } catch (e) {
      // sin reintento inmediato: se usa el archivo local y en la próxima instancia se vuelve a probar
      storeWarning = `Supabase configurado pero no disponible (${e instanceof Error ? e.message : String(e)}). Se está usando almacenamiento temporal.`;
      console.error(storeWarning);
    }
  }
  const { JsonStore } = await import("./json");
  return new JsonStore();
}

export function filterArticles(all: Article[], q: ArticleQuery): Article[] {
  const status = q.status ?? "published";
  const s = q.search?.trim().toLowerCase();
  let out = all.filter(
    (a) =>
      (status === "all" || a.status === status) &&
      (!q.category || (Array.isArray(q.category) ? q.category.includes(a.category) : a.category === q.category)) &&
      (q.featured === undefined || !!a.featured === q.featured) &&
      (!q.since || a.published_at >= q.since) &&
      (!q.hasGeo || !!a.geo) &&
      (!q.hasImage || !!a.image) &&
      (!q.photoOk || (!!a.image && (a.tags ?? []).includes("foto:ok"))) &&
      (!s || a.title.toLowerCase().includes(s) || a.summary.toLowerCase().includes(s)),
  );
  out = out.sort((a, b) =>
    q.orderBy === "views"
      ? (b.views ?? 0) - (a.views ?? 0) || b.published_at.localeCompare(a.published_at)
      : b.published_at.localeCompare(a.published_at),
  );
  const off = q.offset ?? 0;
  return out.slice(off, q.limit ? off + q.limit : undefined);
}
