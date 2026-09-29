import Link from "next/link";
import { CrudList } from "@/components/admin/CrudList";
import { Flash, type FlashParams } from "@/components/admin/Flash";
import { Submit } from "@/components/admin/Submit";
import { SCHEMAS } from "@/lib/admin-schema";
import { getStore } from "@/lib/store";
import { moveSection, toggleSection } from "../../actions";

export default async function Portada({ searchParams }: { searchParams: FlashParams }) {
  const store = await getStore();
  const [settings, sections] = await Promise.all([store.getSettings(), store.list("sections")]);
  const sorted = sections.sort((a, b) => a.order - b.order);
  const typeLabel = Object.fromEntries(SCHEMAS.sections!.find((f) => f.name === "type")!.options!.map((o) => [o.value, o.label]));
  return (
    <div className="max-w-4xl">
      <div className="mb-2 flex items-center">
        <h1 className="text-2xl font-bold">Diagramación de portada</h1>
        <Link href="/" target="_blank" className="btn ml-auto">Ver portada ↗</Link>
      </div>
      <p className="mb-6 text-sm text-muted">Los bloques se muestran en este orden. Movelos con las flechas, ocultalos o editá qué muestra cada uno.</p>
      <Flash {...(await searchParams)} />
      <CrudList
        table="sections"
        rows={sorted as never}
        fields={SCHEMAS.sections!}
        settings={settings}
        path="/admin/portada"
        newLabel="Nuevo bloque"
        newDefaults={{ type: "grid", limit: 4, columns: 2, enabled: true }}
        summary={(r) => {
          const s = r as unknown as (typeof sorted)[number];
          return (
            <div className={s.enabled ? "" : "opacity-50"}>
              <span className="font-semibold">{s.title || typeLabel[s.type]}</span>{" "}
              <span className="text-xs text-dim">
                {typeLabel[s.type]}
                {s.category ? ` · ${settings.categories.find((c) => c.slug === s.category)?.name ?? s.category}` : ""}
                {["hero", "list", "grid", "most_read", "newsroom"].includes(s.type) ? ` · ${s.limit} notas` : ""}
              </span>
            </div>
          );
        }}
        extra={(r) => {
          const s = r as unknown as (typeof sorted)[number];
          return (
            <div className="flex gap-1">
              <form action={moveSection.bind(null, s.id, -1)}><Submit className="btn">↑</Submit></form>
              <form action={moveSection.bind(null, s.id, 1)}><Submit className="btn">↓</Submit></form>
              <form action={toggleSection.bind(null, s.id, !s.enabled)}><Submit className="btn">{s.enabled ? "Ocultar" : "Mostrar"}</Submit></form>
            </div>
          );
        }}
      />
    </div>
  );
}
