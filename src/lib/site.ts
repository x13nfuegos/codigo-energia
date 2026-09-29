import { cache } from "react";
import { getStore } from "./store";
import type { Category, Settings } from "./types";

export const getSettings = cache(async (): Promise<Settings> => (await getStore()).getSettings());

export const getIndicators = cache(async () =>
  (await (await getStore()).list("indicators")).filter((i) => i.enabled).sort((a, b) => a.order - b.order),
);

export function categoryOf(settings: Settings, slug: string): Category {
  return settings.categories.find((c) => c.slug === slug) ?? { slug, name: slug, color: "#3a3f47", text: "#e5e7eb" };
}
