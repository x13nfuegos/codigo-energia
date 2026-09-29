import { POINT_TYPES } from "./map-types";
import type { TableName } from "./types";

export type FieldType = "text" | "textarea" | "number" | "checkbox" | "select" | "list" | "datetime" | "url" | "color";

export interface Field {
  name: string;
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[];
  help?: string;
  required?: boolean;
  /** ancho en la grilla del formulario */
  wide?: boolean;
  /** campo anidado, ej. "selectors.item" */
}

export const CATEGORY_OPTION = "__categories__";

const sourceTypes = [
  { value: "google_news", label: "Google News (búsqueda)" },
  { value: "bing_news", label: "Bing News (búsqueda, con fotos)" },
  { value: "rss", label: "RSS / Atom" },
  { value: "html", label: "Página HTML (selectores CSS)" },
];

export const SCHEMAS: Partial<Record<TableName, Field[]>> = {
  sources: [
    { name: "name", label: "Nombre", type: "text", required: true },
    { name: "type", label: "Tipo", type: "select", options: sourceTypes },
    {
      name: "url",
      label: "URL o búsqueda",
      type: "text",
      wide: true,
      required: true,
      help: "RSS/HTML: URL completa. Google News: términos de búsqueda (admite OR, comillas, site:medio.com).",
    },
    { name: "category", label: "Sección", type: "select", options: [{ value: "auto", label: "Automática (por palabras clave)" }], help: CATEGORY_OPTION },
    { name: "max_items", label: "Máx. notas por corrida", type: "number" },
    { name: "include_keywords", label: "Incluir solo si contiene", type: "list", help: "Separadas por coma. Vacío = todas." },
    { name: "exclude_keywords", label: "Descartar si contiene", type: "list", help: "Separadas por coma." },
    { name: "enabled", label: "Activa", type: "checkbox" },
    { name: "auto_publish", label: "Publicar automáticamente", type: "checkbox", help: "Si no, entran como borrador." },
    { name: "fetch_meta", label: "Buscar imagen y bajada en la nota original", type: "checkbox" },
    { name: "selectors.item", label: "HTML · selector de cada nota", type: "text", help: "Ej: article, .post, .news-item" },
    { name: "selectors.title", label: "HTML · selector del título", type: "text", help: "Ej: h2" },
    { name: "selectors.link", label: "HTML · selector del link", type: "text", help: "Ej: h2 a" },
    { name: "selectors.summary", label: "HTML · selector de la bajada", type: "text" },
    { name: "selectors.image", label: "HTML · selector de la imagen", type: "text" },
    { name: "selectors.date", label: "HTML · selector de la fecha", type: "text" },
  ],
  indicators: [
    { name: "label", label: "Nombre", type: "text", required: true },
    { name: "group", label: "Grupo", type: "text", help: "Dólar, Commodities, Bolsa, Contadores…" },
    {
      name: "provider",
      label: "Proveedor",
      type: "select",
      options: [
        { value: "yahoo", label: "Yahoo Finance" },
        { value: "stooq", label: "Stooq" },
        { value: "bcra", label: "BCRA (Com. A 3500)" },
        { value: "dolarapi", label: "DolarAPI" },
        { value: "se_capitulo_iv", label: "Secretaría de Energía · Capítulo IV" },
        { value: "json", label: "URL JSON" },
        { value: "manual", label: "Manual" },
        { value: "counter", label: "Contador en vivo" },
      ],
    },
    {
      name: "param",
      label: "Parámetro",
      type: "text",
      help: "Yahoo: símbolo (BZ=F, CL=F, NG=F, GC=F, YPF, ^MERV). DolarAPI: oficial, blue, bolsa, contadoconliqui, mayorista. JSON: URL.",
    },
    { name: "json_path", label: "Ruta JSON", type: "text", help: "Solo JSON. Ej: data.0.precio" },
    { name: "source", label: "Fuente (se muestra en el sitio)", type: "text", wide: true },
    { name: "source_url", label: "Link a la fuente", type: "url", wide: true },
    { name: "fallback_provider", label: "Proveedor de respaldo", type: "select", options: [{ value: "", label: "Ninguno" }, { value: "stooq", label: "Stooq" }, { value: "dolarapi", label: "DolarAPI" }, { value: "yahoo", label: "Yahoo Finance" }] },
    { name: "fallback_param", label: "Parámetro de respaldo", type: "text", help: "Stooq: cl.f, cb.f, ng.f, gc.f, ypf.us…" },
    { name: "metric", label: "Capítulo IV · métrica", type: "select", options: [{ value: "", label: "—" }, { value: "petroleo", label: "Petróleo (bbl)" }, { value: "gas", label: "Gas (m³)" }, { value: "pozos", label: "Pozos en producción" }] },
    { name: "unit", label: "Unidad", type: "text" },
    { name: "decimals", label: "Decimales", type: "number" },
    { name: "multiplier", label: "Multiplicador", type: "number", help: "Opcional, se aplica al valor obtenido." },
    { name: "value", label: "Valor (manual)", type: "number" },
    { name: "change_pct", label: "Variación % (manual)", type: "number" },
    { name: "counter_start", label: "Contador · desde", type: "datetime" },
    { name: "counter_base", label: "Contador · valor inicial", type: "number" },
    { name: "counter_rate_per_day", label: "Contador · ritmo por día", type: "number" },
    { name: "note", label: "Nota / fuente del dato", type: "text", wide: true },
    { name: "order", label: "Orden", type: "number" },
    { name: "enabled", label: "Activo", type: "checkbox" },
    { name: "show_in_ticker", label: "Mostrar en la cinta", type: "checkbox" },
    { name: "show_in_panel", label: "Mostrar en el panel", type: "checkbox" },
  ],
  sections: [
    { name: "title", label: "Título visible", type: "text" },
    {
      name: "type",
      label: "Tipo de bloque",
      type: "select",
      options: [
        { value: "hero", label: "Nota principal" },
        { value: "list", label: "Lista con miniaturas" },
        { value: "grid", label: "Grilla" },
        { value: "most_read", label: "Más leídas (7 días)" },
        { value: "counters", label: "Contadores en vivo" },
        { value: "indicators", label: "Panel de indicadores" },
        { value: "map", label: "Mapa" },
        { value: "daily_brief", label: "Resumen diario" },
        { value: "podcast", label: "Podcast (último episodio + lista)" },
        { value: "game", label: "Juego Petrolero Runner" },
        { value: "html", label: "HTML libre (banner, embed)" },
      ],
    },
    { name: "category", label: "Filtrar sección", type: "select", options: [{ value: "", label: "Todas" }], help: CATEGORY_OPTION },
    { name: "limit", label: "Cantidad", type: "number" },
    { name: "offset", label: "Saltear primeras", type: "number", help: "Para no repetir la nota principal." },
    { name: "columns", label: "Columnas (grilla)", type: "select", options: ["2", "3", "4"].map((v) => ({ value: v, label: v })) },
    { name: "html", label: "HTML", type: "textarea", wide: true },
    { name: "enabled", label: "Visible", type: "checkbox" },
  ],
  map_points: [
    { name: "name", label: "Nombre", type: "text", required: true },
    { name: "type", label: "Tipo", type: "select", options: Object.entries(POINT_TYPES).map(([value, v]) => ({ value, label: v.label })) },
    { name: "lat", label: "Latitud", type: "number", required: true, help: "Ej: -38.25" },
    { name: "lng", label: "Longitud", type: "number", required: true, help: "Ej: -68.93" },
    { name: "province", label: "Provincia", type: "text" },
    { name: "operator", label: "Operador", type: "text" },
    { name: "description", label: "Descripción", type: "textarea", wide: true },
    { name: "link", label: "Link", type: "url", wide: true },
    { name: "enabled", label: "Visible", type: "checkbox" },
  ],
  articles: [
    { name: "title", label: "Título", type: "text", wide: true, required: true },
    { name: "summary", label: "Bajada / copete", type: "textarea", wide: true },
    { name: "body", label: "Cuerpo (párrafos separados por una línea en blanco)", type: "textarea", wide: true },
    { name: "url", label: "URL de la fuente original", type: "url", wide: true, help: "Vacío si es una nota propia." },
    { name: "image", label: "Imagen (URL)", type: "url", wide: true },
    { name: "source_name", label: "Medio", type: "text" },
    { name: "category", label: "Sección", type: "select", options: [], help: CATEGORY_OPTION },
    {
      name: "status",
      label: "Estado",
      type: "select",
      options: [
        { value: "published", label: "Publicada" },
        { value: "draft", label: "Borrador" },
        { value: "hidden", label: "Oculta" },
      ],
    },
    { name: "published_at", label: "Fecha", type: "datetime" },
    { name: "geo.place", label: "Ubicación (nombre)", type: "text", help: "Ej: Añelo, Neuquén. Se detecta sola; corregila si hace falta." },
    { name: "geo.lat", label: "Latitud", type: "number", help: "Vacío = sin ubicar en el mapa" },
    { name: "geo.lng", label: "Longitud", type: "number" },
    { name: "featured", label: "Destacada (va a la nota principal)", type: "checkbox" },
  ],
  briefs: [
    { name: "title", label: "Título", type: "text", wide: true },
    { name: "bullets", label: "Puntos clave (uno por línea)", type: "textarea", wide: true },
    { name: "text", label: "Texto", type: "textarea", wide: true },
    { name: "script", label: "Guion de locución", type: "textarea", wide: true },
    { name: "audio_url", label: "URL del audio", type: "url", wide: true },
    { name: "video_url", label: "URL del video (mp4 o YouTube)", type: "url", wide: true, help: "Podés pegar un video hecho a mano en HeyGen." },
  ],
};

function setPath(obj: Record<string, unknown>, path: string, value: unknown) {
  const keys = path.split(".");
  let cur = obj;
  for (const k of keys.slice(0, -1)) cur = (cur[k] ??= {}) as Record<string, unknown>;
  cur[keys[keys.length - 1]] = value;
}

export function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, k) => (acc == null ? undefined : (acc as Record<string, unknown>)[k]), obj);
}

/** Convierte el FormData de un formulario de administración en un objeto tipado según el esquema. */
export function parseForm(fields: Field[], fd: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const raw = fd.get(f.name);
    let v: unknown;
    switch (f.type) {
      case "checkbox":
        v = raw === "on";
        break;
      case "number": {
        const s = String(raw ?? "").trim().replace(",", ".");
        v = s === "" ? null : Number(s);
        if (typeof v === "number" && !isFinite(v)) v = null;
        break;
      }
      case "list":
        v = String(raw ?? "")
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean);
        break;
      case "datetime": {
        const s = String(raw ?? "").trim();
        v = s ? new Date(`${s}:00-03:00`).toISOString() : null;
        break;
      }
      default: {
        const s = String(raw ?? "").trim();
        v = s === "" ? null : s;
      }
    }
    if (f.required && (v === null || v === "")) throw new Error(`Falta completar "${f.label}"`);
    setPath(out, f.name, v);
  }
  return out;
}

/** ISO → valor para <input type="datetime-local"> en hora argentina */
export function toLocalInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() - 3 * 3600000);
  return d.toISOString().slice(0, 16);
}
