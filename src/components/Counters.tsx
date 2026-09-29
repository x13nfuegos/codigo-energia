"use client";

import { useEffect, useState } from "react";

export type CounterData = {
  id: string;
  label: string;
  unit: string;
  start: string;
  base: number;
  ratePerDay: number;
};

const fmt = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const since = (iso: string) =>
  new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(iso)).replace(".", "");

const valueAt = (c: CounterData, t: number) => c.base + Math.max(0, (t - new Date(c.start).getTime()) / 86400000) * c.ratePerDay;

/** Contadores que crecen en vivo según el ritmo diario configurado. */
export function Counters({ items, now }: { items: CounterData[]; now: number }) {
  const [t, setT] = useState(now);
  useEffect(() => {
    const id = setInterval(() => setT(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {items.map((c) => (
        <div key={c.id} className="rounded-xl border border-line bg-surface px-5 py-6">
          <div className="font-mono text-sm uppercase tracking-[0.12em] text-muted">{c.label}</div>
          <div className="mt-2 font-mono text-4xl font-bold tabular-nums md:text-[2.6rem]">{fmt.format(Math.floor(valueAt(c, t)))}</div>
          <div className="mt-1 text-sm text-muted">
            {c.unit} <span className="text-dim">· desde {since(c.start)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
