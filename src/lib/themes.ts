/** Variantes de la identidad visual (ver "Propuestas de identidad visual"). Los colores viven en globals.css. */
export const THEMES = {
  verde: { label: "Verde", description: "La versión original. Verde sintaxis sobre fondo oscuro.", accent: "#64d264", bg: "#0b0e14" },
  cyan: { label: "Cyan", description: "Cyan eléctrico: pantallas de monitoreo, energía en tiempo real.", accent: "#3cd2e6", bg: "#070d15" },
  ember: { label: "Ember", description: "Naranja combustión: energía térmica, industria, urgencia noticiosa.", accent: "#e67828", bg: "#0e0b07" },
  rose: { label: "Rose", description: "Magenta: medio digital de nueva generación, diferenciación radical.", accent: "#e64696", bg: "#11080f" },
  light: { label: "Light", description: "Modo claro: legibilidad máxima, entornos corporativos y newsletters.", accent: "#1e6ec8", bg: "#f5f6fa" },
} as const;

export type ThemeId = keyof typeof THEMES;

export const isTheme = (t: unknown): t is ThemeId => typeof t === "string" && t in THEMES;
