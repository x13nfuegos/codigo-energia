import Link from "next/link";
import { Logo } from "@/components/Logo";
import { logout } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Back office", robots: { index: false } };

const NAV = [
  ["/admin", "Tablero"],
  ["/admin/notas", "Notas"],
  ["/admin/fuentes", "Fuentes de scraping"],
  ["/admin/portada", "Diagramación de portada"],
  ["/admin/indicadores", "Indicadores"],
  ["/admin/mapa", "Mapa"],
  ["/admin/podcast", "Podcast"],
  ["/admin/resumen", "Resumen diario"],
  ["/admin/ajustes", "Ajustes"],
  ["/admin/diagnostico", "Diagnóstico"],
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="md:flex">
      <aside className="border-b border-line bg-surface md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-r md:border-b-0">
        <div className="px-5 py-5">
          <Link href="/"><Logo className="text-base" /></Link>
          <p className="mt-1 font-mono text-xs text-dim">// backoffice</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 text-sm md:flex-col md:overflow-visible">
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} className="whitespace-nowrap rounded-md px-3 py-2 text-muted hover:bg-surface-2 hover:text-ink">
              {label}
            </Link>
          ))}
          <Link href="/" target="_blank" className="whitespace-nowrap rounded-md px-3 py-2 text-muted hover:bg-surface-2 hover:text-ink">
            Ver sitio ↗
          </Link>
          <form action={logout}>
            <button className="w-full whitespace-nowrap rounded-md px-3 py-2 text-left text-muted hover:bg-surface-2 hover:text-ink">Salir</button>
          </form>
        </nav>
      </aside>
      <div className="min-w-0 flex-1 px-4 py-8 md:px-10">{children}</div>
    </div>
  );
}
