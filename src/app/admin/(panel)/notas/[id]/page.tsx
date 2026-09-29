import Link from "next/link";
import { notFound } from "next/navigation";
import { EntityForm } from "@/components/admin/EntityForm";
import { Flash, type FlashParams } from "@/components/admin/Flash";
import { SCHEMAS } from "@/lib/admin-schema";
import { getStore } from "@/lib/store";
import { saveEntity } from "../../../actions";

export default async function EditNota({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: FlashParams }) {
  const { id } = await params;
  const store = await getStore();
  const isNew = id === "nueva";
  const a = isNew ? null : await store.get("articles", id);
  if (!isNew && !a) notFound();
  const settings = await store.getSettings();
  const values = a ?? { status: "published", category: settings.categories[0]?.slug, source_name: settings.site_name };
  return (
    <div className="max-w-3xl">
      <Link href="/admin/notas" className="text-sm text-muted">← Notas</Link>
      <h1 className="mb-6 mt-2 text-2xl font-bold">{isNew ? "Nueva nota" : "Editar nota"}</h1>
      <Flash {...(await searchParams)} />
      {a?.status === "published" && (
        <p className="mb-4 text-sm"><Link href={`/nota/${a.id}`} target="_blank" className="underline">Ver en el sitio ↗</Link></p>
      )}
      <EntityForm
        fields={SCHEMAS.articles!}
        values={values as Record<string, unknown>}
        settings={settings}
        action={saveEntity.bind(null, "articles", isNew ? "/admin/notas" : `/admin/notas/${id}`)}
      />
    </div>
  );
}
