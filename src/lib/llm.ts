import Anthropic from "@anthropic-ai/sdk";

/**
 * IA económica para tareas cortas (resumen de cada nota).
 * Proveedor: AI_PROVIDER=gemini|anthropic (si no se define, se usa el que tenga clave; Gemini primero por costo).
 * Modelo: AI_MODEL (por defecto gemini-3.8-flash o claude-haiku-4-5).
 */
export function cheapProvider(): "gemini" | "anthropic" | null {
  const p = process.env.AI_PROVIDER?.toLowerCase();
  if (p === "gemini" && process.env.GEMINI_API_KEY) return "gemini";
  if (p === "anthropic" && process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return null;
}

/** Extrae el primer objeto JSON de la respuesta (tolera texto o ```json alrededor). */
function parseJson<T>(text: string): T {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("La IA no devolvió JSON");
  return JSON.parse(text.slice(start, end + 1)) as T;
}

let anthropicClient: Anthropic | null = null;

/** Modelo de Gemini por defecto (Google fue retirando gemini-2.5-flash para cuentas nuevas). */
export const DEFAULT_GEMINI = "gemini-3.8-flash";
/** Último modelo de Gemini que respondió bien (si hubo que cambiar por uno sugerido por Google). */
let geminiModel: string | null = null;

/**
 * Modelos con la cuota diaria agotada (plan gratuito: pocas consultas por día y por modelo) y hasta cuándo.
 * La cuota gratuita se renueva a la medianoche del Pacífico (≈ 4 o 5 de la mañana en Argentina).
 */
const exhausted = new Map<string, number>();
function nextPacificMidnight(): number {
  const now = new Date();
  const pt = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  const offset = now.getTime() - pt.getTime();
  const next = new Date(pt);
  next.setHours(24, 5, 0, 0);
  return next.getTime() + offset;
}
const isExhausted = (m: string) => (exhausted.get(m) ?? 0) > Date.now();

/** Estado de la cuota para Diagnóstico. */
export function quotaStatus(): string[] {
  return [...exhausted.entries()]
    .filter(([, until]) => until > Date.now())
    .map(([m, until]) => `${m} sin cuota hasta ${new Date(until).toLocaleTimeString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit" })}`);
}

/** true si el modelo principal se quedó sin cuota: las tareas de baja prioridad no gastan la de respaldo. */
export const aiSaving = () => isExhausted(geminiModel ?? process.env.AI_MODEL ?? DEFAULT_GEMINI);

let modelList: { at: number; names: string[] } | null = null;
/** Modelos Flash disponibles para esta clave (consultar la lista no gasta cuota). */
export async function geminiModels(): Promise<string[]> {
  if (modelList && Date.now() - modelList.at < 6 * 3600000) return modelList.names;
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", {
    headers: { "x-goog-api-key": process.env.GEMINI_API_KEY! },
    signal: AbortSignal.timeout(15000),
  });
  const j = (await res.json().catch(() => ({}))) as { models?: { name: string; supportedGenerationMethods?: string[] }[]; error?: { message?: string } };
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${j.error?.message ?? "no se pudo listar modelos"}`);
  const names = (j.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes("generateContent") && /flash/i.test(m.name) && !/image|tts|audio|live|embed|thinking|exp/i.test(m.name))
    .map((m) => m.name.replace(/^models\//, ""));
  modelList = { at: Date.now(), names };
  return names;
}

/** Respaldo cuando el modelo principal no tiene cuota: AI_FALLBACK_MODELS o, si no, los Flash más nuevos (primero los "lite", que tienen más cuota gratis). */
async function fallbackModels(primary: string): Promise<string[]> {
  const env = process.env.AI_FALLBACK_MODELS?.split(",").map((x) => x.trim()).filter(Boolean);
  if (env?.length) return env.filter((m) => m !== primary);
  const names = await geminiModels().catch(() => [] as string[]);
  const version = (n: string) => Number(n.match(/(\d+(?:\.\d+)?)/)?.[1] ?? 0);
  return names
    .filter((m) => m !== primary && !/preview/i.test(m))
    .sort((a, b) => Number(/lite/.test(b)) - Number(/lite/.test(a)) || version(b) - version(a))
    .slice(0, 4);
}

export type Priority = "high" | "low";

/**
 * Pide JSON a la IA económica. `priority: "low"` (resúmenes de notas, textos de Instagram) no se ejecuta
 * cuando el modelo principal se quedó sin cuota, para dejar lo que queda al resumen diario.
 */
export async function cheapJson<T>(system: string, prompt: string, maxTokens = 900, priority: Priority = "high"): Promise<T> {
  const provider = cheapProvider();
  if (provider === "gemini") {
    const call = async (model: string) => {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", maxOutputTokens: maxTokens, temperature: 0.4 },
        }),
        signal: AbortSignal.timeout(60000),
      });
      const json = (await res.json().catch(() => ({}))) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
        error?: { message?: string };
      };
      return { res, json };
    };
    const primary = geminiModel ?? process.env.AI_MODEL ?? DEFAULT_GEMINI;
    if (priority === "low" && isExhausted(primary)) throw new Error(`Gemini sin cuota por hoy (${primary}): se guarda para el resumen diario`);
    const quotaOut = (msg?: string) => /quota|RESOURCE_EXHAUSTED|free_tier/i.test(msg ?? "");

    const tryModel = async (model: string) => {
      let { res, json } = await call(model);
      // 503 (demanda alta) y 429 por ráfaga suelen ser momentáneos; el 429 por cuota diaria no se reintenta
      for (let i = 1; i <= 2 && (res.status === 503 || (res.status === 429 && !quotaOut(json.error?.message))); i++) {
        await new Promise((r) => setTimeout(r, 2000 * i));
        ({ res, json } = await call(model));
      }
      if (res.status === 429 && quotaOut(json.error?.message)) exhausted.set(model, nextPacificMidnight());
      return { res, json, model };
    };

    let r = isExhausted(primary) ? null : await tryModel(primary);
    // Google retira modelos viejos: si el error sugiere uno nuevo ("use models/xxx"), se reintenta con ese y se recuerda
    if (r && !r.res.ok && r.res.status !== 429) {
      const suggested = r.json.error?.message?.match(/models\/([\w.-]+)/g)?.map((m) => m.slice(7).replace(/\.+$/, "")).find((m) => m !== primary);
      if (suggested) {
        r = await tryModel(suggested);
        if (r.res.ok) geminiModel = suggested;
      }
    }
    // sin cuota: se prueba con otros modelos Flash de la misma clave (cada uno tiene su propia cuota)
    if (!r || (!r.res.ok && isExhausted(r.model))) {
      const firstError = r?.json.error?.message;
      for (const m of await fallbackModels(primary)) {
        if (isExhausted(m)) continue;
        const f = await tryModel(m);
        if (f.res.ok) {
          r = f;
          break;
        }
        if (!r || f.res.status !== 404) r = f;
      }
      if (!r) throw new Error(`Gemini sin cuota por hoy en todos los modelos. ${firstError ?? ""}`.trim());
    }
    if (!r.res.ok) throw new Error(`Gemini ${r.res.status}: ${r.json.error?.message ?? "error"}`);
    return parseJson<T>(r.json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "");
  }
  if (provider === "anthropic") {
    anthropicClient ??= new Anthropic();
    const res = await anthropicClient.messages.create({
      model: process.env.AI_MODEL || "claude-haiku-4-5",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: prompt }],
    });
    if (res.stop_reason === "refusal") throw new Error("El modelo rechazó la solicitud");
    return parseJson<T>(res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join(""));
  }
  throw new Error("Falta GEMINI_API_KEY o ANTHROPIC_API_KEY");
}
