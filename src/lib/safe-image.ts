import { lookup } from "dns/promises";
import { isIP } from "net";

const MAX_BYTES = 8 * 1024 * 1024;

function isPrivateV4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

/** IPs internas, de loopback, link-local o reservadas (no se descargan imágenes desde ahí). */
export function isPrivateIp(ip: string): boolean {
  if (!ip.includes(":")) return isPrivateV4(ip);
  const v = ip.toLowerCase().replace(/^\[|\]$/g, "");
  // IPv4 dentro de IPv6 (::ffff:a.b.c.d, ::a.b.c.d o 64:ff9b::a.b.c.d): se revisa la parte IPv4
  const v4 = v.match(/(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  if (v4) return isPrivateV4(v4);
  // ::ffff:7f00:1 (IPv4 mapeada en hexadecimal)
  const hex = v.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) {
    const n = (parseInt(hex[1], 16) << 16) | parseInt(hex[2], 16);
    return isPrivateV4([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join("."));
  }
  return v === "::1" || v === "::" || /^f[cd]/.test(v) || /^fe[89ab]/.test(v) || v.startsWith("ff");
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
      // si el servidor declara un tamaño mayor al límite, no se descarga
      if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      return buf.byteLength > MAX_BYTES ? null : buf;
    } catch {
      return null;
    }
  }
  return null;
}
