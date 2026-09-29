import Link from "next/link";
import { Newsroom } from "@/components/Newsroom";
import { SectionBlock } from "@/components/Sections";
import { timeAgo } from "@/lib/format";
import { runAllMigrations } from "@/lib/migrations";
import { getStore } from "@/lib/store";
import { getSettings } from "@/lib/site";

export default async function Home() {
  // en serie (las dos guardan la configuración); si fallan, el error queda en Diagnóstico
  await runAllMigrations().catch(() => undefined);
  const [settings, sections] = await Promise.all([getSettings(), (await getStore()).list("sections")]);
  const list = sections.filter((s) => s.enabled).sort((a, b) => a.order - b.order);
  const store = await getStore();
  const [total, latest, briefs] = await Promise.all([store.countArticles({}), store.queryArticles({ limit: 8 }), store.list("briefs")]);
  const [brief] = briefs.sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="space-y-12">
      {latest.length > 0 && (
        <Newsroom items={latest.map((a) => ({ id: a.id, title: a.title, tag: a.category.replace(/-/g, ""), time: timeAgo(a.published_at).toLowerCase() }))} />
      )}
      {brief?.audio_url && (
        <div className="-mt-8 flex flex-col gap-3 rounded-xl border border-line bg-surface px-4 py-3 sm:flex-row sm:items-center">
          <Link href={`/resumen/${brief.id}`} className="flex min-w-0 items-center gap-3 hover:text-accent">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-accent-ink" aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 14v-2a9 9 0 0 1 18 0v2" /><rect x="3" y="14" width="4" height="6" rx="1.5" /><rect x="17" y="14" width="4" height="6" rx="1.5" /></svg>
            </span>
            <span className="min-w-0">
              <span className="block font-mono text-[0.7rem] uppercase tracking-[0.15em] text-dim">Escuchá el resumen de ayer</span>
              <span className="block truncate text-sm font-semibold">{brief.title}</span>
            </span>
          </Link>
          <audio className="h-9 w-full sm:ml-auto sm:max-w-sm" src={brief.audio_url} controls preload="none" />
        </div>
      )}
      {total === 0 && (
        <p className="rounded-xl border border-dashed border-line p-6 text-center text-muted">
          Todavía no hay notas publicadas. El primer scrapeo se dispara automáticamente; también podés correrlo desde el back office.
        </p>
      )}
      {list.map((s) => (
        <SectionBlock key={s.id} section={s} settings={settings} />
      ))}
    </div>
  );
}
