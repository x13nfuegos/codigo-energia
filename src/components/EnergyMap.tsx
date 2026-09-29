"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Marker, TileLayer, Tooltip, WMSTileLayer, useMap } from "react-leaflet";
import { timeAgo } from "@/lib/format";
import { POINT_TYPES, type EnergyMapProps, type NewsPin } from "@/lib/map-types";
import type { MapPointType } from "@/lib/types";

const PERIODS = [
  { days: 1, label: "24 h" },
  { days: 7, label: "7 días" },
  { days: 30, label: "30 días" },
];
/** Encuadre inicial: centro y norte del país, de Tucumán a la Patagonia norte (donde se concentra la actividad). */
const ARG = L.latLngBounds([-42.6, -73.8], [-24.2, -50.5]);

type Group = { key: string; lat: number; lng: number; place: string; items: NewsPin[] };

const keyOf = (lat: number, lng: number) => `${lat.toFixed(2)},${lng.toFixed(2)}`;

function groupNews(news: NewsPin[]): Group[] {
  const map = new Map<string, Group>();
  for (const n of news) {
    const key = keyOf(n.lat, n.lng);
    const g = map.get(key) ?? { key, lat: n.lat, lng: n.lng, place: n.place, items: [] };
    g.items.push(n);
    map.set(key, g);
  }
  return [...map.values()].map((g) => ({ ...g, items: g.items.sort((a, b) => b.published_at.localeCompare(a.published_at)) }));
}

/** Pin de noticias: color de la sección de la nota más reciente, tamaño según cantidad. */
function pinIcon(g: Group, selected: boolean) {
  const count = g.items.length;
  const size = Math.round(30 + Math.min(count, 10) * 2.4);
  const fresh = Date.now() - new Date(g.items[0].published_at).getTime() < 86400000;
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div class="map-pin${fresh ? " map-pin--fresh" : ""}${selected ? " map-pin--on" : ""}" style="--pin:${g.items[0].catColor};width:${size}px;height:${size}px"><span>${count}</span></div>`,
  });
}

/** Vuela hasta la selección y habilita el zoom con rueda recién después de un clic. */
function Camera({ target }: { target: Group | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 6), { duration: 0.7 });
  }, [target, map]);
  useEffect(() => {
    const on = () => map.scrollWheelZoom.enable();
    const off = () => map.scrollWheelZoom.disable();
    map.on("click", on);
    map.on("mouseout", off);
    return () => {
      map.off("click", on);
      map.off("mouseout", off);
    };
  }, [map]);
  return null;
}

const toggled = <T,>(set: Set<T>, v: T) => {
  const next = new Set(set);
  if (next.has(v)) next.delete(v);
  else next.add(v);
  return next;
};

export default function EnergyMap({ points, news, layers, height = 560, focus, showList = false, categories = [], mapboxToken }: EnergyMapProps) {
  const [days, setDays] = useState(focus ? 30 : 7);
  const [showNews, setShowNews] = useState(true);
  const [cats, setCats] = useState<Set<string>>(new Set());
  const types = useMemo(() => [...new Set(points.map((p) => p.type))], [points]);
  const [active, setActive] = useState<Set<MapPointType>>(new Set(types));
  const [wms, setWms] = useState<Set<string>>(new Set(layers.filter((l) => l.enabled && l.visible).map((l) => l.id)));
  const [panel, setPanel] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [full, setFull] = useState(false);
  const [light, setLight] = useState(false);
  const [map, setMap] = useState<L.Map | null>(null);

  useEffect(() => setLight(document.documentElement.dataset.theme === "light"), []);
  useEffect(() => {
    const t = setTimeout(() => map?.invalidateSize(), 150);
    if (!full) return () => clearTimeout(t);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setFull(false);
    document.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", esc);
      document.body.style.overflow = "";
    };
  }, [full, map]);

  const since = Date.now() - days * 86400000;
  const visibleNews = useMemo(
    () => news.filter((n) => new Date(n.published_at).getTime() >= since && (!cats.size || cats.has(n.category))),
    [news, since, cats],
  );
  const groups = useMemo(() => groupNews(visibleNews), [visibleNews]);
  useEffect(() => {
    const n = focus ? news.find((x) => x.id === focus) : null;
    if (n) setSelected(keyOf(n.lat, n.lng));
  }, [focus, news]);
  const sel = groups.find((g) => g.key === selected) ?? null;
  const usedCats = categories.filter((c) => news.some((n) => n.category === c.slug));
  const list = (sel ? sel.items : visibleNews).slice(0, 40);
  const mapHeight = full ? "100%" : `min(${height}px, 70vh)`;

  const tiles = mapboxToken
    ? {
        url: `https://api.mapbox.com/styles/v1/mapbox/${light ? "light-v11" : "dark-v11"}/tiles/{z}/{x}/{y}@2x?access_token=${mapboxToken}`,
        attribution: '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        tileSize: 512,
        zoomOffset: -1,
      }
    : {
        // OpenStreetMap no pide clave; en las variantes oscuras se invierte con CSS para acompañar la identidad
        url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        tileSize: 256,
        zoomOffset: 0,
        className: light ? "map-tiles" : "map-tiles map-tiles--dark",
        maxZoom: 18,
      };

  const chip = (on: boolean) =>
    `inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${on ? "border-accent bg-accent/10 text-ink" : "border-line text-muted hover:text-ink"}`;
  const ctrl = "flex h-9 w-9 items-center justify-center border-b border-line last:border-0 hover:bg-surface-2 hover:text-accent";

  return (
    <div className={full ? "fixed inset-0 z-[60] flex flex-col bg-bg p-3 md:p-5" : ""}>
      {/* filtros */}
      <div className="mb-3 flex flex-wrap items-center gap-2 font-mono">
        <div className="flex overflow-hidden rounded-full border border-line text-xs">
          {PERIODS.map((p) => (
            <button key={p.days} onClick={() => setDays(p.days)} className={`px-3 py-1.5 ${days === p.days ? "bg-accent text-accent-ink" : "text-muted hover:text-ink"}`}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex max-w-full gap-1.5 overflow-x-auto py-0.5">
          <button onClick={() => setCats(new Set())} className={chip(!cats.size)}>
            Todas
          </button>
          {usedCats.map((c) => (
            <button key={c.slug} onClick={() => setCats(toggled(cats, c.slug))} className={chip(cats.has(c.slug))}>
              <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
              {c.name}
            </button>
          ))}
        </div>
        <div className="relative ml-auto flex gap-1.5">
          <button onClick={() => setPanel(!panel)} className={chip(panel)} aria-expanded={panel}>
            ◧ Capas
          </button>
          <button onClick={() => setFull(!full)} className={chip(full)} aria-label={full ? "Salir de pantalla completa" : "Pantalla completa"}>
            {full ? "✕ Cerrar" : "⤢ Ampliar"}
          </button>
          {panel && (
            <div className="absolute right-0 top-full z-[1000] mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-line bg-surface p-4 font-sans text-sm shadow-2xl">
              <label className="flex items-center gap-2 font-semibold">
                <input type="checkbox" checked={showNews} onChange={() => setShowNews(!showNews)} className="accent-[var(--color-accent)]" />
                Noticias ({visibleNews.length})
              </label>
              <div className="mt-4 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-dim">Infraestructura</div>
              <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1.5">
                {types.map((t) => (
                  <label key={t} className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={active.has(t)} onChange={() => setActive(toggled(active, t))} className="accent-[var(--color-accent)]" />
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: POINT_TYPES[t]?.color }} />
                    <span className="truncate">{POINT_TYPES[t]?.label ?? t}</span>
                  </label>
                ))}
              </div>
              {layers.some((l) => l.enabled) && (
                <>
                  <div className="mt-4 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-dim">Capas oficiales · Secretaría de Energía</div>
                  <div className="mt-2 space-y-1.5">
                    {layers
                      .filter((l) => l.enabled)
                      .map((l) => (
                        <label key={l.id} className="flex items-center gap-2 text-xs">
                          <input type="checkbox" checked={wms.has(l.id)} onChange={() => setWms(toggled(wms, l.id))} className="accent-[var(--color-accent)]" />
                          {l.label}
                        </label>
                      ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className={`grid min-h-0 gap-3 ${full ? "flex-1 lg:grid-cols-[1fr_380px]" : showList ? "lg:grid-cols-[1fr_360px]" : ""}`}>
        <div className="relative min-h-[320px] overflow-hidden rounded-xl border border-line" style={{ height: mapHeight }}>
          <MapContainer ref={setMap} bounds={ARG} boundsOptions={{ padding: [0, 0] }} scrollWheelZoom={false} zoomControl={false} style={{ height: "100%", width: "100%" }}>
            <TileLayer {...tiles} />
            {layers
              .filter((l) => l.enabled && wms.has(l.id))
              .map((l) => (
                <WMSTileLayer key={l.id} url={l.url} params={{ layers: l.layers, format: "image/png", transparent: true }} opacity={l.opacity} />
              ))}
            {points
              .filter((p) => active.has(p.type))
              .map((p) => (
                <CircleMarker
                  key={p.id}
                  center={[p.lat, p.lng]}
                  radius={5}
                  pathOptions={{ color: light ? "#ffffff" : "#0b0e14", weight: 1.5, fillColor: POINT_TYPES[p.type]?.color ?? "#999", fillOpacity: 0.9 }}
                >
                  <Tooltip direction="top" offset={[0, -4]}>
                    <b>{p.name}</b>
                    <br />
                    {POINT_TYPES[p.type]?.label ?? p.type} · {p.province}
                    {p.operator ? ` · ${p.operator}` : ""}
                  </Tooltip>
                </CircleMarker>
              ))}
            {showNews &&
              groups.map((g) => (
                <Marker
                  key={g.key}
                  position={[g.lat, g.lng]}
                  icon={pinIcon(g, g.key === selected)}
                  zIndexOffset={g.key === selected ? 2000 : 1000}
                  eventHandlers={{ click: () => setSelected(g.key === selected ? null : g.key) }}
                  title={`${g.place}: ${g.items.length} noticia(s)`}
                />
              ))}
            <Camera target={sel} />
          </MapContainer>

          <div className="absolute right-3 top-3 z-[500] flex flex-col overflow-hidden rounded-lg border border-line bg-surface/90 font-mono text-base backdrop-blur">
            <button className={ctrl} onClick={() => map?.zoomIn()} aria-label="Acercar">+</button>
            <button className={ctrl} onClick={() => map?.zoomOut()} aria-label="Alejar">−</button>
            <button
              className={ctrl}
              onClick={() => {
                setSelected(null);
                map?.flyToBounds(ARG, { duration: 0.6 });
              }}
              aria-label="Ver todo el país"
              title="Ver todo el país"
            >
              ⌂
            </button>
          </div>

          <div className="pointer-events-none absolute bottom-3 left-3 z-[500] hidden rounded-lg border border-line bg-surface/85 px-3 py-2 font-mono text-[0.65rem] text-muted backdrop-blur sm:block">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[0.55rem] font-bold text-accent-ink">3</span>
              noticias en ese lugar · tocá para verlas
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="ml-1 h-2 w-2 rounded-full bg-muted" />
              infraestructura · pasá el mouse
            </div>
          </div>
        </div>

        {(showList || full || sel) && (
          <aside className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-line bg-surface" style={{ maxHeight: full ? "100%" : `min(${height}px, 70vh)` }}>
            <div className="flex items-center gap-2 border-b border-line px-4 py-3 font-mono text-xs uppercase tracking-[0.15em] text-muted">
              {sel ? (
                <>
                  <span className="truncate text-ink">📍 {sel.place}</span>
                  <button onClick={() => setSelected(null)} className="ml-auto shrink-0 normal-case tracking-normal text-dim hover:text-accent">
                    ver todas ✕
                  </button>
                </>
              ) : (
                <>
                  Noticias en el mapa <span className="ml-auto text-dim">{visibleNews.length}</span>
                </>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {!list.length && <p className="p-4 text-sm text-dim">No hay noticias ubicadas en este período.</p>}
              {list.map((n) => (
                <div key={n.id} className={`flex gap-3 border-b border-line px-4 py-3 last:border-0 ${n.id === focus ? "bg-surface-2" : ""}`}>
                  {n.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={n.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.style.display = "none")} className="h-14 w-14 shrink-0 rounded-md bg-surface-2 object-cover" />
                  )}
                  <div className="min-w-0">
                    <button onClick={() => setSelected(keyOf(n.lat, n.lng))} className="flex max-w-full items-center gap-1.5 text-left text-[0.7rem] text-dim hover:text-accent">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: n.catColor }} />
                      <span className="truncate">
                        {n.place} · {timeAgo(n.published_at)}
                      </span>
                    </button>
                    <Link href={`/nota/${n.id}`} className="mt-0.5 line-clamp-3 text-sm font-semibold leading-snug hover:underline">
                      {n.title}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
