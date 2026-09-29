import Link from "next/link";
import type { Settings } from "@/lib/types";
import { Logo, Tagline } from "./Logo";
import { Menu } from "./Menu";

export function Header({ settings }: { settings: Settings }) {
  const links = [
    ...settings.categories.map((c) => ({ href: `/seccion/${c.slug}`, label: c.name })),
    { href: "/resumen", label: "Resumen diario" },
    { href: "/mapa", label: "Mapa" },
    { href: "/indicadores", label: "Indicadores" },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3.5 md:px-6">
        <Link href="/" className="flex flex-col leading-none">
          <Logo className="text-[1.35rem] md:text-2xl" />
          <Tagline className="mt-1.5 hidden whitespace-nowrap text-[0.7rem] md:block" />
        </Link>
        <nav className="hidden flex-1 items-center justify-end gap-4 whitespace-nowrap font-mono text-[0.8rem] text-muted xl:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-accent">
              {l.label.toLowerCase()}
            </Link>
          ))}
        </nav>
        <Menu links={[...links, { href: "/buscar", label: "Buscar" }]} />
      </div>
    </header>
  );
}
