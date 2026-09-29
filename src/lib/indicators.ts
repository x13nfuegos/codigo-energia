import { counterFromMonthly, fetchBcra, fetchStooq, monthlyProduction, type MonthRow } from "./official";
import { getStore } from "./store";
import type { Indicator } from "./types";

const UA = "Mozilla/5.0 (compatible; CodigoEnergiaBot/1.0)";

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" }, signal: AbortSignal.timeout(12000), cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function readPath(obj: unknown, path: string): unknown {
  return path
    .split(".")
    .filter(Boolean)
    .reduce<unknown>((acc, key) => (acc == null ? undefined : (acc as Record<string, unknown>)[key]), obj);
}

type Quote = { value: number; change_pct: number | null; history?: { t: string; v: number }[] };

async function fetchYahoo(symbol: string): Promise<Quote> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1mo&interval=1d`;
  const data = (await getJson(url)) as {
    chart?: { result?: { meta: { regularMarketPrice?: number; regularMarketTime?: number; previousClose?: number }; timestamp?: number[]; indicators: { quote: { close: (number | null)[] }[] } }[] };
  };
  const r = data.chart?.result?.[0];
  if (!r?.meta?.regularMarketPrice) throw new Error(`Sin cotización para ${symbol}`);
  const price = r.meta.regularMarketPrice;
  const ts = r.timestamp ?? [];
  const closes = r.indicators.quote[0]?.close ?? [];
  const points = ts.map((t, i) => ({ t: new Date(t * 1000).toISOString(), v: closes[i] })).filter((p): p is { t: string; v: number } => p.v != null);
  let prev = r.meta.previousClose ?? null;
  if (prev == null && points.length) {
    const lastDay = points[points.length - 1].t.slice(0, 10);
    const marketDay = r.meta.regularMarketTime ? new Date(r.meta.regularMarketTime * 1000).toISOString().slice(0, 10) : lastDay;
    prev = lastDay === marketDay ? points[points.length - 2]?.v ?? null : points[points.length - 1].v;
  }
  return { value: price, change_pct: prev ? ((price - prev) / prev) * 100 : null, history: points.slice(-30) };
}

async function fetchDolar(casa: string): Promise<Quote> {
  const d = (await getJson(`https://dolarapi.com/v1/dolares/${encodeURIComponent(casa)}`)) as { venta?: number; compra?: number };
  const v = d.venta ?? d.compra;
  if (v == null) throw new Error(`Sin cotización para dólar ${casa}`);
  return { value: v, change_pct: null };
}

async function fetchCustomJson(url: string, path: string): Promise<Quote> {
  const v = Number(readPath(await getJson(url), path));
  if (!isFinite(v)) throw new Error(`El valor en "${path}" no es numérico`);
  return { value: v, change_pct: null };
}

/** variación contra el último valor guardado de un día anterior */
function changeFromHistory(history: { t: string; v: number }[], value: number): number | null {
  const today = new Date().toISOString().slice(0, 10);
  const prev = [...history].reverse().find((p) => p.t.slice(0, 10) < today);
  return prev && prev.v ? ((value - prev.v) / prev.v) * 100 : null;
}

async function quote(provider: Indicator["provider"], param: string, jsonPath?: string | null): Promise<Quote> {
  switch (provider) {
    case "yahoo":
      return fetchYahoo(param);
    case "dolarapi":
      return fetchDolar(param);
    case "stooq":
      return { value: await fetchStooq(param), change_pct: null };
    case "bcra":
      return { value: await fetchBcra(param || "USD"), change_pct: null };
    case "json":
      return fetchCustomJson(param, jsonPath ?? "");
    default:
      throw new Error(`Proveedor sin cotización: ${provider}`);
  }
}

type SeriesCache = Map<string, Promise<MonthRow[]>>;

export async function fetchIndicator(ind: Indicator, series: SeriesCache = new Map()): Promise<Partial<Indicator>> {
  if (ind.provider === "manual" || ind.provider === "counter") return {};
  if (ind.provider === "se_capitulo_iv") {
    const key = `${ind.param}|${ind.json_path}`;
    if (!series.has(key)) series.set(key, monthlyProduction(ind.param || undefined, ind.json_path || "vaca muerta"));
    return counterFromMonthly(await series.get(key)!, ind.metric ?? "petroleo");
  }
  let q: Quote;
  try {
    q = await quote(ind.provider, ind.param, ind.json_path);
  } catch (e) {
    if (!ind.fallback_provider || !ind.fallback_param) throw e;
    q = await quote(ind.fallback_provider, ind.fallback_param);
  }

  const mult = ind.multiplier || 1;
  const value = q.value * mult;
  let history = q.history?.map((p) => ({ t: p.t, v: p.v * mult }));
  if (!history) {
    history = [...(ind.history ?? [])];
    const today = new Date().toISOString().slice(0, 10);
    // un punto por día: se reemplaza el del día actual
    if (history.length && history[history.length - 1].t.slice(0, 10) === today) history.pop();
    history.push({ t: new Date().toISOString(), v: value });
    history = history.slice(-60);
  }
  const change_pct = q.change_pct ?? changeFromHistory(ind.history ?? [], value);
  return { value, change_pct, history, updated_at: new Date().toISOString() };
}

/** Las series oficiales mensuales se consultan como mucho dos veces por día. */
const OFFICIAL_EVERY_MS = 12 * 3600000;

export async function refreshIndicators(opts: { forceOfficial?: boolean } = {}): Promise<{ id: string; ok: boolean; error?: string }[]> {
  const store = await getStore();
  await store.saveSettings({ last_indicators_at: new Date().toISOString() });
  const series: SeriesCache = new Map();
  const list = (await store.list("indicators")).filter(
    (i) =>
      i.enabled &&
      (i.provider !== "se_capitulo_iv" || opts.forceOfficial || !i.updated_at || Date.now() - new Date(i.updated_at).getTime() > OFFICIAL_EVERY_MS),
  );
  return Promise.all(
    list.map(async (ind) => {
      try {
        const patch = await fetchIndicator(ind, series);
        if (Object.keys(patch).length) await store.patch("indicators", ind.id, patch);
        return { id: ind.id, ok: true };
      } catch (e) {
        return { id: ind.id, ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    }),
  );
}

/** valor actual de un contador en vivo */
export function counterValue(ind: Pick<Indicator, "counter_start" | "counter_base" | "counter_rate_per_day">, at = Date.now()): number {
  const start = ind.counter_start ? new Date(ind.counter_start).getTime() : at;
  const days = Math.max(0, (at - start) / 86400000);
  return (ind.counter_base ?? 0) + days * (ind.counter_rate_per_day ?? 0);
}

export const isCounter = (i: Indicator) => i.provider === "counter" || i.provider === "se_capitulo_iv";

/** Datos serializables para el componente de contadores. */
export function toCounterData(c: Indicator) {
  return {
    id: c.id,
    label: c.label,
    unit: c.unit,
    start: c.counter_start ?? new Date().toISOString(),
    base: c.counter_base ?? c.value ?? 0,
    ratePerDay: c.counter_rate_per_day ?? 0,
    since: c.counter_since ?? null,
    caption: c.counter_label ?? null,
    source: c.source ?? null,
    sourceUrl: c.source_url ?? null,
    note: c.note ?? null,
  };
}
