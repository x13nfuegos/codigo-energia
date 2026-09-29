"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useMemo, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import { POINT_TYPES } from "@/lib/map-types";
import type { MapPoint, MapPointType } from "@/lib/types";


export default function EnergyMap({ points, height = 520 }: { points: MapPoint[]; height?: number }) {
  const types = useMemo(() => [...new Set(points.map((p) => p.type))], [points]);
  const [active, setActive] = useState<Set<MapPointType>>(new Set(types));
  const visible = points.filter((p) => active.has(p.type));
  const bounds = L.latLngBounds([-55.2, -73.6], [-21.7, -53.5]);

  const toggle = (t: MapPointType) =>
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {types.map((t) => (
          <button
            key={t}
            onClick={() => toggle(t)}
            className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition ${active.has(t) ? "border-line bg-surface-2 text-ink" : "border-transparent text-dim line-through"}`}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: POINT_TYPES[t]?.color ?? "#999" }} />
            {POINT_TYPES[t]?.label ?? t}
          </button>
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-line" style={{ height }}>
        <MapContainer bounds={bounds} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          {visible.map((p) => (
            <CircleMarker
              key={p.id}
              center={[p.lat, p.lng]}
              radius={7}
              pathOptions={{ color: "#0a0a0a", weight: 1.5, fillColor: POINT_TYPES[p.type]?.color ?? "#999", fillOpacity: 0.95 }}
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
        </MapContainer>
      </div>
    </div>
  );
}
