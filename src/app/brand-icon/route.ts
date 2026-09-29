import { getSettings } from "@/lib/site";
import { THEMES, isTheme } from "@/lib/themes";

export const dynamic = "force-dynamic";

/** Favicon </> con los colores de la variante activa. */
export async function GET() {
  const s = await getSettings();
  const t = THEMES[isTheme(s.theme) ? s.theme : "verde"];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="${t.bg}"/><text x="32" y="43" text-anchor="middle" font-family="IBM Plex Mono, Menlo, monospace" font-weight="700" font-size="30" fill="${t.accent}">&lt;/&gt;</text></svg>`;
  return new Response(svg, { headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=3600" } });
}
