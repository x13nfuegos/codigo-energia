import { arDate, generateBrief, yesterdayAR } from "./ai";
import { refreshIndicators } from "./indicators";
import { checkBriefVideo, generateBriefAudio, requestBriefVideo } from "./media";
import { runScrape } from "./scraper";
import { getStore } from "./store";

/** Genera el resumen de ayer (texto + audio + video) si todavía no existe. */
export async function runDailyBrief(force = false) {
  const store = await getStore();
  const settings = await store.getSettings();
  const date = yesterdayAR();
  let brief = await store.get("briefs", date);
  const log: string[] = [];
  if (!brief || force) {
    brief = await generateBrief(date);
    log.push(`resumen ${date} generado`);
  }
  if (settings.brief_audio && !brief.audio_url && process.env.ELEVENLABS_API_KEY) {
    try {
      await generateBriefAudio(brief);
      log.push("audio generado");
    } catch (e) {
      log.push(`audio: ${(e as Error).message}`);
    }
  }
  if (settings.brief_video && !brief.video_id && !brief.video_url && process.env.HEYGEN_API_KEY) {
    try {
      await requestBriefVideo(brief);
      log.push("video solicitado a HeyGen");
    } catch (e) {
      log.push(`video: ${(e as Error).message}`);
    }
  }
  return { date, log };
}

/** Revisa videos pendientes de HeyGen. */
export async function checkPendingVideos() {
  const store = await getStore();
  const pending = (await store.list("briefs")).filter((b) => b.video_status === "processing");
  return Promise.all(pending.map(async (b) => ({ id: b.id, status: await checkBriefVideo(b) })));
}

let running = false;

/**
 * Actualización "perezosa": cada visita revisa si pasó el intervalo configurado
 * y, si corresponde, dispara scrapeo / indicadores / resumen en segundo plano.
 * Complementa (o reemplaza, en planes sin cron frecuente) a /api/cron/*.
 */
export async function maybeRefresh() {
  if (running) return;
  running = true;
  try {
    const store = await getStore();
    const s = await store.getSettings();
    const ago = (iso?: string | null) => (iso ? (Date.now() - new Date(iso).getTime()) / 60000 : Infinity);
    const tasks: Promise<unknown>[] = [];
    if (ago(s.last_indicators_at) >= s.indicators_every_min) tasks.push(refreshIndicators({ fast: true }));
    if (ago(s.last_scrape_at) >= s.scrape_every_min) tasks.push(runScrape());
    await Promise.allSettled(tasks);

    const hourAR = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Argentina/Buenos_Aires", hour: "numeric", hourCycle: "h23" }).format(new Date()));
    if ((process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY) && hourAR >= s.brief_hour && !(await store.get("briefs", yesterdayAR()))) {
      await runDailyBrief().catch(() => undefined);
    }
    await checkPendingVideos().catch(() => undefined);
  } finally {
    running = false;
  }
}

export { arDate };
