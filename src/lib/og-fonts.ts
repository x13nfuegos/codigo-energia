export type Font = { name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" };

const FONT_COUNT = 3;
const TIMEOUT_MS = 8000;
/** si alguna tipografía no bajó, se vuelve a intentar pasado este tiempo (no en cada imagen) */
const RETRY_MS = 5 * 60000;

let fontsCache: Promise<Font[]> | null = null;
let failedAt = 0;

/** IBM Plex (la tipografía del sitio) desde Google Fonts; si no se puede, se usa la fuente por defecto. */
export function loadFonts(): Promise<Font[]> {
  const one = async (family: string, weight: 400 | 700, name: string): Promise<Font | null> => {
    try {
      // un user-agent viejo hace que Google Fonts devuelva TTF, que es lo que entiende el generador de imágenes
      const res = await fetch(`https://fonts.googleapis.com/css2?family=${family}:wght@${weight}&display=swap`, {
        headers: { "user-agent": "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/534.30 (KHTML, like Gecko) Safari/534.30" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) return null;
      // Google Fonts devuelve un @font-face por alfabeto (cyrillic, greek, latin…): hay que tomar el "latin",
      // no el primero (cyrillic-ext), que no tiene las letras del español
      const url = (await res.text()).match(/\/\* latin \*\/[^}]*?src: url\((.+?)\)/)?.[1];
      if (!url) return null;
      const file = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!file.ok) return null;
      return { name, data: await file.arrayBuffer(), weight, style: "normal" };
    } catch {
      return null;
    }
  };
  // una descarga incompleta no queda guardada para siempre: se reintenta cada RETRY_MS
  if (fontsCache && failedAt && Date.now() - failedAt > RETRY_MS) fontsCache = null;
  fontsCache ??= Promise.all([one("IBM+Plex+Sans", 700, "Plex"), one("IBM+Plex+Mono", 400, "PlexMono"), one("IBM+Plex+Mono", 700, "PlexMono")]).then((f) => {
    const ok = f.filter((x): x is Font => !!x);
    failedAt = ok.length < FONT_COUNT ? Date.now() : 0;
    return ok;
  });
  return fontsCache;
}
