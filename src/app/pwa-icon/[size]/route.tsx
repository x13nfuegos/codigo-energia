import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { getSettings } from "@/lib/site";
import { THEMES, isTheme } from "@/lib/themes";

/** Íconos PNG de la PWA (y apple-touch-icon) con los colores de la variante activa. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ size: string }> }) {
  const size = Math.min(1024, Math.max(48, Number((await params).size) || 192));
  const maskable = req.nextUrl.searchParams.has("maskable");
  const s = await getSettings();
  const t = THEMES[isTheme(s.theme) ? s.theme : "verde"];
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: t.bg,
          borderRadius: maskable ? 0 : size * 0.18,
          color: t.accent,
          fontSize: size * (maskable ? 0.3 : 0.38),
          fontWeight: 700,
          fontFamily: "monospace",
          letterSpacing: -size * 0.01,
        }}
      >
        {"</>"}
      </div>
    ),
    { width: size, height: size, headers: { "cache-control": "public, max-age=86400" } },
  );
}
