import { formatNumber } from "@/lib/format";
import type { Indicator } from "@/lib/types";

function Item({ i }: { i: Indicator }) {
  const up = (i.change_pct ?? 0) >= 0;
  return (
    <span className="flex items-center gap-2 whitespace-nowrap px-5">
      <span className="uppercase tracking-[0.12em] text-muted">{i.label}</span>
      <b className="font-bold text-ink">{formatNumber(i.value, i.decimals)}</b>
      <span className="text-dim">{i.unit}</span>
      {i.change_pct != null && (
        <span className={up ? "text-up" : "text-down"}>
          {up ? "▲" : "▼"} {formatNumber(Math.abs(i.change_pct), 2)}%
        </span>
      )}
    </span>
  );
}

export function Ticker({ items }: { items: Indicator[] }) {
  const list = items.filter((i) => i.show_in_ticker && i.provider !== "counter");
  if (!list.length) return null;
  return (
    <div className="ticker overflow-hidden border-y border-line bg-surface font-mono text-sm" aria-label="Cotizaciones">
      <div className="ticker-track flex w-max py-2.5" style={{ ["--ticker-duration" as string]: `${Math.max(30, list.length * 6)}s` }}>
        {[0, 1].map((k) => (
          <div key={k} className="flex" aria-hidden={k === 1}>
            {list.map((i) => (
              <Item key={i.id} i={i} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
