import Link from "next/link";
import { Flash, type FlashParams } from "@/components/admin/Flash";
import { Submit } from "@/components/admin/Submit";
import { dateTime } from "@/lib/format";
import { DEFAULT_INSTAGRAM, igAccount, igCandidates, igConfigured } from "@/lib/instagram";
import { getStore } from "@/lib/store";
import { publishToInstagram, saveInstagram } from "../../actions";

export const maxDuration = 60;

export default async function InstagramAdmin({ searchParams }: { searchParams: FlashParams }) {
  const store = await getStore();
  const ig = { ...DEFAULT_INSTAGRAM, ...(await store.getSettings()).instagram };
  const configured = igConfigured();
  const account = configured ? await igAccount().catch((e: Error) => ({ error: e.message })) : null;
  const candidates = await igCandidates(6);
  const okToday = ig.posts.filter((p) => p.ok && Date.now() - new Date(p.at).getTime() < 86400000).length;

  return (
    <div className="max-w-5xl space-y-6">
      <h1 className="text-2xl font-bold">Instagram</h1>
      <Flash {...(await searchParams)} />

      <div className="card p-5">
        <h2 className="font-bold">Cuenta</h2>
        {!configured ? (
          <div className="mt-2 space-y-2 text-sm text-muted">
            <p className="text-amber-300">Todavía no está conectada.</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>La cuenta de Instagram tiene que ser <b>profesional</b> (Empresa o Creador): Instagram → Configuración → Tipo de cuenta.</li>
              <li>
                Entrá a <a className="underline" href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer">developers.facebook.com/apps</a> → Crear app →
                caso de uso <b>“Administrar mensajes y contenido en Instagram”</b>.
              </li>
              <li>En “Configuración de la API con inicio de sesión de Instagram” → <b>Generar token</b> para tu cuenta (acepta el permiso de publicar contenido).</li>
              <li>
                En Vercel → Settings → Environment Variables cargá <code>INSTAGRAM_ACCESS_TOKEN</code> con ese token y hacé Redeploy.
              </li>
            </ol>
          </div>
        ) : account && "error" in account ? (
          <p className="mt-2 text-sm text-red-300">Error de conexión: {account.error}</p>
        ) : (
          account && (
            <p className="mt-2 text-sm">
              Conectada como <b>@{account.username}</b>
              {account.followers != null && <> · {account.followers.toLocaleString("es-AR")} seguidores</>}
              {account.media != null && <> · {account.media} publicaciones</>}
            </p>
          )
        )}
      </div>

      <form action={saveInstagram} className="card grid gap-4 p-5 md:grid-cols-2">
        <h2 className="font-bold md:col-span-2">Publicación automática</h2>
        <label className="flex items-center gap-2 text-sm md:col-span-2">
          <input type="checkbox" name="enabled" defaultChecked={ig.enabled} className="h-4 w-4 accent-[var(--color-accent)]" />
          Publicar solo las noticias más importantes
        </label>
        <label className="field">
          Máximo por día
          <input name="per_day" type="number" min={1} max={25} defaultValue={ig.per_day} className="input" />
        </label>
        <label className="field">
          Horarios (hora argentina, separados por coma)
          <input name="hours" defaultValue={ig.hours.join(", ")} className="input" />
        </label>
        <label className="field md:col-span-2">
          Hashtags fijos
          <input name="hashtags" defaultValue={ig.hashtags} className="input" />
        </label>
        <label className="flex items-center gap-2 text-sm md:col-span-2">
          <input type="checkbox" name="ai_caption" defaultChecked={ig.ai_caption} className="h-4 w-4 accent-[var(--color-accent)]" />
          Escribir el texto del posteo con IA (si no, se usa la bajada de la nota)
        </label>
        <p className="text-xs text-dim md:col-span-2">
          En cada horario se publica la mejor nota de las últimas 36 h (destacadas y más leídas primero), siempre con foto verificada. Hoy: {okToday} de {ig.per_day}.
        </p>
        <div className="md:col-span-2">
          <Submit>Guardar</Submit>
        </div>
      </form>

      <div>
        <h2 className="mb-3 font-bold">Próximas a publicar</h2>
        {!candidates.length && <p className="text-sm text-muted">No hay notas recientes con foto pendientes de publicar.</p>}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {candidates.map((a) => (
            <div key={a.id} className="card overflow-hidden">
              <a href={`/ig/${a.id}`} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/ig/${a.id}`} alt="" loading="lazy" className="aspect-[4/5] w-full bg-surface-2 object-cover" />
              </a>
              <div className="space-y-3 p-3">
                <Link href={`/nota/${a.id}`} target="_blank" className="line-clamp-2 text-sm font-semibold hover:underline">
                  {a.title}
                </Link>
                {configured && (
                  <form action={publishToInstagram.bind(null, a.id)}>
                    <Submit className="btn w-full" confirm="¿Publicar esta nota en Instagram ahora?">
                      Publicar ahora
                    </Submit>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-5">
        <h2 className="font-bold">Historial</h2>
        {!ig.posts.length && <p className="mt-2 text-sm text-muted">Todavía no se publicó nada.</p>}
        <ul className="mt-3 divide-y divide-line text-sm">
          {ig.posts.slice(0, 30).map((p) => (
            <li key={`${p.article_id}-${p.at}`} className="flex flex-wrap items-baseline gap-x-3 py-2">
              <span className={p.ok ? "text-emerald-300" : "text-red-300"}>{p.ok ? "✓" : "✗"}</span>
              <span className="font-mono text-xs text-dim">{dateTime(p.at)}</span>
              <span className="min-w-0 flex-1 truncate">{p.title}</span>
              {p.permalink && (
                <a href={p.permalink} target="_blank" rel="noreferrer" className="text-accent underline">
                  ver ↗
                </a>
              )}
              {p.error && <span className="basis-full text-xs text-red-300">{p.error}</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
