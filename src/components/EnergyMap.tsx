"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, LayersControl, MapContainer, Marker, Popup, TileLayer, WMSTileLayer, useMap } from "react-leaflet";
import { timeAgo } from "@/lib/format";
import { POINT_TYPES, type EnergyMapProps, type NewsPin } from "@/lib/map-types";
import type { MapPointType } from "@/lib/types";

const PERIODS = [
  { days: 1, label: "24 h" },
  { days: 7, label: "7 días" },
  { days: 30, label: "30 días" },
];

type Group = { key: string; lat: number; lng: number; place: string; items: NewsPin[] };

function groupNews(news: NewsPin[]): Group[] {
  const map = new Map<string, Group>();
  for (const n of news) {
    const key = `${n.lat.toFixed(2)},${n.lng.toFixed(2)}`;
    const g = map.get(key) ?? { key, lat: n.lat, lng: n.lng, place: n.place, items: [] };
    g.items.push(n);
    map.set(key, g);
  }
  return [...map.values()];
}

function newsIcon(count: number, fresh: boolean) {
  const size = Math.round(26 + Math.min(count, 12) * 2.5);
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
    html: `<div class="news-pin${fresh ? " news-pin--fresh" : ""}" style="width:${size}px;height:${size}px">${count}</div>`,
  });
}

/** Centra el mapa y abre el popup de la nota enfocada. */
function Focus({ group, markers }: { group: Group | null; markers: React.RefObject<Map<string, L.Marker>> }) {
  const map = useMap();
  useEffect(() => {
    if (!group) return;
    map.flyTo([group.lat, group.lng], Math.max(map.getZoom(), 6), { duration: 0.8 });
    const t = setTimeout(() => markers.current?.get(group.key)?.openPopup(), 850);
    return () => clearTimeout(t);
  }, [group, map, markers]);
  return null;
}

export default function EnergyMap({ points, news, layers, height = 560, focus, showList = false }: EnergyMapProps) {
  const [days, setDays] = useState(focus ? 30 : 7);
  const [showNews, setShowNews] = useState(true);
  const types = useMemo(() => [...new Set(points.map((p) => p.type))], [points]);
  const [active, setActive] = useState<Set<MapPointType>>(new Set(types));
  const [focusId, setFocusId] = useState<string | null>(focus ?? null);
  const markers = useRef(new Map<string, L.Marker>());
  // el mapa base acompaña a la variante clara u oscura de la identidad
  const [light] = useState(() => typeof document !== "undefined" && document.documentElement.dataset.theme === "light");

  const since = Date.now() - days * 86400000;
  const visibleNews = useMemo(() => news.filter((n) => new Date(n.published_at).getTime() >= since), [news, since]);
  const groups = useMemo(() => groupNews(visibleNews), [visibleNews]);
  const focusGroup = useMemo(() => (focusId ? groups.find((g) => g.items.some((i) => i.id === focusId)) ?? null : null), [focusId, groups]);
  const bounds = L.latLngBounds([-55.2, -73.6], [-21.7, -53.5]);
  const enabledLayers = layers.filter((l) => l.enabled);

  const toggle = (t: MapPointType) =>
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });

  const chip = (on: boolean) =>
    `flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition ${on ? "border-line bg-surface-2 text-ink" : "border-transparent text-dim line-through"}`;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button onClick={() => setShowNews(!showNews)} className={chip(showNews)}>
          <span className="h-2.5 w-2.5 rounded-full bg-accent" />
          Noticias ({visibleNews.length})
        </button>
        <div className="flex overflow-hidden rounded-full border border-line text-sm">
          {PERIODS.map((p) => (
            <button key={p.days} onClick={() => setDays(p.days)} className={`px-3 py-1 ${days === p.days ? "bg-accent text-accent-ink" : "text-muted hover:text-ink"}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        {types.map((t) => (
          <button key={t} onClick={() => toggle(t)} className={chip(active.has(t))}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: POINT_TYPES[t]?.color ?? "#999" }} />
            {POINT_TYPES[t]?.label ?? t}
          </button>
        ))}
      </div>

      <div className={showList ? "grid gap-4 lg:grid-cols-[1fr_340px]" : ""}>
        <div className="overflow-hidden rounded-xl border border-line" style={{ height }}>
          <MapContainer bounds={bounds} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a> · Capas: <a href="https://sig.energia.gob.ar">SIG Secretaría de Energía</a>'
              url={`https://{s}.basemaps.cartocdn.com/${light ? "light_all" : "dark_all"}/{z}/{x}/{y}{r}.png`}
            />
            {enabledLayers.length > 0 && (
              <LayersControl position="topright">
                {enabledLayers.map((l) => (
                  <LayersControl.Overlay key={l.id} name={l.label} checked={l.visible}>
                    <WMSTileLayer url={l.url} params={{ layers: l.layers, format: "image/png", transparent: true }} opacity={l.opacity} />
                  </LayersControl.Overlay>
                ))}
              </LayersControl>
            )}
            {points
              .filter((p) => active.has(p.type))
              .map((p) => (
                <CircleMarker
                  key={p.id}
                  center={[p.lat, p.lng]}
                  radius={6}
                  pathOptions={{ color: light ? "#ffffff" : "#0b0e14", weight: 1.5, fillColor: POINT_TYPES[p.type]?.color ?? "#999", fillOpacity: 0.95 }}
                >
                  <Popup>
                    <strong>{p.name}</strong>
                    <br />
                    <small>
                      {POINT_TYPES[p.type]?.label ?? p.type} · {p.province}
                      {p.operator ? ` · ${p.operator}` : ""}
                    </small>
                    {p.description && <p style={{ margin: "6px 0 0" }}>{p.description}</p>}
                    {p.link && (
                      <a href={p.link} target="_blank" rel="noopener noreferrer">
                        Más información
                      </a>
                    )}
                  </Popup>
                </CircleMarker>
              ))}
            {showNews &&
              groups.map((g) => (
                <Marker
                  key={g.key}
                  position={[g.lat, g.lng]}
                  icon={newsIcon(g.items.length, g.items.some((i) => Date.now() - new Date(i.published_at).getTime() < 86400000))}
                  zIndexOffset={1000}
                  ref={(m) => {
                    if (m) markers.current.set(g.key, m);
                    else markers.current.delete(g.key);
                  }}
                >
                  <Popup maxWidth={320}>
                    <div className="news-popup">
                      <div className="news-popup__place">📍 {g.place}</div>
                      {g.items.slice(0, 8).map((n) => (
                        <Link key={n.id} href={`/nota/${n.id}`} className={`news-popup__item${n.id === focusId ? " is-focus" : ""}`}>
                          <span className="news-popup__cat" style={{ background: n.catColor, color: n.catText }}>{n.catName}</span>
                          <span className="news-popup__title">{n.title}</span>
                          <span className="news-popup__time">{timeAgo(n.published_at)}</span>
                        </Link>
                      ))}
                      {g.items.length > 8 && <div className="news-popup__time">y {g.items.length - 8} más…</div>}
                    </div>
                  </Popup>
                </Marker>
              ))}
            <Focus group={focusGroup} markers={markers} />
          </MapContainer>
        </div>

        {showList && (
          <aside className="max-h-[560px] overflow-y-auto rounded-xl border border-line bg-surface" style={{ maxHeight: height }}>
            <div className="sticky top-0 border-b border-line bg-surface px-4 py-3 font-mono text-xs uppercase tracking-[0.15em] text-muted">
              Noticias en el mapa · {PERIODS.find((p) => p.days === days)?.label}
            </div>
            {!visibleNews.length && <p className="p-4 text-sm text-dim">No hay noticias geolocalizadas en este período.</p>}
            {visibleNews.map((n) => (
              <button
                key={n.id}
                onClick={() => {
                  setShowNews(true);
                  setFocusId(n.id);
                }}
                className={`block w-full border-b border-line px-4 py-3 text-left hover:bg-surface-2 ${n.id === focusId ? "bg-surface-2" : ""}`}
              >
                <div className="text-xs text-dim">📍 {n.place} · {timeAgo(n.published_at)}</div>
                <div className="mt-1 text-sm font-semibold leading-snug">{n.title}</div>
              </button>
            ))}
          </aside>
        )}
      </div>
    </div>
  );
}
