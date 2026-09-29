import { Flash, type FlashParams } from "@/components/admin/Flash";
import { Submit } from "@/components/admin/Submit";
import { runDiagnostics } from "@/lib/diagnostics";
import { timeAgo } from "@/lib/format";
import { getStore } from "@/lib/store";
import { applyUpdates, findMissingPhotos, makeLatestAudio, refreshIndicatorsNow, scrapeNow } from "../../actions";

export const maxDuration = 60;

export default async function Diagnostico({ searchParams }: { searchParams: FlashParams }) {
  const [{ checks, env }, store] = await Promise.all([runDiagnostics(), getStore()]);
  const [settings, sources] = await Promise.all([store.getSettings(), store.list("sources")]);
  const path = "/admin/diagnostico";
  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold">Diagnóstico</h1>
        <div className="ml-auto flex flex-wrap gap-2">
          <form action={scrapeNow.bind(null, null, path)}><Submit>Scrapear ahora</Submit></form>
          <form action={refreshIndicatorsNow.bind(null, path, false)}><Submit className="btn">Actualizar cotizaciones</Submit></form>
          <form action={findMissingPhotos}><Submit className="btn">Buscar y revisar fotos</Submit></form>
          <form action={makeLatestAudio}><Submit className="btn">Generar audio del resumen</Submit></form>
          <form action={applyUpdates}><Submit className="btn">Aplicar actualizaciones</Submit></form>
        </div>
      </div>
      <p className="text-sm text-muted">Prueba cada pieza del sitio desde el servidor. Si algo sale en rojo, mandá una captura de esta página.</p>
      <Flash {...(await searchParams)} />

      <div className="card p-5">
        <h2 className="font-bold">Configuración</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-[14rem_1fr]">
          {Object.entries(env).map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted">{k}</dt>
              <dd className={/falta|no sirve|PUBLICABLE|temporal|no disponible/.test(v) ? "text-down" : ""}>{v}</dd>
            </div>
          ))}
          <dt className="text-muted">Último scrapeo</dt>
          <dd>{settings.last_scrape_at ? timeAgo(settings.last_scrape_at) : "nunca"}</dd>
          <dt className="text-muted">Última actualización de indicadores</dt>
          <dd>{settings.last_indicators_at ? timeAgo(settings.last_indicators_at) : "nunca"}</dd>
        </dl>
      </div>

      <div className="card divide-y divide-line">
        {checks.map((c) => (
          <div key={c.name} className="flex flex-col gap-1 px-5 py-3 text-sm sm:flex-row sm:items-center sm:gap-4">
            <span className={`font-mono font-bold ${c.ok ? "text-up" : "text-down"}`}>{c.ok ? "OK" : "ERROR"}</span>
            <span className="font-semibold sm:w-72">{c.name}</span>
            <span className="min-w-0 flex-1 break-words text-muted">{c.detail}</span>
            <span className="font-mono text-xs text-dim">{c.ms} ms</span>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <h2 className="font-bold">Fuentes</h2>
        <ul className="mt-3 space-y-1.5 text-sm">
          {sources.map((s) => (
            <li key={s.id} className="flex flex-wrap gap-x-3">
              <span className={s.enabled ? "font-semibold" : "text-dim"}>{s.name}</span>
              <span className={s.last_status?.startsWith("error") ? "text-down" : "text-muted"}>
                {s.last_run_at ? `${timeAgo(s.last_run_at).toLowerCase()} · ${s.last_status} · ${s.last_count ?? 0} nuevas` : "sin correr"}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
