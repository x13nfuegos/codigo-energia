import { SectionTitle } from "@/components/Cards";
import { Counters } from "@/components/Counters";
import { IndicatorsPanel } from "@/components/IndicatorsPanel";
import { dateTime } from "@/lib/format";
import { isCounter, toCounterData } from "@/lib/indicators";
import { getIndicators } from "@/lib/site";

export const metadata = { title: "Indicadores y fuentes" };

export default async function Indicadores() {
  const items = await getIndicators();
  const counters = items.filter((i) => isCounter(i) && (i.value != null || i.counter_base != null));
  return (
    <div className="space-y-14">
      {counters.length > 0 && (
        <div>
          <SectionTitle title="Producción" />
          <Counters now={Date.now()} items={counters.map(toCounterData)} />
        </div>
      )}
      <div>
        <SectionTitle title="Mercados" />
        <IndicatorsPanel items={items} />
      </div>
      <div>
        <SectionTitle title="Fuentes" />
        <p className="mb-4 max-w-3xl text-sm text-muted">
          Todos los valores se actualizan automáticamente. Las cotizaciones de mercado tienen demora de hasta 20 minutos; los datos de
          producción son los que publica la Secretaría de Energía (mensuales, con uno o dos meses de rezago).
        </p>
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-surface font-mono text-xs uppercase tracking-wider text-dim">
              <tr>
                <th className="px-4 py-3">Dato</th>
                <th className="px-4 py-3">Fuente</th>
                <th className="px-4 py-3">Actualizado</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className="border-t border-line">
                  <td className="px-4 py-2.5 font-semibold">{i.label}</td>
                  <td className="px-4 py-2.5 text-muted">
                    {i.source_url ? (
                      <a href={i.source_url} target="_blank" rel="noopener noreferrer" className="underline hover:text-ink">
                        {i.source ?? i.source_url}
                      </a>
                    ) : (
                      i.source ?? "Carga manual"
                    )}
                    {i.note && <span className="block text-xs text-dim">{i.note}</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-dim">{i.updated_at ? dateTime(i.updated_at) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
