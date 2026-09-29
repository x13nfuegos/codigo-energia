import { Logo } from "@/components/Logo";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Ingresar", robots: { index: false } };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-sm p-8">
        <h1><Logo className="text-xl" /></h1>
        <p className="mt-2 font-mono text-xs text-dim">// backoffice</p>
        <LoginForm next={next ?? "/admin"} />
      </div>
    </div>
  );
}
