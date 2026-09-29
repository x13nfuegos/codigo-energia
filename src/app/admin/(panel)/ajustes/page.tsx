import { Flash, type FlashParams } from "@/components/admin/Flash";
import { Submit } from "@/components/admin/Submit";
import { Logo } from "@/components/Logo";
import { THEMES, type ThemeId } from "@/lib/themes";
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
        <fieldset className="card p-5">
          <legend className="px-2 font-bold">Variante de identidad</legend>
          <p className="mb-4 text-sm text-muted">
            Las cinco propuestas de la identidad visual. Para mostrarlas sin cambiar el sitio, compartí los links de vista previa
            (la variante queda activa durante esa visita; <code>?tema=off</code> vuelve a la oficial).
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(Object.keys(THEMES) as ThemeId[]).map((id) => (
              <label key={id} className="cursor-pointer">
                <input type="radio" name="theme" value={id} defaultChecked={s.theme === id} className="peer sr-only" />
                <div data-theme={id} className="rounded-lg border-2 border-transparent bg-bg p-4 peer-checked:border-accent peer-focus-visible:border-accent" style={{ outline: "1px solid var(--color-line)" }}>
                  <Logo className="text-base" />
                  <div className="mt-2 font-mono text-[0.65rem] text-accent-soft">noticias del subsuelo</div>
                  <div className="mt-3 flex items-center gap-2 font-mono text-xs">
                    <span className="font-bold text-accent">{THEMES[id].label}</span>
                    <a href={`/?tema=${id}`} target="_blank" className="ml-auto text-dim underline hover:text-ink">vista previa ↗</a>
                  </div>
                  <p className="mt-1 text-xs text-muted">{THEMES[id].description}</p>
                </div>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="card grid gap-4 p-5 md:grid-cols-2">
          <legend className="px-2 font-bold">Identidad</legend>
          {text("site_name", "Nombre del medio")}
          {text("tagline", "Bajada")}
          <label className="field md:col-span-2">
            Descripción (SEO)
            <textarea name="description" defaultValue={s.description} rows={2} className="input" />
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
