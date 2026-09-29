import { SE_NO_CONVENCIONAL, SE_SOURCE, SE_SOURCE_URL } from "./official-ids";
import { DEFAULT_PODCAST } from "./podcast";
import type { Indicator, MapPoint, Section, Settings, Source } from "./types";

export const DEFAULT_SETTINGS: Settings = {
  site_name: "Código Energía",
  tagline: "noticias del subsuelo · real time · sin fricción",
  description:
    "Medio digital que sigue minuto a minuto la energía, el petróleo, el gas y la minería en la Argentina y la región.",
  theme: "verde",
  categories: [
    { slug: "oil-gas", name: "Oil & Gas", color: "#3b5b9a", text: "#ffffff", parent: "" },
    { slug: "mineria", name: "Minería", color: "#f5b400", text: "#1a1200", parent: "" },
    { slug: "energia", name: "Energía", color: "#3a3f47", text: "#e5e7eb", parent: "" },
    { slug: "electricidad", name: "Electricidad", color: "#0e7490", text: "#ffffff", parent: "energia" },
    { slug: "renovables", name: "Renovables", color: "#15803d", text: "#ffffff", parent: "energia" },
    { slug: "economia", name: "Economía", color: "#7c3aed", text: "#ffffff", parent: "" },
  ],
  ticker_enabled: true,
  footer_text: "Energía, oil & gas y minería en tiempo real. Este medio habla el lenguaje de la industria energética con la precisión de un desarrollador.",
  social: [],
  scrape_every_min: 30,
  indicators_every_min: 15,
  retention_days: 120,
  ai_rewrite_auto: false,
  brief_prompt:
    "Sos el editor de Código Energía, un medio argentino especializado en energía, oil & gas y minería. " +
    "Escribí el resumen de lo más importante que pasó ayer, en español rioplatense, tono periodístico, claro y sin exagerar. " +
    "Priorizá: producción y exportaciones de Vaca Muerta, precios, decisiones regulatorias, inversiones y minería (litio, cobre, oro).",
  brief_hour: 7,
  brief_audio: true,
  brief_video: false,
  // Servicio WMS público del SIG de la Secretaría de Energía. Desde el back office
  // se pueden explorar todas las capas del servidor y sumar las que hagan falta.
  // sources_version / sections_version NO van acá: si vinieran por defecto, las bases existentes creerían
  // que ya incorporaron las fuentes y bloques nuevos. Las bases nuevas los suman igual sin duplicar.
  podcast: DEFAULT_PODCAST,
  map_layers: [
    { id: "se-gasoductos-proy", label: "Gasoductos proyectados (SE)", url: "https://sig.energia.gob.ar/wmsenergia", layers: "hidtransp_gasoductos_proyectados", enabled: true, visible: true, opacity: 0.9 },
    { id: "se-oleoductos-proy", label: "Oleoductos proyectados (SE)", url: "https://sig.energia.gob.ar/wmsenergia", layers: "hidrocarburos_transporte_oleoductos_proyectados", enabled: true, visible: true, opacity: 0.9 },
    { id: "se-compresoras", label: "Plantas compresoras (ENARGAS)", url: "https://sig.energia.gob.ar/wmsenergia", layers: "enargas_plantas_compresoras", enabled: true, visible: false, opacity: 1 },
  ],
};

const gn = (q: string) => q;

/**
 * Bing News: mismas búsquedas, con link directo al medio y foto de cada noticia.
 * Se guardan como RSS con la URL completa del feed: así funcionan también en bases creadas
 * antes de que existiera el tipo "bing_news" (la columna type tiene un CHECK con los tipos viejos).
 */
const bingFeed = (q: string) => `https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=rss&cc=AR&setlang=es`;
const bing = (id: string, name: string, q: string, category: string): Omit<Source, "last_run_at" | "last_status" | "last_count"> => ({
  id,
  name: `Bing News · ${name}`,
  type: "rss",
  url: bingFeed(q),
  category,
  enabled: true,
  auto_publish: true,
  include_keywords: [],
  exclude_keywords: ["fútbol", "horóscopo"],
  max_items: 20,
  fetch_meta: false,
});

export const BING_SOURCES = [
  bing("bing-vaca-muerta", "Vaca Muerta", "Vaca Muerta petróleo", "oil-gas"),
  bing("bing-petroleo", "Petróleo y gas", "YPF OR Vista OR Tecpetrol OR Pampa Energía petróleo gas Argentina", "oil-gas"),
  bing("bing-mineria", "Minería", "minería Argentina litio cobre", "mineria"),
  bing("bing-energia", "Energía", "energía eléctrica Argentina CAMMESA ENARSA", "energia"),
  bing("bing-renovables", "Renovables", "parque solar eólico renovables Argentina", "renovables"),
];

/** Bloques de portada agregados en versiones posteriores (se suman una vez a bases existentes). */
// v4: se reaplica podcast + juego (una versión anterior guardaba la versión por defecto sin haberlos sumado)
export const SECTIONS_VERSION = 5;
export const SECTIONS_ADDED = [{ version: 4, ids: ["podcast", "juego"] }];

/** Versión de las fuentes por defecto: al subirla, las bases existentes suman las fuentes nuevas una sola vez. */
// v4: Bing como RSS (la v3 fallaba por el CHECK de tipos en bases existentes)
export const SOURCES_VERSION = 4;
export const SOURCES_ADDED = [{ version: 4, ids: BING_SOURCES.map((s) => s.id) }];

/**
 * Correcciones a fuentes que dejaron de funcionar: se aplican solas a bases existentes
 * solo si la fuente sigue con la configuración vieja (no pisa cambios hechos en el back office).
 */
export const SOURCE_FIXES: { id: string; oldUrl: string; patch: Partial<Source> }[] = [
  {
    id: "energia-estrategica",
    oldUrl: "https://www.energiaestrategica.com/feed/",
    patch: { type: "google_news", url: "site:energiaestrategica.com Argentina", include_keywords: [], fetch_meta: false },
  },
  { id: "panorama-minero", oldUrl: "https://www.panorama-minero.com/feed/", patch: { type: "google_news", url: "site:panorama-minero.com", fetch_meta: false } },
];

export const DEFAULT_SOURCES: Omit<Source, "last_run_at" | "last_status" | "last_count">[] = [
  {
    id: "gn-vaca-muerta",
    name: "Google News · Vaca Muerta",
    type: "google_news",
    url: gn('"Vaca Muerta" OR "shale" Neuquén'),
    category: "oil-gas",
    enabled: true,
    auto_publish: true,
    include_keywords: [],
    exclude_keywords: ["fútbol", "horóscopo"],
    max_items: 20,
    fetch_meta: false,
  },
  {
    id: "gn-petroleo",
    name: "Google News · Petróleo y gas",
    type: "google_news",
    url: gn("YPF OR Vista OR \"Pampa Energía\" OR Tecpetrol OR Chevron petróleo Argentina"),
    category: "oil-gas",
    enabled: true,
    auto_publish: true,
    include_keywords: [],
    exclude_keywords: [],
    max_items: 20,
    fetch_meta: false,
  },
  {
    id: "gn-mineria",
    name: "Google News · Minería",
    type: "google_news",
    url: gn("minería Argentina OR litio OR cobre San Juan OR Catamarca minera"),
    category: "mineria",
    enabled: true,
    auto_publish: true,
    include_keywords: [],
    exclude_keywords: ["bitcoin", "cripto"],
    max_items: 20,
    fetch_meta: false,
  },
  {
    id: "gn-energia",
    name: "Google News · Energía",
    type: "google_news",
    url: gn("CAMMESA OR ENARSA OR \"Secretaría de Energía\" OR tarifas energía Argentina"),
    category: "energia",
    enabled: true,
    auto_publish: true,
    include_keywords: [],
    exclude_keywords: [],
    max_items: 20,
    fetch_meta: false,
  },
  {
    id: "gn-renovables",
    name: "Google News · Renovables",
    type: "google_news",
    url: gn("parque solar OR parque eólico OR renovables Argentina"),
    category: "renovables",
    enabled: true,
    auto_publish: true,
    include_keywords: [],
    exclude_keywords: [],
    max_items: 15,
    fetch_meta: false,
  },
  {
    id: "econojournal",
    name: "EconoJournal",
    type: "rss",
    url: "https://econojournal.com.ar/feed/",
    category: "energia",
    enabled: true,
    auto_publish: true,
    include_keywords: [],
    exclude_keywords: [],
    max_items: 20,
    fetch_meta: true,
  },
  {
    id: "energia-estrategica",
    name: "Energía Estratégica",
    type: "google_news",
    url: "site:energiaestrategica.com Argentina",
    category: "renovables",
    enabled: true,
    auto_publish: true,
    include_keywords: [],
    exclude_keywords: [],
    max_items: 15,
    fetch_meta: false,
  },
  {
    id: "surtidores",
    name: "Surtidores",
    type: "rss",
    url: "https://surtidores.com.ar/feed/",
    category: "oil-gas",
    enabled: true,
    auto_publish: true,
    include_keywords: [],
    exclude_keywords: [],
    max_items: 15,
    fetch_meta: true,
  },
  {
    id: "panorama-minero",
    name: "Panorama Minero",
    type: "google_news",
    url: "site:panorama-minero.com",
    category: "mineria",
    enabled: true,
    auto_publish: true,
    include_keywords: [],
    exclude_keywords: [],
    max_items: 15,
    fetch_meta: false,
  },
  ...BING_SOURCES,
];

let order = 0;
const ind = (i: Omit<Indicator, "order" | "enabled" | "show_in_panel"> & Partial<Indicator>): Indicator => ({
  enabled: true,
  show_in_panel: true,
  order: order++,
  ...i,
});

const official = (id: string, label: string, metric: "petroleo" | "gas" | "pozos", unit: string) =>
  ind({
    id, label, group: "Contadores", provider: "se_capitulo_iv", param: SE_NO_CONVENCIONAL, json_path: "vaca muerta", metric,
    unit, decimals: 0, show_in_ticker: false, source: SE_SOURCE, source_url: SE_SOURCE_URL,
  });

/** Contadores oficiales (se pueden restaurar desde el back office). */
export const OFFICIAL_COUNTERS: Indicator[] = [
  official("barriles-vm", "Petróleo extraído · Vaca Muerta", "petroleo", "bbl"),
  official("gas-vm", "Gas extraído · Vaca Muerta", "gas", "m³"),
  official("pozos-vm", "Pozos en producción · Vaca Muerta", "pozos", "pozos"),
];

const YF = (sym: string, market: string) => ({ source: `${market} vía Yahoo Finance`, source_url: `https://finance.yahoo.com/quote/${encodeURIComponent(sym)}` });
const DOLARAPI = (who: string) => ({ source: `${who} vía DolarAPI`, source_url: "https://dolarapi.com" });

export const DEFAULT_INDICATORS: Indicator[] = [
  ind({ id: "wti", label: "WTI", group: "Commodities", provider: "yahoo", param: "CL=F", fallback_provider: "stooq", fallback_param: "cl.f", unit: "USD/bbl", decimals: 2, show_in_ticker: true, ...YF("CL=F", "NYMEX") }),
  ind({ id: "brent", label: "Brent", group: "Commodities", provider: "yahoo", param: "BZ=F", fallback_provider: "stooq", fallback_param: "cb.f", unit: "USD/bbl", decimals: 2, show_in_ticker: true, ...YF("BZ=F", "ICE") }),
  ind({ id: "gas-ng", label: "Gas (Henry Hub)", group: "Commodities", provider: "yahoo", param: "NG=F", fallback_provider: "stooq", fallback_param: "ng.f", unit: "USD/MMBtu", decimals: 3, show_in_ticker: true, ...YF("NG=F", "NYMEX") }),
  ind({ id: "oro", label: "Oro", group: "Commodities", provider: "yahoo", param: "GC=F", fallback_provider: "stooq", fallback_param: "gc.f", unit: "USD/oz", decimals: 0, show_in_ticker: true, ...YF("GC=F", "COMEX") }),
  ind({ id: "plata", label: "Plata", group: "Commodities", provider: "yahoo", param: "SI=F", fallback_provider: "stooq", fallback_param: "si.f", unit: "USD/oz", decimals: 2, show_in_ticker: true, ...YF("SI=F", "COMEX") }),
  ind({ id: "cobre", label: "Cobre", group: "Commodities", provider: "yahoo", param: "HG=F", fallback_provider: "stooq", fallback_param: "hg.f", unit: "USD/lb", decimals: 2, show_in_ticker: true, ...YF("HG=F", "COMEX") }),
  ind({ id: "litio", label: "Litio (LIT ETF)", group: "Commodities", provider: "yahoo", param: "LIT", fallback_provider: "stooq", fallback_param: "lit.us", unit: "USD", decimals: 2, show_in_ticker: true, ...YF("LIT", "NYSE Arca"), note: "ETF de empresas del litio; no es el precio del carbonato." }),
  ind({ id: "dolar-mayorista", label: "Dólar mayorista", group: "Dólar", provider: "bcra", param: "USD", fallback_provider: "dolarapi", fallback_param: "mayorista", unit: "ARS", decimals: 2, show_in_ticker: true, source: "BCRA · Comunicación A 3500", source_url: "https://www.bcra.gob.ar/PublicacionesEstadisticas/Tipo_de_cambio_minorista.asp" }),
  ind({ id: "dolar-oficial", label: "Dólar oficial (BNA)", group: "Dólar", provider: "dolarapi", param: "oficial", unit: "ARS", decimals: 0, show_in_ticker: true, ...DOLARAPI("Banco Nación") }),
  ind({ id: "dolar-blue", label: "Dólar blue", group: "Dólar", provider: "dolarapi", param: "blue", unit: "ARS", decimals: 0, show_in_ticker: true, ...DOLARAPI("Mercado informal") }),
  ind({ id: "dolar-mep", label: "Dólar MEP", group: "Dólar", provider: "dolarapi", param: "bolsa", unit: "ARS", decimals: 0, show_in_ticker: false, ...DOLARAPI("BYMA") }),
  ind({ id: "dolar-ccl", label: "Dólar CCL", group: "Dólar", provider: "dolarapi", param: "contadoconliqui", unit: "ARS", decimals: 0, show_in_ticker: false, ...DOLARAPI("BYMA") }),
  ind({ id: "merval", label: "Merval", group: "Bolsa", provider: "yahoo", param: "^MERV", unit: "pts", decimals: 0, show_in_ticker: true, ...YF("^MERV", "BYMA") }),
  ind({ id: "ypf", label: "YPF", group: "Bolsa", provider: "yahoo", param: "YPF", fallback_provider: "stooq", fallback_param: "ypf.us", unit: "USD", decimals: 2, show_in_ticker: true, ...YF("YPF", "NYSE") }),
  ind({ id: "vist", label: "Vista", group: "Bolsa", provider: "yahoo", param: "VIST", fallback_provider: "stooq", fallback_param: "vist.us", unit: "USD", decimals: 2, show_in_ticker: true, ...YF("VIST", "NYSE") }),
  ind({ id: "pam", label: "Pampa", group: "Bolsa", provider: "yahoo", param: "PAM", fallback_provider: "stooq", fallback_param: "pam.us", unit: "USD", decimals: 2, show_in_ticker: true, ...YF("PAM", "NYSE") }),
  ind({ id: "tgs", label: "TGS", group: "Bolsa", provider: "yahoo", param: "TGS", fallback_provider: "stooq", fallback_param: "tgs.us", unit: "USD", decimals: 2, show_in_ticker: false, ...YF("TGS", "NYSE") }),
  // Contadores con datos oficiales de producción (Secretaría de Energía, Capítulo IV — no convencional).
  // Suma oficial del año hasta el último mes publicado y, desde ahí, estimación al ritmo de ese mes.
  ...OFFICIAL_COUNTERS,
];

let sOrder = 0;
const sec = (s: Omit<Section, "order" | "enabled" | "category"> & Partial<Section>): Section => ({
  enabled: true,
  category: "",
  order: sOrder++,
  ...s,
});

export const DEFAULT_SECTIONS: Section[] = [
  sec({ id: "hero", type: "hero", title: "Principal", limit: 1 }),
  sec({ id: "podcast", type: "podcast", title: "Código Energía Podcast", limit: 4 }),
  sec({ id: "counters", type: "counters", title: "Contadores", limit: 3 }),
  sec({ id: "ultimas", type: "list", title: "Últimas noticias", limit: 6, offset: 1 }),
  sec({ id: "mapa", type: "map", title: "El mapa de la energía", limit: 0 }),
  sec({ id: "oil-gas", type: "grid", title: "Oil & Gas", category: "oil-gas", limit: 4, columns: 2 }),
  sec({ id: "juego", type: "game", title: "Petrolero Runner", limit: 0 }),
  sec({ id: "mineria", type: "grid", title: "Minería", category: "mineria", limit: 4, columns: 2 }),
  sec({ id: "mas-leidas", type: "most_read", title: "Más leídas", limit: 6, columns: 3 }),
  sec({ id: "energia", type: "grid", title: "Energía", category: "energia", limit: 6, columns: 3 }),
  sec({ id: "brief", type: "daily_brief", title: "El resumen de ayer", limit: 1 }),
  sec({ id: "mercados", type: "indicators", title: "Mercados", limit: 0 }),
];

/** Orden de portada recomendado (se aplica una vez a portadas existentes con la versión 5). */
export const LAYOUT_V5 = DEFAULT_SECTIONS.map((s) => s.id);

const pt = (p: Omit<MapPoint, "enabled">): MapPoint => ({ enabled: true, ...p });
const APROX = "Ubicación aproximada.";

export const DEFAULT_MAP_POINTS: MapPoint[] = [
  pt({ id: "loma-campana", name: "Loma Campana", type: "yacimiento", lat: -38.25, lng: -68.93, province: "Neuquén", operator: "YPF / Chevron", description: `Principal desarrollo de shale oil de Vaca Muerta. ${APROX}` }),
  pt({ id: "la-amarga-chica", name: "La Amarga Chica", type: "yacimiento", lat: -38.17, lng: -68.72, province: "Neuquén", operator: "YPF / Petronas", description: APROX }),
  pt({ id: "bajada-del-palo", name: "Bajada del Palo", type: "yacimiento", lat: -38.33, lng: -68.55, province: "Neuquén", operator: "Vista", description: APROX }),
  pt({ id: "fortin-de-piedra", name: "Fortín de Piedra", type: "yacimiento", lat: -38.45, lng: -68.65, province: "Neuquén", operator: "Tecpetrol", description: `Shale gas. ${APROX}` }),
  pt({ id: "el-trapial", name: "El Trapial", type: "yacimiento", lat: -37.38, lng: -69.12, province: "Neuquén", operator: "Chevron", description: APROX }),
  pt({ id: "tratayen", name: "Tratayén — cabecera GPM", type: "gasoducto", lat: -38.42, lng: -68.58, province: "Neuquén", operator: "ENARSA", description: `Inicio del Gasoducto Perito Moreno. ${APROX}` }),
  pt({ id: "ref-la-plata", name: "Refinería La Plata", type: "refineria", lat: -34.88, lng: -57.9, province: "Buenos Aires", operator: "YPF", description: APROX }),
  pt({ id: "ref-lujan", name: "Refinería Luján de Cuyo", type: "refineria", lat: -33.02, lng: -68.87, province: "Mendoza", operator: "YPF", description: APROX }),
  pt({ id: "ref-campana", name: "Refinería Campana", type: "refineria", lat: -34.18, lng: -58.96, province: "Buenos Aires", operator: "Pan American Energy (Axion)", description: APROX }),
  pt({ id: "ref-dock-sud", name: "Refinería Dock Sud", type: "refineria", lat: -34.65, lng: -58.34, province: "Buenos Aires", operator: "Raízen", description: APROX }),
  pt({ id: "ref-plaza-huincul", name: "Refinería Plaza Huincul", type: "refineria", lat: -38.93, lng: -69.2, province: "Neuquén", operator: "YPF", description: APROX }),
  pt({ id: "puerto-rosales", name: "Puerto Rosales", type: "puerto", lat: -38.92, lng: -62.07, province: "Buenos Aires", operator: "Oiltanking Ebytem", description: `Terminal de exportación de crudo. ${APROX}` }),
  pt({ id: "punta-colorada", name: "Punta Colorada (VMOS)", type: "puerto", lat: -41.72, lng: -65.03, province: "Río Negro", operator: "VMOS", description: `Terminal del oleoducto Vaca Muerta Oil Sur. ${APROX}` }),
  pt({ id: "gnl-escobar", name: "Terminal GNL Escobar", type: "puerto", lat: -34.28, lng: -58.78, province: "Buenos Aires", operator: "ENARSA", description: APROX }),
  pt({ id: "atucha", name: "Atucha I y II", type: "nuclear", lat: -33.97, lng: -59.21, province: "Buenos Aires", operator: "Nucleoeléctrica", description: APROX }),
  pt({ id: "embalse", name: "Central Nuclear Embalse", type: "nuclear", lat: -32.23, lng: -64.44, province: "Córdoba", operator: "Nucleoeléctrica", description: APROX }),
  pt({ id: "yacyreta", name: "Yacyretá", type: "hidro", lat: -27.48, lng: -56.73, province: "Corrientes", operator: "EBY", description: APROX }),
  pt({ id: "salto-grande", name: "Salto Grande", type: "hidro", lat: -31.27, lng: -57.94, province: "Entre Ríos", operator: "CTM Salto Grande", description: APROX }),
  pt({ id: "el-chocon", name: "El Chocón", type: "hidro", lat: -39.27, lng: -68.76, province: "Neuquén", description: APROX }),
  pt({ id: "ct-san-martin", name: "Central Térmica San Martín", type: "termica", lat: -32.67, lng: -60.78, province: "Santa Fe", description: APROX }),
  pt({ id: "ct-belgrano", name: "Central Térmica Belgrano", type: "termica", lat: -34.2, lng: -58.99, province: "Buenos Aires", description: APROX }),
  pt({ id: "cauchari-solar", name: "Parque Solar Cauchari", type: "solar", lat: -23.25, lng: -66.65, province: "Jujuy", operator: "JEMSE", description: APROX }),
  pt({ id: "pe-rawson", name: "Parque Eólico Rawson", type: "eolico", lat: -43.3, lng: -65.1, province: "Chubut", operator: "Genneia", description: APROX }),
  pt({ id: "pe-madryn", name: "Parque Eólico Madryn", type: "eolico", lat: -42.8, lng: -65.15, province: "Chubut", operator: "Genneia", description: APROX }),
  pt({ id: "veladero", name: "Mina Veladero", type: "mina", lat: -29.37, lng: -69.95, province: "San Juan", operator: "Barrick / Shandong Gold", description: `Oro. ${APROX}` }),
  pt({ id: "vicuna", name: "Vicuña (Josemaría / Filo del Sol)", type: "mina", lat: -28.46, lng: -69.58, province: "San Juan", operator: "BHP / Lundin", description: `Cobre, oro y plata. ${APROX}` }),
  pt({ id: "los-azules", name: "Los Azules", type: "mina", lat: -31.07, lng: -70.23, province: "San Juan", operator: "McEwen Copper", description: `Cobre. ${APROX}` }),
  pt({ id: "cerro-negro", name: "Cerro Negro", type: "mina", lat: -46.83, lng: -70.28, province: "Santa Cruz", operator: "Newmont", description: `Oro. ${APROX}` }),
  pt({ id: "olaroz", name: "Salar de Olaroz", type: "litio", lat: -23.5, lng: -66.7, province: "Jujuy", operator: "Rio Tinto", description: APROX }),
  pt({ id: "cauchari-olaroz", name: "Cauchari-Olaroz", type: "litio", lat: -23.62, lng: -66.73, province: "Jujuy", operator: "Minera Exar", description: APROX }),
  pt({ id: "hombre-muerto", name: "Salar del Hombre Muerto", type: "litio", lat: -25.4, lng: -67.0, province: "Catamarca", operator: "Rio Tinto / POSCO", description: APROX }),
];
