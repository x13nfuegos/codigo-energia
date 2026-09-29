import { Flash, type FlashParams } from "@/components/admin/Flash";
import { Submit } from "@/components/admin/Submit";
import { getStore } from "@/lib/store";
import { saveSettings } from "../../actions";

export default async function Ajustes({ searchParams }: { searchParams: FlashParams }) {
  const s = await (await getStore()).getSettings();
  const text = (name: keyof typeof s, label: string, help?: string) => (
    <label className="field">
      {label}
      <input name={name} defaultValue={String(s[name] ?? "")} className="input" />
      {help && <span className="text-xs text-dim">{help}</span>}
    </label>
  );
  const check = (name: keyof typeof s, label: string) => (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={!!s[name]} className="h-4 w-4 accent-[var(--color-accent)]" />
      {label}
    </label>
  );
  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold">Ajustes</h1>
      <Flash {...(await searchParams)} />
      <form action={saveSettings} className="space-y-8">
        <fieldset className="card grid gap-4 p-5 md:grid-cols-2">
          <legend className="px-2 font-bold">Identidad</legend>
          {text("site_name", "Nombre del medio")}
          {text("tagline", "Bajada")}
          <label className="field md:col-span-2">
            Descripción (SEO)
            <textarea name="description" defaultValue={s.description} rows={2} className="input" />
          </label>
          <label className="field">
            Color de acento
            <input type="color" name="accent" defaultValue={s.accent} className="h-10 w-20 rounded border border-line bg-transparent" />
          </label>
          {text("footer_text", "Texto del pie")}
          <div className="md:col-span-2">{check("ticker_enabled", "Mostrar la cinta de cotizaciones")}</div>
        </fieldset>

        <fieldset className="card grid gap-4 p-5">
          <legend className="px-2 font-bold">Secciones</legend>
          <label className="field">
            Una por línea: <code>slug | Nombre | color de fondo | color de texto</code>
            <textarea
              name="categories"
              rows={7}
              className="input font-mono text-sm"
              defaultValue={s.categories.map((c) => `${c.slug} | ${c.name} | ${c.color} | ${c.text}`).join("\n")}
            />
          </label>
          <label className="field">
            Redes (una por línea: <code>Nombre | URL</code>)
            <textarea name="social" rows={3} className="input font-mono text-sm" defaultValue={s.social.map((x) => `${x.name} | ${x.url}`).join("\n")} />
          </label>
        </fieldset>

        <fieldset className="card grid gap-4 p-5 md:grid-cols-3">
          <legend className="px-2 font-bold">Automatización</legend>
          {text("scrape_every_min", "Scrapear cada (min)")}
          {text("indicators_every_min", "Indicadores cada (min)")}
          {text("retention_days", "Conservar notas (días)", "0 = para siempre")}
          <div className="md:col-span-3">{check("ai_rewrite_auto", "Reescribir con IA las notas nuevas (copete + cuerpo propio, hasta 5 por corrida)")}</div>
        </fieldset>

        <fieldset className="card grid gap-4 p-5 md:grid-cols-3">
          <legend className="px-2 font-bold">Resumen diario</legend>
          {text("brief_hour", "Hora de publicación (0-23, Argentina)")}
          <div className="flex flex-col justify-end gap-2 md:col-span-2">
            {check("brief_audio", "Generar audio (ElevenLabs)")}
            {check("brief_video", "Generar video con avatar (HeyGen)")}
          </div>
          <label className="field md:col-span-3">
            Instrucciones para la IA (línea editorial del resumen)
            <textarea name="brief_prompt" defaultValue={s.brief_prompt} rows={6} className="input text-sm" />
          </label>
        </fieldset>
        <Submit>Guardar ajustes</Submit>
      </form>
    </div>
  );
}
