import Link from "next/link";
import { BriefCard } from "@/components/BriefCard";
import { SectionTitle } from "@/components/Cards";
import { longDate } from "@/lib/format";
import { getStore } from "@/lib/store";

export const metadata = { title: "Resumen diario" };

export default async function Resumenes() {
  const briefs = (await (await getStore()).list("briefs")).sort((a, b) => b.date.localeCompare(a.date));
  const [last, ...rest] = briefs;
  return (
    <div className="space-y-10">
      <SectionTitle title="El resumen de la energía" />
      {!last && <p className="text-muted">Todavía no hay resúmenes publicados.</p>}
      {last && <BriefCard brief={last} title="Último resumen" />}
      {rest.length > 0 && (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {rest.map((b) => (
            <li key={b.id}>
              <Link href={`/resumen/${b.id}`} className="flex flex-col gap-1 px-5 py-4 hover:bg-surface md:flex-row md:items-center md:gap-6">
                <span className="w-56 shrink-0 font-mono text-sm capitalize text-dim">{longDate(`${b.date}T12:00:00-03:00`)}</span>
                <span className="font-semibold">{b.title}</span>
                <span className="ml-auto text-xs text-dim">{[b.audio_url && "audio", b.video_url && "video"].filter(Boolean).join(" · ")}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
