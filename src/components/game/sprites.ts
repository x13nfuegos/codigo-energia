/**
 * Sprites en pixel art para "Petrolero Runner". Cada sprite es una grilla de caracteres;
 * cada carácter es un color de la paleta y "." es transparente.
 */
export const PALETTE: Record<string, string> = {
  // petrolero (referencia: casco blanco, anteojos de seguridad, mameluco azul con bandas reflectivas)
  H: "#f4f6f8", // casco blanco
  h: "#c3ccd6", // ala / sombra del casco
  A: "#d9e28a", // lente de los anteojos
  Z: "#9a9a9a", // pelo canoso bajo el casco
  U: "#233257", // mameluco azul marino
  u: "#172241", // sombra del mameluco
  T: "#6b4f36", // botines marrones
  I: "#ffffff", // logo en el pecho
  S: "#f1c27d", // piel
  K: "#1b1b1b", // ojos / detalles
  R: "#e6edf2", // banda reflectiva
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
  "...HHHHH....",
  "..HHHHHHH...",
  ".hhhhhhhhhh.",
  "...ZSSSSS...",
  "...SSAKAA...",
  "...SSSSSS...",
  "..UUUUUUU...",
  ".UUUUUUIUU..",
  ".RRRRRRRRR..",
  ".SUUUUUUUS..",
  "..UuUUUuU...",
];

export const WORKER = {
  run1: [...H, "..UUU.UUU...", "..RR...RR...", ".UU.....UU..", ".TT.....TT..", "............"],
  run2: [...H, "...UUUUU....", "...RR.RR....", "...UU.UU....", "...TT.TTT...", "............"],
  jump: [...H, "..UUU.UUU...", ".RR.....RR..", ".TT.....TT..", "............", "............"],
  duck: [
    "....HHHHH.......",
    "...HHHHHHH......",
    "..hhhhhhhhhh....",
    "....SSAKAS......",
    "..UUUUUUUIUUU...",
    ".SRRRRRRRRRRRS..",
    "..UUUUUUUUUUUU..",
    "..RR.......RRR..",
    "..TT.......TTT..",
    "................",
  ],
  hit: [
    "...HHHHH....",
    "..HHHHHHH...",
    ".hhhhhhhhhh.",
    "...ZSSSSS...",
    "...SKSSKS...",
    "...SSKKSS...",
    ".SUUUUUUUS..",
    ".URRRRRRRU..",
    "..UUUUUUU...",
    "..UuUUUuU...",
    "..UUU.UUU...",
    "..RR...RR...",
    "..UU...UU...",
    "..TT...TT...",
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

/**
 * Pre-dibuja un sprite en un canvas chico (se reutiliza en cada cuadro).
 * Con `outline`, agrega un contorno de 1px (el canvas queda 2px más grande y se dibuja desplazado -1,-1).
 */
export function bake(rows: string[], palette = PALETTE, recolor?: Record<string, string>, outline?: string): HTMLCanvasElement {
  const o = outline ? 1 : 0;
  const w = Math.max(...rows.map((r) => r.length));
  const c = document.createElement("canvas");
  c.width = w + o * 2;
  c.height = rows.length + o * 2;
  const g = c.getContext("2d")!;
  const filled = (x: number, y: number) => y >= 0 && y < rows.length && x >= 0 && x < rows[y].length && rows[y][x] !== ".";
  if (outline) {
    g.fillStyle = outline;
    for (let y = -1; y <= rows.length; y++)
      for (let x = -1; x <= w; x++)
        if (!filled(x, y) && (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1))) g.fillRect(x + o, y + o, 1, 1);
  }
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === ".") return;
      g.fillStyle = recolor?.[ch] ?? palette[ch] ?? "#ff00ff";
      g.fillRect(x + o, y + o, 1, 1);
    }),
  );
  return c;
}
