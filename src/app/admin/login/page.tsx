import { LoginForm } from "./LoginForm";

export const metadata = { title: "Ingresar", robots: { index: false } };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-sm p-8">
        <p className="font-mono text-sm text-accent">&lt;backoffice/&gt;</p>
        <h1 className="mt-2 text-2xl font-bold">Código Energía</h1>
        <LoginForm next={next ?? "/admin"} />
      </div>
    </div>
  );
}
