import { CrudList } from "@/components/admin/CrudList";
import { Flash, type FlashParams } from "@/components/admin/Flash";
import { Submit } from "@/components/admin/Submit";
import { SCHEMAS } from "@/lib/admin-schema";
import { timeAgo } from "@/lib/format";
import { getStore } from "@/lib/store";
import { scrapeNow } from "../../actions";
import { TestSource } from "./TestSource";

const TYPE = { google_news: "Google News", rss: "RSS", html: "HTML" } as const;

export default async function Fuentes({ searchParams }: { searchParams: FlashParams }) {
  const store = await getStore();
  const [settings, sources] = await Promise.all([store.getSettings(), store.list("sources")]);
  const path = "/admin/fuentes";
  return (
    <div className="max-w-5xl">
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Fuentes de scraping</h1>
        <form action={scrapeNow.bind(null, null, path)} className="ml-auto">
          <Submit>Scrapear todas ahora</Submit>
        </form>
      </div>
      <p className="mb-6 text-sm text-muted">
        Cada fuente se revisa cada {settings.scrape_every_min} minutos. Google News permite seguir cualquier tema o medio (por ejemplo{" "}
        <code className="text-ink">site:rionegro.com.ar energía</code>). Para medios sin RSS usá el tipo HTML con selectores CSS y probalo antes de activarlo.
      </p>
      <Flash {...(await searchParams)} />
      <CrudList
        table="sources"
        rows={sources.sort((a, b) => a.name.localeCompare(b.name)) as never}
        fields={SCHEMAS.sources!}
        settings={settings}
        path={path}
        newLabel="Nueva fuente"
        newDefaults={{ type: "google_news", category: "energia", enabled: true, auto_publish: true, max_items: 20, fetch_meta: false }}
        summary={(r) => {
          const s = r as unknown as (typeof sources)[number];
          const err = s.last_status?.startsWith("error");
          return (
            <div>
              <div className="font-semibold">
                {s.name} {!s.enabled && <span className="text-xs text-dim">(pausada)</span>}
              </div>
              <div className="text-xs text-dim">
                {TYPE[s.type]} · {s.category === "auto" ? "Sección automática" : settings.categories.find((c) => c.slug === s.category)?.name ?? s.category} ·{" "}
                {s.last_run_at ? `${timeAgo(s.last_run_at).toLowerCase()}: ` : "sin correr"}
                <span className={err ? "text-red-300" : "text-emerald-300"}>{err ? s.last_status : s.last_run_at ? `${s.last_count ?? 0} nuevas` : ""}</span>
              </div>
            </div>
          );
        }}
        extra={(r) => (
          <div className="flex gap-1.5">
            <TestSource id={r.id} />
            <form action={scrapeNow.bind(null, r.id, path)}>
              <Submit className="btn">Correr</Submit>
            </form>
          </div>
        )}
      />
    </div>
  );
}
