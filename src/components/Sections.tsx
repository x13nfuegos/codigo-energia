import { getStore } from "@/lib/store";
import { categoryOf, getIndicators } from "@/lib/site";
import type { Section, Settings } from "@/lib/types";
import { BriefCard } from "./BriefCard";
import { GridCard, HeroCard, ListItem, SectionTitle } from "./Cards";
import { Counters } from "./Counters";
import { IndicatorsPanel } from "./IndicatorsPanel";
import { MapLoader } from "./MapLoader";
import { Newsroom } from "./Newsroom";

export async function SectionBlock({ section, settings }: { section: Section; settings: Settings }) {
  const store = await getStore();
  const cat = (slug: string) => categoryOf(settings, slug);
  const q = { category: section.category || undefined, limit: section.limit || 6, offset: section.offset ?? 0 };
  const more = section.category ? `/seccion/${section.category}` : undefined;

  switch (section.type) {
    case "hero": {
      const featured = await store.queryArticles({ ...q, featured: true, limit: 1, offset: 0 });
      const [a] = featured.length ? featured : await store.queryArticles({ ...q, limit: 1 });
      return a ? <HeroCard a={a} cat={cat(a.category)} /> : null;
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
    case "newsroom": {
      const list = await store.queryArticles({ ...q, offset: 0 });
      if (!list.length) return null;
      return <Newsroom title={section.title || "Redacción · en vivo"} items={list.map((a) => ({ id: a.id, title: a.title, tag: a.category.replace(/-/g, "") }))} />;
    }
    case "counters": {
      const counters = (await getIndicators()).filter((i) => i.provider === "counter").slice(0, section.limit || 3);
      if (!counters.length) return null;
      return (
        <Counters
          now={Date.now()}
          items={counters.map((c) => ({
            id: c.id,
            label: c.label,
            unit: c.unit,
            start: c.counter_start ?? new Date().toISOString(),
            base: c.counter_base ?? 0,
            ratePerDay: c.counter_rate_per_day ?? 0,
          }))}
        />
      );
    }
    case "indicators":
      return (
        <section>
          {section.title && <SectionTitle title={section.title} href="/indicadores" />}
          <IndicatorsPanel items={await getIndicators()} />
        </section>
      );
    case "map": {
      const points = (await store.list("map_points")).filter((p) => p.enabled);
      return (
        <section>
          {section.title && <SectionTitle title={section.title} href="/mapa" />}
          <MapLoader points={points} height={440} />
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
