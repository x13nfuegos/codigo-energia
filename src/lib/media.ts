import { promises as fs } from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { getStore } from "./store";
import { supabaseEnv } from "./store/env";
import type { DailyBrief } from "./types";

/** Guarda un archivo y devuelve su URL pública (Supabase Storage o /public/media en desarrollo). */
export async function saveMedia(name: string, data: ArrayBuffer, contentType: string): Promise<string> {
  const env = supabaseEnv();
  if (env.ok) {
    const sb = createClient(env.url, env.key, { auth: { persistSession: false } });
    const bucket = process.env.SUPABASE_MEDIA_BUCKET || "media";
    const { error } = await sb.storage.from(bucket).upload(name, data, { contentType, upsert: true });
    if (error) throw new Error(`Storage: ${error.message}`);
    return sb.storage.from(bucket).getPublicUrl(name).data.publicUrl;
  }
  const file = path.join(process.cwd(), "public", "media", name);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, Buffer.from(data));
  return `/media/${name}`;
}

/** Locución del resumen con ElevenLabs. */
export async function generateBriefAudio(brief: DailyBrief): Promise<string> {
  const key = process.env.ELEVENLABS_API_KEY;
  // voz por defecto de la biblioteca de ElevenLabs; conviene elegir una en español rioplatense y cargar ELEVENLABS_VOICE_ID
  const voice = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
  if (!key) throw new Error("Falta ELEVENLABS_API_KEY");
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify({ text: brief.script, model_id: "eleven_multilingual_v2" }),
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const url = await saveMedia(`resumen/${brief.id}-${Date.now()}.mp3`, await res.arrayBuffer(), "audio/mpeg");
  await (await getStore()).patch("briefs", brief.id, { audio_url: url });
  return url;
}

/** Pide a HeyGen un video con avatar leyendo el guion. El render es asincrónico. */
export async function requestBriefVideo(brief: DailyBrief): Promise<string> {
  const key = process.env.HEYGEN_API_KEY;
  const avatar = process.env.HEYGEN_AVATAR_ID;
  const voice = process.env.HEYGEN_VOICE_ID;
  if (!key || !avatar || !voice) throw new Error("Faltan HEYGEN_API_KEY / HEYGEN_AVATAR_ID / HEYGEN_VOICE_ID");
  const res = await fetch("https://api.heygen.com/v2/video/generate", {
    method: "POST",
    headers: { "x-api-key": key, "content-type": "application/json" },
    body: JSON.stringify({
      title: `Código Energía — ${brief.date}`,
      video_inputs: [
        {
          character: { type: "avatar", avatar_id: avatar, avatar_style: "normal" },
          voice: { type: "text", input_text: brief.script, voice_id: voice },
        },
      ],
      dimension: { width: 1280, height: 720 },
    }),
    signal: AbortSignal.timeout(30000),
  });
  const json = (await res.json().catch(() => ({}))) as { data?: { video_id?: string }; error?: { message?: string } | string };
  if (!res.ok || !json.data?.video_id) {
    const msg = typeof json.error === "string" ? json.error : json.error?.message;
    throw new Error(`HeyGen ${res.status}: ${msg ?? "sin video_id"}`);
  }
  await (await getStore()).patch("briefs", brief.id, { video_id: json.data.video_id, video_status: "processing", video_url: null });
  return json.data.video_id;
}

/** Consulta el estado del render; cuando termina copia el video a nuestro storage (las URLs de HeyGen vencen). */
export async function checkBriefVideo(brief: DailyBrief): Promise<string | null> {
  const key = process.env.HEYGEN_API_KEY;
  if (!key || !brief.video_id || brief.video_status === "completed" || brief.video_status === "manual") return brief.video_status ?? null;
  const res = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${encodeURIComponent(brief.video_id)}`, {
    headers: { "x-api-key": key },
    signal: AbortSignal.timeout(20000),
  });
  const json = (await res.json().catch(() => ({}))) as { data?: { status?: string; video_url?: string; error?: unknown } };
  const status = json.data?.status ?? "unknown";
  const store = await getStore();
  if (status === "completed" && json.data?.video_url) {
    let url = json.data.video_url;
    try {
      const vid = await fetch(url, { signal: AbortSignal.timeout(120000) });
      if (vid.ok) url = await saveMedia(`resumen/${brief.id}-${Date.now()}.mp4`, await vid.arrayBuffer(), "video/mp4");
    } catch {
      /* se usa la URL de HeyGen mientras tanto */
    }
    await store.patch("briefs", brief.id, { video_status: "completed", video_url: url });
  } else if (status === "failed") {
    await store.patch("briefs", brief.id, { video_status: "failed" });
  }
  return status;
}
