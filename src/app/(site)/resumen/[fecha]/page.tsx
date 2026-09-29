import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BriefMedia } from "@/components/BriefCard";
import { ListItem, SectionTitle } from "@/components/Cards";
import { longDate } from "@/lib/format";
import { getStore } from "@/lib/store";
import { categoryOf, getSettings } from "@/lib/site";
import type { Article } from "@/lib/types";

export async function generateMetadata({ params }: { params: Promise<{ fecha: string }> }): Promise<Metadata> {
  const b = await (await getStore()).get("briefs", (await params).fecha);
  return b ? { title: b.title, description: b.bullets.join(" ") } : {};
}

export default async function Resumen({ params }: { params: Promise<{ fecha: string }> }) {
  const store = await getStore();
  const b = await store.get("briefs", (await params).fecha);
  if (!b) notFound();
  const settings = await getSettings();
  const arts = (await Promise.all(b.article_ids.slice(0, 12).map((id) => store.get("articles", id)))).filter(
    (a): a is Article => !!a && a.status === "published",
  );
  return (
    <div className="mx-auto max-w-3xl">
      <p className="font-mono text-sm uppercase tracking-[0.15em] text-accent">Resumen diario</p>
      <p className="mt-1 font-mono text-sm capitalize text-dim">{longDate(`${b.date}T12:00:00-03:00`)}</p>
      <h1 className="mt-3 text-3xl font-extrabold leading-tight md:text-5xl">{b.title}</h1>
      <div className="mt-8">
        <BriefMedia brief={b} />
      </div>
      <ul className="mt-8 space-y-3 rounded-xl border border-line bg-surface p-5">
        {b.bullets.map((x, i) => (
          <li key={i} className="flex gap-3">
            <span className="text-accent">▸</span>
            {x}
          </li>
        ))}
      </ul>
      <div className="prose-ce mt-8">
        {b.text.split(/\n{2,}/).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      {arts.length > 0 && (
        <div className="mt-12">
          <SectionTitle title="Las notas del día" />
          {arts.map((a) => (
            <ListItem key={a.id} a={a} cat={categoryOf(settings, a.category)} />
          ))}
        </div>
      )}
    </div>
  );
}
