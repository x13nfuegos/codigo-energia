import { formatNumber, timeAgo } from "@/lib/format";
import { isCounter } from "@/lib/indicators";
import type { Indicator } from "@/lib/types";
import { Sparkline } from "./Sparkline";

const STALE_MS = 3 * 86400000;

export function IndicatorsPanel({ items }: { items: Indicator[] }) {
  const list = items.filter((i) => i.show_in_panel && !isCounter(i));
  const groups = [...new Set(list.map((i) => i.group))];
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {groups.map((g) => (
        <div key={g} className="min-w-0 rounded-xl border border-line bg-surface">
          <h3 className="border-b border-line px-4 py-3 font-mono text-sm uppercase tracking-[0.15em] text-muted">{g}</h3>
          <ul>
            {list
              .filter((i) => i.group === g)
              .map((i) => {
                const up = (i.change_pct ?? 0) >= 0;
                const stale = !i.updated_at || Date.now() - new Date(i.updated_at).getTime() > STALE_MS;
                return (
                  <li key={i.id} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{i.label}</div>
                      <div className="truncate text-[0.7rem] text-dim">
                        {i.source_url ? (
                          <a href={i.source_url} target="_blank" rel="noopener noreferrer" className="hover:text-ink hover:underline">
                            {i.source ?? "Fuente"}
                          </a>
                        ) : (
                          i.source ?? "Carga manual"
                        )}
                        {i.updated_at && <span className={stale ? "text-down" : ""}> · {timeAgo(i.updated_at).toLowerCase()}</span>}
                      </div>
                    </div>
                    <div className="hidden sm:block">
                      <Sparkline points={(i.history ?? []).map((p) => p.v)} up={up} />
                    </div>
                    <div className="w-24 shrink-0 text-right font-mono">
                      <div className="font-bold">{formatNumber(i.value, i.decimals)}</div>
                      <div className="text-xs">
                        <span className="text-dim">{i.unit}</span>{" "}
                        {i.change_pct != null && <span className={up ? "text-up" : "text-down"}>{(up ? "+" : "") + formatNumber(i.change_pct, 2)}%</span>}
                      </div>
                    </div>
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
    </div>
  );
}
