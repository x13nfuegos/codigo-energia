"use client";

import { useEffect, useState } from "react";

export type CounterData = {
  id: string;
  label: string;
  unit: string;
  start: string;
  base: number;
  ratePerDay: number;
  since?: string | null;
  caption?: string | null;
  source?: string | null;
  sourceUrl?: string | null;
  note?: string | null;
};

const fmt = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const since = (iso: string) =>
  new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(iso)).replace(".", "");

const valueAt = (c: CounterData, t: number) => c.base + Math.max(0, (t - new Date(c.start).getTime()) / 86400000) * c.ratePerDay;

/** Contadores: dato oficial acumulado + estimación en vivo al ritmo del último mes publicado. */
export function Counters({ items, now }: { items: CounterData[]; now: number }) {
  const [t, setT] = useState(now);
  useEffect(() => {
    if (!items.some((c) => c.ratePerDay)) return;
    const id = setInterval(() => setT(Date.now()), 250);
    return () => clearInterval(id);
  }, [items]);
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((c) => (
        <div key={c.id} className="@container flex flex-col rounded-xl border border-line bg-surface px-5 py-5">
          <div className="font-mono text-xs uppercase leading-snug tracking-[0.12em] text-muted">{c.label}</div>
          <div className="mt-2 font-mono text-[clamp(1.6rem,11cqw,2.6rem)] font-bold leading-tight tabular-nums">{fmt.format(Math.floor(valueAt(c, t)))}</div>
          <div className="mt-1 text-sm text-muted">
            {c.unit}
            <span className="text-dim"> · {c.caption ?? `desde ${since(c.since ?? c.start)}`}</span>
          </div>
          {c.source && (
            <div className="mt-auto pt-3 text-[0.7rem] leading-snug text-dim" title={c.note ?? undefined}>
              Fuente:{" "}
              {c.sourceUrl ? (
                <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-ink">
                  {c.source}
                </a>
              ) : (
                c.source
              )}
              {c.note && <span className="block">{c.note}</span>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
