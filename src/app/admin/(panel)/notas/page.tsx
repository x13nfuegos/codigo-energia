import Link from "next/link";
import { Flash, type FlashParams } from "@/components/admin/Flash";
import { Submit } from "@/components/admin/Submit";
import { timeAgo } from "@/lib/format";
import { getStore } from "@/lib/store";
import { categoryOf } from "@/lib/site";
import type { ArticleStatus } from "@/lib/types";
import { deleteEntity, patchArticle, rewriteArticleAction } from "../../actions";

const PER = 40;
const STATUS: Record<ArticleStatus, string> = { published: "Publicada", draft: "Borrador", hidden: "Oculta" };

export default async function Notas({ searchParams }: { searchParams: Promise<{ status?: string; cat?: string; q?: string; p?: string } & Awaited<FlashParams>> }) {
  const sp = await searchParams;
  const status = (sp.status as ArticleStatus | "all") || "all";
  const page = Math.max(1, Number(sp.p) || 1);
  const store = await getStore();
  const settings = await store.getSettings();
  const q = { status, category: sp.cat || undefined, search: sp.q || undefined };
  const [list, total] = await Promise.all([store.queryArticles({ ...q, limit: PER, offset: (page - 1) * PER }), store.countArticles(q)]);
  const self = `/admin/notas?${new URLSearchParams(Object.entries({ status: sp.status ?? "", cat: sp.cat ?? "", q: sp.q ?? "", p: String(page) }).filter(([, v]) => v)).toString()}`;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <h1 className="text-2xl font-bold">Notas</h1>
        <span className="text-sm text-dim">{total} resultados</span>
        <Link href="/admin/notas/nueva" className="btn btn-primary ml-auto">+ Nota propia</Link>
      </div>
      <Flash msg={sp.msg} err={sp.err} />
      <form className="mb-6 flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q} placeholder="Buscar…" className="input max-w-xs" />
        <select name="status" defaultValue={sp.status ?? ""} className="input max-w-[10rem]">
          <option value="">Todos los estados</option>
          {Object.entries(STATUS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select name="cat" defaultValue={sp.cat ?? ""} className="input max-w-[12rem]">
          <option value="">Todas las secciones</option>
          {settings.categories.map((c) => (
            <option key={c.slug} value={c.slug}>{c.name}</option>
          ))}
        </select>
        <button className="btn">Filtrar</button>
      </form>

      <div className="space-y-2">
        {list.map((a) => {
          const cat = categoryOf(settings, a.category);
          return (
            <div key={a.id} className="card flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded px-1.5 py-0.5 font-bold uppercase" style={{ background: cat.color, color: cat.text }}>{cat.name}</span>
                  <span className={a.status === "published" ? "text-emerald-300" : a.status === "draft" ? "text-amber-300" : "text-dim"}>{STATUS[a.status]}</span>
                  {a.featured && <span className="text-accent">★ Destacada</span>}
                  {a.body && <span className="text-sky-300">IA</span>}
                  <span className="text-dim">{timeAgo(a.published_at)} · {a.source_name} · {a.views ?? 0} vistas</span>
                </div>
                <Link href={`/admin/notas/${a.id}`} className="mt-1 block font-semibold hover:underline">{a.title}</Link>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {a.status !== "published" ? (
                  <form action={patchArticle.bind(null, a.id, { status: "published" }, self)}><Submit className="btn">Publicar</Submit></form>
                ) : (
                  <form action={patchArticle.bind(null, a.id, { status: "hidden" }, self)}><Submit className="btn">Ocultar</Submit></form>
                )}
                <form action={patchArticle.bind(null, a.id, { featured: !a.featured }, self)}>
                  <Submit className="btn">{a.featured ? "Quitar ★" : "Destacar ★"}</Submit>
                </form>
                <form action={rewriteArticleAction.bind(null, a.id, self)}><Submit className="btn">Reescribir IA</Submit></form>
                <a href={a.url} target="_blank" rel="noopener noreferrer" className="btn">Fuente ↗</a>
                <form action={deleteEntity.bind(null, "articles", a.id, self)}>
                  <Submit className="btn btn-danger" confirm="¿Eliminar la nota? Si sigue en el feed puede volver a entrar; para evitarlo, ocultala.">Borrar</Submit>
                </form>
              </div>
            </div>
          );
        })}
        {!list.length && <p className="text-muted">No hay notas con esos filtros.</p>}
      </div>
      <div className="mt-6 flex gap-2">
        {page > 1 && <Link className="btn" href={self.replace(/p=\d+/, `p=${page - 1}`)}>← Anterior</Link>}
        {page * PER < total && <Link className="btn" href={self.includes("p=") ? self.replace(/p=\d+/, `p=${page + 1}`) : `${self}&p=${page + 1}`}>Siguiente →</Link>}
      </div>
    </div>
  );
}
