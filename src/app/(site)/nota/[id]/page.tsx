import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { ListItem, SectionTitle } from "@/components/Cards";
import { CategoryBadge } from "@/components/CategoryBadge";
import { Img } from "@/components/Img";
import { dateTime, hostname } from "@/lib/format";
import { getStore } from "@/lib/store";
import { categoryOf, getSettings } from "@/lib/site";
import { cheapProvider } from "@/lib/llm";
import { TAG_AI, TAG_EXTRACT, ensureArticleSummary, needsSummary } from "@/lib/summary";

async function load(id: string) {
  const a = await (await getStore()).get("articles", id);
  return a && a.status === "published" ? a : null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const a = await load((await params).id);
  if (!a) return {};
  return {
    title: a.title,
    description: a.summary,
    openGraph: { title: a.title, description: a.summary, images: [a.image || `/cover/${a.id}`], type: "article" },
  };
}

export default async function Nota({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let a = await load(id);
  if (!a) notFound();
  if (needsSummary(a)) {
    if (cheapProvider()) {
      // el resumen con IA tarda unos segundos: se genera en segundo plano y aparece en la próxima visita
      const pending = a;
      after(() => ensureArticleSummary(pending));
    } else {
      // el extracto es rápido: se intenta en el momento (con tope) para mostrarlo ya
      await Promise.race([ensureArticleSummary(a), new Promise((r) => setTimeout(r, 6000))]);
      a = (await load(id)) ?? a;
    }
  }
  const store = await getStore();
  const settings = await getSettings();
  const cat = categoryOf(settings, a.category);
  const source = a.source_name || hostname(a.url) || settings.site_name;
  const photoCredit = (a.tags ?? []).find((t) => t.startsWith("credito:"))?.slice(8);
  const isExtract = (a.tags ?? []).includes(TAG_EXTRACT);
  const isAi = (a.tags ?? []).some((t) => t === TAG_AI || t === "resumen:ia");
  after(() => store.incrementViews(a.id));
  const related = (await store.queryArticles({ category: a.category, limit: 6 })).filter((x) => x.id !== a.id).slice(0, 5);

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_320px]">
      <article>
        <CategoryBadge cat={cat} />
        <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight md:text-5xl">{a.title}</h1>
        {a.summary && <p className="mt-4 text-xl text-muted">{a.summary}</p>}
        <p className="mt-4 font-mono text-sm text-dim">
          {dateTime(a.published_at)}
          {(a.source_name || a.url) && <> · Fuente: {a.source_name || hostname(a.url)}</>}
        </p>
        {a.geo && (
          <Link href={`/mapa?nota=${a.id}`} className="mt-3 inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-sm text-muted hover:text-ink">
            📍 {a.geo.place} · Ver en el mapa
          </Link>
        )}
        <Img src={a.image} alt={a.title} cat={cat} label={a.source_name} fallback={`/cover/${a.id}`} className="mt-6 aspect-[16/9] w-full rounded-xl" priority />
        {photoCredit && <p className="mt-2 text-xs text-dim">Foto ilustrativa: {photoCredit}</p>}
        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.15em] text-muted">
            <span className="h-4 w-1.5 rounded-sm bg-accent" />
            Resumen
          </h2>
          {a.body && isExtract ? (
            <blockquote className="border-l-2 border-accent pl-4">
              <p className="prose-ce italic">“{a.body}”</p>
              <footer className="mt-2 text-sm text-dim">Extracto de {source}</footer>
            </blockquote>
          ) : a.body ? (
            <div className="prose-ce">
              {a.body.split(/\n{2,}/).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          ) : (
            <p className="text-muted">{a.summary || "Estamos preparando el resumen de esta nota."}</p>
          )}
        </section>

        {a.url && (
          <div className="mt-8 rounded-xl border border-line bg-surface p-5">
            <div className="font-mono text-xs uppercase tracking-[0.15em] text-dim">Fuente</div>
            <div className="mt-1 font-semibold">{source}</div>
            <div className="mt-0.5 truncate text-sm text-dim">
              {hostname(a.url)} · publicado {dateTime(a.published_at)}
            </div>
            <a
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 font-semibold text-accent-ink hover:brightness-110"
            >
              Leer la nota original ↗
            </a>
            {isAi && <p className="mt-3 text-xs text-dim">Resumen redactado por Código Energía a partir de la nota original.</p>}
          </div>
        )}
      </article>
      <aside>
        {related.length > 0 && (
          <>
            <SectionTitle title="Relacionadas" />
            {related.map((r) => (
              <ListItem key={r.id} a={r} cat={categoryOf(settings, r.category)} />
            ))}
          </>
        )}
      </aside>
    </div>
  );
}
