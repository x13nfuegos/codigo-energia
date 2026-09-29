import { isCounter, toCounterData } from "@/lib/indicators";
import { getMapData } from "@/lib/map-data";
import Link from "next/link";
import { getStore } from "@/lib/store";
import { categoryFamily, categoryOf, getIndicators } from "@/lib/site";
import type { Section, Settings } from "@/lib/types";
import { BriefCard } from "./BriefCard";
import { GridCard, HeroCard, ListItem, SectionTitle } from "./Cards";
import { Counters } from "./Counters";
import { IndicatorsPanel } from "./IndicatorsPanel";
import { MapLoader } from "./MapLoader";

export async function SectionBlock({ section, settings }: { section: Section; settings: Settings }) {
  const store = await getStore();
  const cat = (slug: string) => categoryOf(settings, slug);
  const q = { category: section.category ? categoryFamily(settings, section.category) : undefined, limit: section.limit || 6, offset: section.offset ?? 0 };
  const more = section.category ? `/seccion/${section.category}` : undefined;

  switch (section.type) {
    case "hero": {
      const featured = await store.queryArticles({ ...q, featured: true, limit: 1, offset: 0 });
      const [a] = featured.length ? featured : await store.queryArticles({ ...q, limit: 1 });
      if (!a) return null;
      // en escritorio, al lado de la principal: lo más leído de la semana
      const top = (await store.queryArticles({ orderBy: "views", since: new Date(Date.now() - 7 * 86400000).toISOString(), limit: 5 }))
        .filter((x) => x.id !== a.id)
        .slice(0, 4);
      return (
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <HeroCard a={a} cat={cat(a.category)} />
          {top.length > 0 && (
            <aside className="hidden lg:block">
              <div className="mb-2 flex items-center gap-2 border-b-2 border-line pb-2 font-mono text-xs uppercase tracking-[0.15em] text-muted">
                <span className="h-4 w-1.5 rounded-sm bg-accent" />
                Lo más leído
              </div>
              <ol>
                {top.map((x, i) => (
                  <li key={x.id} className="flex gap-3 border-b border-line py-4 last:border-0">
                    <span className="font-mono text-2xl font-bold leading-none text-accent">{i + 1}</span>
                    <div className="min-w-0">
                      <Link href={`/nota/${x.id}`} className="font-semibold leading-snug hover:underline">
                        {x.title}
                      </Link>
                      <div className="mt-1 text-xs text-dim">{cat(x.category).name}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </aside>
          )}
        </div>
      );
    }
    case "list": {
      const list = await store.queryArticles(q);
      if (!list.length) return null;
      return (
        <section>
          {section.title && <SectionTitle title={section.title} href={more} />}
          {list.map((a) => (
            <ListItem key={a.id} a={a} cat={cat(a.category)} />
          ))}
        </section>
      );
    }
    case "grid":
    case "most_read": {
      const list =
        section.type === "most_read"
          ? await store.queryArticles({ ...q, orderBy: "views", since: new Date(Date.now() - 7 * 86400000).toISOString() })
          : await store.queryArticles(q);
      if (!list.length) return null;
      const cols = section.columns === 3 ? "md:grid-cols-3" : section.columns === 4 ? "md:grid-cols-4" : "";
      return (
        <section>
          {section.title && <SectionTitle title={section.title} href={more} />}
          <div className={`grid grid-cols-2 gap-x-5 gap-y-10 md:gap-x-8 ${cols}`}>
            {list.map((a) => (
              <GridCard key={a.id} a={a} cat={cat(a.category)} />
            ))}
          </div>
        </section>
      );
    }
    case "newsroom":
      // "Lo importante — Redacción en vivo" ahora va fija arriba de todo, en el layout del sitio
      return null;
    case "counters": {
      const counters = (await getIndicators()).filter((i) => isCounter(i) && (i.value != null || i.counter_base != null)).slice(0, section.limit || 3);
      if (!counters.length) return null;
      return <Counters now={Date.now()} items={counters.map(toCounterData)} />;
    }
    case "indicators": {
      const withValue = (await getIndicators()).filter((i) => i.show_in_panel && !isCounter(i) && i.value != null);
      if (!withValue.length) return null;
      return (
        <section>
          {section.title && <SectionTitle title={section.title} href="/indicadores" />}
          <IndicatorsPanel items={await getIndicators()} />
        </section>
      );
    }
    case "map": {
      const data = await getMapData();
      return (
        <section>
          {section.title && <SectionTitle title={section.title} href="/mapa" />}
          <MapLoader {...data} height={460} />
        </section>
      );
    }
    case "daily_brief": {
      const [brief] = (await store.list("briefs")).sort((a, b) => b.date.localeCompare(a.date));
      return brief ? <BriefCard brief={brief} title={section.title || "El resumen de ayer"} /> : null;
    }
    case "html":
      return section.html ? <section dangerouslySetInnerHTML={{ __html: section.html }} /> : null;
    default:
      return null;
  }
}
