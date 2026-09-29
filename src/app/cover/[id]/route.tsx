import { ImageResponse } from "next/og";
import { categoryOf, getSettings } from "@/lib/site";
import { getStore } from "@/lib/store";
import { THEMES, isTheme } from "@/lib/themes";
import { loadFonts } from "@/lib/og-fonts";

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

  // miniaturas de listados (v=thumb, cuadrada) y tarjetas (v=card, 4:3): ilustración del tema + titular
  const variant = new URL(req.url).searchParams.get("v");
  if (variant === "thumb" || variant === "card") {
    const card = variant === "card";
    const w = card ? 800 : 600;
    const h = 600;
    const max = card ? 95 : 70;
    const headline = a.title.length > max ? `${a.title.slice(0, max).replace(/\s+\S*$/, "").replace(/[,;:.]$/, "")}…` : a.title;
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: card ? 44 : 38,
            backgroundColor: t.bg,
            backgroundImage: `linear-gradient(150deg, ${cat.color} 0%, ${cat.color}cc 38%, ${t.bg} 100%)`,
            fontFamily: sans,
            position: "relative",
          }}
        >
          <div style={{ position: "absolute", right: card ? -30 : -40, top: card ? 20 : 10, display: "flex", opacity: 0.22 }}>
            <TopicIcon kind={topicOf(a.title, a.category)} size={card ? 380 : 360} color="#ffffff" />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ display: "flex", width: card ? 84 : 96, height: card ? 84 : 96, borderRadius: 20, background: "#00000040", alignItems: "center", justifyContent: "center" }}>
              <TopicIcon kind={topicOf(a.title, a.category)} size={card ? 56 : 64} color="#ffffff" />
            </div>
            <div style={{ display: "flex", color: "#ffffffdd", fontSize: card ? 26 : 30, fontFamily: mono, textTransform: "uppercase", letterSpacing: 2 }}>{cat.name}</div>
          </div>
          <div style={{ display: "flex", color: "#ffffff", fontSize: card ? 46 : 44, fontWeight: 700, lineHeight: 1.12, letterSpacing: -0.5 }}>{headline}</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", fontFamily: mono }}>
            <div style={{ display: "flex", color: "#ffffffaa", fontSize: 22, textTransform: "uppercase" }}>{(a.source_name ?? "").slice(0, 26)}</div>
            <div style={{ display: "flex", fontSize: 26 }}>
              <span style={{ color: "#ffffff88" }}>{"<"}</span>
              <span style={{ color: t.accent, fontWeight: 700 }}>c</span>
              <span style={{ color: "#ffffff88" }}>{"/>"}</span>
            </div>
          </div>
        </div>
      ),
      { width: w, height: h, fonts: fonts.length ? fonts : undefined, headers },
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

type Topic = "oil" | "gas" | "well" | "mine" | "wind" | "solar" | "power" | "money";

function topicOf(title: string, category: string): Topic {
  const t = title.toLowerCase();
  if (/e[oó]lic|aerogenerador|viento/.test(t)) return "wind";
  if (/solar|fotovolt/.test(t)) return "solar";
  if (/litio|cobre|oro\b|plata\b|mina\b|miner/.test(t)) return "mine";
  if (/\bgas\b|gnl|gasoducto/.test(t)) return "gas";
  if (/pozo|perfora|fractura|vaca muerta|shale/.test(t)) return "well";
  if (/petr[oó]le|crudo|barril|ypf|combustible|nafta/.test(t)) return "oil";
  if (/el[eé]ctric|tarifa|transmisi|cammesa|termoel|nuclear|represa/.test(t)) return "power";
  if (/d[oó]lar|inversi|econom|precio|export|impuest|fiscal/.test(t)) return "money";
  return category === "mineria" ? "mine" : category === "oil-gas" ? "well" : category === "renovables" ? "wind" : category === "economia" ? "money" : "power";
}

/** Íconos lineales para las portadas generadas (satori dibuja SVG). */
function TopicIcon({ kind, size, color }: { kind: Topic; size: number; color: string }) {
  const p = { fill: "none", stroke: color, strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<Topic, React.ReactNode> = {
    oil: (
      <>
        <ellipse cx="12" cy="4.5" rx="6.5" ry="2" {...p} />
        <path d="M5.5 4.5v15c0 1.1 2.9 2 6.5 2s6.5-.9 6.5-2v-15M5.5 9.5c0 1.1 2.9 2 6.5 2s6.5-.9 6.5-2M5.5 15c0 1.1 2.9 2 6.5 2s6.5-.9 6.5-2" {...p} />
      </>
    ),
    gas: <path d="M12 2.5c.8 3.2 5.5 5.6 5.5 11a5.5 5.5 0 0 1-11 0c0-2.6 1.3-4.3 2.6-5.6.2 1.8 1 2.9 2.1 3.4C11 8.6 11.2 5.4 12 2.5Z" {...p} />,
    well: <path d="M3 21h18M9 21l3.5-10 3.5 10M2.5 8.5 19 5.5M2.5 8.5c-.6 1.6-.2 3.2 1 4.2M3.5 12.7V21M19 5.5v3.5M17.3 9h3.4v3h-3.4z" {...p} />,
    mine: <path d="M3 21h18M5 21l4-8 3 4 3-6 4 10M14.5 3.5l6 6M17.5 6.5 9 15M13 3c2.5-.5 5 .5 8 3" {...p} />,
    wind: <path d="M12 11v10M9 21h6M12 11 12 3M12 11l7 4M12 11l-7 4M12 3c1 1.5 1 3 0 5M19 15c-1.8.2-3.1-.6-4-2M5 15c.9-1.6 2.3-2.3 4-2" {...p} />,
    solar: <path d="M3 17l3-8h12l3 8zM9 9l-1 8M15 9l1 8M4.5 13h15M12 17v4M8 21h8M12 2v2M5 4l1.5 1.5M19 4l-1.5 1.5" {...p} />,
    power: <path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2Z" {...p} />,
    money: <path d="M3 17l6-6 4 4 8-8M15 7h6v6" {...p} />,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      {paths[kind]}
    </svg>
  );
}
