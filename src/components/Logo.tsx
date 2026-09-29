/** Wordmark <código_energía/> */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`font-mono tracking-tight whitespace-nowrap ${className}`} aria-label="Código Energía">
      <span className="font-bold text-bracket">&lt;</span>
      <span className="font-bold text-accent">código</span>
      <span className="font-light text-ink">_energía</span>
      <span className="font-bold text-bracket">/&gt;</span>
    </span>
  );
}

export function Tagline({ className = "" }: { className?: string }) {
  return (
    <span className={`font-mono ${className}`}>
      <span className="text-accent-soft">noticias del subsuelo</span>
      <span className="text-dim"> · real time · sin fricción</span>
    </span>
  );
}
