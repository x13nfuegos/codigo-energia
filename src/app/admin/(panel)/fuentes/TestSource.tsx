"use client";

import { useState, useTransition } from "react";
import { testSource, type TestResult } from "../../actions";

export function TestSource({ id }: { id: string }) {
  const [res, setRes] = useState<TestResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="btn"
        disabled={pending}
        onClick={(e) => {
          e.preventDefault();
          start(async () => setRes(await testSource(id)));
        }}
      >
        {pending ? "Probando…" : "Probar"}
      </button>
      {res && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setRes(null)}>
          <div className="card max-h-[80vh] w-full max-w-2xl overflow-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center">
              <h3 className="font-bold">Vista previa ({res.items?.length ?? 0} notas)</h3>
              <button className="btn ml-auto" onClick={() => setRes(null)}>Cerrar</button>
            </div>
            {res.error && <p className="text-red-300">{res.error}</p>}
            <ul className="space-y-3 text-sm">
              {res.items?.map((it) => (
                <li key={it.url} className="border-b border-line pb-3">
                  <a href={it.url} target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline">{it.title}</a>
                  <div className="text-xs text-dim">{it.source_name} · {it.date ?? "sin fecha"} · {it.image ? "con imagen" : "sin imagen"}</div>
                  {it.summary && <p className="mt-1 text-muted">{it.summary}</p>}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
