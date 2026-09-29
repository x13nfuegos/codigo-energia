import type { Article } from "./types";

/**
 * Foto temática para notas sin foto propia: busca una imagen con licencia libre (Creative Commons / dominio público)
 * que represente el tema (pozo, parque eólico, mina…) en Openverse y, si no, en Wikimedia Commons.
 * No tiene costo ni requiere clave. El crédito se guarda en un tag "credito:…" y se muestra en la nota.
 */

export type StockPhoto = { url: string; credit: string };

const TOPICS: [RegExp, string[]][] = [
  [/vaca muerta|shale|fracking|fractura|no convencional|a[ñn]elo/i, ["Vaca Muerta", "fracking drilling rig", "oil drilling rig"]],
  [/refiner/i, ["oil refinery"]],
  [/gnl|lng|licuefac/i, ["LNG tanker", "LNG terminal"]],
  [/gasoducto|oleoducto|ducto/i, ["gas pipeline construction", "oil pipeline"]],
  [/offshore|costa afuera|plataforma/i, ["offshore oil platform"]],
  [/litio|lithium|salar/i, ["lithium brine evaporation ponds", "salar lithium"]],
  [/cobre|copper/i, ["copper mine", "open pit copper mine"]],
  [/oro\b|plata\b|minera|mina\b|miner/i, ["open pit mine", "mining truck", "gold mine"]],
  [/e[oó]lic|aerogenerador|viento/i, ["wind farm", "wind turbines"]],
  [/solar|fotovolt/i, ["solar power plant", "photovoltaic solar farm"]],
  [/hidr[oó]geno/i, ["hydrogen plant"]],
  [/nuclear|atucha|carem/i, ["nuclear power plant"]],
  [/represa|hidroel/i, ["hydroelectric dam"]],
  [/termoel|central t[eé]rmica|ciclo combinado/i, ["thermal power station", "gas power plant"]],
  [/combustible|nafta|gasoil|surtidor|estaci[oó]n de servicio/i, ["gas station fuel pump"]],
  [/el[eé]ctric|transmisi[oó]n|tarifa|cammesa|apag[oó]n|distribuidora|l[ií]nea de alta/i, ["high voltage power lines", "electrical substation"]],
  [/petr[oó]le|crudo|barril|pozo|ypf|upstream/i, ["oil pumpjack", "oil drilling rig", "oil field"]],
  [/\bgas\b|gas natural/i, ["natural gas plant", "gas pipeline"]],
];

const BY_CATEGORY: Record<string, string[]> = {
  "oil-gas": ["oil pumpjack", "oil field"],
  mineria: ["open pit mine", "mining truck"],
  energia: ["high voltage power lines", "power plant"],
  electricidad: ["high voltage power lines", "electrical substation"],
  renovables: ["wind farm", "solar power plant"],
  economia: ["Buenos Aires skyline", "port container ship"],
};

export function topicQueries(a: Pick<Article, "title" | "summary" | "category">): string[] {
  const text = `${a.title} ${a.summary ?? ""}`;
  const out: string[] = [];
  for (const [re, qs] of TOPICS) if (re.test(text)) out.push(...qs);
  out.push(...(BY_CATEGORY[a.category] ?? ["energy industry"]));
  return [...new Set(out)].slice(0, 5);
}

const UA = { "user-agent": "CodigoEnergia/1.0 (https://codigoenergia.ar; fotos temáticas con licencia libre)" };

async function openverse(q: string): Promise<StockPhoto[]> {
  const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&license_type=commercial&aspect_ratio=wide&size=large&mature=false&page_size=12`;
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(10000) });
  if (!res.ok) return [];
  const j = (await res.json()) as { results?: { url: string; creator?: string | null; license?: string; license_version?: string; source?: string }[] };
  return (j.results ?? [])
    .filter((r) => /^https:/.test(r.url) && !/\.svg($|\?)/i.test(r.url))
    .map((r) => ({ url: r.url, credit: `${r.creator || "autor desconocido"} · CC ${String(r.license ?? "").toUpperCase()} ${r.license_version ?? ""} · ${r.source ?? "Openverse"}`.trim() }));
}

async function wikimedia(q: string): Promise<StockPhoto[]> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "search",
    gsrnamespace: "6",
    gsrsearch: `${q} filetype:bitmap`,
    gsrlimit: "12",
    prop: "imageinfo",
    iiprop: "url|extmetadata|size",
    iiurlwidth: "1200",
    origin: "*",
  });
  const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, { headers: UA, signal: AbortSignal.timeout(10000) });
  if (!res.ok) return [];
  type Info = { thumburl?: string; width?: number; height?: number; extmetadata?: Record<string, { value?: string }> };
  const j = (await res.json()) as { query?: { pages?: Record<string, { imageinfo?: Info[] }> } };
  const strip = (s?: string) => (s ?? "").replace(/<[^>]+>/g, "").trim();
  return Object.values(j.query?.pages ?? {})
    .map((p) => p.imageinfo?.[0])
    .filter((i): i is Info => !!i?.thumburl && (i.width ?? 0) >= 800 && (i.width ?? 0) > (i.height ?? 0))
    .map((i) => ({
      url: i.thumburl!,
      credit: `${strip(i.extmetadata?.Artist?.value).slice(0, 60) || "Wikimedia Commons"} · ${strip(i.extmetadata?.LicenseShortName?.value) || "licencia libre"} · Wikimedia Commons`,
    }));
}

/** Pequeño hash para que notas distintas del mismo tema no terminen con la misma foto. */
function pick<T>(list: T[], seed: string): T[] {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const start = list.length ? h % list.length : 0;
  return [...list.slice(start), ...list.slice(0, start)];
}

const recentlyUsed = new Set<string>();

/** Busca y devuelve una foto temática que cargue de verdad (la prueba `works`). */
export async function findTopicPhoto(a: Pick<Article, "id" | "title" | "summary" | "category">, works: (url: string) => Promise<boolean>): Promise<StockPhoto | null> {
  for (const q of topicQueries(a)) {
    for (const source of [openverse, wikimedia]) {
      const found = await source(q).catch(() => [] as StockPhoto[]);
      for (const p of pick(found, a.id).slice(0, 4)) {
        if (recentlyUsed.has(p.url)) continue;
        if (await works(p.url).catch(() => false)) {
          recentlyUsed.add(p.url);
          if (recentlyUsed.size > 300) recentlyUsed.delete(recentlyUsed.values().next().value!);
          return p;
        }
      }
    }
  }
  return null;
}
