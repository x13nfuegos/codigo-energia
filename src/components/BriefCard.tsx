import Link from "next/link";
import { longDate } from "@/lib/format";
import type { DailyBrief } from "@/lib/types";

export function BriefMedia({ brief }: { brief: DailyBrief }) {
  const yt = brief.video_url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{11})/)?.[1];
  return (
    <div className="space-y-4">
      {brief.video_url &&
        (yt ? (
          <iframe
            className="aspect-video w-full rounded-lg"
            src={`https://www.youtube-nocookie.com/embed/${yt}`}
            title={brief.title}
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <video className="aspect-video w-full rounded-lg bg-black" src={brief.video_url} controls preload="metadata" playsInline />
        ))}
      {brief.audio_url && (
        <div>
          <div className="mb-2 font-mono text-xs uppercase tracking-[0.15em] text-muted">Escuchá el resumen</div>
          <audio className="w-full" src={brief.audio_url} controls preload="none" />
        </div>
      )}
    </div>
  );
}

export function BriefCard({ brief, title }: { brief: DailyBrief; title: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex items-center gap-2 border-b border-line px-5 py-3 font-mono text-sm uppercase tracking-[0.15em] text-muted">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-accent" />
        {title}
        <span className="ml-auto normal-case tracking-normal text-dim">{longDate(`${brief.date}T12:00:00-03:00`)}</span>
      </div>
      <div className="grid gap-6 p-5 md:grid-cols-2">
        <div>
          <Link href={`/resumen/${brief.id}`}>
            <h3 className="text-2xl font-extrabold leading-tight hover:underline">{brief.title}</h3>
          </Link>
          <ul className="mt-4 space-y-2 text-muted">
            {brief.bullets.slice(0, 5).map((b, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-accent">▸</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
          <Link href={`/resumen/${brief.id}`} className="mt-4 inline-block text-sm font-semibold text-accent">
            Leer el resumen completo →
          </Link>
        </div>
        <BriefMedia brief={brief} />
      </div>
    </div>
  );
}
