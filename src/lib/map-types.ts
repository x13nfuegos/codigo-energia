import type { MapLayer, MapPoint, MapPointType } from "./types";

export const POINT_TYPES: Record<MapPointType, { label: string; color: string }> = {
  yacimiento: { label: "Yacimientos", color: "#3b82f6" },
  gasoducto: { label: "Gasoductos / oleoductos", color: "#06b6d4" },
  refineria: { label: "Refinerías", color: "#a855f7" },
  puerto: { label: "Puertos y terminales", color: "#64748b" },
  termica: { label: "Térmicas", color: "#f97316" },
  nuclear: { label: "Nucleares", color: "#facc15" },
  hidro: { label: "Hidroeléctricas", color: "#0ea5e9" },
  eolico: { label: "Eólicos", color: "#22c55e" },
  solar: { label: "Solares", color: "#fbbf24" },
  mina: { label: "Minas", color: "#e11d48" },
  litio: { label: "Litio", color: "#f0abfc" },
};

/** Noticia geolocalizada, lista para el mapa (serializable). */
export interface NewsPin {
  id: string;
  title: string;
  category: string;
  catName: string;
  catColor: string;
  catText: string;
  published_at: string;
  lat: number;
  lng: number;
  place: string;
}

export interface EnergyMapProps {
  points: MapPoint[];
  news: NewsPin[];
  layers: MapLayer[];
  height?: number;
  /** id de nota a enfocar al abrir */
  focus?: string | null;
  /** muestra la lista lateral de noticias */
  showList?: boolean;
}
