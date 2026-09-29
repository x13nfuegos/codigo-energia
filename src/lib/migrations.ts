import { DEFAULT_SECTIONS, DEFAULT_SOURCES, SECTIONS_ADDED, SECTIONS_VERSION, SOURCES_ADDED, SOURCES_VERSION } from "./defaults";
import { getStore } from "./store";
import type { Source } from "./types";

/** Último error de las migraciones (se muestra en Diagnóstico). */
export let migrationError: string | null = null;

/** Corre todas las migraciones en serie y registra el error si lo hay. */
export async function runAllMigrations(): Promise<{ sections: boolean; sources: boolean }> {
  try {
    await runSectionMigrations();
    const sources = await runSourceMigrations();
    migrationError = null;
    return { sections: true, sources };
  } catch (e) {
    migrationError = e instanceof Error ? e.message : String(e);
    console.error("migraciones", migrationError);
    throw e;
  }
}

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

/** Suma a bases existentes las fuentes por defecto nuevas (ej. Bing News), una sola vez. Devuelve si cambió algo. */
export async function runSourceMigrations(): Promise<boolean> {
  const store = await getStore();
  const settings = await store.getSettings();
  if ((settings.sources_version ?? 1) >= SOURCES_VERSION) return false;
  const all = await store.list("sources");
  const newIds = SOURCES_ADDED.filter((a) => a.version > (settings.sources_version ?? 1)).flatMap((a) => a.ids);
  // no revive fuentes que existan (aunque estén pausadas)
  const missing = DEFAULT_SOURCES.filter((d) => newIds.includes(d.id) && !all.some((x) => x.id === d.id));
  if (missing.length) await store.upsert("sources", missing as Source[]);
  await store.saveSettings({ sources_version: SOURCES_VERSION });
  return missing.length > 0;
}
