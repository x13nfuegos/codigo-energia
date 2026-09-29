import { CrudList } from "@/components/admin/CrudList";
import { Flash, type FlashParams } from "@/components/admin/Flash";
import { MapLoader } from "@/components/MapLoader";
import { SCHEMAS } from "@/lib/admin-schema";
import { POINT_TYPES } from "@/lib/map-types";
import { getStore } from "@/lib/store";

export default async function Mapa({ searchParams }: { searchParams: FlashParams }) {
  const store = await getStore();
  const [settings, points] = await Promise.all([store.getSettings(), store.list("map_points")]);
  return (
    <div className="max-w-5xl">
      <h1 className="mb-2 text-2xl font-bold">Mapa interactivo</h1>
      <p className="mb-6 text-sm text-muted">Para sacar coordenadas: clic derecho sobre el lugar en Google Maps y copiar los números (latitud, longitud).</p>
      <Flash {...(await searchParams)} />
      <div className="mb-6">
        <MapLoader points={points.filter((p) => p.enabled)} height={380} />
      </div>
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
  );
}
