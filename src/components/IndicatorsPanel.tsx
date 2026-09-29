import { formatNumber, timeAgo } from "@/lib/format";
import type { Indicator } from "@/lib/types";
import { Sparkline } from "./Sparkline";

export function IndicatorsPanel({ items }: { items: Indicator[] }) {
  const list = items.filter((i) => i.show_in_panel && i.provider !== "counter");
  const groups = [...new Set(list.map((i) => i.group))];
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {groups.map((g) => (
        <div key={g} className="rounded-xl border border-line bg-surface">
          <h3 className="border-b border-line px-4 py-3 font-mono text-sm uppercase tracking-[0.15em] text-muted">{g}</h3>
          <ul>
            {list
              .filter((i) => i.group === g)
              .map((i) => {
                const up = (i.change_pct ?? 0) >= 0;
                return (
                  <li key={i.id} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{i.label}</div>
                      <div className="text-xs text-dim">{i.updated_at ? `act. ${timeAgo(i.updated_at).toLowerCase()}` : i.note ?? ""}</div>
                    </div>
                    <Sparkline points={(i.history ?? []).map((p) => p.v)} up={up} />
                    <div className="w-28 text-right font-mono">
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
