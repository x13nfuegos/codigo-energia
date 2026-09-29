import { NextResponse, type NextRequest } from "next/server";
import { refreshIndicators } from "@/lib/indicators";
import { checkPendingVideos, runDailyBrief } from "@/lib/jobs";
import { runScrape } from "@/lib/scraper";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const bearer = req.headers.get("authorization") === `Bearer ${secret}`;
  return bearer || req.nextUrl.searchParams.get("key") === secret;
}

/**
 * Tareas programadas. Vercel Cron manda "Authorization: Bearer $CRON_SECRET".
 * Desde otro programador (cron-job.org, GitHub Actions) se puede usar ?key=$CRON_SECRET.
 *   /api/cron/scrape      scrapear fuentes
 *   /api/cron/indicators  actualizar cotizaciones
 *   /api/cron/daily       generar el resumen de ayer (texto, audio, video)
 *   /api/cron/videos      revisar videos pendientes de HeyGen
 *   /api/cron/all         todo lo anterior
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ job: string }> }) {
  if (!authorized(req)) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const { job } = await params;
  const out: Record<string, unknown> = {};
  try {
    if (job === "indicators" || job === "all") out.indicators = await refreshIndicators();
    if (job === "scrape" || job === "all") out.scrape = await runScrape();
    if (job === "daily" || job === "all") out.daily = await runDailyBrief(req.nextUrl.searchParams.get("force") === "1");
    if (job === "videos" || job === "all") out.videos = await checkPendingVideos();
    if (!Object.keys(out).length) return NextResponse.json({ error: `tarea desconocida: ${job}` }, { status: 404 });
    return NextResponse.json({ ok: true, ...out });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e), ...out }, { status: 500 });
  }
}
