import { ListItem, SectionTitle } from "@/components/Cards";
import { getStore } from "@/lib/store";
import { categoryOf, getSettings } from "@/lib/site";

export const metadata = { title: "Buscar" };

export default async function Buscar({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").trim();
  const settings = await getSettings();
  const list = q ? await (await getStore()).queryArticles({ search: q, limit: 40 }) : [];
  return (
    <div className="mx-auto max-w-3xl">
      <SectionTitle title="Buscar" />
      <form className="flex gap-2">
        <input name="q" defaultValue={q} placeholder="Vaca Muerta, litio, YPF…" className="input text-lg" autoFocus />
        <button className="btn btn-primary">Buscar</button>
      </form>
      <div className="mt-6">
        {q && !list.length && <p className="text-muted">Sin resultados para “{q}”.</p>}
        {list.map((a) => (
          <ListItem key={a.id} a={a} cat={categoryOf(settings, a.category)} />
        ))}
      </div>
    </div>
  );
}
