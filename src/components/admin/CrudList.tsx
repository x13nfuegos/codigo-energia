import type { Field } from "@/lib/admin-schema";
import type { Settings, TableName } from "@/lib/types";
import { deleteEntity, saveEntity } from "@/app/admin/actions";
import { EntityForm } from "./EntityForm";
import { Submit } from "./Submit";

type Row = { id: string } & Record<string, unknown>;

/** Lista de registros con formulario desplegable para editar cada uno y otro para crear. */
export function CrudList({
  table,
  rows,
  fields,
  settings,
  path,
  summary,
  extra,
  newDefaults,
  newLabel = "Agregar",
}: {
  table: TableName;
  rows: Row[];
  fields: Field[];
  settings: Settings;
  path: string;
  summary: (r: Row) => React.ReactNode;
  extra?: (r: Row) => React.ReactNode;
  newDefaults?: Record<string, unknown>;
  newLabel?: string;
}) {
  const save = saveEntity.bind(null, table, path);
  return (
    <div className="space-y-2">
      <details className="card p-4">
        <summary className="cursor-pointer font-semibold text-accent">+ {newLabel}</summary>
        <div className="mt-4">
          <EntityForm fields={fields} values={newDefaults} settings={settings} action={save} submitLabel="Crear" />
        </div>
      </details>
      {rows.map((r) => (
        <details key={r.id} className="card group p-4">
          <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3">
            <span className="text-dim transition group-open:rotate-90">▸</span>
            <div className="min-w-0 flex-1">{summary(r)}</div>
            {extra?.(r)}
          </summary>
          <div className="mt-4 border-t border-line pt-4">
            <EntityForm fields={fields} values={r} settings={settings} action={save} />
            <form action={deleteEntity.bind(null, table, r.id, path)} className="mt-3">
              <Submit className="btn btn-danger" confirm="¿Eliminar definitivamente?">Eliminar</Submit>
            </form>
          </div>
        </details>
      ))}
    </div>
  );
}
