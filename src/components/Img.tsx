"use client";

import { useEffect, useRef, useState } from "react";
import type { Category } from "@/lib/types";

const proxied = (src: string) => `/api/img?u=${encodeURIComponent(src)}`;

/**
 * Imagen de la nota. Si el medio bloquea la carga directa (hotlinking, http) se reintenta por el proxy;
 * si tampoco carga, muestra un placeholder con el color de la sección.
 */
export function Img({
  src,
  alt,
  cat,
  className = "",
  priority = false,
  label,
}: {
  src?: string | null;
  alt: string;
  cat: Category;
  className?: string;
  priority?: boolean;
  /** medio de origen, se muestra en el placeholder cuando no hay foto */
  label?: string | null;
}) {
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
        className={`@container relative flex flex-col justify-between overflow-hidden ${className}`}
        style={{
          background: `radial-gradient(120% 90% at 0% 0%, ${cat.color} 0%, transparent 60%), repeating-linear-gradient(135deg, transparent 0 14px, rgb(255 255 255 / .025) 14px 15px), var(--color-surface-2)`,
        }}
        aria-hidden
      >
        <span className="p-3 font-mono text-[clamp(0.9rem,9cqw,2.4rem)] font-bold leading-none text-white/85">&lt;{cat.slug.replace(/-/g, "")}/&gt;</span>
        {label && <span className="truncate p-3 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-white/60">{label}</span>}
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
