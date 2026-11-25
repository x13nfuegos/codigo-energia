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

  /** Verifica la conexión; si faltan las tablas intenta crearlas y después carga la configuración inicial. */
  async ready(): Promise<void> {
    const probe = await this.sb.from("settings").select("id").limit(1);
    if (probe.error) {
      const missing = /does not exist|schema cache|PGRST205|42P01/i.test(`${probe.error.message} ${(probe.error as { code?: string }).code ?? ""}`);
      if (!missing) throw new Error(probe.error.message);
      const { runSchema } = await import("./migrate");
      await runSchema();
      // PostgREST tarda unos segundos en ver las tablas nuevas
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        if (!(await this.sb.from("settings").select("id").limit(1)).error) break;
      }
    }
    await this.ensureSeed();
  }

  /**
   * Carga la configuración inicial en las tablas que estén vacías (una vez por instancia).
   * Revisa tabla por tabla: repara bases a las que les quedó algo sin cargar.
   */
  private ensureSeed(): Promise<void> {
    this.seeded ??= (async () => {
      const seeds: [TableName, object[]][] = [
        ["sources", DEFAULT_SOURCES],
        ["indicators", DEFAULT_INDICATORS],
        ["sections", DEFAULT_SECTIONS],
        ["map_points", DEFAULT_MAP_POINTS],
      ];
      for (const [table, rows] of seeds) {
        const { count, error } = await this.sb.from(table).select("id", { count: "exact", head: true });
        if (error) throw new Error(`Supabase (${table}): ${error.message}`);
        if (!count) this.check(await this.sb.from(table).upsert(rows));
      }
      const row = this.check(await this.sb.from("settings").select("id").eq("id", "site").maybeSingle());
      if (!row) this.check(await this.sb.from("settings").upsert({ id: "site", value: DEFAULT_SETTINGS }));
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
    if (Array.isArray(q.category)) query = query.in("category", q.category);
    else if (q.category) query = query.eq("category", q.category);
    if (q.featured !== undefined) query = query.eq("featured", q.featured);
    if (q.since) query = query.gte("published_at", q.since);
    if (q.hasGeo) query = query.not("geo", "is", null);
    if (q.hasImage || q.photoOk) query = query.not("image", "is", null).neq("image", "");
    if (q.photoOk) query = query.filter("tags", "cs", '["foto:ok"]');
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

  /** fila cruda de la configuración, con su número de revisión (_rev) para escribir sin pisar a otros */
  private async readSettings(): Promise<{ value: Settings & { _rev?: number }; exists: boolean }> {
    await this.ensureSeed();
    const row = this.check(await this.sb.from("settings").select("value").eq("id", "site").maybeSingle()) as { value: Settings & { _rev?: number } } | null;
    return { value: { ...DEFAULT_SETTINGS, ...(row?.value ?? {}) }, exists: !!row };
  }

  async getSettings(): Promise<Settings> {
    const { _rev, ...settings } = (await this.readSettings()).value;
    void _rev;
    return settings;
  }

  async saveSettings(patch: Partial<Settings>): Promise<Settings> {
    return (await this.updateSettings(() => patch)) as Settings;
  }

  /**
   * Compare-and-swap sobre la fila de configuración: solo escribe si nadie la cambió desde que se leyó
   * (filtro por value->>_rev). Si otra tarea escribió en el medio, se relee y se reintenta.
   * Así dos tareas en paralelo (scrapeo, audio, Instagram, admin) no se pisan los cambios.
   */
  async updateSettings(fn: (current: Settings) => Partial<Settings> | null): Promise<Settings | null> {
    let lastInsertError = "";
    for (let attempt = 0; attempt < 8; attempt++) {
      const { value, exists } = await this.readSettings();
      const { _rev, ...current } = value;
      const patch = fn(current);
      if (!patch) return null;
      const next = { ...current, ...patch };
      const stored = { ...next, _rev: (_rev ?? 0) + 1 };
      if (!exists) {
        const ins = await this.sb.from("settings").insert({ id: "site", value: stored });
        if (!ins.error) return next;
        lastInsertError = ins.error.message; // si fue una carrera, la próxima vuelta ya encuentra la fila
      } else {
        let q = this.sb.from("settings").update({ value: stored }).eq("id", "site");
        q = _rev === undefined ? q.is("value->>_rev", null) : q.eq("value->>_rev", String(_rev));
        const res = await q.select("id");
        if (res.error) {
          // si el filtro por revisión no anduviera, se guarda como antes (sin protección) en lugar de romper el sitio
          console.error("settings: compare-and-swap falló, se guarda sin control de revisión", res.error.message);
          this.check(await this.sb.from("settings").upsert({ id: "site", value: stored }));
          return next;
        }
        if (res.data?.length) return next;
      }
      // otra instancia escribió primero: esperar un poco (con azar) y volver a intentar con lo nuevo
      await new Promise((r) => setTimeout(r, 50 + Math.random() * 150 * (attempt + 1)));
    }
    throw new Error(
      lastInsertError
        ? `Supabase: no se pudo crear la configuración (${lastInsertError})`
        : "Supabase: no se pudo guardar la configuración (demasiadas escrituras simultáneas)",
    );
  }
}
