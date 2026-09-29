"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Item = { id: string; title: string; tag: string; time: string };

/** "Lo importante — Redacción en vivo": recuadro que va tipeando los últimos titulares, uno por uno. */
export function Newsroom({ items }: { items: Item[] }) {
  const [idx, setIdx] = useState(0);
  const [chars, setChars] = useState(0);
  const [paused, setPaused] = useState(false);
  const item = items[idx];

  useEffect(() => {
    if (!item || paused) return;
    if (chars < item.title.length) {
      const t = setTimeout(() => setChars((c) => c + 1), 28);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setIdx((i) => (i + 1) % items.length);
      setChars(0);
    }, 3500);
    return () => clearTimeout(t);
  }, [chars, item, items.length, paused]);

  if (!item) return null;
  const go = (d: number) => {
    setIdx((i) => (i + d + items.length) % items.length);
    setChars(0);
  };
  return (
    <section
      className="overflow-hidden rounded-xl border border-line bg-surface font-mono"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-label="Lo importante — Redacción en vivo"
    >
      <div className="flex items-center gap-2 border-b border-line bg-surface-2 px-4 py-2.5 text-[0.7rem] uppercase tracking-[0.15em] sm:text-xs">
        <span className="h-3 w-3 shrink-0 rounded-full bg-[#ef4444]" />
        <span className="h-3 w-3 shrink-0 rounded-full bg-[#eab308]" />
        <span className="h-3 w-3 shrink-0 rounded-full bg-[#22c55e]" />
        <span className="ml-2 min-w-0 truncate">
          <b className="text-accent">Lo importante</b>
          <span className="text-dim"> — Redacción en vivo</span>
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-1 text-dim">
          <button onClick={() => go(-1)} className="px-1 hover:text-accent" aria-label="Titular anterior">
            ‹
          </button>
          {idx + 1} / {items.length}
          <button onClick={() => go(1)} className="px-1 hover:text-accent" aria-label="Titular siguiente">
            ›
          </button>
        </span>
      </div>
      <Link href={`/nota/${item.id}`} className="block px-5 py-5" aria-live="polite">
        <div className="text-sm text-accent">&lt;{item.tag}/&gt;</div>
        <p className="mt-2 min-h-[3.3em] text-lg font-bold leading-snug sm:min-h-[2.2em] sm:text-xl md:text-2xl">
          {item.title.slice(0, chars)}
          <span className="caret" />
        </p>
        <div className="mt-2 text-xs text-dim">{item.time}</div>
      </Link>
    </section>
  );
}
