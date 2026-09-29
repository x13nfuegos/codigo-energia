import { SectionTitle } from "@/components/Cards";
import { PetroleroRunner } from "@/components/game/PetroleroRunner";
import { getStore } from "@/lib/store";

export const metadata = {
  title: "Petrolero Runner",
  description: "Esquivá barriles, válvulas y drones, sumá energía y leé los titulares del día.",
};

export default async function Juego() {
  const latest = await (await getStore()).queryArticles({ limit: 40 });
  const headlines = latest.map((a) => ({ id: a.id, title: a.title, tag: a.category.replace(/-/g, "") }));
  return (
    <div className="mx-auto max-w-4xl">
      <SectionTitle title="Petrolero Runner" />
      <p className="-mt-2 mb-6 text-muted">
        Un petrolero en plena jornada en Vaca Muerta. Saltá barriles, válvulas y conos, agachate ante los drones y sumá energía:
        cada obstáculo que esquivás te titula una noticia de hoy.
      </p>
      <PetroleroRunner headlines={headlines} />
    </div>
  );
}
