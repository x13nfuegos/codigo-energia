import type { GeoTag, MapPoint } from "./types";

/**
 * Nomenclador para geolocalizar noticias por los lugares que mencionan.
 * weight: 3 = lugar puntual (yacimiento, ciudad, proyecto), 1 = provincia / cuenca, 0.5 = país.
 * Coordenadas aproximadas. Los puntos del mapa cargados en el back office se suman automáticamente.
 */
type Place = { names: string[]; lat: number; lng: number; place: string; weight: number };

const P = (names: string | string[], lat: number, lng: number, place: string, weight = 3): Place => ({
  names: Array.isArray(names) ? names : [names],
  lat,
  lng,
  place,
  weight,
});

export const GAZETTEER: Place[] = [
  // Oil & gas
  P(["Vaca Muerta"], -38.35, -68.79, "Vaca Muerta, Neuquén", 2.5),
  P(["Añelo"], -38.35, -68.79, "Añelo, Neuquén"),
  P(["Rincón de los Sauces"], -37.39, -68.93, "Rincón de los Sauces, Neuquén"),
  P(["Plaza Huincul", "Cutral Có", "Cutral Co"], -38.93, -69.21, "Plaza Huincul, Neuquén"),
  P(["Allen"], -38.98, -67.83, "Allen, Río Negro"),
  P(["Catriel"], -37.88, -67.79, "Catriel, Río Negro"),
  P(["Comodoro Rivadavia"], -45.86, -67.48, "Comodoro Rivadavia, Chubut"),
  P(["Golfo San Jorge"], -46.0, -67.5, "Cuenca del Golfo San Jorge", 2),
  P(["Caleta Olivia"], -46.44, -67.52, "Caleta Olivia, Santa Cruz"),
  P(["Cuenca Austral", "Río Gallegos"], -51.62, -69.22, "Cuenca Austral", 2),
  P(["Cuenca Neuquina"], -38.5, -69.0, "Cuenca Neuquina", 2),
  P(["Cuenca Marina Austral", "Fénix"], -52.9, -67.2, "Cuenca Marina Austral (offshore)", 2),
  P(["Argerich", "CAN 100", "offshore bonaerense", "Mar Argentino"], -38.6, -55.6, "Cuenca Argentina Norte (offshore)", 2),
  P(["Malargüe"], -35.47, -69.58, "Malargüe, Mendoza"),
  P(["Luján de Cuyo"], -33.04, -68.88, "Luján de Cuyo, Mendoza"),
  P(["Bahía Blanca", "Ingeniero White"], -38.72, -62.27, "Bahía Blanca, Buenos Aires"),
  P(["Puerto Rosales", "Punta Alta"], -38.88, -62.07, "Puerto Rosales, Buenos Aires"),
  P(["Punta Colorada", "Sierra Grande", "VMOS", "Vaca Muerta Oil Sur"], -41.6, -65.35, "Punta Colorada, Río Negro"),
  P(["San Antonio Oeste", "Punta Villarino", "Fuerte Argentino"], -40.73, -64.95, "Golfo San Matías, Río Negro"),
  P(["Salliqueló"], -36.75, -62.96, "Salliqueló, Buenos Aires"),
  P(["Tratayén", "Gasoducto Perito Moreno", "GPM"], -38.42, -68.58, "Tratayén, Neuquén"),
  P(["Ensenada", "Refinería La Plata"], -34.87, -57.9, "Ensenada, Buenos Aires"),
  P(["Campana"], -34.16, -58.96, "Campana, Buenos Aires"),
  P(["Zárate"], -34.1, -59.03, "Zárate, Buenos Aires"),
  P(["Escobar"], -34.35, -58.79, "Escobar, Buenos Aires"),
  P(["Dock Sud"], -34.65, -58.35, "Dock Sud, Buenos Aires"),
  P(["Timbúes"], -32.66, -60.79, "Timbúes, Santa Fe"),
  P(["Rosario"], -32.95, -60.64, "Rosario, Santa Fe"),
  P(["Río Tercero"], -32.17, -64.11, "Río Tercero, Córdoba"),
  P(["Atucha"], -33.97, -59.21, "Atucha, Buenos Aires"),
  P(["Embalse"], -32.2, -64.4, "Embalse, Córdoba"),
  P(["Piedra del Águila"], -40.05, -70.07, "Piedra del Águila, Neuquén"),
  P(["Condor Cliff", "La Barrancosa", "represas de Santa Cruz"], -50.2, -70.8, "Represas de Santa Cruz"),
  P(["Ushuaia"], -54.8, -68.3, "Ushuaia, Tierra del Fuego"),
  P(["Río Grande"], -53.79, -67.7, "Río Grande, Tierra del Fuego"),
  // Minería
  P(["Puna"], -24.0, -66.8, "Puna", 2),
  P(["Antofagasta de la Sierra"], -26.06, -67.4, "Antofagasta de la Sierra, Catamarca"),
  P(["Susques"], -23.4, -66.37, "Susques, Jujuy"),
  P(["San Antonio de los Cobres"], -24.22, -66.32, "San Antonio de los Cobres, Salta"),
  P(["Calingasta"], -31.33, -69.43, "Calingasta, San Juan"),
  P(["Jáchal"], -30.24, -68.75, "Jáchal, San Juan"),
  P(["Andalgalá"], -27.58, -66.32, "Andalgalá, Catamarca"),
  P(["MARA", "Agua Rica", "Alumbrera"], -27.35, -66.4, "Proyecto MARA, Catamarca"),
  P(["Lindero"], -24.8, -67.4, "Mina Lindero, Salta"),
  P(["Taca Taca"], -24.6, -67.75, "Taca Taca, Salta"),
  P(["El Pachón"], -31.75, -70.43, "El Pachón, San Juan"),
  P(["Josemaría", "Filo del Sol", "Vicuña"], -28.46, -69.58, "Vicuña, San Juan"),
  P(["Cerro Moro"], -48.1, -66.6, "Cerro Moro, Santa Cruz"),
  P(["Cerro Vanguardia"], -48.4, -68.3, "Cerro Vanguardia, Santa Cruz"),
  P(["Calcatreu"], -41.87, -69.37, "Calcatreu, Río Negro"),
  P(["Potasio Río Colorado"], -36.9, -68.2, "Potasio Río Colorado, Mendoza"),
  // Provincias (centroides aproximados)
  P(["Neuquén", "neuquino", "neuquina"], -38.6, -69.5, "Neuquén", 1),
  P(["Río Negro", "rionegrino"], -40.0, -67.0, "Río Negro", 1),
  P(["Chubut"], -43.8, -68.5, "Chubut", 1),
  P(["Santa Cruz"], -48.8, -69.5, "Santa Cruz", 1),
  P(["Tierra del Fuego"], -54.0, -67.8, "Tierra del Fuego", 1),
  P(["Mendoza", "mendocino", "mendocina"], -34.6, -68.6, "Mendoza", 1),
  P(["San Juan", "sanjuanino", "sanjuanina"], -30.9, -68.9, "San Juan", 1),
  P(["La Rioja"], -29.7, -67.2, "La Rioja", 1),
  P(["Catamarca"], -27.3, -66.9, "Catamarca", 1),
  P(["Salta", "salteño", "salteña"], -25.0, -65.5, "Salta", 1),
  P(["Jujuy", "jujeño", "jujeña"], -23.3, -65.8, "Jujuy", 1),
  P(["Tucumán"], -26.9, -65.3, "Tucumán", 1),
  P(["Santiago del Estero"], -27.8, -63.3, "Santiago del Estero", 1),
  P(["Córdoba"], -31.4, -64.2, "Córdoba", 1),
  P(["San Luis"], -33.7, -66.0, "San Luis", 1),
  P(["La Pampa"], -37.1, -65.4, "La Pampa", 1),
  P(["provincia de Buenos Aires", "bonaerense"], -36.5, -60.0, "Buenos Aires", 1),
  P(["Santa Fe", "santafesino"], -30.7, -60.9, "Santa Fe", 1),
  P(["Entre Ríos", "entrerriano"], -32.0, -59.2, "Entre Ríos", 1),
  P(["Corrientes"], -28.8, -58.0, "Corrientes", 1),
  P(["Misiones"], -26.9, -54.6, "Misiones", 1),
  P(["Chaco"], -26.4, -60.8, "Chaco", 1),
  P(["Formosa"], -25.0, -60.0, "Formosa", 1),
  // Región
  P(["Chile", "chileno", "chilena"], -33.45, -70.67, "Chile", 0.5),
  P(["Perú", "peruano", "peruana"], -12.05, -77.04, "Perú", 0.5),
  P(["Bolivia", "boliviano", "boliviana"], -16.5, -68.15, "Bolivia", 0.5),
  P(["Brasil", "brasileño", "brasileña"], -15.8, -47.9, "Brasil", 0.5),
  P(["Uruguay", "uruguayo", "uruguaya"], -34.9, -56.16, "Uruguay", 0.5),
  P(["Paraguay", "paraguayo", "paraguaya"], -25.3, -57.6, "Paraguay", 0.5),
];

const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const PREFIX = /^(Refinería|Mina|Parque (Eólico|Solar)|Central (Nuclear|Térmica)|Terminal( GNL)?|Salar (de|del))\s+/i;

// alias demasiado comunes para usarlos solos (calles, localidades homónimas)
const AMBIGUOUS = new Set(["San Martín", "Belgrano", "Embalse"]);

function pointsAsPlaces(points: MapPoint[]): Place[] {
  return points.map((p) => {
    const short = p.name.replace(PREFIX, "").replace(/\s*[—(].*$/, "").trim();
    const names = [...new Set([p.name, short].filter((n) => n.length >= 4 && !AMBIGUOUS.has(n)))];
    return P(names, p.lat, p.lng, p.province ? `${p.name}, ${p.province}` : p.name, 3.5);
  });
}

// Compilación perezosa: nombres propios → comparación sensible a mayúsculas pero no a tildes
// ("Salta" la provincia vs. "salta" el verbo).
const cache = new WeakMap<Place[], { re: RegExp; place: Place }[]>();
function compiled(places: Place[]) {
  let c = cache.get(places);
  if (!c) {
    c = places.flatMap((place) =>
      place.names.map((n) => {
        const pat = esc(strip(n));
        // gentilicios y palabras en minúscula admiten mayúscula inicial
        const flex = /^[a-z]/.test(pat) ? `[${pat[0]}${pat[0].toUpperCase()}]${pat.slice(1)}s?` : pat;
        return { re: new RegExp(`(^|[^\\p{L}\\p{N}])${flex}(?![\\p{L}\\p{N}])`, "u"), place };
      }),
    );
    cache.set(places, c);
  }
  return c;
}

/** Crea un geolocalizador con los puntos del mapa actuales (compilar una vez por corrida). */
export function makeGeolocator(points: MapPoint[] = []) {
  const lists = [compiled(pointsAsPlaces(points)), compiled(GAZETTEER)];
  /** Detecta el lugar más específico mencionado; el título pesa más que la bajada. */
  return (title: string, summary = ""): GeoTag | null => {
    const t = strip(title);
    const s = strip(summary);
    let best: Place | null = null;
    let bestScore = 0;
    for (const list of lists) {
      for (const { re, place } of list) {
        const inTitle = re.test(t);
        if (!inTitle && !re.test(s)) continue;
        const score = place.weight + (inTitle ? 1 : 0);
        if (score > bestScore) [best, bestScore] = [place, score];
      }
    }
    return best ? { lat: best.lat, lng: best.lng, place: best.place } : null;
  };
}
