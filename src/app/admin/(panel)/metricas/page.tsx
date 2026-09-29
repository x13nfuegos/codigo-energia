import Link from "next/link";
import { getMetrics, type Row } from "@/lib/metrics";
import { DEFAULT_INSTAGRAM } from "@/lib/instagram";
import { getStore } from "@/lib/store";

const n = (x: number) => x.toLocaleString("es-AR", { maximumFractionDigits: 1 });

function Bars({ rows, value }: { rows: Row[]; value: "views" | "notes" }) {
  const max = Math.max(1, ...rows.map((r) => r[value]));
  return (
    <ul className="space-y-2 text-sm">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="flex justify-between gap-3">
            <span className="truncate">{r.label}</span>
            <span className="shrink-0 font-mono text-xs text-muted">
              {n(r.views)} lecturas · {r.notes} notas
            </span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-accent" style={{ width: `${(r[value] / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function Metricas({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const days = [7, 30, 90].includes(Number((await searchParams).d)) ? Number((await searchParams).d) : 30;
  const [m, settings] = await Promise.all([getMetrics(days), (await getStore()).getSettings()]);
  const ig = { ...DEFAULT_INSTAGRAM, ...settings.instagram };
  const igOk = ig.posts.filter((p) => p.ok && Date.now() - new Date(p.at).getTime() < days * 86400000).length;
  const maxDay = Math.max(1, ...m.perDay.map((d) => d.notes));

  const stat = (label: string, value: React.ReactNode, hint?: string) => (
    <div className="card p-5">
      <div className="text-xs uppercase tracking-wider text-dim">{label}</div>
      <div className="mt-1 text-3xl font-bold">{value}</div>
      {hint && <div className="mt-1 text-xs text-dim">{hint}</div>}
    </div>
  );

  return (
    <div className="max-w-6xl space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Métricas</h1>
        <div className="ml-auto flex gap-1 text-sm">
          {[7, 30, 90].map((d) => (
            <Link key={d} href={`/admin/metricas?d=${d}`} className={`rounded-md px-3 py-1.5 ${d === days ? "bg-accent text-accent-ink" : "text-muted hover:bg-surface-2"}`}>
              {d} días
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stat("Notas publicadas", n(m.total), `${n(m.total / days)} por día`)}
        {stat("Lecturas de notas", n(m.totalViews), `${n(m.viewsPerNote)} por nota`)}
        {stat("Posteos en Instagram", igOk, ig.enabled ? "publicación automática activa" : "publicación automática apagada")}
        {stat("Notas con foto", `${m.quality[0].value}%`)}
      </div>

      <div className="card p-5">
        <h2 className="font-bold">Notas por día</h2>
        <div className="mt-4 flex h-40 items-end gap-[3px]">
          {m.perDay.map((d) => (
            <div key={d.date} className="group relative flex h-full flex-1 flex-col justify-end">
              <div className="rounded-t bg-accent/80 group-hover:bg-accent" style={{ height: `${(d.notes / maxDay) * 100}%`, minHeight: d.notes ? 2 : 0 }} />
              <span className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-surface-2 px-2 py-0.5 text-xs group-hover:block">
                {d.date.slice(5)}: {d.notes} notas · {d.views} lecturas
              </span>
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between font-mono text-xs text-dim">
          <span>{m.perDay[0]?.date.slice(5)}</span>
          <span>hoy</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {[
          ["Más leídas de la semana", m.topWeek],
          [`Más leídas (${days} días)`, m.topMonth],
        ].map(([title, list]) => (
          <div key={title as string} className="card p-5">
            <h2 className="font-bold">{title as string}</h2>
            {!(list as typeof m.topWeek).length && <p className="mt-2 text-sm text-muted">Todavía sin lecturas.</p>}
            <ol className="mt-3 space-y-2 text-sm">
              {(list as typeof m.topWeek).map((a, i) => (
                <li key={a.id} className="flex gap-3">
                  <span className="w-5 shrink-0 font-mono font-bold text-accent">{i + 1}</span>
                  <Link href={`/nota/${a.id}`} target="_blank" className="min-w-0 flex-1 truncate hover:underline">
                    {a.title}
                  </Link>
                  <span className="shrink-0 font-mono text-xs text-muted">{n(a.views ?? 0)}</span>
                </li>
              ))}
            </ol>
          </div>
        ))}
        <div className="card p-5">
          <h2 className="mb-3 font-bold">Por sección</h2>
          <Bars rows={m.byCategory} value="views" />
        </div>
        <div className="card p-5">
          <h2 className="mb-3 font-bold">Por medio de origen</h2>
          <Bars rows={m.bySource} value="notes" />
        </div>
      </div>

      <div className="card p-5">
        <h2 className="font-bold">Calidad del contenido</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {m.quality.map((q) => (
            <div key={q.label}>
              <div className="flex justify-between text-sm">
                <span className="text-muted">{q.label}</span>
                <span className="font-mono">{q.value}%</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-surface-2">
                <div className="h-full rounded-full bg-accent" style={{ width: `${q.value}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-5 text-sm text-muted">
        <h2 className="font-bold text-ink">Visitas, países y dispositivos</h2>
        <p className="mt-2">
          El tráfico general del sitio lo mide <b>Vercel Web Analytics</b> (ya está instalado en el sitio). Para verlo: Vercel → proyecto codigo-energia →
          pestaña <b>Analytics</b> → <b>Enable</b> (una sola vez). Ahí aparecen visitantes, páginas vistas, de dónde llegan y desde qué dispositivo.
        </p>
      </div>
    </div>
  );
}
