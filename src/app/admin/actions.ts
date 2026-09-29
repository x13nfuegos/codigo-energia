"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SCHEMAS, parseForm } from "@/lib/admin-schema";
import { checkPassword, createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE, verifySessionToken } from "@/lib/auth";
import { refreshIndicators } from "@/lib/indicators";
import { runDailyBrief } from "@/lib/jobs";
import * as cheerio from "cheerio";
import { articleId, fetchSource, fetchText, geotagArticles, runScrape, type RawItem } from "@/lib/scraper";
import { getStore } from "@/lib/store";
import { isTheme, type ThemeId } from "@/lib/themes";
import type { Article, Category, MapLayer, PodcastEpisode, Settings, Source, TableName, Tables } from "@/lib/types";

async function requireAdmin() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!(await verifySessionToken(token))) redirect("/admin/login");
}

function back(path: string, msg: string, error = false): never {
  revalidatePath("/", "layout");
  redirect(`${path}${path.includes("?") ? "&" : "?"}${error ? "err" : "msg"}=${encodeURIComponent(msg)}`);
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

// ---------- sesión ----------

export async function login(_: string | null, fd: FormData): Promise<string | null> {
  if (!process.env.ADMIN_PASSWORD) return "Falta configurar ADMIN_PASSWORD en las variables de entorno.";
  if (!(await checkPassword(String(fd.get("password") ?? "")))) return "Contraseña incorrecta.";
  (await cookies()).set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  const next = String(fd.get("next") || "/admin");
  redirect(next.startsWith("/admin") ? next : "/admin");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/admin/login");
}

// ---------- CRUD genérico ----------

const DEFAULTS: Partial<Record<TableName, Record<string, unknown>>> = {
  sources: { last_run_at: null, last_status: null, last_count: null },
  indicators: { history: [] },
  articles: { tags: [], views: 0 },
};

export async function saveEntity(table: TableName, returnTo: string, fd: FormData) {
  await requireAdmin();
  const fields = SCHEMAS[table];
  if (!fields) throw new Error("Tabla no editable");
  let id = String(fd.get("id") || "");
  try {
    const data = parseForm(fields, fd);
    const store = await getStore();
    if (table === "briefs" && typeof data.bullets === "string") {
      data.bullets = data.bullets.split("\n").map((l) => l.replace(/^[-•▸*]\s*/, "").trim()).filter(Boolean);
    }
    if (table === "briefs" && data.video_url) data.video_status = "manual";
    if (table === "articles") {
      data.url ??= "";
      const g = data.geo as { lat: number | null; lng: number | null; place: string | null } | undefined;
      const prev = id ? ((await store.get("articles", id))?.geo ?? null) : null;
      if (g?.lat == null || g?.lng == null) data.geo = null;
      else {
        const changed = !prev || prev.lat !== g.lat || prev.lng !== g.lng || prev.place !== (g.place ?? "");
        data.geo = { lat: g.lat, lng: g.lng, place: g.place ?? "", manual: changed ? true : !!prev?.manual };
      }
    }
    if (table === "sections" && data.columns) data.columns = Number(data.columns);
    if (table === "sources") {
      const sel = data.selectors as Record<string, string | null> | undefined;
      if (!sel?.item) data.selectors = null;
    }
    const existing = id ? await store.get(table, id) : null;
    if (!existing) {
      if (table === "articles") {
        data.published_at ??= new Date().toISOString();
        id ||= data.url ? articleId(String(data.url)) : `n-${Date.now().toString(36)}`;
        Object.assign(data, { scraped_at: new Date().toISOString(), source_id: null });
      } else if (table === "sections") {
        const all = await store.list("sections");
        data.order = all.length ? Math.max(...all.map((s) => s.order)) + 1 : 0;
      }
      id ||= slugify(String(data.name ?? data.label ?? data.title ?? "")) || `id-${Date.now()}`;
      if (await store.get(table, id)) id = `${id}-${Date.now().toString(36)}`;
    }
    const row = { ...(existing ? {} : DEFAULTS[table] ?? {}), ...(existing ?? {}), ...data, id } as Tables[typeof table];
    await store.upsert(table, [row]);
  } catch (e) {
    back(returnTo, errMsg(e), true);
  }
  back(returnTo, "Guardado");
}

export async function deleteEntity(table: TableName, id: string, returnTo: string) {
  await requireAdmin();
  await (await getStore()).remove(table, id);
  back(returnTo, "Eliminado");
}

// ---------- notas ----------

export async function patchArticle(id: string, patch: Partial<Pick<Article, "status" | "featured" | "category">>, returnTo: string) {
  await requireAdmin();
  await (await getStore()).patch("articles", id, patch);
  back(returnTo, "Nota actualizada");
}

export async function rewriteArticleAction(id: string, returnTo: string) {
  await requireAdmin();
  const store = await getStore();
  const a = await store.get("articles", id);
  if (!a) back(returnTo, "La nota no existe", true);
  try {
    const { rewriteArticle } = await import("@/lib/ai");
    const { TAG_AI } = await import("@/lib/summary");
    const r = await rewriteArticle(a);
    await store.patch("articles", id, { ...r, tags: [...(a.tags ?? []).filter((t) => !t.startsWith("resumen:")), TAG_AI] });
  } catch (e) {
    back(returnTo, errMsg(e), true);
  }
  back(returnTo, "Nota reescrita con IA");
}

// ---------- scraping ----------

export async function scrapeNow(sourceId: string | null, returnTo: string) {
  await requireAdmin();
  let msg = "";
  try {
    const r = await runScrape(sourceId ?? undefined);
    const errors = r.reports.filter((x) => x.error);
    msg = `Scrapeo terminado: ${r.inserted} notas nuevas${errors.length ? `, ${errors.length} fuente(s) con error` : ""}${r.removed ? `, ${r.removed} viejas eliminadas` : ""}.`;
  } catch (e) {
    back(returnTo, errMsg(e), true);
  }
  back(returnTo, msg);
}

export type TestResult = { items?: RawItem[]; error?: string };

export async function testSource(sourceId: string): Promise<TestResult> {
  await requireAdmin();
  const s = await (await getStore()).get("sources", sourceId);
  if (!s) return { error: "Fuente inexistente" };
  try {
    return { items: await fetchSource(s as Source) };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

// ---------- indicadores ----------

export async function refreshIndicatorsNow(returnTo: string, forceOfficial = false) {
  await requireAdmin();
  const r = await refreshIndicators({ forceOfficial });
  const bad = r.filter((x) => !x.ok);
  back(returnTo, bad.length ? `Actualizados con ${bad.length} error(es): ${bad.map((b) => `${b.id} (${b.error})`).join(", ")}` : "Indicadores actualizados", bad.length > 0);
}

// ---------- portada ----------

export async function moveSection(id: string, dir: -1 | 1) {
  await requireAdmin();
  const store = await getStore();
  const list = (await store.list("sections")).sort((a, b) => a.order - b.order);
  const i = list.findIndex((s) => s.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  await store.upsert("sections", list.map((s, k) => ({ ...s, order: k })));
  revalidatePath("/", "layout");
}

export async function toggleSection(id: string, enabled: boolean) {
  await requireAdmin();
  await (await getStore()).patch("sections", id, { enabled });
  revalidatePath("/", "layout");
}

// ---------- resumen diario ----------

export async function generateBriefNow(force: boolean) {
  await requireAdmin();
  let msg = "";
  try {
    const r = await runDailyBrief(force);
    msg = `Resumen ${r.date}: ${r.log.join(", ") || "ya existía"}`;
  } catch (e) {
    back("/admin/resumen", errMsg(e), true);
  }
  back("/admin/resumen", msg);
}

export async function briefMedia(id: string, kind: "audio" | "video") {
  await requireAdmin();
  const store = await getStore();
  const b = await store.get("briefs", id);
  if (!b) back("/admin/resumen", "No existe", true);
  try {
    const m = await import("@/lib/media");
    if (kind === "audio") {
      const r = await (await import("@/lib/jobs")).makeAudio(b);
      if (!r.ok) throw new Error(r.error);
    }
    else await m.requestBriefVideo(b);
  } catch (e) {
    back("/admin/resumen", errMsg(e), true);
  }
  back("/admin/resumen", kind === "audio" ? "Audio generado" : "Video solicitado a HeyGen (tarda unos minutos)");
}

export async function checkVideo(id: string) {
  await requireAdmin();
  const b = await (await getStore()).get("briefs", id);
  if (!b) back("/admin/resumen", "No existe", true);
  const { checkBriefVideo } = await import("@/lib/media");
  const status = await checkBriefVideo(b).catch((e) => `error: ${errMsg(e)}`);
  back("/admin/resumen", `Estado del video: ${status}`);
}

// ---------- ajustes ----------

export async function saveSettings(fd: FormData) {
  await requireAdmin();
  try {
    const str = (k: string) => String(fd.get(k) ?? "").trim();
    const num = (k: string, d: number) => (isFinite(Number(fd.get(k))) && str(k) !== "" ? Number(fd.get(k)) : d);
    const categories: Category[] = str("categories")
      .split("\n")
      .map((l) => l.split("|").map((x) => x.trim()))
      .filter((p) => p[0] && p[1])
      .map(([slug, name, color, text, parent]) => ({ slug: slugify(slug), name, color: color || "#3a3f47", text: text || "#ffffff", parent: parent ? slugify(parent) : "" }));
    if (!categories.length) throw new Error("Tiene que haber al menos una sección");
    const social = str("social")
      .split("\n")
      .map((l) => l.split("|").map((x) => x.trim()))
      .filter((p) => p[0] && p[1])
      .map(([name, url]) => ({ name, url }));
    const patch: Partial<Settings> = {
      site_name: str("site_name") || "Código Energía",
      tagline: str("tagline"),
      description: str("description"),
      theme: isTheme(str("theme")) ? (str("theme") as ThemeId) : "verde",
      footer_text: str("footer_text"),
      ticker_enabled: fd.get("ticker_enabled") === "on",
      scrape_every_min: num("scrape_every_min", 30),
      indicators_every_min: num("indicators_every_min", 15),
      retention_days: num("retention_days", 120),
      ai_rewrite_auto: fd.get("ai_rewrite_auto") === "on",
      brief_prompt: str("brief_prompt"),
      brief_hour: num("brief_hour", 7),
      brief_audio: fd.get("brief_audio") === "on",
      brief_video: fd.get("brief_video") === "on",
      categories,
      social,
    };
    await (await getStore()).saveSettings(patch);
  } catch (e) {
    back("/admin/ajustes", errMsg(e), true);
  }
  back("/admin/ajustes", "Ajustes guardados");
}

// ---------- mapa: geolocalización y capas WMS ----------

export async function geotagNow(force: boolean) {
  await requireAdmin();
  const r = await geotagArticles(force);
  back("/admin/mapa", `Revisadas ${r.checked} notas, ${r.tagged} ubicadas en el mapa`);
}

export async function saveMapLayer(fd: FormData) {
  await requireAdmin();
  const str = (k: string) => String(fd.get(k) ?? "").trim();
  const store = await getStore();
  const layers = [...((await store.getSettings()).map_layers ?? [])];
  const layer: MapLayer = {
    id: str("id") || `capa-${Date.now().toString(36)}`,
    label: str("label") || str("layers"),
    url: str("url"),
    layers: str("layers"),
    enabled: fd.get("enabled") === "on",
    visible: fd.get("visible") === "on",
    opacity: Math.min(1, Math.max(0.1, Number(str("opacity").replace(",", ".")) || 1)),
  };
  if (!layer.url || !layer.layers) back("/admin/mapa", "La capa necesita URL del servicio WMS y nombre de capa", true);
  const i = layers.findIndex((l) => l.id === layer.id);
  if (i >= 0) layers[i] = layer;
  else layers.push(layer);
  await store.saveSettings({ map_layers: layers });
  back("/admin/mapa", "Capa guardada");
}

export async function deleteMapLayer(id: string) {
  await requireAdmin();
  const store = await getStore();
  await store.saveSettings({ map_layers: ((await store.getSettings()).map_layers ?? []).filter((l) => l.id !== id) });
  back("/admin/mapa", "Capa eliminada");
}

export type WmsLayerInfo = { name: string; title: string };

/** Lee el GetCapabilities de un servicio WMS y devuelve sus capas. */
export async function listWmsLayers(url: string): Promise<{ layers?: WmsLayerInfo[]; error?: string }> {
  await requireAdmin();
  try {
    const u = new URL(url);
    u.searchParams.set("service", "WMS");
    u.searchParams.set("request", "GetCapabilities");
    if (!u.searchParams.get("version")) u.searchParams.set("version", "1.3.0");
    const $ = cheerio.load(await fetchText(u.toString(), 25000), { xml: true });
    const layers: WmsLayerInfo[] = [];
    $("Layer").each((_, el) => {
      const name = $(el).children("Name").first().text().trim();
      if (name) layers.push({ name, title: $(el).children("Title").first().text().trim() || name });
    });
    if (!layers.length) return { error: "El servicio no devolvió capas (¿es una URL WMS?)" };
    return { layers };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

export async function addWmsLayer(url: string, name: string, title: string) {
  await requireAdmin();
  const store = await getStore();
  const layers = [...((await store.getSettings()).map_layers ?? [])];
  if (!layers.some((l) => l.url === url && l.layers === name)) {
    layers.push({ id: `capa-${Date.now().toString(36)}`, label: title, url, layers: name, enabled: true, visible: false, opacity: 0.9 });
    await store.saveSettings({ map_layers: layers });
  }
  revalidatePath("/", "layout");
}

/** Vuelve a cargar los contadores oficiales de producción con su configuración por defecto. */
export async function restoreOfficialCounters() {
  await requireAdmin();
  const { OFFICIAL_COUNTERS } = await import("@/lib/defaults");
  const store = await getStore();
  const existing = await store.list("indicators");
  await store.upsert(
    "indicators",
    OFFICIAL_COUNTERS.map((c) => ({ ...c, order: existing.find((e) => e.id === c.id)?.order ?? c.order })),
  );
  // los contadores estimados viejos dejan de mostrarse
  for (const old of existing.filter((e) => e.provider === "counter")) await store.patch("indicators", old.id, { enabled: false });
  const r = await refreshIndicators({ forceOfficial: true });
  const bad = r.filter((x) => !x.ok && OFFICIAL_COUNTERS.some((c) => c.id === x.id));
  back("/admin/indicadores", bad.length ? `Contadores restaurados; no se pudo leer el dato oficial: ${bad[0].error}` : "Contadores oficiales restaurados y actualizados", bad.length > 0);
}

// ---------- podcast ----------

async function podcastState() {
  const { DEFAULT_PODCAST } = await import("@/lib/podcast");
  const store = await getStore();
  return { store, podcast: (await store.getSettings()).podcast ?? DEFAULT_PODCAST };
}

export async function savePodcastInfo(fd: FormData) {
  await requireAdmin();
  const { store, podcast } = await podcastState();
  await store.saveSettings({
    podcast: { ...podcast, title: String(fd.get("title") || podcast.title).trim(), description: String(fd.get("description") ?? "").trim() },
  });
  back("/admin/podcast", "Datos del podcast guardados");
}

export async function saveEpisode(fd: FormData) {
  await requireAdmin();
  const { parseVideo, fetchEpisodeMeta } = await import("@/lib/podcast");
  const { store, podcast } = await podcastState();
  const str = (k: string) => String(fd.get(k) ?? "").trim();
  const url = str("url");
  if (!parseVideo(url)) back("/admin/podcast", "El link no es de Vimeo, YouTube ni un archivo de video/audio", true);
  const id = str("id") || `ep-${Date.now().toString(36)}`;
  const prev = podcast.episodes.find((e) => e.id === id);
  const number = Number(str("number")) || prev?.number || Math.max(0, ...podcast.episodes.map((e) => e.number ?? 0)) + 1;
  let episode: PodcastEpisode = {
    ...(prev ?? {}),
    id,
    url,
    number,
    title: str("title") || prev?.title || `Episodio ${number}`,
    description: str("description") || prev?.description || null,
    published_at: str("published_at") ? new Date(`${str("published_at")}T12:00:00-03:00`).toISOString() : prev?.published_at ?? new Date().toISOString(),
    meta_ok: prev?.url === url ? prev.meta_ok : false,
  };
  // al cargar un link nuevo (o con título/descripción vacíos) se traen los datos del video
  let metaErr = "";
  if (!episode.meta_ok || !str("title") || !str("description")) {
    try {
      const meta = await fetchEpisodeMeta(url);
      episode = {
        ...episode,
        thumbnail: meta.thumbnail ?? episode.thumbnail ?? null,
        duration: meta.duration ?? episode.duration ?? null,
        title: str("title") || meta.title || episode.title,
        description: str("description") || meta.description || null,
        published_at: str("published_at") ? episode.published_at : meta.published_at ?? episode.published_at,
        meta_ok: true,
        meta_tried_at: new Date().toISOString(),
      };
    } catch (e) {
      metaErr = errMsg(e);
      episode = { ...episode, meta_tried_at: new Date().toISOString() };
    }
  }
  const episodes = prev ? podcast.episodes.map((e) => (e.id === id ? episode : e)) : [...podcast.episodes, episode];
  await store.saveSettings({ podcast: { ...podcast, episodes } });
  if (metaErr) back("/admin/podcast", `Episodio guardado, pero no se pudieron leer los datos de Vimeo: ${metaErr}`, true);
  back("/admin/podcast", prev ? "Episodio actualizado" : "Episodio publicado: ya aparece en la playlist");
}

export async function deleteEpisode(id: string) {
  await requireAdmin();
  const { store, podcast } = await podcastState();
  await store.saveSettings({ podcast: { ...podcast, episodes: podcast.episodes.filter((e) => e.id !== id) } });
  back("/admin/podcast", "Episodio eliminado");
}

export async function findMissingPhotos() {
  await requireAdmin();
  const { enrichMissing, verifyPhotos } = await import("@/lib/scraper");
  const fixed = await enrichMissing(40, 25000);
  const v = await verifyPhotos(30, 25000);
  back(
    "/admin/diagnostico",
    `Fotos: ${fixed} notas consiguieron foto · ${v.checked} revisadas, ${v.replaced} reemplazadas, ${v.removed} sin foto válida (no se muestran en la portada)`,
  );
}

export async function applyUpdates() {
  await requireAdmin();
  try {
    const { runAllMigrations } = await import("@/lib/migrations");
    const r = await runAllMigrations();
    revalidatePath("/", "layout");
    back("/admin/diagnostico", `Actualizaciones aplicadas${r.sources ? " (se sumaron fuentes nuevas)" : ""}`);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e; // redirect de Next
    back("/admin/diagnostico", `No se pudieron aplicar: ${errMsg(e)}`, true);
  }
}

export async function makeLatestAudio() {
  await requireAdmin();
  const store = await getStore();
  let [last] = (await store.list("briefs")).sort((a, b) => b.date.localeCompare(a.date));
  if (!last) {
    try {
      last = await (await import("@/lib/ai")).generateBrief();
    } catch (e) {
      back("/admin/diagnostico", `No hay resumen y no se pudo generar: ${errMsg(e)}`, true);
    }
  }
  const r = await (await import("@/lib/jobs")).makeAudio(last);
  back("/admin/diagnostico", r.ok ? `Audio del resumen ${last.date} generado` : `Audio: ${r.error}`, !r.ok);
}

/** Vuelve a leer título, descripción, miniatura y fecha desde Vimeo/YouTube (pisa lo cargado a mano). */
export async function refreshEpisodeMeta(id: string | null) {
  await requireAdmin();
  const { fetchEpisodeMeta, applyMeta } = await import("@/lib/podcast");
  const { store, podcast } = await podcastState();
  const errors: string[] = [];
  let ok = 0;
  const episodes = await Promise.all(
    podcast.episodes.map(async (e) => {
      if (id && e.id !== id) return e;
      try {
        const next = applyMeta(e, await fetchEpisodeMeta(e.url), true);
        ok++;
        return next;
      } catch (err) {
        errors.push(`${e.title}: ${errMsg(err)}`);
        return e;
      }
    }),
  );
  await store.saveSettings({ podcast: { ...podcast, episodes } });
  if (errors.length) back("/admin/podcast", `${ok} actualizados · ${errors.join(" | ")}`, true);
  back("/admin/podcast", ok === 1 ? "Datos leídos desde el video" : `${ok} episodios actualizados desde el video`);
}
