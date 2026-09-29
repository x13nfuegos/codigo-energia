import { getStore } from "./store";
import { categoryOf, getSettings } from "./site";
import type { NewsPin } from "./map-types";

/** Puntos de infraestructura, noticias geolocalizadas (últimos 30 días) y capas WMS. */
export async function getMapData() {
  const store = await getStore();
  const [settings, points, articles] = await Promise.all([
    getSettings(),
    store.list("map_points"),
    store.queryArticles({ hasGeo: true, since: new Date(Date.now() - 30 * 86400000).toISOString(), limit: 400 }),
  ]);
  const news: NewsPin[] = articles
    .filter((a) => a.geo)
    .map((a) => {
      const c = categoryOf(settings, a.category);
      return {
        id: a.id,
        title: a.title,
        category: a.category,
        catName: c.name,
        catColor: c.color,
        catText: c.text,
        published_at: a.published_at,
        lat: a.geo!.lat,
        lng: a.geo!.lng,
        place: a.geo!.place,
      };
    });
  return { points: points.filter((p) => p.enabled), news, layers: settings.map_layers ?? [] };
}
