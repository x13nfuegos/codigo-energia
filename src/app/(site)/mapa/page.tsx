import { SectionTitle } from "@/components/Cards";
import { MapLoader } from "@/components/MapLoader";
import { getStore } from "@/lib/store";

export const metadata = { title: "Mapa energético" };

export default async function Mapa() {
  const points = (await (await getStore()).list("map_points")).filter((p) => p.enabled);
  return (
    <div>
      <SectionTitle title="Mapa energético de la Argentina" />
      <p className="mb-6 max-w-3xl text-muted">
        Yacimientos, refinerías, centrales, proyectos mineros y terminales de exportación. Filtrá por tipo y tocá cada punto para ver el detalle.
      </p>
      <MapLoader points={points} height={640} />
    </div>
  );
}
