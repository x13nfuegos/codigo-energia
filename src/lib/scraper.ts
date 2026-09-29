import { createHash } from "crypto";
import * as cheerio from "cheerio";
import Parser from "rss-parser";
import { makeGeolocator } from "./geo";
import { isGoogleNewsUrl, resolveGoogleNewsUrl } from "./gnews";
import { getStore } from "./store";
import type { Article, Source } from "./types";

const UA =
  "Mozilla/5.0 (compatible; CodigoEnergiaBot/1.0; +https://codigoenergia.ar) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

export async function fetchText(url: string, timeoutMs = 15000): Promise<string> {
  const res = await fetch(url, {
    headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml,application/xml,application/rss+xml;q=0.9,*/*;q=0.8" },
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
  return res.text();
}

export interface RawItem {
  title: string;
  url: string;
  summary: string;
  image?: string | null;
  date?: string | null;
  source_name?: string | null;
}

export function stripHtml(html: string): string {
  if (!html) return "";
  const text = cheerio.load(`<div>${html}</div>`)("div").text();
  return text.replace(/\s+/g, " ").replace(/\[…\]|\[\.\.\.\]/g, "…").trim();
}

export function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  return cut.slice(0, cut.lastIndexOf(" ") > n * 0.6 ? cut.lastIndexOf(" ") : n).trimEnd() + "…";
}

export function normalizeUrl(u: string): string {
  try {
    const url = new URL(u);
    url.hash = "";
    for (const k of [...url.searchParams.keys()]) if (/^(utm_|fbclid|gclid|ref$|oc$)/.test(k)) url.searchParams.delete(k);
    return url.toString().replace(/\/$/, "");
  } catch {
    return u.trim();
  }
}

export function articleId(url: string): string {
  return createHash("sha1").update(normalizeUrl(url)).digest("hex").slice(0, 16);
}

export function titleKey(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

/** Bing News en RSS: trae el link real de la nota (en el parámetro url) y una foto por noticia. */
export function bingNewsUrl(query: string): string {
  return `https://www.bing.com/news/search?q=${encodeURIComponent(query.replace(/\s*when:\d+[hd]/, ""))}&format=rss&cc=AR&setlang=es`;
}

function unwrapBing(u: string): string {
  try {
    const url = new URL(u);
    if (/(^|\.)bing\.com$/.test(url.hostname) && url.searchParams.get("url")) return url.searchParams.get("url")!;
  } catch {
    /* URL inválida: se deja como está */
  }
  return u;
}

function bingImage(u?: string | null): string | null {
  if (!u) return null;
  try {
    const url = new URL(u.replace(/^http:/, "https:"));
    if (url.hostname.endsWith("bing.com") && url.pathname === "/th") {
      url.searchParams.set("w", "800");
      url.searchParams.set("h", "450");
      url.searchParams.set("c", "7");
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function googleNewsUrl(query: string): string {
  const q = /when:\d+[hd]/.test(query) ? query : `${query} when:2d`;
  return `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=es-419&gl=AR&ceid=AR:es-419`;
}

type FeedItem = {
  title?: string;
  link?: string;
  contentSnippet?: string;
  content?: string;
  summary?: string;
  isoDate?: string;
  pubDate?: string;
  enclosure?: { url?: string; type?: string };
  mediaContent?: { $?: { url?: string } } | { $?: { url?: string } }[];
  mediaThumbnail?: { $?: { url?: string } };
  source?: string | { _?: string };
  "content:encoded"?: string;
  newsImage?: string;
  newsSource?: string;
};

const parser: Parser<object, FeedItem> = new Parser({
  customFields: {
    item: [
      ["media:content", "mediaContent", { keepArray: false }],
      ["media:thumbnail", "mediaThumbnail"],
      ["source", "source"],
      ["content:encoded", "content:encoded"],
      ["News:Image", "newsImage"],
      ["News:Source", "newsSource"],
    ],
  },
});

function firstImgInHtml(html?: string): string | null {
  if (!html) return null;
  const $ = cheerio.load(html);
  return $("img").first().attr("src") ?? null;
}

export async function parseFeed(xml: string, isGoogleNews = false): Promise<RawItem[]> {
  const feed = await parser.parseString(xml);
  return (feed.items ?? [])
    .filter((it) => it.title && it.link)
    .map((it) => {
      let title = stripHtml(it.title!);
      let source_name: string | null = null;
      if (it.source) source_name = typeof it.source === "string" ? it.source : it.source._ ?? null;
      if (it.newsSource) source_name = it.newsSource;
      if (isGoogleNews) {
        // "Titular - Medio" → separar el medio
        const m = title.match(/^(.*) - ([^-]{2,60})$/);
        if (m) {
          title = m[1].trim();
          source_name ??= m[2].trim();
        }
      }
      const media = Array.isArray(it.mediaContent) ? it.mediaContent[0] : it.mediaContent;
      const image =
        bingImage(it.newsImage) ??
        media?.$?.url ??
        it.mediaThumbnail?.$?.url ??
        (it.enclosure?.type?.startsWith("image") ? it.enclosure.url : undefined) ??
        firstImgInHtml(it["content:encoded"] ?? it.content) ??
        null;
      const rawSummary = isGoogleNews ? "" : it.contentSnippet || stripHtml(it.summary ?? it.content ?? "");
      return {
        title,
        url: unwrapBing(it.link!),
        summary: truncate(stripHtml(rawSummary), 420),
        image,
        date: it.isoDate ?? (it.pubDate ? new Date(it.pubDate).toISOString() : null),
        source_name,
      };
    });
}

export function parseHtmlList(html: string, baseUrl: string, sel: NonNullable<Source["selectors"]>): RawItem[] {
  const $ = cheerio.load(html);
  const abs = (u?: string | null) => {
    if (!u) return null;
    try {
      return new URL(u, baseUrl).toString();
    } catch {
      return null;
    }
  };
  const items: RawItem[] = [];
  $(sel.item).each((_, el) => {
    const $el = $(el);
    const titleEl = sel.title ? $el.find(sel.title).first() : $el;
    const linkEl = sel.link ? $el.find(sel.link).first() : $el.is("a") ? $el : $el.find("a").first();
    const title = titleEl.text().replace(/\s+/g, " ").trim();
    const url = abs(linkEl.attr("href"));
    if (!title || !url) return;
    const imgEl = sel.image ? $el.find(sel.image).first() : $el.find("img").first();
    const image = abs(imgEl.attr("data-src") || imgEl.attr("src") || imgEl.attr("data-lazy-src"));
    const summary = sel.summary ? $el.find(sel.summary).first().text().replace(/\s+/g, " ").trim() : "";
    const dateEl = sel.date ? $el.find(sel.date).first() : null;
    const dateStr = dateEl?.attr("datetime") || dateEl?.text().trim();
    const d = dateStr ? new Date(dateStr) : null;
    items.push({ title, url, summary: truncate(summary, 420), image, date: d && !isNaN(+d) ? d.toISOString() : null });
  });
  return items;
}

export interface PageMeta {
  image?: string | null;
  description?: string | null;
  published?: string | null;
}

export function extractMeta(html: string, pageUrl: string): PageMeta {
  const $ = cheerio.load(html);
  const meta = (...names: string[]) => {
    for (const n of names) {
      const v = $(`meta[property="${n}"]`).attr("content") || $(`meta[name="${n}"]`).attr("content");
      if (v) return v.trim();
    }
    return null;
  };
  let image = meta("og:image", "og:image:url", "twitter:image");
  if (image) {
    try {
      image = new URL(image, pageUrl).toString();
    } catch {
      image = null;
    }
  }
  return {
    image,
    description: meta("og:description", "description", "twitter:description"),
    published: meta("article:published_time", "og:updated_time", "date"),
  };
}

// Orden = prioridad. Solo se ancla el inicio de palabra para aceptar plurales y derivados.
/** Descarta logos, íconos y píxeles de seguimiento; fuerza https para evitar contenido mixto. */
export function cleanImage(src?: string | null): string | null {
  if (!src) return null;
  let u = src.trim();
  if (u.startsWith("//")) u = `https:${u}`;
  if (!/^https?:\/\//.test(u)) return null;
  u = u.replace(/^http:\/\//, "https://");
  if (/\.(svg|ico)(\?|$)|gravatar|logo|favicon|placeholder|blank\.(gif|png)|1x1|pixel|spacer|lh3\.googleusercontent|news\.google/i.test(u)) return null;
  return u;
}

/** Completa imagen, bajada, fecha y URL real de una nota leyendo la página original. */
export async function enrichItem(it: RawItem): Promise<void> {
  if (isGoogleNewsUrl(it.url)) {
    const real = await resolveGoogleNewsUrl(it.url).catch(() => null);
    if (real) it.url = real;
    else return;
  }
  const meta = extractMeta(await fetchText(it.url, 10000), it.url);
  it.image = cleanImage(it.image) ?? cleanImage(meta.image);
  if (!it.summary && meta.description) it.summary = truncate(stripHtml(meta.description), 420);
  if (!it.date && meta.published && !isNaN(+new Date(meta.published))) it.date = new Date(meta.published).toISOString();
}

const CLASSIFIER: [string, RegExp][] = [
  ["mineria", /(^|[^\p{L}])(miner[ií]a|miner[oa]s?|mining|litio|lithium|cobre|copper|oro\b|plata\b|salar(es)?\b|uranio|metalífer|exploraci[oó]n minera|RIGI minero)/iu],
  ["renovables", /(^|[^\p{L}])(solar(es)?\b|e[oó]lic|renovable|fotovoltaic|hidr[oó]geno verde|biocombustible|bioetanol|biodi[eé]sel)/iu],
  ["electricidad", /(^|[^\p{L}])(CAMMESA|tarifas? el[eé]ctric|electricidad|transmisi[oó]n el[eé]ctrica|distribuidora|Edenor|Edesur|apag[oó]n|demanda el[eé]ctrica)/iu],
  ["oil-gas", /(^|[^\p{L}])(petr[oó]le|crudo|Vaca Muerta|shale|gas natural|GNL|LNG|oleoducto|gasoducto|YPF|barril|refiner[ií]a|nafta|combustible|upstream|fractura|Chevron|Vista Energy|Tecpetrol|El Trapial)/iu],
];

export function classify(text: string, fallback: string): string {
  for (const [slug, re] of CLASSIFIER) if (re.test(text)) return slug;
  return fallback === "auto" ? "energia" : fallback;
}

function matchesKeywords(text: string, include: string[], exclude: string[]): boolean {
  const t = text.toLowerCase();
  if (exclude.some((k) => k.trim() && t.includes(k.trim().toLowerCase()))) return false;
  if (!include.filter((k) => k.trim()).length) return true;
  return include.some((k) => k.trim() && t.includes(k.trim().toLowerCase()));
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    }),
  );
  return out;
}

/** Descarga y parsea una fuente sin guardar nada. Se usa también para "Probar fuente" en el back office. */
export async function fetchSource(source: Source): Promise<RawItem[]> {
  let items: RawItem[];
  if (source.type === "google_news") {
    items = await parseFeed(await fetchText(googleNewsUrl(source.url)), true);
  } else if (source.type === "bing_news") {
    items = await parseFeed(await fetchText(bingNewsUrl(source.url)));
  } else if (source.type === "rss") {
    items = await parseFeed(await fetchText(source.url));
  } else {
    if (!source.selectors?.item) throw new Error("La fuente HTML necesita al menos el selector de item");
    items = parseHtmlList(await fetchText(source.url), source.url, source.selectors);
  }
  return items
    .filter((it) => matchesKeywords(`${it.title} ${it.summary}`, source.include_keywords ?? [], source.exclude_keywords ?? []))
    .slice(0, source.max_items || 20);
}

export interface SourceReport {
  source: string;
  found: number;
  inserted: number;
  error?: string;
}

/** Notas ya guardadas por título normalizado (para no duplicar entre medios y completar fotos). */
export type KnownTitles = Map<string, { id: string; image: boolean; url: string }>;

export async function scrapeSource(source: Source, knownTitles: KnownTitles, geo = makeGeolocator()): Promise<{ report: SourceReport; inserted: Article[] }> {
  const store = await getStore();
  const now = new Date().toISOString();
  try {
    const raw = await fetchSource(source);
    // el id se calcula con el link del feed (estable entre corridas), antes de resolver redirecciones
    const ids = raw.map((r) => articleId(r.url));
    const existing = await store.existingArticleIds(ids);
    const withIds = raw.map((r, i) => ({ ...r, id: ids[i] }));
    // la misma noticia ya está guardada (de otra fuente) sin foto: se completa con la de esta fuente
    for (const r of withIds) {
      const k = knownTitles.get(titleKey(r.title));
      const img = cleanImage(r.image);
      if (k && !k.image && img && k.id !== r.id) {
        await store.patch("articles", k.id, { image: img, enriched: true, ...(isGoogleNewsUrl(k.url) && !isGoogleNewsUrl(r.url) ? { url: normalizeUrl(r.url) } : {}) });
        k.image = true;
      }
    }
    const fresh = withIds.filter((r) => !existing.has(r.id) && !knownTitles.has(titleKey(r.title)));

    // Primero se guardan las notas (rápido); las de Google News se completan después con enrichMissing,
    // así un scrapeo lento nunca deja la portada vacía. En feeds directos se busca la imagen con tope de tiempo.
    if (source.fetch_meta && source.type !== "google_news") {
      const deadline = Date.now() + 20000;
      await mapLimit(fresh, 4, async (it) => {
        if ((it.image && it.summary && it.date) || Date.now() > deadline) return;
        try {
          await enrichItem(it);
        } catch {
          /* la nota se guarda igual, sin imagen */
        }
      });
    }

    const rows: Article[] = fresh.map((it) => {
      knownTitles.set(titleKey(it.title), { id: it.id, image: !!cleanImage(it.image), url: it.url });
      const published = it.date && new Date(it.date) <= new Date() ? it.date : now;
      return {
        id: it.id,
        url: normalizeUrl(it.url),
        title: it.title,
        summary: it.summary,
        image: cleanImage(it.image),
        enriched: !!cleanImage(it.image) || !isGoogleNewsUrl(it.url),
        source_id: source.id,
        source_name: it.source_name || source.name.replace(/^Google News · /, ""),
        category: source.category === "auto" ? classify(`${it.title} ${it.summary}`, "auto") : source.category,
        tags: [],
        published_at: published,
        scraped_at: now,
        status: source.auto_publish ? "published" : "draft",
        featured: false,
        views: 0,
        geo: geo(it.title, it.summary),
      };
    });
    const inserted = await store.insertNewArticles(rows);
    await store.patch("sources", source.id, { last_run_at: now, last_status: "ok", last_count: inserted.length });
    return { report: { source: source.name, found: raw.length, inserted: inserted.length }, inserted };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await store.patch("sources", source.id, { last_run_at: now, last_status: `error: ${msg}`.slice(0, 300), last_count: 0 });
    return { report: { source: source.name, found: 0, inserted: 0, error: msg }, inserted: [] };
  }
}

export async function runScrape(onlySourceId?: string): Promise<{ reports: SourceReport[]; inserted: number; removed: number }> {
  const store = await getStore();
  const settings = await store.getSettings();
  await store.saveSettings({ last_scrape_at: new Date().toISOString() });
  let all = await store.list("sources");
  const { SOURCE_FIXES } = await import("./defaults");
  const { runSourceMigrations } = await import("./migrations");
  // una actualización fallida no puede frenar el scrapeo (queda registrada en Diagnóstico)
  if (await runSourceMigrations().catch(() => false)) all = await store.list("sources");
  for (const f of SOURCE_FIXES) {
    const s = all.find((x) => x.id === f.id && x.url === f.oldUrl);
    if (s) await store.patch("sources", s.id, f.patch);
  }
  if (SOURCE_FIXES.some((f) => all.some((x) => x.id === f.id && x.url === f.oldUrl))) all = await store.list("sources");
  const sources = all.filter((s) => (onlySourceId ? s.id === onlySourceId : s.enabled));
  const recent = await store.queryArticles({ status: "all", limit: 400 });
  const knownTitles: KnownTitles = new Map(recent.map((a) => [titleKey(a.title), { id: a.id, image: !!a.image, url: a.url }]));
  const geo = makeGeolocator(await store.list("map_points"));

  // Las fuentes van en serie para que la deduplicación por título funcione entre medios.
  const reports: SourceReport[] = [];
  const insertedAll: Article[] = [];
  for (const s of sources) {
    const { report, inserted } = await scrapeSource(s, knownTitles, geo);
    reports.push(report);
    insertedAll.push(...inserted);
  }

  if (settings.ai_rewrite_auto && (process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY)) {
    const { rewriteArticle } = await import("./ai");
    for (const a of insertedAll.slice(0, 5)) {
      try {
        const r = await rewriteArticle(a);
        await store.patch("articles", a.id, { ...r, tags: ["resumen:ia2"] });
      } catch {
        /* se reintenta desde el back office */
      }
    }
  }

  if (!onlySourceId) {
    await enrichMissing(40, 60000).catch(() => undefined);
    await verifyPhotos(60, 40000).catch(() => undefined);
  }

  let removed = 0;
  if (!onlySourceId && settings.retention_days > 0) {
    const cutoff = new Date(Date.now() - settings.retention_days * 86400000).toISOString();
    removed = await store.deleteArticlesBefore(cutoff);
  }
  return { reports, inserted: insertedAll.length, removed };
}

/** Geolocaliza notas recientes que todavía no tienen ubicación (o todas, con force). */
export async function geotagArticles(force = false, limit = 500): Promise<{ checked: number; tagged: number }> {
  const store = await getStore();
  const geo = makeGeolocator(await store.list("map_points"));
  const list = await store.queryArticles({ status: "all", limit });
  let tagged = 0;
  for (const a of list) {
    if (a.geo && (!force || a.geo.manual)) continue;
    const g = geo(a.title, a.summary);
    if (g || (force && a.geo)) {
      await store.patch("articles", a.id, { geo: g });
      if (g) tagged++;
    }
  }
  return { checked: list.length, tagged };
}

/** Similitud entre titulares (palabras en común), para reconocer la misma noticia en otro buscador. */
function titleSimilarity(a: string, b: string): number {
  const words = (t: string) => new Set(titleKey(t).split(" ").filter((w) => w.length > 3));
  const A = words(a);
  const B = words(b);
  if (!A.size || !B.size) return 0;
  let common = 0;
  for (const w of A) if (B.has(w)) common++;
  return common / Math.min(A.size, B.size);
}

/** Busca la misma noticia en Bing News por su titular y devuelve foto y link directo si la encuentra. */
export async function findImageByTitle(title: string): Promise<{ image: string; url: string } | null> {
  const items = await parseFeed(await fetchText(bingNewsUrl(`"${title.slice(0, 120)}"`), 10000));
  const hit = items.find((it) => cleanImage(it.image) && titleSimilarity(it.title, title) >= 0.6);
  return hit ? { image: cleanImage(hit.image)!, url: hit.url } : null;
}

const TAG_PHOTO_SEARCHED = "foto:buscada";

/** Busca imagen (y la URL real) para notas recientes que quedaron sin foto: página original y, si no, Bing por titular. */
export async function enrichMissing(limit = 25, budgetMs = 60000): Promise<number> {
  const store = await getStore();
  const deadline = Date.now() + budgetMs;
  const pending = (await store.queryArticles({ status: "all", limit: 200 }))
    .filter((a) => !a.image && (!a.enriched || !(a.tags ?? []).includes(TAG_PHOTO_SEARCHED)))
    .slice(0, limit);
  let fixed = 0;
  await mapLimit(pending, 4, async (a) => {
    if (Date.now() > deadline) return;
    const it: RawItem = { title: a.title, url: a.url, summary: a.summary, image: null, date: a.published_at };
    if (!a.enriched) {
      try {
        await enrichItem(it);
      } catch {
        /* se sigue con la búsqueda por titular */
      }
    }
    if (!it.image) {
      try {
        const found = await findImageByTitle(a.title);
        if (found) {
          it.image = found.image;
          if (isGoogleNewsUrl(it.url)) it.url = found.url;
        }
      } catch {
        /* sin foto: se usa la portada generada */
      }
    }
    // la foto encontrada se prueba en el momento: si carga, la nota ya puede aparecer en la portada
    const works = it.image ? await photoWorks(it.image).catch(() => false) : false;
    if (!works) it.image = null;
    if (it.image) fixed++;
    await store.patch("articles", a.id, {
      image: it.image ?? null,
      summary: a.summary || it.summary,
      url: normalizeUrl(it.url),
      enriched: true,
      tags: [...(a.tags ?? []).filter((t) => t !== TAG_PHOTO_SEARCHED && t !== TAG_PHOTO_OK), TAG_PHOTO_SEARCHED, ...(works ? [TAG_PHOTO_OK] : [])],
    });
  });
  return fixed;
}

const TAG_PHOTO_OK = "foto:ok";

/** true si la foto se puede descargar y tiene tamaño de foto (no un logo ni un píxel de seguimiento). */
async function photoWorks(url: string): Promise<boolean> {
  const { fetchPublicImage } = await import("./safe-image");
  const buf = await fetchPublicImage(url);
  if (!buf) return false;
  try {
    const sharp = (await import("sharp")).default;
    const m = await sharp(buf).metadata();
    return (m.width ?? 0) >= 320 && (m.height ?? 0) >= 180;
  } catch {
    return false;
  }
}

/**
 * Revisa que las fotos de las notas recientes carguen de verdad. Si una no sirve, busca otra por titular;
 * si no hay, la nota queda sin foto (no aparece en los listados de la portada hasta conseguir una).
 */
export async function verifyPhotos(limit = 30, budgetMs = 45000): Promise<{ checked: number; replaced: number; removed: number }> {
  const store = await getStore();
  const deadline = Date.now() + budgetMs;
  const pending = (await store.queryArticles({ limit: 150, hasImage: true })).filter((a) => !(a.tags ?? []).includes(TAG_PHOTO_OK)).slice(0, limit);
  let checked = 0;
  let replaced = 0;
  let removed = 0;
  await mapLimit(pending, 8, async (a) => {
    if (Date.now() > deadline || !a.image) return;
    checked++;
    let image: string | null = a.image;
    if (!(await photoWorks(image).catch(() => false))) {
      image = null;
      const found = await findImageByTitle(a.title).catch(() => null);
      if (found && found.image !== a.image && (await photoWorks(found.image).catch(() => false))) image = found.image;
      if (image) replaced++;
      else removed++;
    }
    await store.patch("articles", a.id, {
      image,
      tags: [...(a.tags ?? []).filter((t) => t !== TAG_PHOTO_OK), ...(image ? [TAG_PHOTO_OK] : [])],
    });
  });
  return { checked, replaced, removed };
}
