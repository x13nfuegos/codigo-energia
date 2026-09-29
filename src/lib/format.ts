const TZ = "America/Argentina/Buenos_Aires";

export function timeAgo(iso: string, now = Date.now()): string {
  const d = new Date(iso);
  const diff = (now - d.getTime()) / 1000;
  if (diff < 60) return "Hace instantes";
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`;
  const day = (x: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(x);
  if (day(d) === day(new Date(now - 86400000)))
    return `Ayer ${new Intl.DateTimeFormat("es-AR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(d)}`;
  const sameYear = new Intl.DateTimeFormat("en", { timeZone: TZ, year: "numeric" }).format(d) === new Intl.DateTimeFormat("en", { timeZone: TZ, year: "numeric" }).format(new Date(now));
  return new Intl.DateTimeFormat("es-AR", { timeZone: TZ, day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) })
    .format(d)
    .replace(".", "");
}

export function longDate(iso: string): string {
  return new Intl.DateTimeFormat("es-AR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}

export function dateTime(iso: string): string {
  return new Intl.DateTimeFormat("es-AR", { timeZone: TZ, day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}

export function formatNumber(v: number | null | undefined, decimals = 2): string {
  if (v == null || !isFinite(v)) return "s/d";
  return new Intl.NumberFormat("es-AR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v);
}

export function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
