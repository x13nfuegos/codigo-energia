import Link from "next/link";
import { Flash, type FlashParams } from "@/components/admin/Flash";
import { Submit } from "@/components/admin/Submit";
import { toLocalInput } from "@/lib/admin-schema";
import { DEFAULT_PODCAST, formatDuration, sortedEpisodes } from "@/lib/podcast";
import { getStore } from "@/lib/store";
import type { PodcastEpisode } from "@/lib/types";
import { deleteEpisode, refreshEpisodeMeta, saveEpisode, savePodcastInfo } from "../../actions";

function EpisodeForm({ e, next }: { e?: PodcastEpisode; next: number }) {
  return (
    <form action={saveEpisode} className="grid gap-3 md:grid-cols-2">
      <input type="hidden" name="id" defaultValue={e?.id ?? ""} />
      <label className="field md:col-span-2">
        Link del video (Vimeo, YouTube o archivo)
        <input name="url" defaultValue={e?.url} required placeholder="https://vimeo.com/123456789/abcdef1234" className="input" />
        <span className="text-xs text-dim">Sirven los links privados de Vimeo (con el código después del número). El título, la miniatura y la duración se completan solos.</span>
      </label>
      <label className="field">
        Número de episodio
        <input name="number" defaultValue={e?.number ?? next} inputMode="numeric" className="input" />
      </label>
      <label className="field">
        Fecha de publicación
        <input name="published_at" type="date" defaultValue={e ? toLocalInput(e.published_at).slice(0, 10) : ""} className="input" />
      </label>
      <label className="field md:col-span-2">
        Título (vacío = el de Vimeo)
        <input name="title" defaultValue={e?.title} className="input" />
      </label>
      <label className="field md:col-span-2">
        Descripción (vacía = la de Vimeo)
        <textarea name="description" defaultValue={e?.description ?? ""} rows={5} className="input text-sm" />
      </label>
      <div className="md:col-span-2">
        <Submit>{e ? "Guardar" : "Publicar episodio"}</Submit>
      </div>
    </form>
  );
}

export default async function PodcastAdmin({ searchParams }: { searchParams: FlashParams }) {
  const podcast = (await (await getStore()).getSettings()).podcast ?? DEFAULT_PODCAST;
  const episodes = sortedEpisodes(podcast);
  const next = Math.max(0, ...podcast.episodes.map((e) => e.number ?? 0)) + 1;
  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center">
        <h1 className="text-2xl font-bold">Podcast</h1>
        <Link href="/podcast" target="_blank" className="btn ml-auto">Ver en el sitio ↗</Link>
      </div>
      <Flash {...(await searchParams)} />

      <div className="card p-5">
        <h2 className="mb-3 font-bold">Nuevo episodio</h2>
        <EpisodeForm next={next} />
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-bold">Episodios publicados ({episodes.length})</h2>
          {episodes.length > 0 && (
            <form action={refreshEpisodeMeta.bind(null, null)} className="ml-auto">
              <Submit className="btn">Releer todos desde Vimeo</Submit>
            </form>
          )}
        </div>
        {episodes.map((e) => (
          <details key={e.id} className="card p-4">
            <summary className="flex cursor-pointer list-none items-center gap-3">
              <div className="h-12 w-20 shrink-0 overflow-hidden rounded bg-surface-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={e.thumbnail || `/podcast-cover/${e.id}`} alt="" className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0">
                <div className="font-mono text-xs text-dim">
                  Ep. {e.number ?? "—"} · {new Date(e.published_at).toLocaleDateString("es-AR")}
                  {e.duration ? ` · ${formatDuration(e.duration)}` : ""}
                </div>
                <div className="truncate font-semibold">{e.title}</div>
              </div>
            </summary>
            <div className="mt-4 border-t border-line pt-4">
              <EpisodeForm e={e} next={next} />
              <div className="mt-3 flex flex-wrap gap-2">
                <form action={refreshEpisodeMeta.bind(null, e.id)}>
                  <Submit className="btn">Releer título y descripción desde Vimeo</Submit>
                </form>
                <form action={deleteEpisode.bind(null, e.id)}>
                  <Submit className="btn btn-danger" confirm="¿Quitar este episodio de la playlist?">Eliminar</Submit>
                </form>
              </div>
            </div>
          </details>
        ))}
      </div>

      <form action={savePodcastInfo} className="card grid gap-3 p-5">
        <h2 className="font-bold">Datos del podcast</h2>
        <label className="field">
          Nombre
          <input name="title" defaultValue={podcast.title} className="input" />
        </label>
        <label className="field">
          Descripción
          <textarea name="description" defaultValue={podcast.description} rows={2} className="input" />
        </label>
        <div>
          <Submit className="btn">Guardar</Submit>
        </div>
      </form>
    </div>
  );
}
