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

type IconKind = "oil" | "gas" | "well" | "bolt";
function iconFor(c: CounterData): IconKind {
  const k = `${c.id} ${c.label} ${c.unit}`.toLowerCase();
  if (/pozo|well/.test(k)) return "well";
  if (/gas|m³|m3/.test(k)) return "gas";
  if (/petr|crudo|barril|bbl|oil/.test(k)) return "oil";
  return "bolt";
}

/** Íconos lineales (heredan el color de acento del tema). */
function CounterIcon({ kind }: { kind: IconKind }) {
  const common = { width: 28, height: 28, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (kind === "oil")
    return (
      <svg {...common}>
        <ellipse cx="12" cy="4.5" rx="6.5" ry="2" />
        <path d="M5.5 4.5v15c0 1.1 2.9 2 6.5 2s6.5-.9 6.5-2v-15" />
        <path d="M5.5 9.5c0 1.1 2.9 2 6.5 2s6.5-.9 6.5-2M5.5 15c0 1.1 2.9 2 6.5 2s6.5-.9 6.5-2" />
      </svg>
    );
  if (kind === "gas")
    return (
      <svg {...common}>
        <path d="M12 2.5c.8 3.2 5.5 5.6 5.5 11a5.5 5.5 0 0 1-11 0c0-2.6 1.3-4.3 2.6-5.6.2 1.8 1 2.9 2.1 3.4C11 8.6 11.2 5.4 12 2.5Z" />
        <path d="M12 21a2.3 2.3 0 0 1-2.3-2.3c0-1.5 1.3-2.4 2.3-3.9 1 1.5 2.3 2.4 2.3 3.9A2.3 2.3 0 0 1 12 21Z" />
      </svg>
    );
  if (kind === "well")
    return (
      <svg {...common}>
        <path d="M3 21h18" />
        <path d="M9 21l3.5-10 3.5 10" />
        <path d="M2.5 8.5 19 5.5" />
        <path d="M2.5 8.5c-.6 1.6-.2 3.2 1 4.2" />
        <path d="M3.5 12.7V21" />
        <circle cx="12.5" cy="7" r="1.3" />
        <path d="M19 5.5v3.5" />
        <rect x="17.3" y="9" width="3.4" height="3" rx=".6" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2Z" />
    </svg>
  );
}

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
          <div className="flex items-start justify-between gap-3">
            <div className="font-mono text-xs uppercase leading-snug tracking-[0.12em] text-muted">{c.label}</div>
            <span className="relative -mt-1 grid size-11 shrink-0 place-items-center rounded-lg border border-accent/30 bg-accent/10 text-accent">
              <CounterIcon kind={iconFor(c)} />
              {c.ratePerDay > 0 && (
                <span className="absolute -right-1 -top-1 flex size-2.5" title="En vivo">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-accent" />
                </span>
              )}
            </span>
          </div>
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
