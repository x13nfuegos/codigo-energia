import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GridCard, HeroCard, ListItem, SectionTitle } from "@/components/Cards";
import { getStore } from "@/lib/store";
import { categoryOf, getSettings } from "@/lib/site";

const PER_PAGE = 20;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const s = await getSettings();
  const c = s.categories.find((x) => x.slug === slug);
  return { title: c?.name ?? "Sección" };
}

export default async function Seccion({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ p?: string }> }) {
  const { slug } = await params;
  const page = Math.max(1, Number((await searchParams).p) || 1);
  const settings = await getSettings();
  const c = settings.categories.find((x) => x.slug === slug);
  if (!c) notFound();
  const store = await getStore();
  const [list, total] = await Promise.all([
    store.queryArticles({ category: slug, limit: PER_PAGE, offset: (page - 1) * PER_PAGE }),
    store.countArticles({ category: slug }),
  ]);
  const cat = (s: string) => categoryOf(settings, s);
  const [first, ...rest] = list;
  return (
    <div>
      <SectionTitle title={c.name} />
      {!list.length && <p className="text-muted">No hay notas en esta sección todavía.</p>}
      {page === 1 && first ? (
        <>
          <HeroCard a={first} cat={cat(first.category)} />
          <div className="mt-12 grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 md:gap-x-8">
            {rest.slice(0, 6).map((a) => (
              <GridCard key={a.id} a={a} cat={cat(a.category)} />
            ))}
          </div>
          <div className="mt-10">
            {rest.slice(6).map((a) => (
              <ListItem key={a.id} a={a} cat={cat(a.category)} />
            ))}
          </div>
        </>
      ) : (
        list.map((a) => <ListItem key={a.id} a={a} cat={cat(a.category)} />)
      )}
      <div className="mt-10 flex justify-between text-sm">
        {page > 1 ? <Link href={`?p=${page - 1}`} className="btn">← Más recientes</Link> : <span />}
        {page * PER_PAGE < total && <Link href={`?p=${page + 1}`} className="btn">Anteriores →</Link>}
      </div>
    </div>
  );
}
