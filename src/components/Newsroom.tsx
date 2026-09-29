"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Item = { id: string; title: string; tag: string; time: string };

/** "Lo importante — Redacción en vivo": tipea los últimos titulares, uno por uno. */
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
    <div className="border-b border-line bg-surface" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="mx-auto flex max-w-6xl flex-col gap-1.5 px-4 py-3 font-mono md:flex-row md:items-center md:gap-5 md:px-6">
        <div className="flex shrink-0 items-center gap-2 text-[0.7rem] uppercase tracking-[0.15em]">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
          </span>
          <b className="text-accent">Lo importante</b>
          <span className="text-dim">— Redacción en vivo</span>
          <span className="ml-auto text-dim md:hidden">
            {idx + 1}/{items.length}
          </span>
        </div>
        <Link href={`/nota/${item.id}`} className="line-clamp-2 min-h-[2.6em] min-w-0 flex-1 text-[0.95rem] font-bold leading-snug hover:underline md:min-h-0 md:truncate" aria-live="polite">
          <span className="mr-2 font-normal text-accent-soft">&lt;{item.tag}/&gt;</span>
          {item.title.slice(0, chars)}
          <span className="caret" />
          <span className="ml-2 whitespace-nowrap text-xs font-normal text-dim">{item.time}</span>
        </Link>
        <div className="hidden shrink-0 items-center gap-1 text-xs text-dim md:flex">
          <button onClick={() => go(-1)} className="px-1.5 hover:text-accent" aria-label="Titular anterior">‹</button>
          <span>
            {idx + 1} / {items.length}
          </span>
          <button onClick={() => go(1)} className="px-1.5 hover:text-accent" aria-label="Titular siguiente">›</button>
        </div>
      </div>
    </div>
  );
}
