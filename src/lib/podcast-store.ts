// solo servidor: usa el almacenamiento (no importar desde componentes del navegador)
import { DEFAULT_PODCAST, applyMeta, fetchEpisodeMeta, isGenericTitle } from "./podcast";
import { getStore } from "./store";
import type { Podcast, PodcastEpisode } from "./types";

/** Completa título, descripción y miniatura de episodios nuevos y lo guarda (si Vimeo falla, reintenta en una hora). */
export async function enrichPodcast(podcast: Podcast): Promise<void> {
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
  await mergePodcastEpisodes(episodes.filter((e, i) => e !== podcast.episodes[i]));
}

/**
 * Guarda episodios actualizados sobre la configuración vigente (por id), sin pisar lo que el back office
 * haya cambiado mientras tanto: los episodios agregados o borrados en el medio se respetan.
 */
export async function mergePodcastEpisodes(changed: PodcastEpisode[]): Promise<void> {
  if (!changed.length) return;
  const byId = new Map(changed.map((e) => [e.id, e]));
  await (await getStore()).updateSettings((s) => {
    const p = s.podcast ?? DEFAULT_PODCAST;
    return { podcast: { ...p, episodes: p.episodes.map((e) => byId.get(e.id) ?? e) } };
  });
}
