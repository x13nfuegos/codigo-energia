export type Font = { name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" };
let fontsCache: Promise<Font[]> | null = null;

/** IBM Plex (la tipografía del sitio) desde Google Fonts; si no se puede, se usa la fuente por defecto. */
export function loadFonts(): Promise<Font[]> {
  const one = async (family: string, weight: 400 | 700, name: string): Promise<Font | null> => {
    try {
      // un user-agent viejo hace que Google Fonts devuelva TTF, que es lo que entiende el generador de imágenes
      const css = await fetch(`https://fonts.googleapis.com/css2?family=${family}:wght@${weight}&display=swap`, {
        headers: { "user-agent": "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/534.30 (KHTML, like Gecko) Safari/534.30" },
      }).then((r) => r.text());
      const url = css.match(/src: url\((.+?)\)/)?.[1];
      if (!url) return null;
      return { name, data: await fetch(url).then((r) => r.arrayBuffer()), weight, style: "normal" };
    } catch {
      return null;
    }
  };
  fontsCache ??= Promise.all([one("IBM+Plex+Sans", 700, "Plex"), one("IBM+Plex+Mono", 400, "PlexMono"), one("IBM+Plex+Mono", 700, "PlexMono")]).then(
    (f) => f.filter((x): x is Font => !!x),
  );
  return fontsCache;
}

