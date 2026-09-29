import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_INDICATORS, DEFAULT_MAP_POINTS, DEFAULT_SECTIONS, DEFAULT_SETTINGS, DEFAULT_SOURCES } from "../defaults";
import type { Article, ArticleQuery, Settings, TableName, Tables } from "../types";
import type { Store } from "./index";

export class SupabaseStore implements Store {
  readonly kind = "supabase" as const;
  private sb: SupabaseClient;
  private seeded: Promise<void> | null = null;

  constructor(url: string, key: string) {
    this.sb = createClient(url, key, { auth: { persistSession: false } });
  }

  private check<T>(res: { data: T; error: { message: string } | null }): T {
    if (res.error) throw new Error(`Supabase: ${res.error.message}`);
    return res.data;
  }

  /** La primera vez que se usa una base vacía, carga la configuración inicial. */
  private ensureSeed(): Promise<void> {
    this.seeded ??= (async () => {
      const row = this.check(await this.sb.from("settings").select("id").eq("id", "site").maybeSingle());
      if (row) return;
      await this.sb.from("settings").upsert({ id: "site", value: DEFAULT_SETTINGS });
      await this.sb.from("sources").upsert(DEFAULT_SOURCES);
      await this.sb.from("indicators").upsert(DEFAULT_INDICATORS);
      await this.sb.from("sections").upsert(DEFAULT_SECTIONS);
      await this.sb.from("map_points").upsert(DEFAULT_MAP_POINTS);
    })().catch((e) => {
      this.seeded = null;
      throw e;
    });
    return this.seeded;
  }

  async list<T extends TableName>(table: T): Promise<Tables[T][]> {
    await this.ensureSeed();
    const q = this.sb.from(table).select("*");
    const ordered = table === "articles" || table === "briefs" ? q.order(table === "articles" ? "published_at" : "date", { ascending: false }).limit(500) : q;
    return this.check(await ordered) as Tables[T][];
  }

  async get<T extends TableName>(table: T, id: string): Promise<Tables[T] | null> {
    await this.ensureSeed();
    return this.check(await this.sb.from(table).select("*").eq("id", id).maybeSingle()) as Tables[T] | null;
  }

  async upsert<T extends TableName>(table: T, rows: Tables[T][]): Promise<void> {
    if (!rows.length) return;
    this.check(await this.sb.from(table).upsert(rows as object[]));
  }

  async patch<T extends TableName>(table: T, id: string, patch: Partial<Tables[T]>): Promise<void> {
    this.check(await this.sb.from(table).update(patch as object).eq("id", id));
  }

  async remove(table: TableName, id: string): Promise<void> {
    this.check(await this.sb.from(table).delete().eq("id", id));
  }

  async existingArticleIds(ids: string[]): Promise<Set<string>> {
    if (!ids.length) return new Set();
    const rows = this.check(await this.sb.from("articles").select("id").in("id", ids)) as { id: string }[];
    return new Set(rows.map((r) => r.id));
  }

  async insertNewArticles(rows: Article[]): Promise<Article[]> {
    if (!rows.length) return [];
    const inserted = this.check(
      await this.sb.from("articles").upsert(rows, { onConflict: "id", ignoreDuplicates: true }).select("*"),
    ) as Article[];
    return inserted ?? [];
  }

  private buildQuery(q: ArticleQuery, head = false) {
    let query = this.sb.from("articles").select("*", head ? { count: "exact", head: true } : undefined);
    const status = q.status ?? "published";
    if (status !== "all") query = query.eq("status", status);
    if (q.category) query = query.eq("category", q.category);
    if (q.featured !== undefined) query = query.eq("featured", q.featured);
    if (q.since) query = query.gte("published_at", q.since);
    if (q.search?.trim()) {
      const s = q.search.trim().replace(/[%,()]/g, " ");
      query = query.or(`title.ilike.%${s}%,summary.ilike.%${s}%`);
    }
    return query;
  }

  async queryArticles(q: ArticleQuery): Promise<Article[]> {
    await this.ensureSeed();
    let query = this.buildQuery(q);
    if (q.orderBy === "views") query = query.order("views", { ascending: false });
    query = query.order("published_at", { ascending: false });
    const off = q.offset ?? 0;
    query = query.range(off, off + (q.limit ?? 50) - 1);
    return this.check(await query) as Article[];
  }

  async countArticles(q: ArticleQuery): Promise<number> {
    const res = await this.buildQuery(q, true);
    if (res.error) throw new Error(res.error.message);
    return res.count ?? 0;
  }

  async incrementViews(id: string): Promise<void> {
    await this.sb.rpc("increment_article_views", { article_id: id });
  }

  async deleteArticlesBefore(iso: string): Promise<number> {
    const res = await this.sb.from("articles").delete({ count: "exact" }).lt("published_at", iso).eq("featured", false);
    if (res.error) throw new Error(res.error.message);
    return res.count ?? 0;
  }

  async getSettings(): Promise<Settings> {
    await this.ensureSeed();
    const row = this.check(await this.sb.from("settings").select("value").eq("id", "site").maybeSingle()) as { value: Settings } | null;
    return { ...DEFAULT_SETTINGS, ...(row?.value ?? {}) };
  }

  async saveSettings(patch: Partial<Settings>): Promise<Settings> {
    const next = { ...(await this.getSettings()), ...patch };
    this.check(await this.sb.from("settings").upsert({ id: "site", value: next }));
    return next;
  }
}
