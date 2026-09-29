import { cache } from "react";
import { DEFAULT_SETTINGS } from "./defaults";
import { getStore } from "./store";
import type { Category, Settings } from "./types";

/** Completa datos de configuraciones guardadas con versiones anteriores. */
function normalize(s: Settings): Settings {
  const defaults = new Map(DEFAULT_SETTINGS.categories.map((c) => [c.slug, c]));
  const slugs = new Set(s.categories.map((c) => c.slug));
  // configuración anterior a las subsecciones: se adopta también el orden nuevo (Oil & Gas, Minería, Energía…)
  const legacy = s.categories.every((c) => c.parent === undefined);
  const order = [...defaults.keys()];
  const source = legacy
    ? [...s.categories].sort((a, b) => (order.indexOf(a.slug) + 1 || 99) - (order.indexOf(b.slug) + 1 || 99))
    : s.categories;
  const categories = source.map((c) => {
    // antes no existían las subsecciones: se aplica la jerarquía por defecto si la madre existe
    if (c.parent === undefined) {
      const p = defaults.get(c.slug)?.parent ?? "";
      return { ...c, parent: p && slugs.has(p) ? p : "" };
    }
    return c;
  });
  return { ...s, categories };
}

export const getSettings = cache(async (): Promise<Settings> => normalize(await (await getStore()).getSettings()));

export const getIndicators = cache(async () =>
  (await (await getStore()).list("indicators")).filter((i) => i.enabled).sort((a, b) => a.order - b.order),
);

export function categoryOf(settings: Settings, slug: string): Category {
  return settings.categories.find((c) => c.slug === slug) ?? { slug, name: slug, color: "#3a3f47", text: "#e5e7eb" };
}

/** Sección y sus subsecciones (para consultar notas). */
export function categoryFamily(settings: Settings, slug: string): string[] {
  return [slug, ...settings.categories.filter((c) => c.parent === slug).map((c) => c.slug)];
}

export function topCategories(settings: Settings): Category[] {
  return settings.categories.filter((c) => !c.parent);
}

export function subCategories(settings: Settings, slug: string): Category[] {
  return settings.categories.filter((c) => c.parent === slug);
}
