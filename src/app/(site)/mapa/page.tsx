import { SectionTitle } from "@/components/Cards";
import { MapLoader } from "@/components/MapLoader";
import { getMapData } from "@/lib/map-data";

export const metadata = {
  title: "El mapa de la energía",
  description: "Noticias geolocalizadas, yacimientos, ductos, centrales y proyectos mineros de la Argentina.",
};

export default async function Mapa({ searchParams }: { searchParams: Promise<{ nota?: string }> }) {
  const { nota } = await searchParams;
  const data = await getMapData();
  return (
    <div>
      <SectionTitle title="El mapa de la energía" />
      <p className="mb-6 max-w-3xl text-muted">
        Cada noticia aparece donde ocurre. Sumá las capas oficiales del SIG de la Secretaría de Energía (ductos, plantas) desde el
        control de capas, filtrá la infraestructura por tipo y tocá un punto para ver el detalle.
      </p>
      <MapLoader {...data} height={640} focus={nota ?? null} showList />
    </div>
  );
}
