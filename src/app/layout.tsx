import type { Metadata, Viewport } from "next";
import { getSettings } from "@/lib/site";
import { THEMES, isTheme } from "@/lib/themes";
import { RegisterSW } from "@/components/RegisterSW";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://codigoenergia.ar"),
    title: { default: `${s.site_name} — ${s.tagline}`, template: `%s · ${s.site_name}` },
    description: s.description,
    openGraph: { siteName: s.site_name, locale: "es_AR", type: "website" },
    alternates: { types: { "application/rss+xml": "/feed.xml" } },
    icons: { icon: { url: "/brand-icon", type: "image/svg+xml" }, apple: { url: "/pwa-icon/180", sizes: "180x180" } },
    appleWebApp: { capable: true, title: "Código Energía", statusBarStyle: "black-translucent" },
    formatDetection: { telephone: false },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const s = await getSettings();
  return { themeColor: THEMES[isTheme(s.theme) ? s.theme : "verde"].bg, width: "device-width", initialScale: 1, viewportFit: "cover" };
}

// Permite comparar variantes sin tocar la configuración: /?tema=cyan (queda activa durante la visita; ?tema=off vuelve a la oficial).
const themePreview = `(function(){try{var k="ce-tema",q=new URLSearchParams(location.search).get("tema"),v=${JSON.stringify(Object.keys(THEMES))};
if(q==="off"){sessionStorage.removeItem(k)}else if(q&&v.indexOf(q)>=0){sessionStorage.setItem(k,q)}
var t=sessionStorage.getItem(k);if(t&&v.indexOf(t)>=0)document.documentElement.dataset.theme=t}catch(e){}})()`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings();
  const theme = isTheme(s.theme) ? s.theme : "verde";
  return (
    <html lang="es-AR" data-theme={theme} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themePreview }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap"
        />
      </head>
      <body className="min-h-screen">
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
