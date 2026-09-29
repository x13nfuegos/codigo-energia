"use client";

import { useEffect, useState } from "react";
import { formatDuration, parseVideo } from "@/lib/podcast";
import type { PodcastEpisode } from "@/lib/types";

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(iso)).replace(".", "");

/** Reproductor + playlist de episodios (la lista se arma sola con cada episodio publicado). */
export function PodcastPlayer({ episodes, initial, compact = false }: { episodes: PodcastEpisode[]; initial?: string | null; compact?: boolean }) {
  const [current, setCurrent] = useState(() => episodes.find((e) => e.id === initial) ?? episodes[0]);
  const [autoplay, setAutoplay] = useState(false);
  // se muestra la miniatura con un botón de play; el reproductor carga recién al tocarlo
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!compact && current) window.history.replaceState(null, "", `?e=${current.id}`);
  }, [current, compact]);
  if (!current) return null;
  const video = parseVideo(current.url);
  const src = video && video.provider !== "file" ? `${video.embed}${video.embed.includes("?") ? "&" : "?"}autoplay=${autoplay ? 1 : 0}` : null;

  return (
    <div className={`grid gap-4 ${compact ? "lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]" : "lg:grid-cols-[minmax(0,1fr)_360px]"}`}>
      <div className="min-w-0">
        <div className="overflow-hidden rounded-xl border border-line bg-black">
          {!playing ? (
            <button
              onClick={() => {
                setAutoplay(true);
                setPlaying(true);
              }}
              className="group relative block aspect-video w-full"
              aria-label={`Reproducir: ${current.title}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={current.thumbnail || `/podcast-cover/${current.id}`}
                alt=""
                onError={(ev) => {
                  if (!ev.currentTarget.src.includes("/podcast-cover/")) ev.currentTarget.src = `/podcast-cover/${current.id}`;
                }}
                className="h-full w-full object-cover transition group-hover:scale-[1.02]"
              />
              <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <span className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-accent text-2xl text-accent-ink shadow-2xl transition group-hover:scale-110 md:h-20 md:w-20 md:text-3xl">
                ▶
              </span>
              <span className="absolute bottom-3 left-4 font-mono text-xs uppercase tracking-[0.15em] text-white/90">
                {current.number ? `Episodio ${current.number}` : "Episodio"}
                {current.duration ? ` · ${formatDuration(current.duration)}` : ""}
              </span>
            </button>
          ) : src ? (
            <iframe
              key={current.id}
              src={src}
              className="aspect-video w-full"
              title={current.title}
              allow="autoplay; fullscreen; picture-in-picture; clipboard-write"
              allowFullScreen
            />
          ) : video?.provider === "file" ? (
            <video key={current.id} src={video.embed} className="aspect-video w-full" controls autoPlay={autoplay} playsInline preload="metadata" />
          ) : (
            <div className="flex aspect-video items-center justify-center text-sm text-dim">No se pudo cargar el video</div>
          )}
        </div>
        <div className="mt-4">
          <div className="font-mono text-xs uppercase tracking-[0.15em] text-accent">
            {current.number ? `Episodio ${current.number}` : "Episodio"} · {fmtDate(current.published_at)}
            {current.duration ? ` · ${formatDuration(current.duration)}` : ""}
          </div>
          <h3 className={`mt-1 font-extrabold leading-tight ${compact ? "text-xl md:text-2xl" : "text-2xl md:text-3xl"}`}>{current.title}</h3>
          {current.description && !compact && <p className="mt-3 whitespace-pre-line text-muted">{current.description}</p>}
        </div>
      </div>

      <aside className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-line bg-surface lg:max-h-[min(520px,70vh)]">
        <div className="flex items-center border-b border-line px-4 py-3 font-mono text-xs uppercase tracking-[0.15em] text-muted">
          Episodios <span className="ml-auto text-dim">{episodes.length}</span>
        </div>
        <ol className="min-h-0 flex-1 overflow-y-auto">
          {episodes.map((e) => {
            const on = e.id === current.id;
            return (
              <li key={e.id}>
                <button
                  onClick={() => {
                    setAutoplay(true);
                    setPlaying(true);
                    setCurrent(e);
                  }}
                  className={`flex w-full gap-3 border-b border-line px-4 py-3 text-left last:border-0 hover:bg-surface-2 ${on ? "bg-surface-2" : ""}`}
                  aria-current={on}
                >
                  <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-md bg-surface-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={e.thumbnail || `/podcast-cover/${e.id}`}
                      alt=""
                      loading="lazy"
                      onError={(ev) => {
                        if (!ev.currentTarget.src.includes("/podcast-cover/")) ev.currentTarget.src = `/podcast-cover/${e.id}`;
                      }}
                      className="h-full w-full object-cover"
                    />
                    <span className={`absolute inset-0 flex items-center justify-center text-lg ${on ? "bg-black/50 text-accent" : "bg-black/25 text-white"}`}>{on ? "▮▮" : "▶"}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="font-mono text-[0.65rem] uppercase tracking-wider text-dim">
                      {e.number ? `Ep. ${e.number}` : "Ep."} · {fmtDate(e.published_at)}
                      {e.duration ? ` · ${formatDuration(e.duration)}` : ""}
                    </div>
                    <div className={`mt-0.5 line-clamp-2 text-sm font-semibold leading-snug ${on ? "text-accent" : ""}`}>{e.title}</div>
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      </aside>
    </div>
  );
}
