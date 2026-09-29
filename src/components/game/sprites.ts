/**
 * Sprites en pixel art para "Petrolero Runner". Cada sprite es una grilla de caracteres;
 * cada carácter es un color de la paleta y "." es transparente.
 */
export const PALETTE: Record<string, string> = {
  Y: "#f5c400", // casco
  y: "#c99a00", // ala del casco
  S: "#f1c27d", // piel
  K: "#1b1b1b", // ojos / detalles
  O: "#e8742a", // mameluco
  o: "#b8561c", // sombra del mameluco
  R: "#e6edf2", // banda reflectiva
  G: "#3a3f47", // guantes
  B: "#2b2b2b", // botas
  D: "#7a1f1f", // barril
  d: "#4a1212", // aros del barril
  W: "#f2f2f2", // blanco
  P: "#8a96a3", // caño
  p: "#5a6672", // sombra del caño
  V: "#d63b3b", // volante de la válvula
  C: "#ff7a1a", // cono
  N: "#2e3440", // dron
  n: "#9aa5b1", // hélices
  L: "#39ff88", // luz del dron
  F: "#ffb000", // llama
  f: "#ff5a00", // llama externa
};

const H = [
  "...YYYYY....",
  "..YYYYYYY...",
  ".yyyyyyyyyy.",
  "...SSSSSS...",
  "...SSSSKS...",
  "...SSSSSS...",
  "..OOOOOOO...",
  ".GOOOOOOOG..",
  ".GRRRRRRRG..",
  "..OOOOOOO...",
  "..OoOOOoO...",
];

export const WORKER = {
  run1: [...H, "..OOO.OOO...", "..OO...OO...", ".OO.....OO..", ".BB.....BB..", "............"],
  run2: [...H, "...OOOOO....", "...OO.OO....", "...OO.OO....", "...BB.BBB...", "............"],
  jump: [...H, "..OOO.OOO...", ".OO.....OO..", ".BB.....BB..", "............", "............"],
  duck: [
    "....YYYYY.......",
    "...YYYYYYY......",
    "..yyyyyyyyyy....",
    "....SSSSKS......",
    "..OOOOOOOOOOO...",
    ".GRRRRRRRRRRRG..",
    "..OOOOOOOOOOOO..",
    "..OO.......OOO..",
    "..BB.......BBB..",
    "................",
  ],
  hit: [
    "...YYYYY....",
    "..YYYYYYY...",
    ".yyyyyyyyyy.",
    "...SSSSSS...",
    "...SKSSKS...",
    "...SSKKSS...",
    ".GOOOOOOOG..",
    ".GRRRRRRRG..",
    "..OOOOOOO...",
    "..OoOOOoO...",
    "..OOO.OOO...",
    "..OO...OO...",
    "..OO...OO...",
    "..BB...BB...",
    "............",
    "............",
  ],
};

export const OBSTACLES = {
  barrel: [
    ".DDDDDDDD.",
    "DdddddddDD",
    "DDDDDDDDDD",
    "DDWWDDDDDD",
    "DDWWDDDDDD",
    "DdddddddDD",
    "DDDDDDDDDD",
    "DDDDDDDDDD",
    "DDDDDDDDDD",
    "DdddddddDD",
    "DDDDDDDDDD",
    ".DDDDDDDD.",
  ],
  valve: [
    "....VVVV....",
    "...V.PP.V...",
    "....VVVV....",
    ".....PP.....",
    ".....PP.....",
    "PPPPPPPPPPPP",
    "PppppppppppP",
    "PPPPPPPPPPPP",
    ".....PP.....",
    "....pPPp....",
  ],
  cone: ["...CC...", "...CC...", "..CWWC..", "..CCCC..", ".CCCCCC.", ".CWWWWC.", "CCCCCCCC", "KKKKKKKK"],
  drone: [
    "nnnn......nnnn",
    "..K........K..",
    "..KNNNNNNNNK..",
    "...NNLNNLNN...",
    "....NNNNNN....",
    ".....K..K.....",
  ],
};

/** Balancín (pumpjack) de fondo: cuerpo fijo y cabezal que cabecea. */
export const PUMPJACK_BASE = [
  "...........K..........",
  "..........KKK.........",
  ".........K.K.K........",
  "........K..K..K.......",
  ".......K...K...K......",
  "......K....K....K.....",
  ".....K.....K.....K....",
  "....KKKKKKKKKKKKKKK...",
];

export const FLAME = [
  ["..F..", ".FfF.", "FfFfF", ".fFf.", "..f.."],
  [".F...", "..FF.", ".FfF.", "FfFfF", ".fff."],
];

/** Pre-dibuja un sprite en un canvas chico (se reutiliza en cada cuadro). */
export function bake(rows: string[], palette = PALETTE, recolor?: Record<string, string>): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(...rows.map((r) => r.length));
  c.height = rows.length;
  const g = c.getContext("2d")!;
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === ".") return;
      g.fillStyle = recolor?.[ch] ?? palette[ch] ?? "#ff00ff";
      g.fillRect(x, y, 1, 1);
    }),
  );
  return c;
}
