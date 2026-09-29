import { bingNewsUrl, googleNewsUrl, fetchText } from "./scraper";
import { DEFAULT_GEMINI, cheapJson, cheapProvider } from "./llm";
import { migrationError } from "./migrations";
import { getStore, storeWarning } from "./store";
import { supabaseEnv } from "./store/env";

export type Check = { name: string; ok: boolean; ms: number; detail: string };

async function timed(name: string, fn: () => Promise<string>, timeoutMs = 20000): Promise<Check> {
  const t = Date.now();
  try {
    const detail = await Promise.race([fn(), new Promise<string>((_, rej) => setTimeout(() => rej(new Error(`sin respuesta en ${timeoutMs / 1000}s`)), timeoutMs))]);
    return { name, ok: true, ms: Date.now() - t, detail };
  } catch (e) {
    return { name, ok: false, ms: Date.now() - t, detail: e instanceof Error ? e.message : String(e) };
  }
}

/** Qué tipo de clave se configuró (sin mostrarla). */
function keyKind(key: string): string {
  if (!key) return "falta";
  if (key.startsWith("sb_secret_")) return "secreta (sb_secret_…) ✓";
  if (key.startsWith("sb_publishable_")) return "PUBLICABLE: no sirve, usá la secreta / service_role";
  try {
    const role = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()).role;
    return role === "service_role" ? "service_role ✓" : `rol "${role}": no sirve, usá la service_role`;
  } catch {
    return "formato desconocido";
  }
}

export async function runDiagnostics(): Promise<{ checks: Check[]; env: Record<string, string> }> {
  const env = supabaseEnv();
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  const envInfo = {
    "Versión publicada": sha ? `${sha.slice(0, 7)} · ${process.env.VERCEL_GIT_COMMIT_MESSAGE?.split("\n")[0]?.slice(0, 70) ?? ""}` : "local",
    "Base de datos": env.ok ? "Supabase" : "archivo temporal (sin Supabase)",
    "URL de Supabase": env.url ? env.url.replace(/^https?:\/\//, "") : "falta",
    "Clave de Supabase": keyKind(env.key),
    "Postgres (crear tablas)": env.pg ? "configurado" : "no configurado",
    "Aviso del almacenamiento": storeWarning ?? "ninguno",
    "IA para resúmenes": cheapProvider()
      ? `${cheapProvider()} · ${process.env.AI_MODEL || (cheapProvider() === "gemini" ? DEFAULT_GEMINI : "claude-haiku-4-5")}`
      : "sin IA (se muestra un extracto de la nota original)",
  };
  const store = await getStore();
  const checks = await Promise.all([
    timed("Base: leer notas, fuentes e indicadores", async () => {
      const [a, s, i] = await Promise.all([store.countArticles({ status: "all" }), store.list("sources"), store.list("indicators")]);
      const recent = await store.queryArticles({ limit: 60 });
      const withImg = recent.filter((x) => x.image).length;
      return `${store.kind}: ${a} notas (${withImg}/${recent.length} recientes con imagen) · ${s.length} fuentes (${s.filter((x) => x.enabled).length} activas) · ${i.length} indicadores (${i.filter((x) => x.value != null).length} con valor)`;
    }),
    timed("Base: escribir", async () => {
      const s = await store.getSettings();
      await store.saveSettings({ tagline: s.tagline });
      return "escritura OK";
    }),
    timed("Portada: bloques y actualizaciones", async () => {
      const [secs, settings] = await Promise.all([store.list("sections"), store.getSettings()]);
      const types = secs.filter((x) => x.enabled).sort((a, b) => a.order - b.order).map((x) => x.type);
      const miss = ["podcast", "game"].filter((t) => !types.includes(t as never));
      const detail = `${types.join(" · ")} | versiones: portada ${settings.sections_version ?? 1}, fuentes ${settings.sources_version ?? 1}${migrationError ? ` | ERROR: ${migrationError}` : ""}`;
      if (miss.length) throw new Error(`faltan ${miss.join(" y ")} → tocá "Aplicar actualizaciones". ${detail}`);
      return detail;
    }),
    timed(
      "IA (prueba real)",
      async () => {
        if (!cheapProvider()) return "sin IA configurada";
        const r = await cheapJson<{ ok: boolean }>("Respondé solo JSON.", 'Devolvé {"ok": true}', 50);
        return r.ok ? `${cheapProvider()} responde OK` : "respuesta inesperada";
      },
      30000,
    ),
    timed("Audio del resumen (ElevenLabs)", async () => {
      const key = process.env.ELEVENLABS_API_KEY;
      if (!key) throw new Error("falta ELEVENLABS_API_KEY en Vercel");
      const res = await fetch("https://api.elevenlabs.io/v1/user/subscription", { headers: { "xi-api-key": key }, signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 160)}`);
      const j = (await res.json()) as { tier?: string; character_count?: number; character_limit?: number };
      const [settings, briefs] = await Promise.all([store.getSettings(), store.list("briefs")]);
      const [last] = briefs.sort((a, b) => b.date.localeCompare(a.date));
      const st = settings.audio_status;
      const lastTry = st ? ` · último intento: ${st.ok ? "OK" : `ERROR ${st.error}`}` : "";
      const info = `plan ${j.tier ?? "?"} · ${j.character_count ?? "?"}/${j.character_limit ?? "?"} caracteres usados · resumen ${last?.date ?? "—"}: ${last?.audio_url ? "con audio ✓" : "sin audio"}${lastTry}`;
      if (!settings.brief_audio) throw new Error(`el audio está apagado en Ajustes · ${info}`);
      if (st && !st.ok && !last?.audio_url) throw new Error(info);
      return info;
    }),
    timed("Yahoo Finance (WTI)", async () => {
      const j = JSON.parse(await fetchText("https://query1.finance.yahoo.com/v8/finance/chart/CL%3DF?range=5d&interval=1d", 15000));
      return `WTI ${j.chart?.result?.[0]?.meta?.regularMarketPrice ?? "sin dato"}`;
    }),
    timed("Stooq (respaldo opcional)", async () => (await fetchText("https://stooq.com/q/l/?s=cl.f&f=sd2t2ohlcv&h&e=csv", 15000)).split("\n")[1] ?? "vacío"),
    timed("DolarAPI", async () => `oficial ${JSON.parse(await fetchText("https://dolarapi.com/v1/dolares/oficial", 15000)).venta}`),
    timed("BCRA", async () => {
      const t = await fetchText("https://api.bcra.gob.ar/estadisticascambiarias/v1.0/Cotizaciones", 15000);
      return t.includes("USD") ? "responde con USD" : t.slice(0, 120);
    }),
    timed("Google News (feed)", async () => {
      const x = await fetchText(googleNewsUrl("Vaca Muerta"), 15000);
      return `${(x.match(/<item>/g) ?? []).length} notas en el feed`;
    }),
    timed("Bing News (feed con fotos)", async () => {
      const x = await fetchText(bingNewsUrl("Vaca Muerta"), 15000);
      return `${(x.match(/<item>/g) ?? []).length} notas · ${(x.match(/<News:Image>/g) ?? []).length} con foto`;
    }),
    timed("Secretaría de Energía (datos.energia.gob.ar)", async () => {
      const t = await fetchText("https://datos.energia.gob.ar/api/3/action/resource_show?id=b5b58cdc-9e07-41f9-b392-fb9ec68b0725", 20000);
      const j = JSON.parse(t);
      return j.success ? `recurso OK · datastore ${j.result?.datastore_active ? "activo" : "inactivo"}` : "respuesta sin éxito";
    }),
  ]);
  return { checks, env: envInfo };
}
