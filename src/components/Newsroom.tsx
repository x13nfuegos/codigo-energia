"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Item = { id: string; title: string; tag: string; time: string };

/** Duración del tipeo de cada titular (ms), sin importar el largo: los titulares largos no tardan más. */
const TYPE_MS = 900;
const STEP_MS = 30;
/** Tiempo que queda el titular completo antes de pasar al siguiente. */
const HOLD_MS = 4500;

/**
 * "Lo importante — Redacción en vivo": recuadro que va tipeando los últimos titulares, uno por uno.
 * El primero llega completo desde el servidor (se lee al instante, aunque el JavaScript tarde en cargar);
 * desde el segundo se tipean en menos de un segundo. La pausa (mouse encima) solo frena la rotación:
 * un titular a medio escribir siempre se termina.
 */
export function Newsroom({ items }: { items: Item[] }) {
  const [idx, setIdx] = useState(0);
  const [chars, setChars] = useState(() => items[0]?.title.length ?? 0);
  const [paused, setPaused] = useState(false);
  const item = items[idx];
  const len = item?.title.length ?? 0;

  useEffect(() => {
    if (!item) return;
    if (chars < len) {
      // sin animación para quien la desactivó en el sistema
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
        setChars(len);
        return;
      }
      const step = Math.max(1, Math.ceil(len / (TYPE_MS / STEP_MS)));
      const t = setTimeout(() => setChars((c) => Math.min(len, c + step)), STEP_MS);
      return () => clearTimeout(t);
    }
    if (paused || items.length < 2) return;
    const t = setTimeout(() => {
      setIdx((i) => (i + 1) % items.length);
      setChars(0);
    }, HOLD_MS);
    return () => clearTimeout(t);
  }, [chars, len, item, items.length, paused]);

  if (!item) return null;
  const go = (d: number) => {
    setIdx((i) => (i + d + items.length) % items.length);
    setChars(0);
  };
  // solo el mouse pausa: en el celular el toque dispara "enter" sin "leave" y dejaba el recuadro trabado
  const hover = (on: boolean) => (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") setPaused(on);
  };
  return (
    <section
      className="overflow-hidden rounded-xl border border-line bg-surface font-mono"
      onPointerEnter={hover(true)}
      onPointerLeave={hover(false)}
      aria-label="Lo importante — Redacción en vivo"
    >
      <div className="flex items-center gap-2 border-b border-line bg-surface-2 px-4 py-2.5 text-[0.7rem] uppercase tracking-[0.15em] sm:text-xs">
        <span className="h-3 w-3 shrink-0 rounded-full bg-[#ef4444]" />
        <span className="h-3 w-3 shrink-0 rounded-full bg-[#eab308]" />
        <span className="h-3 w-3 shrink-0 rounded-full bg-[#22c55e]" />
        <span className="ml-2 min-w-0 truncate">
          <b className="text-accent">Lo importante</b>
          <span className="hidden text-dim sm:inline"> — Redacción en vivo</span>
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
      <Link href={`/nota/${item.id}`} className="block px-5 py-5">
        <div className="text-sm text-accent">&lt;{item.tag}/&gt;</div>
        <p className="mt-2 min-h-[3.3em] text-lg font-bold leading-snug sm:min-h-[2.2em] sm:text-xl md:text-2xl">
          {/* el titular completo para lectores de pantalla y buscadores; el tipeo es solo visual */}
          <span className="sr-only">{item.title}</span>
          <span aria-hidden>
            {item.title.slice(0, chars)}
            {chars < len && <span className="caret" />}
          </span>
        </p>
        <div className="mt-2 text-xs text-dim">{item.time}</div>
      </Link>
    </section>
  );
}
