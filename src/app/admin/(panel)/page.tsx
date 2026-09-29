import Link from "next/link";
import { Flash, type FlashParams } from "@/components/admin/Flash";
import { Submit } from "@/components/admin/Submit";
import { dateTime, timeAgo } from "@/lib/format";
import { getStore } from "@/lib/store";
import { generateBriefNow, refreshIndicatorsNow, scrapeNow } from "../actions";

export default async function Dashboard({ searchParams }: { searchParams: FlashParams }) {
  const sp = await searchParams;
  const store = await getStore();
  const [settings, published, drafts, sources, today, briefs] = await Promise.all([
    store.getSettings(),
    store.countArticles({}),
    store.countArticles({ status: "draft" }),
    store.list("sources"),
    store.countArticles({ since: new Date(Date.now() - 86400000).toISOString() }),
    store.list("briefs"),
  ]);
  const failing = sources.filter((s) => s.enabled && s.last_status?.startsWith("error"));
  const lastBrief = briefs.sort((a, b) => b.date.localeCompare(a.date))[0];
  const env = [
    ["Base de datos", store.kind === "supabase" ? "Supabase" : "Archivo local (solo desarrollo)", store.kind === "supabase"],
    ["Clave de administración", process.env.ADMIN_PASSWORD ? "configurada" : "falta", !!process.env.ADMIN_PASSWORD],
    ["Cron (CRON_SECRET)", process.env.CRON_SECRET ? "configurado" : "falta", !!process.env.CRON_SECRET],
    ["IA (Anthropic)", process.env.ANTHROPIC_API_KEY ? "configurada" : "falta: sin resumen ni reescritura", !!process.env.ANTHROPIC_API_KEY],
    ["Audio (ElevenLabs)", process.env.ELEVENLABS_API_KEY ? "configurado" : "falta", !!process.env.ELEVENLABS_API_KEY],
    ["Video (HeyGen)", process.env.HEYGEN_API_KEY ? "configurado" : "falta", !!process.env.HEYGEN_API_KEY],
  ] as const;

  const stat = (label: string, value: React.ReactNode, href?: string) => (
    <div className="card p-5">
      <div className="text-xs uppercase tracking-wider text-dim">{label}</div>
      <div className="mt-1 text-3xl font-bold">{href ? <Link href={href}>{value}</Link> : value}</div>
    </div>
  );

  return (
    <div className="max-w-5xl">
      <h1 className="mb-6 text-2xl font-bold">Tablero</h1>
      <Flash {...sp} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stat("Notas publicadas", published, "/admin/notas")}
        {stat("Últimas 24 h", today)}
        {stat("Borradores", drafts, "/admin/notas?status=draft")}
        {stat("Fuentes con error", failing.length, "/admin/fuentes")}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-bold">Acciones</h2>
          <p className="mt-1 text-sm text-dim">
            Último scrapeo: {settings.last_scrape_at ? timeAgo(settings.last_scrape_at).toLowerCase() : "nunca"} · Indicadores:{" "}
            {settings.last_indicators_at ? timeAgo(settings.last_indicators_at).toLowerCase() : "nunca"}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <form action={scrapeNow.bind(null, null, "/admin")}>
              <Submit>Scrapear ahora</Submit>
            </form>
            <form action={refreshIndicatorsNow.bind(null, "/admin")}>
              <Submit className="btn">Actualizar indicadores</Submit>
            </form>
            <form action={generateBriefNow.bind(null, false)}>
              <Submit className="btn">Generar resumen de ayer</Submit>
            </form>
          </div>
          {lastBrief && (
            <p className="mt-4 text-sm text-muted">
              Último resumen: <Link href={`/resumen/${lastBrief.id}`} className="underline">{lastBrief.title}</Link> ({dateTime(lastBrief.created_at)})
            </p>
          )}
        </div>
        <div className="card p-5">
          <h2 className="font-bold">Configuración</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {env.map(([k, v, ok]) => (
              <li key={k} className="flex justify-between gap-4">
                <span className="text-muted">{k}</span>
                <span className={ok ? "text-emerald-300" : "text-amber-300"}>{v}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {failing.length > 0 && (
        <div className="card mt-6 p-5">
          <h2 className="font-bold">Fuentes con error</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {failing.map((s) => (
              <li key={s.id}>
                <b>{s.name}</b> <span className="text-red-300">{s.last_status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
