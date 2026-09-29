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
    openGraph: { title: a.title, description: a.summary, images: a.image ? [a.image] : undefined, type: "article" },
  };
}

export default async function Nota({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await load(id);
  if (!a) notFound();
  const store = await getStore();
  const settings = await getSettings();
  const cat = categoryOf(settings, a.category);
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
        <Img src={a.image} alt={a.title} cat={cat} className="mt-6 aspect-[16/9] w-full rounded-xl" />
        {a.body && (
          <div className="prose-ce mt-8">
            {a.body.split(/\n{2,}/).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        )}
        {a.url && (
        <a
          href={a.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 font-semibold text-accent-ink hover:brightness-110"
        >
          Leer la nota completa en {a.source_name || hostname(a.url)} ↗
        </a>
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
