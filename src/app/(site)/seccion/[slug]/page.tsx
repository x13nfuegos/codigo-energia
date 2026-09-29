import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GridCard, HeroCard, ListItem, SectionTitle } from "@/components/Cards";
import { MapLoader } from "@/components/MapLoader";
import { getMapData } from "@/lib/map-data";
import { getStore } from "@/lib/store";
import { categoryFamily, categoryOf, getSettings, subCategories } from "@/lib/site";

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
  const family = categoryFamily(settings, slug);
  const parent = c.parent ? settings.categories.find((x) => x.slug === c.parent) : null;
  const subs = subCategories(settings, slug);
  const store = await getStore();
  const [list, total, map] = await Promise.all([
    store.queryArticles({ category: family, photoOk: true, limit: PER_PAGE, offset: (page - 1) * PER_PAGE }),
    store.countArticles({ category: family, photoOk: true }),
    page === 1 ? getMapData({ category: family }) : null,
  ]);
  const cat = (s: string) => categoryOf(settings, s);
  const [first, ...rest] = list;
  return (
    <div>
      {parent && (
        <Link href={`/seccion/${parent.slug}`} className="mb-2 inline-block font-mono text-sm text-muted hover:text-accent">
          ← {parent.name}
        </Link>
      )}
      <SectionTitle title={c.name} />
      {subs.length > 0 && (
        <div className="-mt-3 mb-8 flex flex-wrap gap-2">
          {subs.map((s) => (
            <Link key={s.slug} href={`/seccion/${s.slug}`} className="rounded-full border border-line px-3 py-1 font-mono text-sm text-muted hover:border-accent hover:text-accent">
              {s.name}
            </Link>
          ))}
        </div>
      )}
      {!list.length && <p className="text-muted">No hay notas en esta sección todavía.</p>}
      {page === 1 && first ? (
        <>
          <HeroCard a={first} cat={cat(first.category)} />
          <div className="mt-12 grid grid-cols-1 gap-x-6 gap-y-10 min-[480px]:grid-cols-2 md:grid-cols-3 md:gap-x-8">
            {rest.slice(0, 6).map((a) => (
              <GridCard key={a.id} a={a} cat={cat(a.category)} />
            ))}
          </div>
          {map && map.news.length > 0 && (
            <section className="mt-14">
              <SectionTitle title={`Mapa · ${c.name}`} href="/mapa" />
              <MapLoader {...map} height={420} />
            </section>
          )}
          <div className="mt-10">
            {rest.slice(6).map((a) => (
              <ListItem key={a.id} a={a} cat={cat(a.category)} />
            ))}
          </div>
        </>
      ) : (
        list.map((a) => <ListItem key={a.id} a={a} cat={cat(a.category)} />)
      )}
      <div className="mt-10 flex justify-between gap-2 text-sm">
        {page > 1 ? <Link href={`?p=${page - 1}`} className="btn">← Más recientes</Link> : <span />}
        {page * PER_PAGE < total && <Link href={`?p=${page + 1}`} className="btn">Anteriores →</Link>}
      </div>
    </div>
  );
}
