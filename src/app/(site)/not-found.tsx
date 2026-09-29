import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-24 text-center">
      <p className="font-mono text-accent">&lt;404/&gt;</p>
      <h1 className="mt-3 text-3xl font-bold">No encontramos esa página</h1>
      <Link href="/" className="btn mt-6">Volver a la portada</Link>
    </div>
  );
}
