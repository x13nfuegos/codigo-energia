import Link from "next/link";

export const metadata = { title: "Sin conexión" };

export default function Offline() {
  return (
    <div className="py-24 text-center">
      <p className="font-mono text-accent">&lt;sin_conexión/&gt;</p>
      <h1 className="mt-3 text-2xl font-bold">No hay conexión a internet</h1>
      <p className="mt-2 text-muted">Las notas que ya abriste siguen disponibles. Volvé a intentar cuando tengas señal.</p>
      <Link href="/" className="btn mt-6">Reintentar</Link>
    </div>
  );
}
