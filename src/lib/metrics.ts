import { arDate } from "./ai";
import { getStore } from "./store";
import type { Article } from "./types";

export type Row = { key: string; label: string; notes: number; views: number };

/**
 * Métricas del back office calculadas a partir de las notas (lecturas acumuladas por nota).
 * El tráfico general (visitas, países, dispositivos) lo mide Vercel Web Analytics.
 */
export async function getMetrics(days = 30) {
  const store = await getStore();
  const settings = await store.getSettings();
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const articles = await store.queryArticles({ since, limit: 1000 });
  const catName = Object.fromEntries(settings.categories.map((c) => [c.slug, c.name]));

  const group = (key: (a: Article) => string, label: (k: string) => string): Row[] => {
    const m = new Map<string, Row>();
    for (const a of articles) {
      const k = key(a);
      const r = m.get(k) ?? { key: k, label: label(k), notes: 0, views: 0 };
      r.notes++;
      r.views += a.views ?? 0;
      m.set(k, r);
    }
    return [...m.values()].sort((x, y) => y.views - x.views || y.notes - x.notes);
  };

  // notas publicadas por día (horario de Argentina), con los días vacíos en cero
  const perDay: { date: string; notes: number; views: number }[] = [];
  for (let i = days - 1; i >= 0; i--) perDay.push({ date: arDate(new Date(Date.now() - i * 86400000)), notes: 0, views: 0 });
  const dayIdx = new Map(perDay.map((d, i) => [d.date, i]));
  for (const a of articles) {
    const i = dayIdx.get(arDate(new Date(a.published_at)));
    if (i !== undefined) {
      perDay[i].notes++;
      perDay[i].views += a.views ?? 0;
    }
  }

  const week = Date.now() - 7 * 86400000;
  const byViews = (list: Article[]) => [...list].sort((a, b) => (b.views ?? 0) - (a.views ?? 0)).filter((a) => (a.views ?? 0) > 0);
  const pct = (n: number) => (articles.length ? Math.round((n / articles.length) * 100) : 0);
  const totalViews = articles.reduce((s, a) => s + (a.views ?? 0), 0);

  return {
    days,
    total: articles.length,
    totalViews,
    viewsPerNote: articles.length ? totalViews / articles.length : 0,
    perDay,
    topWeek: byViews(articles.filter((a) => new Date(a.published_at).getTime() >= week)).slice(0, 10),
    topMonth: byViews(articles).slice(0, 10),
    byCategory: group((a) => a.category, (k) => catName[k] ?? k),
    bySource: group((a) => a.source_name || "Sin fuente", (k) => k).slice(0, 15),
    quality: [
      { label: "Con foto", value: pct(articles.filter((a) => a.image).length) },
      { label: "Con resumen propio (IA)", value: pct(articles.filter((a) => (a.tags ?? []).some((t) => t.startsWith("resumen:ia"))).length) },
      { label: "Geolocalizadas en el mapa", value: pct(articles.filter((a) => a.geo).length) },
      { label: "Sin lecturas todavía", value: pct(articles.filter((a) => !a.views).length) },
    ],
  };
}
