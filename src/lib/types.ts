export type ArticleStatus = "published" | "draft" | "hidden";

export interface Category {
  slug: string;
  name: string;
  /** color de la etiqueta (fondo) */
  color: string;
  /** color del texto de la etiqueta */
  text: string;
}

export interface Article {
  id: string;
  url: string;
  title: string;
  summary: string;
  /** cuerpo reescrito / ampliado (markdown simple). Opcional. */
  body?: string | null;
  image?: string | null;
  source_id?: string | null;
  source_name?: string | null;
  category: string;
  tags?: string[];
  published_at: string;
  scraped_at: string;
  status: ArticleStatus;
  featured?: boolean;
  views?: number;
  /** ubicación de la noticia (detectada automáticamente o cargada a mano) */
  geo?: GeoTag | null;
}

export interface GeoTag {
  lat: number;
  lng: number;
  place: string;
  /** cargada a mano en el back office: no se pisa al re-geolocalizar */
  manual?: boolean;
}

/** capa WMS externa (ej. SIG de la Secretaría de Energía) */
export interface MapLayer {
  id: string;
  label: string;
  url: string;
  layers: string;
  enabled: boolean;
  /** visible al abrir el mapa */
  visible: boolean;
  opacity: number;
}

export type SourceType = "rss" | "google_news" | "html";

export interface HtmlSelectors {
  item: string;
  title: string;
  link: string;
  summary?: string;
  image?: string;
  date?: string;
}

export interface Source {
  id: string;
  name: string;
  type: SourceType;
  /** URL del feed, query de Google News o URL de la página a scrapear */
  url: string;
  category: string;
  enabled: boolean;
  auto_publish: boolean;
  /** si alguna palabra coincide, la nota entra (vacío = todas) */
  include_keywords: string[];
  /** si alguna palabra coincide, la nota se descarta */
  exclude_keywords: string[];
  max_items: number;
  /** buscar og:image / og:description en la nota original */
  fetch_meta: boolean;
  selectors?: HtmlSelectors | null;
  last_run_at?: string | null;
  last_status?: string | null;
  last_count?: number | null;
}

export type IndicatorProvider = "dolarapi" | "yahoo" | "json" | "manual" | "counter";

export interface Indicator {
  id: string;
  label: string;
  group: string;
  provider: IndicatorProvider;
  /**
   * dolarapi: casa (oficial, blue, bolsa, contadoconliqui, mayorista, cripto, tarjeta)
   * yahoo: símbolo (BZ=F, CL=F, NG=F, GC=F, SI=F, HG=F, LIT, YPF, ^MERV...)
   * json: URL
   */
  param: string;
  /** json: ruta al valor, ej "data.0.price" */
  json_path?: string | null;
  unit: string;
  decimals: number;
  /** multiplicador aplicado al valor obtenido (ej. cobre en USD/lb) */
  multiplier?: number | null;
  show_in_ticker: boolean;
  show_in_panel: boolean;
  enabled: boolean;
  order: number;
  value?: number | null;
  change_pct?: number | null;
  history?: { t: string; v: number }[];
  updated_at?: string | null;
  note?: string | null;
  /** counter: valor en start_date y ritmo por día; el valor mostrado crece en vivo */
  counter_start?: string | null;
  counter_base?: number | null;
  counter_rate_per_day?: number | null;
}

export type SectionType =
  | "hero"
  | "list"
  | "grid"
  | "most_read"
  | "newsroom"
  | "counters"
  | "indicators"
  | "map"
  | "daily_brief"
  | "html";

export interface Section {
  id: string;
  type: SectionType;
  title: string;
  /** slug de categoría para filtrar (vacío = todas) */
  category: string;
  limit: number;
  order: number;
  enabled: boolean;
  /** html: contenido libre; grid: columnas */
  html?: string | null;
  columns?: number | null;
  /** saltear las primeras N notas (para no repetir la del hero) */
  offset?: number | null;
}

export type MapPointType =
  | "yacimiento"
  | "refineria"
  | "eolico"
  | "solar"
  | "hidro"
  | "nuclear"
  | "termica"
  | "mina"
  | "litio"
  | "puerto"
  | "gasoducto";

export interface MapPoint {
  id: string;
  name: string;
  type: MapPointType;
  lat: number;
  lng: number;
  province: string;
  operator?: string | null;
  description?: string | null;
  link?: string | null;
  enabled: boolean;
}

export interface DailyBrief {
  id: string; // YYYY-MM-DD
  date: string;
  title: string;
  bullets: string[];
  text: string;
  script: string;
  article_ids: string[];
  audio_url?: string | null;
  video_id?: string | null;
  video_url?: string | null;
  video_status?: string | null;
  created_at: string;
}

export interface Settings {
  site_name: string;
  tagline: string;
  description: string;
  /** variante de la identidad: verde | cyan | ember | rose | light */
  theme: import("./themes").ThemeId;
  categories: Category[];
  ticker_enabled: boolean;
  footer_text: string;
  social: { name: string; url: string }[];
  /** minutos entre scrapeos automáticos disparados por visitas */
  scrape_every_min: number;
  /** minutos entre actualizaciones de indicadores */
  indicators_every_min: number;
  /** días que se conservan las notas scrapeadas */
  retention_days: number;
  ai_rewrite_auto: boolean;
  brief_prompt: string;
  brief_hour: number;
  brief_audio: boolean;
  brief_video: boolean;
  map_layers: MapLayer[];
  last_scrape_at?: string | null;
  last_indicators_at?: string | null;
}

export interface Tables {
  articles: Article;
  sources: Source;
  indicators: Indicator;
  sections: Section;
  map_points: MapPoint;
  briefs: DailyBrief;
}

export type TableName = keyof Tables;

export interface ArticleQuery {
  category?: string;
  status?: ArticleStatus | "all";
  search?: string;
  limit?: number;
  offset?: number;
  featured?: boolean;
  since?: string;
  orderBy?: "published_at" | "views";
  /** solo notas geolocalizadas */
  hasGeo?: boolean;
}
