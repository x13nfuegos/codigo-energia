import { ImageResponse } from "next/og";
import { DEFAULT_PODCAST } from "@/lib/podcast";
import { getSettings } from "@/lib/site";
import { THEMES, isTheme } from "@/lib/themes";

/** Miniatura de episodio cuando el video no trae una (ej. link privado de Vimeo). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const settings = await getSettings();
  const podcast = settings.podcast ?? DEFAULT_PODCAST;
  const e = podcast.episodes.find((x) => x.id === id);
  if (!e) return new Response("no existe", { status: 404 });
  const t = THEMES[isTheme(settings.theme) ? settings.theme : "verde"];
  const title = e.title.length > 70 ? `${e.title.slice(0, 67)}…` : e.title;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "44px 56px",
          backgroundColor: t.bg,
          backgroundImage: `radial-gradient(circle at 85% 20%, ${t.accent}55 0%, transparent 45%)`,
          fontFamily: "monospace",
          color: "#e6ecf2",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 28 }}>
          <div style={{ display: "flex", width: 22, height: 22, borderRadius: 11, background: t.accent }} />
          <span style={{ color: t.accent, fontWeight: 700 }}>PODCAST</span>
          <span style={{ color: "#8a96a3" }}>{`EP. ${e.number ?? ""}`}</span>
        </div>
        <div style={{ display: "flex", fontSize: 58, fontWeight: 700, lineHeight: 1.15 }}>{title}</div>
        <div style={{ display: "flex", fontSize: 30 }}>
          <span style={{ color: "#8a96a3" }}>{"<"}</span>
          <span style={{ color: t.accent, fontWeight: 700 }}>código</span>
          <span>_energía</span>
          <span style={{ color: "#8a96a3" }}>{"/>"}</span>
        </div>
      </div>
    ),
    { width: 1280, height: 720, headers: { "cache-control": "public, max-age=3600, s-maxage=86400" } },
  );
}
