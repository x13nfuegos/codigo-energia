import type { Podcast, PodcastEpisode } from "./types";

export const DEFAULT_PODCAST: Podcast = {
  title: "Código Energía Podcast",
  description: "Conversaciones sobre innovación en energía, oil & gas y minería: tecnología, proyectos y las personas que los hacen.",
  episodes: [
    {
      id: "ep-1",
      url: "https://vimeo.com/1231275587/1f2f4ab273",
      title: "Episodio 1",
      number: 1,
      published_at: "2026-09-29T12:00:00-03:00",
    },
  ],
};

export type VideoRef =
  | { provider: "vimeo"; id: string; hash?: string | null; embed: string }
  | { provider: "youtube"; id: string; embed: string }
  | { provider: "file"; embed: string };

/** Interpreta links de Vimeo (incluidos los privados con hash), YouTube o archivos directos. */
export function parseVideo(raw: string): VideoRef | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "");
  if (host.endsWith("vimeo.com")) {
    const parts = u.pathname.split("/").filter(Boolean);
    const i = parts.findIndex((p) => /^\d+$/.test(p));
    if (i < 0) return null;
    const id = parts[i];
    const hash = u.searchParams.get("h") ?? (parts[i + 1] && /^[0-9a-f]{6,}$/i.test(parts[i + 1]) ? parts[i + 1] : null);
    const q = new URLSearchParams({ title: "0", byline: "0", portrait: "0", dnt: "1" });
    if (hash) q.set("h", hash);
    return { provider: "vimeo", id, hash, embed: `https://player.vimeo.com/video/${id}?${q}` };
  }
  if (host === "youtu.be" || host.endsWith("youtube.com")) {
    const id = host === "youtu.be" ? u.pathname.slice(1) : u.searchParams.get("v") ?? u.pathname.split("/").filter(Boolean).pop() ?? "";
    if (!/^[\w-]{11}$/.test(id)) return null;
    return { provider: "youtube", id, embed: `https://www.youtube-nocookie.com/embed/${id}?rel=0` };
  }
  if (/\.(mp4|webm|m4v|mp3|m4a|ogg)(\?|$)/i.test(u.pathname)) return { provider: "file", embed: u.toString() };
  return null;
}

type Meta = Partial<PodcastEpisode>;

const decode = (t: string) =>
  t
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&");

/** Limpia la descripción (Vimeo a veces la manda con HTML) y conserva los saltos de línea. */
const cleanText = (t?: string | null) =>
  t
    ? decode(t.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<[^>]+>/g, ""))
        .replace(/\n{3,}/g, "\n\n")
        .trim()
        .slice(0, 3000) || undefined
    : undefined;

const bigThumb = (u?: string | null) => u?.replace(/_\d+x\d+(\.\w+)?$/, "_1280x720$1").replace(/-d_\d+x\d+/, "-d_1280x720") ?? null;
const isoDate = (d?: string | null) => (d && !isNaN(+new Date(d)) ? { published_at: new Date(d).toISOString() } : {});

const UA = { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36" };

/** API oficial de Vimeo (si hay VIMEO_ACCESS_TOKEN): trae la descripción completa aunque el video sea privado. */
async function vimeoApi(id: string, hash?: string | null): Promise<Meta> {
  const token = process.env.VIMEO_ACCESS_TOKEN;
  if (!token) return {};
  const res = await fetch(`https://api.vimeo.com/videos/${id}${hash ? `:${hash}` : ""}?fields=name,description,duration,release_time,created_time,pictures.sizes`, {
    headers: { authorization: `bearer ${token}`, accept: "application/vnd.vimeo.*+json;version=3.4" },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return {};
  const j = (await res.json()) as { name?: string; description?: string | null; duration?: number; release_time?: string; created_time?: string; pictures?: { sizes?: { width: number; link: string }[] } };
  const pic = j.pictures?.sizes?.sort((a, b) => b.width - a.width)[0]?.link ?? null;
  return { title: j.name, description: cleanText(j.description), duration: j.duration ?? null, thumbnail: pic, ...isoDate(j.release_time ?? j.created_time) };
}

async function vimeoOembed(id: string, hash?: string | null): Promise<Meta> {
  const page = hash ? `https://vimeo.com/${id}/${hash}` : `https://vimeo.com/${id}`;
  const res = await fetch(`https://vimeo.com/api/oembed.json?width=1280&url=${encodeURIComponent(page)}`, { headers: UA, signal: AbortSignal.timeout(10000) });
  if (!res.ok) return {};
  const j = (await res.json()) as { title?: string; description?: string; thumbnail_url?: string; duration?: number; upload_date?: string };
  return { title: j.title ? decode(j.title) : undefined, description: cleanText(j.description), thumbnail: bigThumb(j.thumbnail_url), duration: j.duration ?? null, ...isoDate(j.upload_date) };
}

/** Página pública del video: og:title / og:description y el JSON-LD (descripción más completa). */
async function vimeoPage(id: string, hash?: string | null): Promise<Meta> {
  const res = await fetch(hash ? `https://vimeo.com/${id}/${hash}` : `https://vimeo.com/${id}`, { headers: UA, signal: AbortSignal.timeout(12000) });
  if (!res.ok) return {};
  const html = await res.text();
  const meta = (p: string) => html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]+content=["']([^"']*)["']`, "i"))?.[1];
  let ld: { name?: string; description?: string; uploadDate?: string; thumbnailUrl?: string | string[] } = {};
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const j = JSON.parse(m[1]);
      const v = (Array.isArray(j) ? j : [j]).find((x) => x?.["@type"] === "VideoObject");
      if (v) ld = v;
    } catch {
      /* JSON-LD inválido */
    }
  }
  const title = ld.name ?? meta("og:title");
  return {
    title: title ? decode(title) : undefined,
    description: cleanText(ld.description ?? meta("og:description")),
    thumbnail: bigThumb(Array.isArray(ld.thumbnailUrl) ? ld.thumbnailUrl[0] : ld.thumbnailUrl ?? meta("og:image")),
    ...isoDate(ld.uploadDate),
  };
}

/** Configuración del reproductor: último recurso para título, duración y miniatura. */
async function vimeoPlayer(id: string, hash?: string | null): Promise<Meta> {
  const res = await fetch(`https://player.vimeo.com/video/${id}/config${hash ? `?h=${hash}` : ""}`, { headers: { ...UA, referer: "https://codigoenergia.ar/" }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) return {};
  const j = (await res.json()) as { video?: { title?: string; duration?: number; thumbs?: Record<string, string> } };
  const thumbs = j.video?.thumbs ?? {};
  return { title: j.video?.title, duration: j.video?.duration ?? null, thumbnail: thumbs["1280"] ?? thumbs.base ?? Object.values(thumbs).pop() ?? null };
}

/** Une resultados: el primero que tenga cada dato gana; la descripción más larga gana. */
function merge(parts: Meta[]): Meta {
  const out: Meta = {};
  for (const p of parts) {
    for (const [k, v] of Object.entries(p) as [keyof Meta, unknown][]) {
      if (v == null || v === "") continue;
      if (k === "description") {
        if (!out.description || String(v).length > out.description.length) out.description = String(v);
      } else if (out[k] == null) (out as Record<string, unknown>)[k] = v;
    }
  }
  return out;
}

/**
 * Título, descripción, miniatura, duración y fecha del video.
 * Vimeo: API oficial (con token) → oEmbed → página pública → reproductor. YouTube: oEmbed.
 */
export async function fetchEpisodeMeta(url: string): Promise<Meta> {
  const v = parseVideo(url);
  if (!v || v.provider === "file") return {};
  if (v.provider === "vimeo") {
    const safe = (p: Promise<Meta>) => p.catch(() => ({}) as Meta);
    const parts = await Promise.all([safe(vimeoApi(v.id, v.hash)), safe(vimeoOembed(v.id, v.hash)), safe(vimeoPage(v.id, v.hash))]);
    let meta = merge(parts);
    if (!meta.title || !meta.thumbnail) meta = merge([meta, await safe(vimeoPlayer(v.id, v.hash))]);
    if (!meta.title) throw new Error("Vimeo no devolvió los datos del video (¿es privado? cargá VIMEO_ACCESS_TOKEN o poné el video como “oculto”)");
    return { ...meta, meta_ok: true };
  }
  const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${v.id}`)}`, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`oEmbed ${res.status}`);
  const j = (await res.json()) as { title?: string; thumbnail_url?: string };
  return { title: j.title, thumbnail: j.thumbnail_url?.replace(/hqdefault/, "maxresdefault") ?? null, meta_ok: true };
}

/** Título genérico puesto por el sitio (se reemplaza por el del video). */
export const isGenericTitle = (t?: string | null) => !t || /^Episodio \d+$/.test(t.trim());

export function sortedEpisodes(p: Podcast): PodcastEpisode[] {
  return [...p.episodes].sort((a, b) => (b.number ?? 0) - (a.number ?? 0) || b.published_at.localeCompare(a.published_at));
}

export function formatDuration(s?: number | null): string {
  if (!s) return "";
  const m = Math.round(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
}

/**
 * Aplica los datos del video. Con `overwrite`, Vimeo manda en título y descripción;
 * si no, se respeta lo cargado a mano (salvo el título genérico "Episodio N").
 */
export function applyMeta(e: PodcastEpisode, meta: Partial<PodcastEpisode>, overwrite: boolean): PodcastEpisode {
  return {
    ...e,
    thumbnail: meta.thumbnail ?? e.thumbnail ?? null,
    duration: meta.duration ?? e.duration ?? null,
    published_at: overwrite && meta.published_at ? meta.published_at : e.published_at,
    title: overwrite || isGenericTitle(e.title) ? meta.title ?? e.title : e.title,
    description: overwrite ? meta.description ?? e.description ?? null : e.description || meta.description || null,
    meta_ok: true,
    meta_tried_at: new Date().toISOString(),
  };
}

/** Completa título, descripción y miniatura de episodios nuevos y lo guarda (si Vimeo falla, reintenta en una hora). */
export async function enrichPodcast(podcast: Podcast, save: (p: Podcast) => Promise<unknown>): Promise<void> {
  // episodios nuevos, o con título genérico / sin descripción: se consulta el video (como mucho una vez por hora)
  const due = (e: PodcastEpisode) =>
    (!e.meta_ok || isGenericTitle(e.title) || !e.description) && (!e.meta_tried_at || Date.now() - new Date(e.meta_tried_at).getTime() > 3600000);
  if (!podcast.episodes.some(due)) return;
  const episodes = await Promise.all(
    podcast.episodes.map(async (e) => {
      if (!due(e)) return e;
      try {
        return applyMeta(e, await fetchEpisodeMeta(e.url), false);
      } catch {
        return { ...e, meta_tried_at: new Date().toISOString() };
      }
    }),
  );
  await save({ ...podcast, episodes });
}
