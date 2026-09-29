import { lookup } from "dns/promises";
import { isIP } from "net";

const MAX_BYTES = 8 * 1024 * 1024;

export function isPrivateIp(ip: string): boolean {
  if (ip.includes(":")) {
    const v = ip.toLowerCase();
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v.startsWith("::ffff:127.") || v.startsWith("::ffff:10.") || v.startsWith("::ffff:192.168.");
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

/** Descarga una imagen pública (bloquea hosts internos y revisa cada redirección). Devuelve null si no se puede. */
export async function fetchPublicImage(raw: string): Promise<Buffer | null> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  for (let hop = 0; hop < 4; hop++) {
    if (!/^https?:$/.test(url.protocol) || url.username || url.password) return null;
    try {
      const addrs = isIP(url.hostname) ? [{ address: url.hostname }] : await lookup(url.hostname, { all: true });
      if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) return null;
      const res = await fetch(url, {
        headers: { "user-agent": "Mozilla/5.0 (compatible; CodigoEnergiaBot/1.0)", accept: "image/*,*/*;q=0.8", referer: `${url.protocol}//${url.host}/` },
        redirect: "manual",
        signal: AbortSignal.timeout(10000),
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) return null;
        url = new URL(loc, url);
        continue;
      }
      const type = res.headers.get("content-type") ?? "";
      if (!res.ok || !type.startsWith("image/") || type.includes("svg")) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      return buf.byteLength > MAX_BYTES ? null : buf;
    } catch {
      return null;
    }
  }
  return null;
}
