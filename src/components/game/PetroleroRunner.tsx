"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { FLAME, OBSTACLES, PUMPJACK_BASE, WORKER, bake } from "./sprites";

export type Headline = { id: string; title: string; tag: string };

// Resolución lógica (pixel art): el canvas se escala con image-rendering: pixelated
const W = 240;
const H = 84;
const GROUND = 72;
const PX = 24; // x del petrolero
const GRAVITY = 0.26;
const JUMP_V = -4.9;
const BONUS = 25;

type Kind = keyof typeof OBSTACLES;
type Obstacle = { kind: Kind; x: number; y: number; w: number; h: number; passed: boolean };
type Float = { x: number; y: number; t: number; text: string };
type Phase = "ready" | "running" | "over";

const HI_KEY = "ce-runner-hi";
const readHi = () => {
  try {
    return Number(localStorage.getItem(HI_KEY)) || 0;
  } catch {
    return 0;
  }
};

export function PetroleroRunner({ headlines, compact = false }: { headlines: Headline[]; compact?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("ready");
  const [score, setScore] = useState(0);
  const [hi, setHi] = useState(0);
  const [headline, setHeadline] = useState<Headline | null>(null);
  const [chars, setChars] = useState(0);
  const [seen, setSeen] = useState<Headline[]>([]);
  const [sound, setSound] = useState(false);
  const [level, setLevel] = useState(1);

  // estado mutable del juego (fuera de React para no re-renderizar en cada cuadro)
  const g = useRef({
    phase: "ready" as Phase,
    y: GROUND - 16,
    vy: 0,
    ducking: false,
    holdJump: false,
    speed: 1.5,
    level: 1,
    levelBanner: 0,
    dist: 0,
    bonus: 0,
    frame: 0,
    obstacles: [] as Obstacle[],
    floats: [] as Float[],
    nextSpawn: 90,
    hlIndex: 0,
    shake: 0,
  });
  const soundRef = useRef(false);
  soundRef.current = sound;
  const audio = useRef<AudioContext | null>(null);

  const beep = useCallback((freq: number, ms: number, type: OscillatorType = "square") => {
    if (!soundRef.current) return;
    try {
      audio.current ??= new AudioContext();
      const ctx = audio.current;
      const o = ctx.createOscillator();
      const v = ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      v.gain.setValueAtTime(0.05, ctx.currentTime);
      v.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + ms / 1000);
      o.connect(v).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + ms / 1000);
    } catch {
      /* sin audio */
    }
  }, []);

  const start = useCallback(() => {
    const s = g.current;
    Object.assign(s, { phase: "running", y: GROUND - 16, vy: 0, ducking: false, speed: 1.5, level: 1, levelBanner: 0, dist: 0, bonus: 0, frame: 0, obstacles: [], floats: [], nextSpawn: 110, shake: 0 });
    setLevel(1);
    setSeen([]);
    setHeadline(null);
    setScore(0);
    setPhase("running");
  }, []);

  const jump = useCallback(() => {
    const s = g.current;
    if (s.phase !== "running") {
      start();
      return;
    }
    if (s.y >= GROUND - 16 - 0.5 && !s.ducking) {
      s.vy = JUMP_V;
      s.holdJump = true;
      beep(520, 90);
    }
  }, [beep, start]);

  // teclado
  useEffect(() => {
    const inView = () => {
      const r = wrapRef.current?.getBoundingClientRect();
      return !!r && r.bottom > 0 && r.top < window.innerHeight;
    };
    const down = (e: KeyboardEvent) => {
      if (!inView() || (e.target as HTMLElement)?.closest("input, textarea")) return;
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
        e.preventDefault();
        jump();
      } else if (e.code === "ArrowDown" || e.code === "KeyS") {
        e.preventDefault();
        g.current.ducking = true;
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") g.current.holdJump = false;
      if (e.code === "ArrowDown" || e.code === "KeyS") g.current.ducking = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [jump]);

  useEffect(() => setHi(readHi()), []);

  // titular que se tipea al esquivar
  useEffect(() => {
    if (!headline || chars >= headline.title.length) return;
    const t = setTimeout(() => setChars((c) => c + 2), 18);
    return () => clearTimeout(t);
  }, [headline, chars]);

  // bucle del juego
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    const css = getComputedStyle(document.documentElement);
    const col = (v: string, d: string) => css.getPropertyValue(v).trim() || d;
    const C = {
      bg: col("--ce-bg", "#0b0e14"),
      surface: col("--ce-surface-2", "#151a23"),
      line: col("--ce-line", "#1d2430"),
      ink: col("--ce-ink", "#dae2ea"),
      dim: col("--ce-dim", "#5a6672"),
      accent: col("--ce-accent", "#64d264"),
    };
    const light = document.documentElement.dataset.theme === "light";
    const sil = light ? "#aab6c4" : "#27313f";
    const silNear = light ? "#8f9cad" : "#344255";
    const stars = light ? [] : Array.from({ length: 18 }, (_, i) => ({ x: (i * 47) % W, y: 4 + ((i * 13) % 30), tw: i % 3 }));
    // contorno para que el mameluco azul se despegue del fondo
    const edge = light ? "rgba(20,28,45,.55)" : "rgba(220,230,240,.38)";
    const sprites = {
      run1: bake(WORKER.run1, undefined, undefined, edge),
      run2: bake(WORKER.run2, undefined, undefined, edge),
      jump: bake(WORKER.jump, undefined, undefined, edge),
      duck: bake(WORKER.duck, undefined, undefined, edge),
      hit: bake(WORKER.hit, undefined, undefined, edge),
      barrel: bake(OBSTACLES.barrel),
      valve: bake(OBSTACLES.valve),
      cone: bake(OBSTACLES.cone),
      drone: bake(OBSTACLES.drone),
      pump: bake(PUMPJACK_BASE, undefined, { K: silNear }),
      flame: FLAME.map((f) => bake(f)),
    };
    // decorado de fondo (parallax)
    const hills = Array.from({ length: 8 }, (_, i) => ({ x: i * 60, h: 10 + ((i * 37) % 18), w: 70 + ((i * 23) % 40) }));
    const pumps = Array.from({ length: 3 }, (_, i) => ({ x: 60 + i * 140, phase: i * 1.7 }));
    const flares = [{ x: 250 }];
    const specks = Array.from({ length: 40 }, (_, i) => ({ x: (i * 53) % W, y: GROUND + 3 + ((i * 7) % 9) }));

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const STEP = 1000 / 60;

    const spawn = () => {
      const s = g.current;
      const r = Math.random();
      // cada nivel suma variedad: conos y barriles → válvulas → drones → barriles dobles y drones altos
      const kinds: Kind[] = s.level >= 3 ? ["barrel", "valve", "cone", "drone"] : s.level >= 2 ? ["barrel", "valve", "cone"] : ["barrel", "cone"];
      const kind = kinds[Math.floor(r * kinds.length)];
      const spr = sprites[kind];
      const y = kind === "drone" ? GROUND - 22 - (s.level >= 5 && Math.random() < 0.35 ? 16 : 0) : GROUND - spr.height;
      s.obstacles.push({ kind, x: W + 4, y, w: spr.width, h: spr.height, passed: false });
      // a veces un segundo obstáculo pegado (doble barril)
      if (kind === "barrel" && s.level >= 4 && Math.random() < 0.25) s.obstacles.push({ kind, x: W + 4 + spr.width + 1, y, w: spr.width, h: spr.height, passed: false });
      // al principio los obstáculos vienen bien espaciados; se van juntando con el nivel
      s.nextSpawn = Math.max(50, 135 - s.level * 8 + Math.random() * 70);
    };

    const update = () => {
      const s = g.current;
      s.frame++;
      if (s.phase !== "running") return;
      // niveles: cada 250 de energía sube uno; la velocidad acompaña de a poco
      const total = Math.floor(s.dist) + s.bonus;
      const lvl = Math.min(10, 1 + Math.floor(total / 250));
      if (lvl > s.level) {
        s.level = lvl;
        s.levelBanner = 90;
        setLevel(lvl);
        beep(660, 90, "triangle");
        setTimeout(() => beep(990, 140, "triangle"), 110);
      }
      const target = 1.5 + (s.level - 1) * 0.4;
      s.speed += Math.sign(target - s.speed) * Math.min(0.01, Math.abs(target - s.speed));
      s.dist += s.speed / 3;
      // física del salto (mantener apretado = salto más alto)
      const standing = GROUND - 16;
      if (s.y < standing || s.vy < 0) {
        s.vy += s.holdJump && s.vy < 0 ? GRAVITY * 0.55 : GRAVITY;
        if (s.ducking) s.vy += GRAVITY * 1.5; // agacharse en el aire = caer rápido
        s.y += s.vy;
        if (s.y >= standing) {
          s.y = standing;
          s.vy = 0;
        }
      }
      // obstáculos
      s.nextSpawn -= s.speed;
      if (s.nextSpawn <= 0) spawn();
      for (const o of s.obstacles) o.x -= o.kind === "drone" ? s.speed * 1.15 : s.speed;
      s.obstacles = s.obstacles.filter((o) => o.x + o.w > -4);
      // colisión (con margen para que sea justo)
      const ph = s.ducking && s.y >= standing ? 10 : 16;
      const pw = s.ducking && s.y >= standing ? 14 : 9;
      const box = { x: PX + 2, y: s.y + (16 - ph) + 1, w: pw, h: ph - 2 };
      for (const o of s.obstacles) {
        const inset = 2;
        if (box.x < o.x + o.w - inset && box.x + box.w > o.x + inset && box.y < o.y + o.h - inset && box.y + box.h > o.y + inset) {
          s.phase = "over";
          s.shake = 10;
          beep(110, 350, "sawtooth");
          const final = Math.floor(s.dist) + s.bonus;
          setScore(final);
          setPhase("over");
          setHi((h) => {
            const nh = Math.max(h, final);
            try {
              localStorage.setItem(HI_KEY, String(nh));
            } catch {
              /* sin almacenamiento */
            }
            return nh;
          });
          return;
        }
        // esquivado: sumar energía y mostrar un titular
        if (!o.passed && o.x + o.w < PX) {
          o.passed = true;
          s.bonus += BONUS;
          s.floats.push({ x: PX + 6, y: s.y - 4, t: 40, text: `+${BONUS}` });
          beep(880, 70, "triangle");
          if (headlines.length) {
            const h = headlines[s.hlIndex % headlines.length];
            s.hlIndex++;
            setHeadline(h);
            setChars(0);
            setSeen((prev) => (prev.some((x) => x.id === h.id) ? prev : [h, ...prev].slice(0, 12)));
          }
        }
      }
      for (const f of s.floats) {
        f.y -= 0.4;
        f.t--;
      }
      s.floats = s.floats.filter((f) => f.t > 0);
      if (s.frame % 6 === 0) setScore(Math.floor(s.dist) + s.bonus);
    };

    const draw = () => {
      const s = g.current;
      ctx.save();
      if (s.shake > 0) {
        ctx.translate((Math.random() - 0.5) * s.shake * 0.4, (Math.random() - 0.5) * s.shake * 0.4);
        s.shake--;
      }
      // cielo
      const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
      sky.addColorStop(0, C.bg);
      sky.addColorStop(1, C.surface);
      ctx.fillStyle = sky;
      ctx.fillRect(-4, -4, W + 8, H + 8);
      // estrellas titilando (variantes oscuras)
      for (const st of stars) {
        if ((s.frame / 30 + st.tw) % 3 < 2.4) {
          ctx.fillStyle = C.dim;
          ctx.fillRect(st.x, st.y, 1, 1);
        }
      }
      const scroll = s.phase === "running" ? s.speed : 0.3;
      // cerros (lejos)
      ctx.fillStyle = sil;
      for (const hl of hills) {
        hl.x -= scroll * 0.15;
        if (hl.x + hl.w < 0) hl.x += 8 * 60;
        ctx.beginPath();
        ctx.moveTo(Math.round(hl.x), GROUND);
        ctx.lineTo(Math.round(hl.x + hl.w * 0.3), GROUND - hl.h);
        ctx.lineTo(Math.round(hl.x + hl.w * 0.7), GROUND - hl.h + 3);
        ctx.lineTo(Math.round(hl.x + hl.w), GROUND);
        ctx.fill();
      }
      // balancines que cabecean y antorchas
      for (const p of pumps) {
        p.x -= scroll * 0.35;
        if (p.x < -30) p.x += 420;
        const bx = Math.round(p.x);
        ctx.drawImage(sprites.pump, bx, GROUND - 8);
        const a = Math.sin(s.frame / 22 + p.phase) * 0.35;
        ctx.save();
        ctx.translate(bx + 11, GROUND - 8);
        ctx.rotate(a);
        ctx.fillStyle = silNear;
        ctx.fillRect(-12, -2, 22, 2);
        ctx.fillRect(9, -4, 3, 6); // cabeza del balancín
        ctx.restore();
        ctx.fillStyle = silNear;
        ctx.fillRect(bx + 1 + Math.round(a * 6), GROUND - 7 - Math.round(a * 8), 1, 7 + Math.round(a * 8));
      }
      for (const f of flares) {
        f.x -= scroll * 0.35;
        if (f.x < -10) f.x += 380;
        const fx = Math.round(f.x);
        ctx.fillStyle = silNear;
        ctx.fillRect(fx + 2, GROUND - 22, 1, 22);
        ctx.drawImage(sprites.flame[Math.floor(s.frame / 8) % 2], fx, GROUND - 27);
      }
      // suelo
      ctx.fillStyle = C.line;
      ctx.fillRect(0, GROUND, W, 1);
      ctx.fillStyle = C.dim;
      for (const sp of specks) {
        sp.x -= scroll;
        if (sp.x < 0) sp.x += W;
        ctx.fillRect(Math.round(sp.x), sp.y, sp.y % 3 === 0 ? 2 : 1, 1);
      }
      // obstáculos
      for (const o of s.obstacles) {
        const spr = sprites[o.kind];
        if (o.kind === "drone" && Math.floor(s.frame / 4) % 2) {
          ctx.drawImage(spr, 0, 1, spr.width, spr.height - 1, Math.round(o.x), Math.round(o.y) + 1, spr.width, spr.height - 1);
        } else ctx.drawImage(spr, Math.round(o.x), Math.round(o.y));
      }
      // petrolero
      const standing = GROUND - 16;
      let spr = sprites.run1;
      if (s.phase === "over") spr = sprites.hit;
      else if (s.y < standing) spr = sprites.jump;
      else if (s.ducking) spr = sprites.duck;
      else if (s.phase === "running") spr = Math.floor(s.frame / 6) % 2 ? sprites.run1 : sprites.run2;
      // los sprites del petrolero tienen 1px de contorno: se dibujan desplazados
      const py = spr === sprites.duck ? GROUND - (spr.height - 2) : Math.round(s.y);
      ctx.drawImage(spr, PX - 1, py - 1);
      // puntos flotantes
      ctx.fillStyle = C.accent;
      ctx.font = "bold 6px monospace";
      for (const f of s.floats) {
        ctx.globalAlpha = Math.min(1, f.t / 20);
        ctx.fillText(f.text, Math.round(f.x), Math.round(f.y));
      }
      ctx.globalAlpha = 1;
      // cartel de nivel
      if (s.levelBanner > 0 && s.phase === "running") {
        s.levelBanner--;
        ctx.globalAlpha = Math.min(1, s.levelBanner / 25);
        ctx.fillStyle = C.accent;
        ctx.font = "bold 10px monospace";
        const txt = `NIVEL ${s.level}`;
        ctx.fillText(txt, Math.round(W / 2 - ctx.measureText(txt).width / 2), 30);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    };

    const loop = (now: number) => {
      acc += Math.min(100, now - last);
      last = now;
      while (acc >= STEP) {
        update();
        acc -= STEP;
      }
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    // pausa si la pestaña no está visible
    const vis = () => {
      last = performance.now();
    };
    document.addEventListener("visibilitychange", vis);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [beep, headlines]);

  const pad = (n: number) => String(n).padStart(6, "0");
  const btn = "flex-1 select-none rounded-lg border border-line bg-surface-2 py-3 font-mono text-sm font-bold active:bg-accent active:text-accent-ink";

  return (
    <div ref={wrapRef} className="overflow-hidden rounded-xl border border-line bg-surface font-mono">
      <div className="flex items-center gap-2 border-b border-line bg-surface-2 px-4 py-2.5 text-[0.7rem] uppercase tracking-[0.15em] sm:text-xs">
        <b className="whitespace-nowrap text-accent">
          Petrolero<span className="hidden sm:inline"> Runner</span>
        </b>
        <span className="hidden text-dim sm:inline">— esquivá obstáculos, sumá energía</span>
        <span className="ml-auto whitespace-nowrap text-accent">NV {level}</span>
        <span className="whitespace-nowrap tabular-nums text-ink">⚡ {pad(score)}</span>
        <span className="whitespace-nowrap tabular-nums text-dim">HI {pad(Math.max(hi, score))}</span>
        <button onClick={() => setSound(!sound)} className="px-1 text-dim hover:text-accent" aria-label={sound ? "Silenciar" : "Activar sonido"}>
          {sound ? "🔊" : "🔈"}
        </button>
      </div>

      {/* titular del último obstáculo esquivado */}
      <div className="min-h-[3.2rem] border-b border-line px-4 py-2 text-sm">
        {headline ? (
          <p className="line-clamp-2 font-bold leading-snug">
            <span className="mr-2 font-normal text-accent">&lt;{headline.tag}/&gt;</span>
            {headline.title.slice(0, chars)}
            {chars < headline.title.length && <span className="caret" />}
          </p>
        ) : (
          <p className="text-dim">Cada obstáculo que esquivás titula una noticia de hoy.</p>
        )}
      </div>

      <div
        className="relative cursor-pointer touch-none select-none"
        onPointerDown={(e) => {
          e.preventDefault();
          jump();
        }}
        onPointerUp={() => (g.current.holdJump = false)}
      >
        <canvas ref={canvasRef} width={W} height={H} className="block w-full" style={{ imageRendering: "pixelated", aspectRatio: `${W} / ${H}` }} aria-label="Juego Petrolero Runner" />
        {phase !== "running" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-bg/55 text-center backdrop-blur-[1px]">
            {phase === "over" ? (
              <>
                <div className="text-lg font-bold text-accent sm:text-2xl">¡PARADA DE PLANTA!</div>
                <div className="text-sm text-ink">
                  Energía generada: <b>{score}</b> {score >= hi && score > 0 ? "· ¡récord!" : ""}
                </div>
              </>
            ) : (
              <div className="text-lg font-bold sm:text-2xl">
                <span className="text-dim">&lt;</span>
                <span className="text-accent">jugar</span>
                <span className="text-dim">/&gt;</span>
              </div>
            )}
            <div className="text-xs text-muted">{phase === "over" ? "Tocá o apretá espacio para reintentar" : "Tocá la pantalla o apretá espacio para empezar"}</div>
            {!compact && <div className="hidden text-[0.7rem] text-dim sm:block">Saltar: espacio / ↑ · Agacharse: ↓ (para los drones)</div>}
          </div>
        )}
      </div>

      {/* controles táctiles */}
      <div className="flex gap-2 border-t border-line p-2 sm:hidden">
        <button
          className={btn}
          onPointerDown={(e) => {
            e.preventDefault();
            jump();
          }}
          onPointerUp={() => (g.current.holdJump = false)}
        >
          ▲ SALTAR
        </button>
        <button
          className={btn}
          onPointerDown={(e) => {
            e.preventDefault();
            g.current.ducking = true;
          }}
          onPointerUp={() => (g.current.ducking = false)}
          onPointerLeave={() => (g.current.ducking = false)}
        >
          ▼ AGACHARSE
        </button>
      </div>

      {phase === "over" && seen.length > 0 && (
        <div className="border-t border-line px-4 py-3">
          <div className="mb-2 text-[0.7rem] uppercase tracking-[0.15em] text-dim">Los titulares que esquivaste</div>
          <ul className="space-y-1.5 font-sans text-sm">
            {seen.slice(0, compact ? 3 : 8).map((h) => (
              <li key={h.id}>
                <Link href={`/nota/${h.id}`} className="hover:text-accent hover:underline">
                  <span className="font-mono text-xs text-accent">&lt;{h.tag}/&gt;</span> {h.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
