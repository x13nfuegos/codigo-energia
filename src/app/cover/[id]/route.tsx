import { ImageResponse } from "next/og";
import { categoryOf, getSettings } from "@/lib/site";
import { getStore } from "@/lib/store";
import { THEMES, isTheme } from "@/lib/themes";

type Font = { name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" };
let fontsCache: Promise<Font[]> | null = null;

/** IBM Plex (la tipografía del sitio) desde Google Fonts; si no se puede, se usa la fuente por defecto. */
function loadFonts(): Promise<Font[]> {
  const one = async (family: string, weight: 400 | 700, name: string): Promise<Font | null> => {
    try {
      // un user-agent viejo hace que Google Fonts devuelva TTF, que es lo que entiende el generador de imágenes
      const css = await fetch(`https://fonts.googleapis.com/css2?family=${family}:wght@${weight}&display=swap`, {
        headers: { "user-agent": "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/534.30 (KHTML, like Gecko) Safari/534.30" },
      }).then((r) => r.text());
      const url = css.match(/src: url\((.+?)\)/)?.[1];
      if (!url) return null;
      return { name, data: await fetch(url).then((r) => r.arrayBuffer()), weight, style: "normal" };
    } catch {
      return null;
    }
  };
  fontsCache ??= Promise.all([one("IBM+Plex+Sans", 700, "Plex"), one("IBM+Plex+Mono", 400, "PlexMono"), one("IBM+Plex+Mono", 700, "PlexMono")]).then(
    (f) => f.filter((x): x is Font => !!x),
  );
  return fontsCache;
}

/**
 * Portada generada para notas sin foto: título, sección y medio con la identidad del sitio.
 * No usa IA (sin costo) y la CDN la cachea una semana.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [a, settings, fonts] = await Promise.all([(await getStore()).get("articles", id), getSettings(), loadFonts()]);
  const sans = fonts.some((f) => f.name === "Plex") ? "Plex" : "sans-serif";
  const mono = fonts.some((f) => f.name === "PlexMono") ? "PlexMono" : "monospace";
  if (!a) return new Response("no existe", { status: 404 });
  const t = THEMES[isTheme(settings.theme) ? settings.theme : "verde"];
  const cat = categoryOf(settings, a.category);
  const title = a.title.length > 120 ? `${a.title.slice(0, 117).trimEnd()}…` : a.title;
  const light = settings.theme === "light";
  const ink = light ? "#1e2533" : "#e6ecf2";
  const dim = light ? "#5a6472" : "#8a96a3";
  const date = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" })
    .format(new Date(a.published_at))
    .replace(".", "");

  const headers = { "cache-control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400" };

  // variante para miniaturas chicas: sin titular (se lee al lado), sección y medio bien grandes
  if (new URL(req.url).searchParams.get("v") === "thumb") {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: 40,
            backgroundColor: t.bg,
            backgroundImage: `linear-gradient(135deg, ${cat.color} 0%, ${t.bg} 75%)`,
            fontFamily: mono,
          }}
        >
          <div style={{ display: "flex", color: "#fff", fontSize: 64, fontWeight: 700, lineHeight: 1 }}>{`<${cat.slug.replace(/-/g, "")}/>`}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", color: "#ffffffcc", fontSize: 30, textTransform: "uppercase", letterSpacing: 2 }}>{(a.source_name ?? cat.name).slice(0, 28)}</div>
            <div style={{ display: "flex", fontSize: 30 }}>
              <span style={{ color: "#ffffff88" }}>{"<"}</span>
              <span style={{ color: t.accent, fontWeight: 700 }}>c</span>
              <span style={{ color: "#ffffff88" }}>{"/>"}</span>
            </div>
          </div>
        </div>
      ),
      { width: 600, height: 600, fonts: fonts.length ? fonts : undefined, headers },
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px 64px",
          backgroundColor: t.bg,
          backgroundImage: `radial-gradient(circle at 0% 0%, ${cat.color} 0%, transparent 55%), radial-gradient(circle at 100% 100%, ${t.accent}33 0%, transparent 45%)`,
          fontFamily: sans,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ display: "flex", background: cat.color, color: cat.text, fontSize: 26, fontWeight: 700, padding: "8px 18px", borderRadius: 10, textTransform: "uppercase" }}>
            {cat.name}
          </div>
          <div style={{ display: "flex", color: dim, fontSize: 26, fontFamily: mono }}>{`<${cat.slug.replace(/-/g, "")}/>`}</div>
        </div>
        <div style={{ display: "flex", color: ink, fontSize: title.length > 80 ? 54 : 64, fontWeight: 800, lineHeight: 1.12, letterSpacing: -1 }}>{title}</div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", width: "100%" }}>
          <div style={{ display: "flex", flexDirection: "column", color: dim, fontSize: 24 }}>
            <span style={{ color: ink, fontWeight: 700 }}>{a.source_name ?? ""}</span>
            <span>{date}</span>
          </div>
          <div style={{ display: "flex", fontSize: 34, fontFamily: mono }}>
            <span style={{ color: dim }}>{"<"}</span>
            <span style={{ color: t.accent, fontWeight: 700 }}>código</span>
            <span style={{ color: ink }}>_energía</span>
            <span style={{ color: dim }}>{"/>"}</span>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 675, fonts: fonts.length ? fonts : undefined, headers },
  );
}
