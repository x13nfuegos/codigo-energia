import { ImageResponse } from "next/og";
import sharp from "sharp";
import { loadFonts } from "@/lib/og-fonts";
import { fetchPublicImage } from "@/lib/safe-image";
import { categoryOf, getSettings } from "@/lib/site";
import { getStore } from "@/lib/store";
import { THEMES, isTheme } from "@/lib/themes";

export const runtime = "nodejs";

const W = 1080;
const H = 1350;
const PHOTO_H = 760;

/** Foto de la nota recortada al tamaño del posteo, como data URI JPEG (satori no lee webp/avif). */
async function photo(url?: string | null): Promise<string | null> {
  if (!url) return null;
  const buf = await fetchPublicImage(url);
  if (!buf) return null;
  try {
    const jpg = await sharp(buf).resize(W, PHOTO_H, { fit: "cover", position: "attention" }).jpeg({ quality: 85 }).toBuffer();
    return `data:image/jpeg;base64,${jpg.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * Imagen para Instagram (1080×1350, JPEG): foto de la nota arriba y titular con la identidad abajo.
 * Instagram solo acepta JPEG, por eso se convierte con sharp.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await (await getStore()).get("articles", id);
  if (!a || a.status !== "published") return new Response("no existe", { status: 404 });
  const [settings, fonts, img] = await Promise.all([getSettings(), loadFonts(), photo(a.image)]);
  const sans = fonts.some((f) => f.name === "Plex") ? "Plex" : "sans-serif";
  const mono = fonts.some((f) => f.name === "PlexMono") ? "PlexMono" : "monospace";
  const t = THEMES[isTheme(settings.theme) && settings.theme !== "light" ? settings.theme : "verde"];
  const cat = categoryOf(settings, a.category);
  const title = a.title.length > 140 ? `${a.title.slice(0, 137).trimEnd()}…` : a.title;
  const size = title.length > 110 ? 50 : title.length > 75 ? 58 : 66;

  const png = new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", backgroundColor: t.bg, fontFamily: sans }}>
        <div
          style={{
            display: "flex",
            position: "relative",
            width: W,
            height: img ? PHOTO_H : 420,
            backgroundColor: t.bg,
            backgroundImage: img ? undefined : `radial-gradient(circle at 0% 0%, ${cat.color} 0%, transparent 60%), radial-gradient(circle at 100% 100%, ${t.accent}40 0%, transparent 50%)`,
          }}
        >
          {img && <img src={img} width={W} height={PHOTO_H} style={{ position: "absolute", top: 0, left: 0, objectFit: "cover" }} />}
          <div style={{ position: "absolute", left: 0, bottom: 0, width: W, height: 260, display: "flex", backgroundImage: `linear-gradient(180deg, transparent 0%, ${t.bg} 100%)` }} />
          <div style={{ position: "absolute", top: 48, left: 56, display: "flex", background: cat.color, color: cat.text, fontSize: 30, fontWeight: 700, padding: "10px 22px", borderRadius: 12, textTransform: "uppercase" }}>
            {cat.name}
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "8px 56px 52px" }}>
          <div style={{ display: "flex", color: "#f2f5f8", fontSize: size, fontWeight: 800, lineHeight: 1.12, letterSpacing: -1 }}>{title}</div>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", width: "100%" }}>
            <div style={{ display: "flex", flexDirection: "column", color: "#8a96a3", fontSize: 26, fontFamily: mono }}>
              <span>Fuente: {(a.source_name ?? "").slice(0, 32)}</span>
              <span style={{ color: t.accent }}>codigoenergia.ar</span>
            </div>
            <div style={{ display: "flex", fontSize: 40, fontFamily: mono }}>
              <span style={{ color: "#8a96a3" }}>{"<"}</span>
              <span style={{ color: t.accent, fontWeight: 700 }}>código</span>
              <span style={{ color: "#f2f5f8" }}>_energía</span>
              <span style={{ color: "#8a96a3" }}>{"/>"}</span>
            </div>
          </div>
        </div>
      </div>
    ),
    { width: W, height: H, fonts: fonts.length ? fonts : undefined },
  );
  const jpg = await sharp(Buffer.from(await png.arrayBuffer())).jpeg({ quality: 90 }).toBuffer();
  return new Response(new Uint8Array(jpg), {
    headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=3600, s-maxage=86400" },
  });
}
