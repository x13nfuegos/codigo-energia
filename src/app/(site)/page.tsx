import { Newsroom } from "@/components/Newsroom";
import { SectionBlock } from "@/components/Sections";
import { timeAgo } from "@/lib/format";
import { getStore } from "@/lib/store";
import { getSettings } from "@/lib/site";

export default async function Home() {
  const [settings, sections] = await Promise.all([getSettings(), (await getStore()).list("sections")]);
  const list = sections.filter((s) => s.enabled).sort((a, b) => a.order - b.order);
  const store = await getStore();
  const [total, latest] = await Promise.all([store.countArticles({}), store.queryArticles({ limit: 8 })]);
  return (
    <div className="space-y-12">
      {latest.length > 0 && (
        <Newsroom items={latest.map((a) => ({ id: a.id, title: a.title, tag: a.category.replace(/-/g, ""), time: timeAgo(a.published_at).toLowerCase() }))} />
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
