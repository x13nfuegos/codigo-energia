import type { Article, ArticleQuery, Settings, TableName, Tables } from "../types";

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

const g = globalThis as { __ceStore?: Promise<Store> };

export function getStore(): Promise<Store> {
  return (g.__ceStore ??= createStore());
}

async function createStore(): Promise<Store> {
  let store: Store;
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { SupabaseStore } = await import("./supabase");
    store = new SupabaseStore(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  } else {
    const { JsonStore } = await import("./json");
    store = new JsonStore();
  }
  return store;
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
