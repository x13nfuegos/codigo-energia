export function Flash({ msg, err }: { msg?: string; err?: string }) {
  if (!msg && !err) return null;
  return (
    <div className={`mb-6 rounded-lg border px-4 py-3 text-sm ${err ? "border-red-900 bg-red-950/50 text-red-200" : "border-emerald-900 bg-emerald-950/40 text-emerald-200"}`}>
      {err ?? msg}
    </div>
  );
}

export type FlashParams = Promise<{ msg?: string; err?: string }>;
