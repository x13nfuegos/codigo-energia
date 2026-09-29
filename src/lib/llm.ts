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

export async function cheapJson<T>(system: string, prompt: string, maxTokens = 900): Promise<T> {
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
    let model = geminiModel ?? process.env.AI_MODEL ?? DEFAULT_GEMINI;
    let { res, json } = await call(model);
    // 503 (demanda alta) y 429 (límite) suelen ser momentáneos: dos reintentos con espera creciente
    for (let i = 1; i <= 2 && (res.status === 503 || res.status === 429); i++) {
      await new Promise((r) => setTimeout(r, 2000 * i));
      ({ res, json } = await call(model));
    }
    // Google retira modelos viejos: si el error sugiere uno nuevo ("use models/xxx"), se reintenta con ese y se recuerda
    const suggested = !res.ok ? json.error?.message?.match(/models\/([\w.-]+)/g)?.map((m) => m.slice(7).replace(/\.+$/, "")).find((m) => m !== model) : undefined;
    if (suggested) {
      model = suggested;
      ({ res, json } = await call(model));
    }
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${json.error?.message ?? "error"}`);
    geminiModel = model;
    return parseJson<T>(json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "");
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
