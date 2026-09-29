import { SectionTitle } from "@/components/Cards";
import { Counters } from "@/components/Counters";
import { IndicatorsPanel } from "@/components/IndicatorsPanel";
import { getIndicators } from "@/lib/site";

export const metadata = { title: "Indicadores" };

export default async function Indicadores() {
  const items = await getIndicators();
  const counters = items.filter((i) => i.provider === "counter");
  return (
    <div className="space-y-12">
      <div>
        <SectionTitle title="Indicadores" />
        <IndicatorsPanel items={items} />
      </div>
      {counters.length > 0 && (
        <div>
          <SectionTitle title="Contadores" />
          <Counters
            now={Date.now()}
            items={counters.map((c) => ({
              id: c.id,
              label: c.label,
              unit: c.unit,
              start: c.counter_start ?? new Date().toISOString(),
              base: c.counter_base ?? 0,
              ratePerDay: c.counter_rate_per_day ?? 0,
            }))}
          />
          <p className="mt-3 text-xs text-dim">Estimaciones en base al ritmo de producción informado. Se actualizan con cada dato oficial.</p>
        </div>
      )}
    </div>
  );
}
