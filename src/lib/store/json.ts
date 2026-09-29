import { promises as fs } from "fs";
import path from "path";
import { DEFAULT_INDICATORS, DEFAULT_MAP_POINTS, DEFAULT_SECTIONS, DEFAULT_SETTINGS, DEFAULT_SOURCES } from "../defaults";
import type { Article, ArticleQuery, Settings, TableName, Tables } from "../types";
import { filterArticles, type Store } from "./index";

type Row = { id: string };
type Db = { settings: Settings } & { [K in TableName]: Tables[K][] };

/**
 * Almacenamiento en un archivo JSON local. Pensado para desarrollo y demos:
 * en producción usar Supabase (las funciones serverless no tienen disco persistente).
 */
export class JsonStore implements Store {
  readonly kind = "json" as const;
  private file: string;
  private db: Db | null = null;
  private mtime = 0;
  private loading: Promise<Db> | null = null;
  private writing: Promise<void> = Promise.resolve();

  constructor() {
    const dir = process.env.DATA_DIR || (process.env.VERCEL ? "/tmp/codigo-energia" : path.join(process.cwd(), ".data"));
    this.file = path.join(dir, "db.json");
  }

  private load(): Promise<Db> {
    // una sola lectura concurrente; se relee si otro proceso modificó el archivo
    return (this.loading ??= this.read().finally(() => (this.loading = null)));
  }

  private async read(): Promise<Db> {
    let stat: { mtimeMs: number } | null = null;
    try {
      stat = await fs.stat(this.file);
    } catch {
      /* todavía no existe */
    }
    if (this.db && stat && stat.mtimeMs === this.mtime) return this.db;
    if (stat) {
      this.db = JSON.parse(await fs.readFile(this.file, "utf8")) as Db;
      this.db.settings = { ...DEFAULT_SETTINGS, ...this.db.settings };
      this.mtime = stat.mtimeMs;
      return this.db;
    }
    if (!this.db) {
      this.db = {
        settings: DEFAULT_SETTINGS,
        articles: [],
        sources: DEFAULT_SOURCES.map((s) => ({ ...s })),
        indicators: DEFAULT_INDICATORS,
        sections: DEFAULT_SECTIONS,
        map_points: DEFAULT_MAP_POINTS,
        briefs: [],
      };
      await this.save();
    }
    return this.db;
  }

  private save(): Promise<void> {
    this.writing = this.writing.then(async () => {
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      const tmp = `${this.file}.${process.pid}.${Date.now()}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(this.db));
      await fs.rename(tmp, this.file);
      this.mtime = (await fs.stat(this.file)).mtimeMs;
    });
    return this.writing;
  }

  async list<T extends TableName>(table: T): Promise<Tables[T][]> {
    return [...(await this.load())[table]] as Tables[T][];
  }

  async get<T extends TableName>(table: T, id: string): Promise<Tables[T] | null> {
    const rows = (await this.load())[table] as Row[];
    return (rows.find((r) => r.id === id) as Tables[T]) ?? null;
  }

  async upsert<T extends TableName>(table: T, rows: Tables[T][]): Promise<void> {
    const db = await this.load();
    const list = db[table] as Row[];
    for (const row of rows as Row[]) {
      const i = list.findIndex((r) => r.id === row.id);
      if (i >= 0) list[i] = { ...list[i], ...row };
      else list.push(row);
    }
    await this.save();
  }

  async patch<T extends TableName>(table: T, id: string, patch: Partial<Tables[T]>): Promise<void> {
    const db = await this.load();
    const list = db[table] as Row[];
    const i = list.findIndex((r) => r.id === id);
    if (i >= 0) {
      list[i] = { ...list[i], ...patch };
      await this.save();
    }
  }

  async remove(table: TableName, id: string): Promise<void> {
    const db = await this.load();
    (db[table] as Row[]) = (db[table] as Row[]).filter((r) => r.id !== id);
    await this.save();
  }

  async existingArticleIds(ids: string[]): Promise<Set<string>> {
    const db = await this.load();
    const want = new Set(ids);
    return new Set(db.articles.filter((a) => want.has(a.id)).map((a) => a.id));
  }

  async insertNewArticles(rows: Article[]): Promise<Article[]> {
    const db = await this.load();
    const existing = new Set(db.articles.map((a) => a.id));
    const fresh = rows.filter((r) => !existing.has(r.id));
    db.articles.push(...fresh);
    if (fresh.length) await this.save();
    return fresh;
  }

  async queryArticles(q: ArticleQuery): Promise<Article[]> {
    return filterArticles((await this.load()).articles, q);
  }

  async countArticles(q: ArticleQuery): Promise<number> {
    return filterArticles((await this.load()).articles, { ...q, limit: undefined, offset: 0 }).length;
  }

  async incrementViews(id: string): Promise<void> {
    const db = await this.load();
    const a = db.articles.find((x) => x.id === id);
    if (a) {
      a.views = (a.views ?? 0) + 1;
      await this.save();
    }
  }

  async deleteArticlesBefore(iso: string): Promise<number> {
    const db = await this.load();
    const before = db.articles.length;
    db.articles = db.articles.filter((a) => a.published_at >= iso || a.featured);
    await this.save();
    return before - db.articles.length;
  }

  async getSettings(): Promise<Settings> {
    return (await this.load()).settings;
  }

  async saveSettings(patch: Partial<Settings>): Promise<Settings> {
    const db = await this.load();
    db.settings = { ...db.settings, ...patch };
    await this.save();
    return db.settings;
  }
}
