import { lookup } from "dns/promises";
import { isIP } from "net";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

const MAX_BYTES = 6 * 1024 * 1024;

function isPrivate(ip: string): boolean {
  if (ip.includes(":")) {
    const v = ip.toLowerCase();
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v.startsWith("::ffff:127.") || v.startsWith("::ffff:10.") || v.startsWith("::ffff:192.168.");
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

/**
 * Proxy de imágenes de las notas: resuelve bloqueos por hotlinking y contenido http en un sitio https.
 * Solo sirve imágenes públicas (bloquea IPs privadas) y la CDN de Vercel las cachea una semana.
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("u");
  let url: URL;
  try {
    url = new URL(raw ?? "");
  } catch {
    return new Response("url inválida", { status: 400 });
  }
  if (!/^https?:$/.test(url.protocol) || url.username || url.password) return new Response("protocolo no permitido", { status: 400 });
  try {
    const addrs = isIP(url.hostname) ? [{ address: url.hostname }] : await lookup(url.hostname, { all: true });
    if (!addrs.length || addrs.some((a) => isPrivate(a.address))) return new Response("host no permitido", { status: 403 });
  } catch {
    return new Response("host desconocido", { status: 404 });
  }

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; CodigoEnergiaBot/1.0)",
        accept: "image/avif,image/webp,image/*,*/*;q=0.8",
        referer: `${url.protocol}//${url.host}/`,
      },
      redirect: "manual",
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    return new Response("no se pudo descargar", { status: 502 });
  }
  // sin seguir redirecciones: evita saltar a un host interno
  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get("location");
    if (!loc) return new Response("redirección inválida", { status: 502 });
    const next = new URL(loc, url);
    return Response.redirect(new URL(`/api/img?u=${encodeURIComponent(next.toString())}`, req.nextUrl.origin), 307);
  }
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || !type.startsWith("image/") || type.includes("svg")) return new Response("no es una imagen", { status: 415 });
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > MAX_BYTES) return new Response("imagen demasiado grande", { status: 413 });
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) return new Response("imagen demasiado grande", { status: 413 });
  return new Response(buf, {
    headers: {
      "content-type": type,
      "cache-control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
      "x-content-type-options": "nosniff",
    },
  });
}
