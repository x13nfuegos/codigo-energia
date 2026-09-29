import { CATEGORY_OPTION, getPath, toLocalInput, type Field } from "@/lib/admin-schema";
import type { Settings } from "@/lib/types";
import { Submit } from "./Submit";

/** Formulario genérico a partir del esquema de campos de la tabla. */
export function EntityForm({
  fields,
  values,
  action,
  settings,
  submitLabel = "Guardar",
}: {
  fields: Field[];
  values?: Record<string, unknown> | null;
  action: (fd: FormData) => Promise<void>;
  settings: Settings;
  submitLabel?: string;
}) {
  const v = (name: string) => getPath(values, name);
  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      <input type="hidden" name="id" defaultValue={String(values?.id ?? "")} />
      {fields.map((f) => {
        const val = v(f.name);
        const help = f.help && f.help !== CATEGORY_OPTION ? <span className="text-xs text-dim">{f.help}</span> : null;
        if (f.type === "checkbox") {
          return (
            <label key={f.name} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name={f.name} defaultChecked={!!val} className="h-4 w-4 accent-[var(--color-accent)]" />
              {f.label}
              {help}
            </label>
          );
        }
        let input: React.ReactNode;
        if (f.type === "select") {
          const opts = [...(f.options ?? []), ...(f.help === CATEGORY_OPTION ? settings.categories.map((c) => ({ value: c.slug, label: c.name })) : [])];
          input = (
            <select name={f.name} defaultValue={val == null ? "" : String(val)} className="input">
              {opts.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          );
        } else if (f.type === "textarea") {
          const text = Array.isArray(val) ? val.join("\n") : String(val ?? "");
          input = <textarea name={f.name} defaultValue={text} rows={f.name === "body" || f.name === "text" ? 10 : 4} className="input font-mono text-sm" />;
        } else {
          const dv = f.type === "list" ? ((val as string[] | undefined) ?? []).join(", ") : f.type === "datetime" ? toLocalInput(val as string) : val == null ? "" : String(val);
          input = (
            <input
              name={f.name}
              type={f.type === "number" ? "text" : f.type === "datetime" ? "datetime-local" : f.type === "url" ? "url" : "text"}
              inputMode={f.type === "number" ? "decimal" : undefined}
              defaultValue={dv}
              required={f.required}
              className="input"
            />
          );
        }
        return (
          <label key={f.name} className={`field ${f.wide || f.type === "textarea" ? "md:col-span-2" : ""}`}>
            {f.label}
            {input}
            {help}
          </label>
        );
      })}
      <div className="md:col-span-2">
        <Submit>{submitLabel}</Submit>
      </div>
    </form>
  );
}
