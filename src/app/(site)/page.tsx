import { SectionBlock } from "@/components/Sections";
import { getStore } from "@/lib/store";
import { getSettings } from "@/lib/site";

export default async function Home() {
  const [settings, sections] = await Promise.all([getSettings(), (await getStore()).list("sections")]);
  const list = sections.filter((s) => s.enabled).sort((a, b) => a.order - b.order);
  const total = await (await getStore()).countArticles({});
  return (
    <div className="space-y-14">
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
