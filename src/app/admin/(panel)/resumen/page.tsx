import Link from "next/link";
import { CrudList } from "@/components/admin/CrudList";
import { Flash, type FlashParams } from "@/components/admin/Flash";
import { Submit } from "@/components/admin/Submit";
import { SCHEMAS } from "@/lib/admin-schema";
import { dateTime } from "@/lib/format";
import { getStore } from "@/lib/store";
import { briefMedia, checkVideo, generateBriefNow } from "../../actions";

export default async function Resumen({ searchParams }: { searchParams: FlashParams }) {
  const store = await getStore();
  const [settings, briefs] = await Promise.all([store.getSettings(), store.list("briefs")]);
  const sorted = briefs.sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="max-w-4xl">
      <h1 className="mb-2 text-2xl font-bold">Resumen diario</h1>
      <p className="mb-4 text-sm text-muted">
        Todos los días a partir de las {settings.brief_hour} h Claude arma el resumen de lo que pasó ayer con las notas publicadas.
        Después se genera la locución (ElevenLabs) y, si está activado, un video con avatar (HeyGen). También podés pegar la URL
        de un video que hayas hecho a mano. El prompt y los horarios se configuran en Ajustes.
      </p>
      <div className="mb-6 flex flex-wrap gap-2">
        <form action={generateBriefNow.bind(null, false)}><Submit>Generar resumen de ayer</Submit></form>
        <form action={generateBriefNow.bind(null, true)}>
          <Submit className="btn" confirm="Se reescribe el resumen de ayer y se descartan audio y video generados. ¿Seguir?">Regenerar</Submit>
        </form>
      </div>
      <Flash {...(await searchParams)} />
      {!sorted.length && <p className="text-muted">Todavía no hay resúmenes.</p>}
      <CrudList
        table="briefs"
        rows={sorted as never}
        fields={SCHEMAS.briefs!}
        settings={settings}
        path="/admin/resumen"
        newLabel="Resumen manual"
        newDefaults={{ title: "", bullets: [] }}
        summary={(r) => {
          const b = r as unknown as (typeof sorted)[number];
          return (
            <div>
              <span className="font-mono text-sm text-dim">{b.date}</span> <span className="font-semibold">{b.title}</span>
              <div className="text-xs text-dim">
                creado {b.created_at ? dateTime(b.created_at) : ""} · audio: {b.audio_url ? "sí" : "no"} · video: {b.video_url ? "sí" : b.video_status ?? "no"}
              </div>
            </div>
          );
        }}
        extra={(r) => {
          const b = r as unknown as (typeof sorted)[number];
          return (
            <div className="flex flex-wrap gap-1.5">
              <Link href={`/resumen/${b.id}`} target="_blank" className="btn">Ver ↗</Link>
              <form action={briefMedia.bind(null, b.id, "audio")}><Submit className="btn">{b.audio_url ? "Rehacer audio" : "Generar audio"}</Submit></form>
              <form action={briefMedia.bind(null, b.id, "video")}><Submit className="btn">Video HeyGen</Submit></form>
              {b.video_status === "processing" && <form action={checkVideo.bind(null, b.id)}><Submit className="btn">Revisar video</Submit></form>}
            </div>
          );
        }}
      />
    </div>
  );
}
