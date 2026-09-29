import { CrudList } from "@/components/admin/CrudList";
import { Flash, type FlashParams } from "@/components/admin/Flash";
import { Submit } from "@/components/admin/Submit";
import { SCHEMAS } from "@/lib/admin-schema";
import { formatNumber, timeAgo } from "@/lib/format";
import { getStore } from "@/lib/store";
import { refreshIndicatorsNow } from "../../actions";

export default async function Indicadores({ searchParams }: { searchParams: FlashParams }) {
  const store = await getStore();
  const [settings, list] = await Promise.all([store.getSettings(), store.list("indicators")]);
  const sorted = list.sort((a, b) => a.order - b.order);
  const path = "/admin/indicadores";
  return (
    <div className="max-w-4xl">
      <div className="mb-2 flex items-center">
        <h1 className="text-2xl font-bold">Indicadores</h1>
        <form action={refreshIndicatorsNow.bind(null, path)} className="ml-auto">
          <Submit>Actualizar ahora</Submit>
        </form>
      </div>
      <p className="mb-6 text-sm text-muted">
        Cotizaciones automáticas (Yahoo Finance, DolarAPI o cualquier URL JSON), valores manuales y contadores en vivo. Los contadores muestran
        valor inicial + ritmo diario × días transcurridos: actualizá el ritmo cuando salgan datos oficiales de producción.
      </p>
      <Flash {...(await searchParams)} />
      <CrudList
        table="indicators"
        rows={sorted as never}
        fields={SCHEMAS.indicators!}
        settings={settings}
        path={path}
        newLabel="Nuevo indicador"
        newDefaults={{ provider: "yahoo", group: "Commodities", decimals: 2, enabled: true, show_in_ticker: true, show_in_panel: true, order: sorted.length }}
        summary={(r) => {
          const i = r as unknown as (typeof sorted)[number];
          return (
            <div className={i.enabled ? "" : "opacity-50"}>
              <span className="font-semibold">{i.label}</span>{" "}
              <span className="font-mono text-sm">
                {i.provider === "counter" ? `+${formatNumber(i.counter_rate_per_day, 0)}/día` : `${formatNumber(i.value, i.decimals)} ${i.unit}`}
              </span>
              <div className="text-xs text-dim">
                {i.group} · {i.provider} {i.param} {i.updated_at ? `· ${timeAgo(i.updated_at).toLowerCase()}` : ""}
                {i.show_in_ticker ? " · en cinta" : ""}
              </div>
            </div>
          );
        }}
      />
    </div>
  );
}
