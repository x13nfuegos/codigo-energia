import { SECTIONS_ADDED, SECTIONS_VERSION, DEFAULT_SECTIONS } from "./defaults";
import { getStore } from "./store";

/**
 * Suma a portadas existentes los bloques nuevos (ej. Podcast), una sola vez.
 * Es rápida: se llama al mostrar la portada y en cada scrapeo.
 */
export async function runSectionMigrations(): Promise<void> {
  const store = await getStore();
  const settings = await store.getSettings();
  if ((settings.sections_version ?? 1) >= SECTIONS_VERSION) return;
  const sections = (await store.list("sections")).sort((a, b) => a.order - b.order);
  const newIds = SECTIONS_ADDED.filter((a) => a.version > (settings.sections_version ?? 1)).flatMap((a) => a.ids);
  for (const id of newIds) {
    const def = DEFAULT_SECTIONS.find((d) => d.id === id);
    if (!def || sections.some((x) => x.id === id || x.type === def.type)) continue;
    // podcast: después del mapa; juego: después del podcast (o cerca del principio)
    const anchor = sections.findIndex((x) => x.type === (def.type === "game" ? "podcast" : "map"));
    sections.splice(anchor >= 0 ? anchor + 1 : Math.min(3, sections.length), 0, def);
  }
  await store.upsert("sections", sections.map((x, i) => ({ ...x, order: i })));
  await store.saveSettings({ sections_version: SECTIONS_VERSION });
}
