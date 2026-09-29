import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function GET() {
  const store = await getStore();
  const s = await store.getSettings();
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://codigoenergia.ar";
  const items = await store.queryArticles({ limit: 50 });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>${esc(s.site_name)}</title><link>${site}</link><description>${esc(s.description)}</description><language>es-AR</language>
${items
  .map(
    (a) => `<item><title>${esc(a.title)}</title><link>${site}/nota/${a.id}</link><guid isPermaLink="false">${a.id}</guid>
<pubDate>${new Date(a.published_at).toUTCString()}</pubDate><category>${esc(a.category)}</category><description>${esc(a.summary)}</description></item>`,
  )
  .join("\n")}
</channel></rss>`;
  return new Response(xml, { headers: { "content-type": "application/rss+xml; charset=utf-8", "cache-control": "s-maxage=300" } });
}
