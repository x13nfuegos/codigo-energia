import Anthropic from "@anthropic-ai/sdk";
import * as cheerio from "cheerio";
import { fetchText, truncate } from "./scraper";
import { getStore } from "./store";
import { cheapJson } from "./llm";
import type { Article, DailyBrief } from "./types";

const MODEL = "claude-opus-5-5";

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Falta ANTHROPIC_API_KEY");
  return (client ??= new Anthropic());
}

/**
 * Pide a Claude una respuesta JSON que cumpla `schema`.
 * Usa el fallback del lado del servidor para que un rechazo del modelo principal
 * se reintente automáticamente con otro modelo.
 */
async function askJson<T>(system: string, prompt: string, schema: Record<string, unknown>, effort: "low" | "medium" | "high"): Promise<T> {
  const res = await anthropic().beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system,
    output_config: { effort, format: { type: "json_schema", schema } },
    messages: [{ role: "user", content: prompt }],
  });
  if (res.stop_reason === "refusal") throw new Error("El modelo rechazó la solicitud");
  if (res.stop_reason === "max_tokens") throw new Error("La respuesta quedó cortada (max_tokens)");
  const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  return JSON.parse(text) as T;
}

/** Fecha YYYY-MM-DD en horario de Argentina */
export function arDate(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(d);
}

export function yesterdayAR(): string {
  return arDate(new Date(Date.now() - 86400000));
}

const BRIEF_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "bullets", "text", "script", "article_ids"],
  properties: {
    title: { type: "string", description: "Titular del resumen, máx. 90 caracteres" },
    bullets: { type: "array", items: { type: "string" }, description: "5 a 8 puntos clave, una oración cada uno" },
    text: { type: "string", description: "Resumen en 3 a 6 párrafos separados por una línea en blanco" },
    script: { type: "string", description: "Guion para locución de 90 a 120 segundos, sin símbolos ni viñetas, números escritos para leerse en voz alta" },
    article_ids: { type: "array", items: { type: "string" }, description: "ids de las notas usadas" },
  },
} as const;

export async function generateBrief(date = yesterdayAR()): Promise<DailyBrief> {
  const store = await getStore();
  const settings = await store.getSettings();
  const from = new Date(`${date}T00:00:00-03:00`);
  const to = new Date(from.getTime() + 86400000);
  let articles = (await store.queryArticles({ since: from.toISOString(), limit: 120 })).filter((a) => new Date(a.published_at) < to);
  if (articles.length < 3) articles = await store.queryArticles({ since: new Date(to.getTime() - 2 * 86400000).toISOString(), limit: 80 });
  if (!articles.length) throw new Error("No hay notas publicadas para resumir");

  const catName = Object.fromEntries(settings.categories.map((c) => [c.slug, c.name]));
  const list = articles
    .map((a) => `- [${a.id}] (${catName[a.category] ?? a.category} · ${a.source_name ?? ""}) ${a.title}${a.summary ? ` — ${truncate(a.summary, 280)}` : ""}`)
    .join("\n");

  const task =
    `Fecha del resumen: ${date}.\n\nEstas son las notas publicadas (id entre corchetes):\n${list}\n\n` +
    "Armá el resumen del día. Usá solo información de estas notas; no inventes cifras. " +
    "Agrupá temas repetidos y ordená por relevancia para el sector energético argentino. " +
    "El guion es para una locutora o un avatar: frases cortas, comenzá con un saludo y la fecha, cerrá con \"Esto fue el resumen de Código Energía\".";
  type BriefOut = Omit<DailyBrief, "id" | "date" | "created_at">;
  // con clave de Anthropic se usa Claude (una vez por día); si no, la IA económica (Gemini)
  const out = process.env.ANTHROPIC_API_KEY
    ? await askJson<BriefOut>(settings.brief_prompt, task, BRIEF_SCHEMA, "medium")
    : await cheapJson<BriefOut>(
        `${settings.brief_prompt}\nRespondé solo con JSON con estas claves: title (titular, máx. 90 caracteres), bullets (5 a 8 oraciones), ` +
          "text (3 a 6 párrafos separados por una línea en blanco), script (guion de locución de 90 a 120 segundos, sin símbolos, números escritos para leerse en voz alta), " +
          "article_ids (ids de las notas usadas).",
        task,
        4000,
      );
  out.bullets ??= [];
  out.article_ids ??= [];

  const existing = await store.get("briefs", date);
  const brief: DailyBrief = {
    ...(existing ?? {}),
    id: date,
    date,
    title: out.title,
    bullets: out.bullets,
    text: out.text,
    script: out.script,
    article_ids: out.article_ids.filter((id) => articles.some((a) => a.id === id)),
    audio_url: null,
    video_id: null,
    video_url: existing?.video_url && existing.video_status === "manual" ? existing.video_url : null,
    video_status: existing?.video_status === "manual" ? "manual" : null,
    created_at: new Date().toISOString(),
  };
  await store.upsert("briefs", [brief]);
  return brief;
}

export function extractArticleText(html: string): string {
  const $ = cheerio.load(html);
  $("script,style,nav,header,footer,aside,form,iframe,noscript,figure").remove();
  const root = $("article").first().length ? $("article").first() : $("main").first().length ? $("main").first() : $("body");
  const paras = root
    .find("p")
    .map((_, p) => $(p).text().replace(/\s+/g, " ").trim())
    .get()
    .filter((t) => t.length > 60);
  return paras.join("\n\n").slice(0, 12000);
}

const REWRITE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "body"],
  properties: {
    summary: { type: "string", description: "Copete de una o dos oraciones, máx. 280 caracteres" },
    body: { type: "string", description: "Nota de 3 a 6 párrafos breves separados por una línea en blanco" },
  },
} as const;

/**
 * Escribe copete y resumen propios a partir de la nota original, citando el medio.
 * Usa la IA económica (Gemini Flash o Claude Haiku) y recorta la entrada para gastar pocos tokens.
 */
export async function rewriteArticle(a: Article): Promise<Pick<Article, "summary" | "body">> {
  let original = "";
  try {
    original = extractArticleText(await fetchText(a.url, 12000)).slice(0, 9000);
  } catch {
    /* si no se puede leer la nota, se trabaja con título y bajada */
  }
  const out = await cheapJson<{ summary: string; body: string }>(
    "Sos redactor de Código Energía, medio argentino de energía, oil & gas y minería. Escribís en español rioplatense, estilo periodístico, " +
      "con tus propias palabras (nunca copies frases textuales largas) y sin agregar datos que no estén en el material. " +
      "Si el texto original es corto, no rellenes ni especules: escribí solo lo que el material permita. " +
      'Respondé solo con JSON: {"summary": "copete de 1 o 2 oraciones, máx. 250 caracteres", "body": "nota-resumen de 4 a 6 párrafos separados por una línea en blanco (entre 300 y 400 palabras): qué pasó, quiénes intervienen, cifras y datos clave, contexto para el sector energético argentino y próximos pasos si los hay; mencioná al medio de origen como fuente"}.',
    `Medio de origen: ${a.source_name ?? "desconocido"}\nTítulo: ${a.title}\nBajada: ${a.summary}\n\nTexto original:\n${original || "(no disponible)"}`,
    1800,
  );
  if (!out.body) throw new Error("La IA devolvió un resumen vacío");
  return { summary: out.summary, body: out.body };
}
