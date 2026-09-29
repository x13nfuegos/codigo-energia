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

/** Título, descripción, miniatura y duración desde el oEmbed del proveedor. */
export async function fetchEpisodeMeta(url: string): Promise<Partial<PodcastEpisode>> {
  const v = parseVideo(url);
  if (!v || v.provider === "file") return {};
  const endpoint =
    v.provider === "vimeo"
      ? `https://vimeo.com/api/oembed.json?width=1280&url=${encodeURIComponent(v.hash ? `https://vimeo.com/${v.id}/${v.hash}` : `https://vimeo.com/${v.id}`)}`
      : `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${v.id}`)}`;
  const res = await fetch(endpoint, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`oEmbed ${res.status}`);
  const j = (await res.json()) as { title?: string; description?: string; thumbnail_url?: string; duration?: number; upload_date?: string };
  const thumb = j.thumbnail_url?.replace(/_\d+x\d+(\.\w+)?$/, "_1280x720$1") ?? null;
  return {
    title: j.title || undefined,
    description: j.description ? j.description.slice(0, 600) : undefined,
    thumbnail: thumb,
    duration: j.duration ?? null,
    ...(j.upload_date && !isNaN(+new Date(j.upload_date)) ? { published_at: new Date(j.upload_date).toISOString() } : {}),
    meta_ok: true,
  };
}

export function sortedEpisodes(p: Podcast): PodcastEpisode[] {
  return [...p.episodes].sort((a, b) => (b.number ?? 0) - (a.number ?? 0) || b.published_at.localeCompare(a.published_at));
}

export function formatDuration(s?: number | null): string {
  if (!s) return "";
  const m = Math.round(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
}

/** Completa título/miniatura de episodios nuevos (una vez) y lo guarda. */
export async function enrichPodcast(podcast: Podcast, save: (p: Podcast) => Promise<unknown>): Promise<void> {
  const pending = podcast.episodes.filter((e) => !e.meta_ok);
  if (!pending.length) return;
  const episodes = await Promise.all(
    podcast.episodes.map(async (e) => {
      if (e.meta_ok) return e;
      try {
        const meta = await fetchEpisodeMeta(e.url);
        // el título cargado a mano manda; el genérico "Episodio N" se reemplaza por el del video
        const manualTitle = e.title && !/^Episodio \d+$/.test(e.title);
        return { ...e, ...meta, title: manualTitle ? e.title : meta.title ?? e.title, description: e.description || meta.description, meta_ok: true };
      } catch {
        return { ...e, meta_ok: true };
      }
    }),
  );
  await save({ ...podcast, episodes });
}
