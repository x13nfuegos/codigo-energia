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

export async function fetchIndicator(ind: Indicator): Promise<Partial<Indicator>> {
  if (ind.provider === "manual" || ind.provider === "counter") return {};
  let q: Quote;
  if (ind.provider === "yahoo") q = await fetchYahoo(ind.param);
  else if (ind.provider === "dolarapi") q = await fetchDolar(ind.param);
  else q = await fetchCustomJson(ind.param, ind.json_path ?? "");

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

export async function refreshIndicators(): Promise<{ id: string; ok: boolean; error?: string }[]> {
  const store = await getStore();
  await store.saveSettings({ last_indicators_at: new Date().toISOString() });
  const list = (await store.list("indicators")).filter((i) => i.enabled);
  return Promise.all(
    list.map(async (ind) => {
      try {
        const patch = await fetchIndicator(ind);
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
