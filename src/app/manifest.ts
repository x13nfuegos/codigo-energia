import type { MetadataRoute } from "next";
import { getSettings } from "@/lib/site";
import { THEMES, isTheme } from "@/lib/themes";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const s = await getSettings();
  const t = THEMES[isTheme(s.theme) ? s.theme : "verde"];
  return {
    name: s.site_name,
    short_name: "Código Energía",
    description: s.description,
    lang: "es-AR",
    start_url: "/?utm_source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: t.bg,
    theme_color: t.bg,
    categories: ["news", "business"],
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512?maskable=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Mapa de la energía", url: "/mapa" },
      { name: "Resumen diario", url: "/resumen" },
      { name: "Indicadores", url: "/indicadores" },
    ],
  };
}
