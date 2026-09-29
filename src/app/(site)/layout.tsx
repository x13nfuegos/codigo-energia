import Link from "next/link";
import { after } from "next/server";
import { Header } from "@/components/Header";
import { Logo, Tagline } from "@/components/Logo";
import { Ticker } from "@/components/Ticker";
import { maybeRefresh } from "@/lib/jobs";
import { getIndicators, getSettings } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [settings, indicators] = await Promise.all([getSettings(), getIndicators()]);
  // Scrapeo / indicadores / resumen en segundo plano si corresponde (no bloquea la respuesta).
  after(() => maybeRefresh().catch((e) => console.error("maybeRefresh", e)));
  return (
    <>
      <Header settings={settings} />
      {settings.ticker_enabled && <Ticker items={indicators} />}
      <main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-10">{children}</main>
      <footer className="mt-16 border-t border-line">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm text-muted md:grid-cols-3 md:px-6">
          <div>
            <Logo className="text-xl" />
            <Tagline className="mt-2 block text-xs" />
            <p className="mt-4">{settings.footer_text}</p>
          </div>
          <nav className="flex flex-col gap-2">
            {settings.categories.map((c) => (
              <Link key={c.slug} href={`/seccion/${c.slug}`} className="hover:text-ink">
                {c.name}
              </Link>
            ))}
          </nav>
          <nav className="flex flex-col gap-2">
            <Link href="/podcast" className="hover:text-ink">Podcast</Link>
            <Link href="/juego" className="hover:text-ink">Petrolero Runner</Link>
            <Link href="/resumen" className="hover:text-ink">Resumen diario</Link>
            <Link href="/mapa" className="hover:text-ink">Mapa energético</Link>
            <Link href="/indicadores" className="hover:text-ink">Indicadores</Link>
            <Link href="/feed.xml" className="hover:text-ink">RSS</Link>
            {settings.social.map((s) => (
              <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="hover:text-ink">
                {s.name}
              </a>
            ))}
          </nav>
        </div>
        <p className="px-4 pb-6 text-center font-mono text-xs text-dim">
          Las notas enlazan a sus medios de origen. Cotizaciones con demora; no constituyen recomendación de inversión.
        </p>
        <div className="flex items-center gap-5 bg-status px-4 py-1.5 font-mono text-[0.7rem] text-dim md:px-6">
          <span>⎇ main</span>
          <span className="hidden sm:inline">CE-001.js</span>
          <span className="ml-auto">UTF-8 · 50Hz / 220V · v1.0.0</span>
        </div>
      </footer>
    </>
  );
}
