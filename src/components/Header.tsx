import Link from "next/link";
import type { Settings } from "@/lib/types";
import { Menu } from "./Menu";

export function Header({ settings }: { settings: Settings }) {
  const links = [
    ...settings.categories.map((c) => ({ href: `/seccion/${c.slug}`, label: c.name })),
    { href: "/resumen", label: "Resumen diario" },
    { href: "/mapa", label: "Mapa" },
    { href: "/indicadores", label: "Indicadores" },
  ];
  return (
    <header className="sticky top-0 z-40 bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-4 md:px-6">
        <Link href="/" className="text-2xl font-bold tracking-tight">
          {settings.site_name}
        </Link>
        <nav className="hidden flex-1 items-center gap-5 text-sm text-muted lg:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-ink">
              {l.label}
            </Link>
          ))}
        </nav>
        <Menu links={[...links, { href: "/buscar", label: "Buscar" }]} />
      </div>
    </header>
  );
}
