"use client";

import { useActionState } from "react";
import { login } from "../actions";

export function LoginForm({ next }: { next: string }) {
  const [error, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="next" value={next} />
      <label className="field">
        Contraseña
        <input name="password" type="password" className="input" autoFocus required />
      </label>
      {error && <p className="text-sm text-red-300">{error}</p>}
      <button className="btn btn-primary w-full justify-center" disabled={pending}>
        {pending ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}
