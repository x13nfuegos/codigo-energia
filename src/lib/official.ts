import { CKAN, SE_NO_CONVENCIONAL } from "./official-ids";
import { fetchText } from "./scraper";
import type { Indicator } from "./types";

export { CKAN, SE_NO_CONVENCIONAL, SE_SOURCE, SE_SOURCE_URL } from "./official-ids";

/**
 * Datos oficiales de producción: Secretaría de Energía, "Producción de Pozos de Gas y Petróleo No Convencional"
 * (Capítulo IV, datos.energia.gob.ar). Petróleo en m³, gas en miles de m³, mensual por pozo y formación.
 */

const M3_TO_BBL = 6.28981;
const TZ = "America/Argentina/Buenos_Aires";

export type MonthRow = { anio: number; mes: number; pet: number; gas: number; pozos: number };

const num = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(",", "."));
  return isFinite(n) ? n : 0;
};

/** Agregado mensual vía SQL del datastore de CKAN (rápido, si el portal lo permite). */
async function monthlyViaSql(resource: string, formation: string, fromYear: number): Promise<MonthRow[]> {
  const f = formation.replace(/'/g, "''").toLowerCase();
  const sql =
    `SELECT anio, mes, SUM(prod_pet::numeric) AS pet, SUM(prod_gas::numeric) AS gas, ` +
    `COUNT(DISTINCT sigla) FILTER (WHERE prod_pet::numeric > 0 OR prod_gas::numeric > 0) AS pozos ` +
    `FROM "${resource}" WHERE lower(formacion) LIKE '%${f}%' AND anio::int >= ${fromYear} ` +
    `GROUP BY anio, mes ORDER BY anio, mes`;
  const text = await fetchText(`${CKAN}/api/3/action/datastore_search_sql?sql=${encodeURIComponent(sql)}`, 60000);
  const json = JSON.parse(text) as { success?: boolean; result?: { records?: Record<string, unknown>[] }; error?: unknown };
  if (!json.success || !json.result?.records) throw new Error(`CKAN SQL: ${JSON.stringify(json.error ?? "sin resultados").slice(0, 200)}`);
  return json.result.records.map((r) => ({ anio: num(r.anio), mes: num(r.mes), pet: num(r.pet), gas: num(r.gas), pozos: num(r.pozos) }));
}

/** Separa una línea CSV respetando comillas. */
function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = false;
      } else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

/** Alternativa: descarga el CSV oficial y agrega por mes (más lento, sin depender del datastore). */
async function monthlyViaCsv(resource: string, formation: string, fromYear: number): Promise<MonthRow[]> {
  const meta = JSON.parse(await fetchText(`${CKAN}/api/3/action/resource_show?id=${resource}`, 30000)) as { result?: { url?: string } };
  const url = meta.result?.url;
  if (!url) throw new Error("No se encontró la URL del recurso oficial");
  const res = await fetch(url, { signal: AbortSignal.timeout(240000) });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} al descargar el CSV oficial`);
  const f = formation.toLowerCase();
  const agg = new Map<string, MonthRow & { wells: Set<string> }>();
  let header: string[] | null = null;
  let idx: Record<string, number> = {};
  let buf = "";
  const decoder = new TextDecoder();
  const handle = (line: string) => {
    if (!line) return;
    const cols = splitCsv(line);
    if (!header) {
      header = cols.map((c) => c.trim().toLowerCase());
      idx = Object.fromEntries(header.map((h, i) => [h, i]));
      for (const k of ["anio", "mes", "prod_pet", "prod_gas", "formacion"]) if (!(k in idx)) throw new Error(`El CSV oficial no tiene la columna ${k}`);
      return;
    }
    const anio = num(cols[idx.anio]);
    if (anio < fromYear || !String(cols[idx.formacion] ?? "").toLowerCase().includes(f)) return;
    const mes = num(cols[idx.mes]);
    const key = `${anio}-${mes}`;
    const row = agg.get(key) ?? { anio, mes, pet: 0, gas: 0, pozos: 0, wells: new Set<string>() };
    const pet = num(cols[idx.prod_pet]);
    const gas = num(cols[idx.prod_gas]);
    row.pet += pet;
    row.gas += gas;
    if ((pet > 0 || gas > 0) && idx.sigla !== undefined) row.wells.add(cols[idx.sigla]);
    agg.set(key, row);
  };
  for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
    buf += decoder.decode(chunk, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      handle(buf.slice(0, nl).replace(/\r$/, ""));
      buf = buf.slice(nl + 1);
    }
  }
  handle(buf);
  return [...agg.values()]
    .map(({ wells, ...r }) => ({ ...r, pozos: wells.size || r.pozos }))
    .sort((a, b) => a.anio - b.anio || a.mes - b.mes);
}

export async function monthlyProduction(resource = SE_NO_CONVENCIONAL, formation = "vaca muerta", fast = false): Promise<MonthRow[]> {
  const fromYear = Number(new Intl.DateTimeFormat("en", { timeZone: TZ, year: "numeric" }).format(new Date())) - 1;
  try {
    const rows = await monthlyViaSql(resource, formation, fromYear);
    if (rows.length) return rows;
  } catch (e) {
    // el portal puede tener deshabilitado el SQL: se usa el CSV (lento, solo desde el cron o el back office)
    if (fast) throw e;
  }
  return monthlyViaCsv(resource, formation, fromYear);
}

const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/**
 * Convierte la serie mensual en un contador: suma oficial del año en curso y, desde el fin del último mes
 * publicado, estimación al ritmo diario de ese mes. Pozos: valor del último mes (no acumula).
 */
export function counterFromMonthly(rows: MonthRow[], metric: NonNullable<Indicator["metric"]>): Partial<Indicator> {
  if (!rows.length) throw new Error("La serie oficial vino vacía");
  const conv = metric === "petroleo" ? M3_TO_BBL : metric === "gas" ? 1000 : 1;
  const pick = (r: MonthRow) => (metric === "petroleo" ? r.pet : metric === "gas" ? r.gas : r.pozos) * conv;
  const last = rows[rows.length - 1];
  const year = Number(new Intl.DateTimeFormat("en", { timeZone: TZ, year: "numeric" }).format(new Date()));
  const history = rows.slice(-18).map((r) => ({ t: new Date(Date.UTC(r.anio, r.mes - 1, 15)).toISOString(), v: pick(r) }));
  const lastLabel = `${MONTHS[last.mes - 1]} ${last.anio}`;

  if (metric === "pozos") {
    return {
      value: pick(last),
      counter_base: pick(last),
      counter_rate_per_day: 0,
      counter_start: new Date().toISOString(),
      counter_since: null,
      counter_label: `pozos con producción en ${lastLabel}`,
      history,
      updated_at: new Date().toISOString(),
      note: `Dato oficial de ${lastLabel}.`,
    };
  }
  const thisYear = rows.filter((r) => r.anio === year);
  const base = thisYear.reduce((s, r) => s + pick(r), 0);
  const rate = pick(last) / daysIn(last.anio, last.mes);
  // el conteo estimado arranca el día siguiente al último mes oficial (00:00 hora argentina)
  const nextMonth = last.mes === 12 ? { y: last.anio + 1, m: 1 } : { y: last.anio, m: last.mes + 1 };
  const start = `${nextMonth.y}-${String(nextMonth.m).padStart(2, "0")}-01T00:00:00-03:00`;
  const counting = thisYear.length ? base : 0;
  return {
    value: pick(last),
    counter_base: counting,
    counter_rate_per_day: rate,
    counter_start: thisYear.length ? start : `${year}-01-01T00:00:00-03:00`,
    counter_since: `${year}-01-01T00:00:00-03:00`,
    counter_label: null,
    history,
    updated_at: new Date().toISOString(),
    note: `Oficial hasta ${lastLabel}; después, estimado al ritmo diario de ${lastLabel}.`,
  };
}

/** Tipo de cambio de referencia del BCRA (Comunicación A 3500) para una moneda. */
export async function fetchBcra(code = "USD"): Promise<number> {
  const json = JSON.parse(await fetchText("https://api.bcra.gob.ar/estadisticascambiarias/v1.0/Cotizaciones", 20000)) as {
    results?: { detalle?: { codigoMoneda?: string; tipoCotizacion?: number }[] } | { detalle?: { codigoMoneda?: string; tipoCotizacion?: number }[] }[];
  };
  const results = Array.isArray(json.results) ? json.results[json.results.length - 1] : json.results;
  const v = results?.detalle?.find((d) => d.codigoMoneda === code)?.tipoCotizacion;
  if (!v) throw new Error(`BCRA sin cotización para ${code}`);
  return v;
}

/** Stooq (CSV, sin clave): alternativa a Yahoo Finance para futuros y acciones. */
export async function fetchStooq(symbol: string): Promise<number> {
  const csv = await fetchText(`https://stooq.com/q/l/?s=${encodeURIComponent(symbol)}&f=sd2t2ohlcv&h&e=csv`, 15000);
  const [header, row] = csv.trim().split(/\r?\n/);
  const cols = header.toLowerCase().split(",");
  const v = Number(row?.split(",")[cols.indexOf("close")]);
  if (!isFinite(v) || v <= 0) throw new Error(`Stooq sin dato para ${symbol}`);
  return v;
}
