import type { MetadataRoute } from "next";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://codigoenergia.ar";
  const store = await getStore();
  const [s, articles, briefs] = await Promise.all([store.getSettings(), store.queryArticles({ limit: 1000 }), store.list("briefs")]);
  return [
    { url: site, changeFrequency: "hourly", priority: 1 },
    ...["mapa", "podcast", "juego", "resumen", "indicadores"].map((p) => ({ url: `${site}/${p}` })),
    ...s.categories.map((c) => ({ url: `${site}/seccion/${c.slug}`, changeFrequency: "hourly" as const })),
    ...briefs.map((b) => ({ url: `${site}/resumen/${b.id}`, lastModified: b.created_at })),
    ...articles.map((a) => ({ url: `${site}/nota/${a.id}`, lastModified: a.published_at })),
  ];
}
