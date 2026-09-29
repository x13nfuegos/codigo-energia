import { cheapJson, cheapProvider } from "./llm";
import { categoryOf } from "./site";
import { getStore } from "./store";
import type { Article, InstagramPost, InstagramSettings } from "./types";

export const DEFAULT_INSTAGRAM: InstagramSettings = {
  enabled: false,
  per_day: 3,
  hours: [9, 13, 19],
  hashtags: "#energía #oilandgas #VacaMuerta #minería #Argentina #CódigoEnergía",
  ai_caption: true,
  posts: [],
};

const VERSION = "v23.0";

export function igConfigured(): boolean {
  return !!process.env.INSTAGRAM_ACCESS_TOKEN;
}

/** Los tokens de Instagram Login empiezan con "IG"; los de Facebook Login (página + cuenta profesional), con "EAA". */
function host(token: string) {
  return token.startsWith("EAA") ? "https://graph.facebook.com" : "https://graph.instagram.com";
}

export function siteUrl(): string {
  const u = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "https://codigoenergia.ar");
  return u.replace(/\/$/, "");
}

async function graph<T>(path: string, init?: { method?: "GET" | "POST"; params?: Record<string, string> }): Promise<T> {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) throw new Error("Falta INSTAGRAM_ACCESS_TOKEN");
  const params = new URLSearchParams({ ...(init?.params ?? {}), access_token: token });
  const method = init?.method ?? "GET";
  const url = `${host(token)}/${VERSION}/${path}`;
  const res = await fetch(method === "GET" ? `${url}?${params}` : url, {
    method,
    body: method === "POST" ? params : undefined,
    signal: AbortSignal.timeout(30000),
  });
  const j = (await res.json().catch(() => ({}))) as T & { error?: { message?: string; code?: number } };
  if (!res.ok || j.error) throw new Error(`Instagram ${res.status}: ${j.error?.message ?? "error desconocido"}`);
  return j;
}

/** Id de la cuenta profesional: INSTAGRAM_ACCOUNT_ID o, con Instagram Login, el de /me. */
async function accountId(): Promise<string> {
  if (process.env.INSTAGRAM_ACCOUNT_ID) return process.env.INSTAGRAM_ACCOUNT_ID;
  const me = await graph<{ user_id?: string; id?: string }>("me", { params: { fields: "user_id,username" } });
  const id = me.user_id ?? me.id;
  if (!id) throw new Error("No se pudo obtener el id de la cuenta: cargá INSTAGRAM_ACCOUNT_ID");
  return id;
}

/** Datos de la cuenta conectada (para el back office y Diagnóstico). */
export async function igAccount(): Promise<{ id: string; username: string; followers?: number; media?: number }> {
  const id = await accountId();
  const a = await graph<{ username?: string; followers_count?: number; media_count?: number }>(id, { params: { fields: "username,followers_count,media_count" } });
  return { id, username: a.username ?? "?", followers: a.followers_count, media: a.media_count };
}

/** Texto del posteo: bajada propia (IA si está disponible), fuente y hashtags. Máx. 2200 caracteres. */
export async function buildCaption(a: Article, ig: InstagramSettings): Promise<string> {
  const settings = await (await getStore()).getSettings();
  const cat = categoryOf(settings, a.category);
  let body = a.summary?.trim() ?? "";
  let tags = "";
  if (ig.ai_caption && cheapProvider()) {
    try {
      const out = await cheapJson<{ text: string; hashtags: string[] }>(
        "Sos community manager de Código Energía, medio argentino de energía, oil & gas y minería. Escribís en español rioplatense, claro y sin exagerar. " +
          'Respondé solo JSON: {"text": "2 a 4 oraciones que cuenten la noticia con los datos clave, sin inventar nada, sin emojis de más (uno o dos como máximo)", "hashtags": ["3 a 5 hashtags específicos del tema, sin espacios"]}.',
        `Título: ${a.title}\nBajada: ${a.summary}\n${a.body ? `Resumen: ${a.body.slice(0, 2500)}` : ""}`,
        600,
      );
      if (out.text?.trim()) body = out.text.trim();
      tags = (out.hashtags ?? []).map((h) => `#${h.replace(/^#/, "").replace(/\s+/g, "")}`).join(" ");
    } catch {
      /* sin IA: se usa la bajada */
    }
  }
  const lines = [
    a.title,
    "",
    body,
    "",
    a.geo?.place ? `📍 ${a.geo.place}` : "",
    `Fuente: ${a.source_name ?? "prensa"}`,
    "🔗 La nota completa en codigoenergia.ar (link en la bio)",
    "",
    [tags, ig.hashtags, `#${cat.name.replace(/[^\p{L}\p{N}]/gu, "")}`].filter(Boolean).join(" "),
  ];
  // hashtags repetidos fuera; Instagram admite hasta 30
  const text = lines.filter((l, i, arr) => l !== "" || arr[i - 1] !== "").join("\n");
  const seen = new Set<string>();
  return text
    .replace(/#[\p{L}\p{N}_]+/gu, (h) => {
      const k = h.toLowerCase();
      if (seen.has(k) || seen.size >= 30) return "";
      seen.add(k);
      return h;
    })
    .replace(/ {2,}/g, " ")
    .slice(0, 2200);
}

/** Publica una nota: crea el contenedor con la imagen de /ig/{id}, espera a que Instagram la procese y la publica. */
export async function publishArticle(a: Article): Promise<InstagramPost> {
  const store = await getStore();
  const settings = await store.getSettings();
  const ig = { ...DEFAULT_INSTAGRAM, ...settings.instagram };
  const post: InstagramPost = { article_id: a.id, title: a.title, at: new Date().toISOString(), ok: false };
  try {
    const id = await accountId();
    const caption = await buildCaption(a, ig);
    const image_url = `${siteUrl()}/ig/${a.id}?v=${Date.now().toString(36)}`;
    const container = await graph<{ id: string }>(`${id}/media`, { method: "POST", params: { image_url, caption } });
    for (let i = 0; i < 10; i++) {
      const st = await graph<{ status_code?: string; status?: string }>(container.id, { params: { fields: "status_code,status" } });
      if (st.status_code === "FINISHED" || !st.status_code) break;
      if (st.status_code === "ERROR" || st.status_code === "EXPIRED") throw new Error(`Instagram no pudo procesar la imagen: ${st.status ?? st.status_code}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
    const published = await graph<{ id: string }>(`${id}/media_publish`, { method: "POST", params: { creation_id: container.id } });
    post.media_id = published.id;
    post.permalink = (await graph<{ permalink?: string }>(published.id, { params: { fields: "permalink" } }).catch(() => ({}) as { permalink?: string })).permalink ?? null;
    post.ok = true;
  } catch (e) {
    post.error = e instanceof Error ? e.message : String(e);
  }
  const fresh = { ...DEFAULT_INSTAGRAM, ...(await store.getSettings()).instagram };
  await store.saveSettings({ instagram: { ...fresh, posts: [post, ...fresh.posts].slice(0, 100) } });
  return post;
}

/** Candidatas: notas de las últimas 36 h con foto verificada, todavía no publicadas; primero las destacadas y más leídas. */
export async function igCandidates(limit = 8): Promise<Article[]> {
  const store = await getStore();
  const ig = { ...DEFAULT_INSTAGRAM, ...(await store.getSettings()).instagram };
  const done = new Set(ig.posts.filter((p) => p.ok).map((p) => p.article_id));
  const failed = new Map<string, number>();
  for (const p of ig.posts) if (!p.ok) failed.set(p.article_id, (failed.get(p.article_id) ?? 0) + 1);
  const list = await store.queryArticles({ since: new Date(Date.now() - 36 * 3600000).toISOString(), limit: 120, photoOk: true });
  const score = (a: Article) => (a.featured ? 1000 : 0) + (a.views ?? 0) * 3 + ((a.tags ?? []).includes("foto:ok") ? 20 : 0) - (Date.now() - new Date(a.published_at).getTime()) / 3600000;
  return list
    .filter((a) => !done.has(a.id) && (failed.get(a.id) ?? 0) < 2)
    .sort((x, y) => score(y) - score(x))
    .slice(0, limit);
}

const hourAR = () => Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Argentina/Buenos_Aires", hour: "numeric", hourCycle: "h23" }).format(new Date()));
const dayAR = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(d);

let busy = false;

/**
 * Publicación automática: en cada horario configurado publica la mejor nota disponible,
 * sin pasar el máximo diario. Lo disparan el cron y las visitas (maybeRefresh).
 */
export async function maybePostInstagram(): Promise<InstagramPost | null> {
  if (busy || !igConfigured()) return null;
  busy = true;
  try {
    const store = await getStore();
    const ig = { ...DEFAULT_INSTAGRAM, ...(await store.getSettings()).instagram };
    if (!ig.enabled) return null;
    const h = hourAR();
    const slot = [...ig.hours].sort((a, b) => a - b).filter((x) => x <= h).pop();
    if (slot === undefined) return null;
    const today = ig.posts.filter((p) => dayAR(new Date(p.at)) === dayAR());
    if (today.filter((p) => p.ok).length >= ig.per_day) return null;
    // una vez por horario (los intentos fallidos también cuentan, para no insistir cada visita)
    if (today.some((p) => Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Argentina/Buenos_Aires", hour: "numeric", hourCycle: "h23" }).format(new Date(p.at))) >= slot)) return null;
    const [next] = await igCandidates(1);
    return next ? await publishArticle(next) : null;
  } finally {
    busy = false;
  }
}
