"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Item = { id: string; title: string; tag: string };

/** Widget "Redacción · en vivo": tipea los últimos titulares uno por uno. */
export function Newsroom({ items, title }: { items: Item[]; title: string }) {
  const [idx, setIdx] = useState(0);
  const [chars, setChars] = useState(0);
  const item = items[idx];

  useEffect(() => {
    if (!item) return;
    if (chars < item.title.length) {
      const t = setTimeout(() => setChars((c) => c + 1), 38);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setIdx((i) => (i + 1) % items.length);
      setChars(0);
    }, 3200);
    return () => clearTimeout(t);
  }, [chars, item, items.length]);

  if (!item) return null;
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface font-mono">
      <div className="flex items-center gap-2 border-b border-line bg-[#111] px-4 py-3 text-sm uppercase tracking-[0.15em] text-muted">
        <span className="h-3.5 w-3.5 rounded-full bg-[#ef4444]" />
        <span className="h-3.5 w-3.5 rounded-full bg-[#eab308]" />
        <span className="h-3.5 w-3.5 rounded-full bg-[#22c55e]" />
        <span className="ml-3">{title}</span>
        <span className="ml-auto">
          {idx + 1} / {items.length}
        </span>
      </div>
      <Link href={`/nota/${item.id}`} className="block min-h-[9.5rem] px-5 py-6">
        <div className="text-accent">&lt;{item.tag}/&gt;</div>
        <p className="mt-3 text-xl font-bold leading-snug md:text-2xl" aria-live="polite">
          {item.title.slice(0, chars)}
          <span className="caret" />
        </p>
      </Link>
    </div>
  );
}
