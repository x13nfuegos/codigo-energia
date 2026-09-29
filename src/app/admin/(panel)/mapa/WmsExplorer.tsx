"use client";

import { useState, useTransition } from "react";
import { addWmsLayer, listWmsLayers, type WmsLayerInfo } from "../../actions";

export function WmsExplorer({ defaultUrl, existing }: { defaultUrl: string; existing: string[] }) {
  const [url, setUrl] = useState(defaultUrl);
  const [filter, setFilter] = useState("");
  const [layers, setLayers] = useState<WmsLayerInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set(existing));
  const [pending, start] = useTransition();
  const shown = (layers ?? []).filter((l) => `${l.name} ${l.title}`.toLowerCase().includes(filter.toLowerCase()));
  return (
    <div className="card p-5">
      <h2 className="font-bold">Explorar capas oficiales</h2>
      <p className="mt-1 text-sm text-muted">
        Lee las capas publicadas por un servicio WMS (por defecto, el SIG de la Secretaría de Energía) y te deja sumarlas al mapa.
      </p>
      <div className="mt-3 flex gap-2">
        <input value={url} onChange={(e) => setUrl(e.target.value)} className="input" />
        <button
          className="btn btn-primary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await listWmsLayers(url);
              setLayers(r.layers ?? null);
              setError(r.error ?? null);
            })
          }
        >
          {pending ? "Leyendo…" : "Ver capas"}
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      {layers && (
        <>
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={`Filtrar ${layers.length} capas: gasoducto, oleoducto, pozos, centrales…`} className="input mt-3" />
          <ul className="mt-3 max-h-96 overflow-y-auto rounded-lg border border-line">
            {shown.map((l) => {
              const key = `${url}|${l.name}`;
              return (
                <li key={l.name} className="flex items-center gap-3 border-b border-line px-3 py-2 text-sm last:border-0">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{l.title}</div>
                    <div className="truncate font-mono text-xs text-dim">{l.name}</div>
                  </div>
                  <button
                    className="btn"
                    disabled={added.has(key) || pending}
                    onClick={() =>
                      start(async () => {
                        await addWmsLayer(url, l.name, l.title);
                        setAdded((s) => new Set(s).add(key));
                      })
                    }
                  >
                    {added.has(key) ? "Agregada" : "Agregar"}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
