"use client";

import { useEffect, useRef, useState } from "react";
import type { Category } from "@/lib/types";

const proxied = (src: string) => `/api/img?u=${encodeURIComponent(src)}`;

/**
 * Imagen de la nota. Si el medio bloquea la carga directa (hotlinking, http) se reintenta por el proxy;
 * si tampoco carga, muestra un placeholder con el color de la sección.
 */
export function Img({ src, alt, cat, className = "", priority = false }: { src?: string | null; alt: string; cat: Category; className?: string; priority?: boolean }) {
  const direct = src?.startsWith("http://") ? proxied(src) : src;
  const [current, setCurrent] = useState(direct);
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setCurrent(direct);
    setFailed(false);
  }, [direct]);

  const onError = () => {
    if (src && current && !current.startsWith("/api/img")) setCurrent(proxied(src));
    else setFailed(true);
  };

  // si la imagen falló antes de hidratar, onError no se dispara: se revisa al montar
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) onError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  if (!current || failed) {
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
    <img
      ref={ref}
      src={current}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={onError}
      className={`bg-surface-2 object-cover ${className}`}
    />
  );
}
