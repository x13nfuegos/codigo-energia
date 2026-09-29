/**
 * Los links de Google News (news.google.com/rss/articles/…) no son la nota original.
 * Se decodifican para llegar al medio y poder leer su imagen y bajada (og:image / og:description).
 */
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

export function isGoogleNewsUrl(u: string): boolean {
  try {
    return new URL(u).hostname === "news.google.com";
  } catch {
    return false;
  }
}

function articleIdFrom(u: string): string | null {
  try {
    const parts = new URL(u).pathname.split("/");
    const i = parts.findIndex((p) => p === "articles" || p === "read");
    return i >= 0 ? parts[i + 1] ?? null : null;
  } catch {
    return null;
  }
}

/** Formato viejo: la URL viene dentro del id en base64. */
function decodeLegacy(id: string): string | null {
  try {
    const raw = Buffer.from(id.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("latin1");
    const m = raw.match(/https?:\/\/[\x21-\x7e]+/);
    if (m && !raw.includes("AU_yqL")) return m[0].replace(/[\x00-\x1f]+.*$/, "");
  } catch {
    /* formato nuevo */
  }
  return null;
}

export async function resolveGoogleNewsUrl(u: string, timeoutMs = 10000): Promise<string | null> {
  const id = articleIdFrom(u);
  if (!id) return null;
  const legacy = decodeLegacy(id);
  if (legacy) return legacy;

  // Formato nuevo: firma y timestamp de la página intermedia + endpoint interno de Google News.
  const page = await fetch(`https://news.google.com/rss/articles/${id}`, {
    headers: { "user-agent": UA, "accept-language": "es-419,es;q=0.9" },
    signal: AbortSignal.timeout(timeoutMs),
  }).then((r) => (r.ok ? r.text() : ""));
  const sg = page.match(/data-n-a-sg="([^"]+)"/)?.[1];
  const ts = page.match(/data-n-a-ts="([^"]+)"/)?.[1];
  if (!sg || !ts) return null;

  const inner = JSON.stringify([
    "garturlreq",
    [["X", "X", ["X", "X"], null, null, 1, 1, "US:en", null, 1, null, null, null, null, null, 0, 1], "X", "X", 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0],
    id,
    Number(ts),
    sg,
  ]);
  const body = `f.req=${encodeURIComponent(JSON.stringify([[["Fbv4je", inner, null, "generic"]]]))}`;
  const res = await fetch("https://news.google.com/_/DotsSplashUi/data/batchexecute", {
    method: "POST",
    headers: { "user-agent": UA, "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) return null;
  const text = await res.text();
  const chunk = text.split("\n\n")[1] ?? text.replace(/^\)\]\}'\s*/, "");
  try {
    const outer = JSON.parse(chunk) as unknown[][];
    const payload = JSON.parse(String(outer[0][2])) as unknown[];
    const url = payload[1];
    return typeof url === "string" && url.startsWith("http") ? url : null;
  } catch {
    const urls = (text.replace(/\\\//g, "/").match(/https?:\/\/[^"\\\s]+/g) ?? []).filter((x) => !/google\.|gstatic\./.test(x));
    return urls[0] ?? null;
  }
}
