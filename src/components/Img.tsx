"use client";

import { useEffect, useRef, useState } from "react";
import type { Category } from "@/lib/types";

/** Imagen de la nota; si falta o no carga, muestra un placeholder con el color de la sección. */
export function Img({ src, alt, cat, className = "" }: { src?: string | null; alt: string; cat: Category; className?: string }) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  // si la imagen falló antes de hidratar, onError no se dispara: se revisa al montar
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, [src]);
  if (!src || failed) {
    return (
      <div
        className={`flex items-end overflow-hidden ${className}`}
        style={{ background: `linear-gradient(135deg, ${cat.color} 0%, var(--color-surface-2) 85%)` }}
        aria-hidden
      >
        <span className="p-3 font-mono text-xs uppercase tracking-[0.2em] text-ink/60">&lt;{cat.slug}/&gt;</span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={ref} src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} className={`object-cover ${className}`} />
  );
}
