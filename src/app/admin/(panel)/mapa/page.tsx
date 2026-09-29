import { CrudList } from "@/components/admin/CrudList";
import { Flash, type FlashParams } from "@/components/admin/Flash";
import { Submit } from "@/components/admin/Submit";
import { MapLoader } from "@/components/MapLoader";
import { SCHEMAS } from "@/lib/admin-schema";
import { getMapData } from "@/lib/map-data";
import { POINT_TYPES } from "@/lib/map-types";
import { getStore } from "@/lib/store";
import type { MapLayer } from "@/lib/types";
import { deleteMapLayer, geotagNow, saveMapLayer } from "../../actions";
import { WmsExplorer } from "./WmsExplorer";

const SE_WMS = "https://sig.energia.gob.ar/wmsenergia";

function LayerForm({ l }: { l?: MapLayer }) {
  return (
    <form action={saveMapLayer} className="grid gap-3 md:grid-cols-2">
      <input type="hidden" name="id" defaultValue={l?.id ?? ""} />
      <label className="field">Nombre visible<input name="label" defaultValue={l?.label} className="input" /></label>
      <label className="field">Capa (nombre WMS)<input name="layers" defaultValue={l?.layers} className="input font-mono" /></label>
      <label className="field md:col-span-2">URL del servicio WMS<input name="url" defaultValue={l?.url ?? SE_WMS} className="input" /></label>
      <label className="field">Opacidad (0.1 a 1)<input name="opacity" defaultValue={l?.opacity ?? 0.9} className="input" /></label>
      <div className="flex flex-col justify-end gap-2 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="enabled" defaultChecked={l?.enabled ?? true} /> Disponible en el mapa</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="visible" defaultChecked={l?.visible ?? false} /> Encendida al abrir</label>
      </div>
      <div className="md:col-span-2"><Submit>{l ? "Guardar" : "Agregar capa"}</Submit></div>
    </form>
  );
}

export default async function Mapa({ searchParams }: { searchParams: FlashParams }) {
  const store = await getStore();
  const [settings, points, data, geoCount, total] = await Promise.all([
    store.getSettings(),
    store.list("map_points"),
    getMapData(),
    store.countArticles({ status: "all", hasGeo: true }),
    store.countArticles({ status: "all" }),
  ]);
  const layers = settings.map_layers ?? [];
  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="mb-2 text-2xl font-bold">El mapa de la energía</h1>
        <p className="text-sm text-muted">
          El mapa combina tres cosas: las <b>noticias geolocalizadas</b> (se ubican solas según los lugares que mencionan), las
          <b> capas oficiales</b> del SIG de la Secretaría de Energía y los <b>puntos de infraestructura</b> que cargues acá.
        </p>
      </div>
      <Flash {...(await searchParams)} />
      <MapLoader {...data} height={420} />

      <div className="card p-5">
        <h2 className="font-bold">Noticias en el mapa</h2>
        <p className="mt-1 text-sm text-muted">
          {geoCount} de {total} notas tienen ubicación. Las nuevas se ubican al scrapearlas; para corregir una, editala en Notas (campos de ubicación).
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <form action={geotagNow.bind(null, false)}><Submit>Ubicar notas sin ubicación</Submit></form>
          <form action={geotagNow.bind(null, true)}>
            <Submit className="btn" confirm="Se recalculan las ubicaciones automáticas (las cargadas a mano se respetan). ¿Seguir?">Recalcular todas</Submit>
          </form>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="font-bold">Capas oficiales (WMS)</h2>
        {layers.map((l) => (
          <details key={l.id} className="card p-4">
            <summary className="cursor-pointer">
              <span className="font-semibold">{l.label}</span> <span className="font-mono text-xs text-dim">{l.layers}</span>
              {!l.enabled && <span className="text-xs text-dim"> (oculta)</span>}
            </summary>
            <div className="mt-4 border-t border-line pt-4">
              <LayerForm l={l} />
              <form action={deleteMapLayer.bind(null, l.id)} className="mt-3"><Submit className="btn btn-danger" confirm="¿Quitar la capa?">Quitar</Submit></form>
            </div>
          </details>
        ))}
        <details className="card p-4">
          <summary className="cursor-pointer font-semibold text-accent">+ Capa manual</summary>
          <div className="mt-4"><LayerForm /></div>
        </details>
      </div>
      <WmsExplorer defaultUrl={SE_WMS} existing={layers.map((l) => `${l.url}|${l.layers}`)} />

      <div>
        <h2 className="mb-1 font-bold">Puntos de infraestructura</h2>
        <p className="mb-3 text-sm text-muted">Para sacar coordenadas: clic derecho sobre el lugar en Google Maps y copiar los números (latitud, longitud). Los nombres de estos puntos también sirven para ubicar noticias.</p>
        <CrudList
          table="map_points"
          rows={points.sort((a, b) => a.name.localeCompare(b.name)) as never}
          fields={SCHEMAS.map_points!}
          settings={settings}
          path="/admin/mapa"
          newLabel="Nuevo punto"
          newDefaults={{ type: "yacimiento", enabled: true }}
          summary={(r) => {
            const p = r as unknown as (typeof points)[number];
            return (
              <div className={p.enabled ? "" : "opacity-50"}>
                <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: POINT_TYPES[p.type]?.color }} />
                <span className="font-semibold">{p.name}</span>{" "}
                <span className="text-xs text-dim">{POINT_TYPES[p.type]?.label} · {p.province}</span>
              </div>
            );
          }}
        />
      </div>
    </div>
  );
}
