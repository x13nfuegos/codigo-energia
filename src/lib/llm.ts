import Anthropic from "@anthropic-ai/sdk";

/**
 * IA económica para tareas cortas (resumen de cada nota).
 * Proveedor: AI_PROVIDER=gemini|anthropic (si no se define, se usa el que tenga clave; Gemini primero por costo).
 * Modelo: AI_MODEL (por defecto gemini-2.5-flash o claude-haiku-4-5).
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

export async function cheapJson<T>(system: string, prompt: string, maxTokens = 900): Promise<T> {
  const provider = cheapProvider();
  if (provider === "gemini") {
    const model = process.env.AI_MODEL || "gemini-2.5-flash";
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", maxOutputTokens: maxTokens, temperature: 0.4 },
      }),
      signal: AbortSignal.timeout(45000),
    });
    const json = (await res.json().catch(() => ({}))) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      error?: { message?: string };
    };
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${json.error?.message ?? "error"}`);
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
