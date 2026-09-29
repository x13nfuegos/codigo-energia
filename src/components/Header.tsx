import Link from "next/link";
import { subCategories, topCategories } from "@/lib/site";
import type { Settings } from "@/lib/types";
import { Logo, Tagline } from "./Logo";
import { Menu, type MenuLink } from "./Menu";

export function Header({ settings }: { settings: Settings }) {
  const top = topCategories(settings);
  // menú completo: secciones con sus subsecciones + herramientas
  const links: MenuLink[] = [
    ...top.map((c) => ({
      href: `/seccion/${c.slug}`,
      label: c.name,
      children: subCategories(settings, c.slug).map((s) => ({ href: `/seccion/${s.slug}`, label: s.name })),
    })),
    { href: "/mapa", label: "Mapa" },
    { href: "/resumen", label: "Resumen diario" },
    { href: "/indicadores", label: "Indicadores" },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3 md:px-6">
        <Link href="/" className="flex min-w-0 flex-col leading-none">
          <Logo className="text-[clamp(1.05rem,4.6vw,1.5rem)]" />
          <Tagline className="mt-1.5 hidden whitespace-nowrap text-[0.7rem] lg:block" />
        </Link>
        <nav className="hidden flex-1 items-center justify-end gap-5 whitespace-nowrap font-mono text-sm text-muted md:flex">
          {/* encabezado: solo las secciones principales */}
          {top.map((c) => (
            <Link key={c.slug} href={`/seccion/${c.slug}`} className="hover:text-accent">
              {c.name.toLowerCase()}
            </Link>
          ))}
        </nav>
        <Menu links={[...links, { href: "/buscar", label: "Buscar" }]} />
      </div>
    </header>
  );
}
