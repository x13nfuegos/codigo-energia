import { extractArticleText, rewriteArticle } from "./ai";
import { isGoogleNewsUrl, resolveGoogleNewsUrl } from "./gnews";
import { fetchText, normalizeUrl } from "./scraper";
import { cheapProvider } from "./llm";
import { getStore } from "./store";
import type { Article } from "./types";

/** v2: resumen largo (4 a 6 párrafos). Los de la versión anterior ("resumen:ia") se regeneran. */
export const TAG_AI = "resumen:ia2";
export const TAG_EXTRACT = "resumen:extracto";

const inFlight = new Set<string>();

/** Falta resumen, o el que hay es un extracto / resumen corto viejo y ya hay IA configurada. Los textos cargados a mano no se tocan. */
export function needsSummary(a: Article): boolean {
  if (!a.body) return true;
  const tags = a.tags ?? [];
  if (tags.includes(TAG_AI)) return false;
  const auto = tags.some((t) => t.startsWith("resumen:"));
  return auto && !!cheapProvider();
}

/** Primeras oraciones de la nota original, hasta ~90 palabras (cita breve con atribución). */
function excerpt(text: string, maxWords = 90): string {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  if (words.length <= maxWords) return words.join(" ");
  const cut = words.slice(0, maxWords).join(" ");
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(".”"));
  return end > cut.length * 0.5 ? cut.slice(0, end + 1) : `${cut}…`;
}

/**
 * Resumen escrito de la nota: con GEMINI_API_KEY o ANTHROPIC_API_KEY, una IA económica redacta un resumen propio citando el medio;
 * sin clave, se guarda un extracto breve de la nota original. Se ejecuta una sola vez por nota.
 */
export async function ensureArticleSummary(a: Article): Promise<void> {
  if (inFlight.has(a.id)) return;
  if (a.body && !needsSummary(a)) return;
  inFlight.add(a.id);
  try {
    const store = await getStore();
    let url = a.url;
    if (url && isGoogleNewsUrl(url)) {
      const real = await resolveGoogleNewsUrl(url).catch(() => null);
      if (real) {
        url = normalizeUrl(real);
        await store.patch("articles", a.id, { url });
      }
    }
    const tags = (a.tags ?? []).filter((t) => !t.startsWith("resumen:"));
    if (cheapProvider()) {
      const r = await rewriteArticle({ ...a, url });
      await store.patch("articles", a.id, { body: r.body, summary: a.summary || r.summary, tags: [...tags, TAG_AI] });
      return;
    }
    if (!url || isGoogleNewsUrl(url)) return;
    const text = extractArticleText(await fetchText(url, 12000));
    if (text.length < 120) return;
    await store.patch("articles", a.id, { body: excerpt(text), tags: [...tags, TAG_EXTRACT] });
  } catch {
    /* se reintenta en la próxima visita */
  } finally {
    inFlight.delete(a.id);
  }
}
