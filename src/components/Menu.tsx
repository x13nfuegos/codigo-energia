"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function Menu({ links }: { links: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  return (
    <>
      <button onClick={() => setOpen(!open)} className="ml-auto p-2 xl:ml-0" aria-label="Menú" aria-expanded={open}>
        <svg width="30" height="22" viewBox="0 0 30 22" fill="currentColor" aria-hidden>
          <rect y="0" width="30" height="3" rx="1.5" />
          <rect y="9.5" width="30" height="3" rx="1.5" />
          <rect y="19" width="30" height="3" rx="1.5" />
        </svg>
      </button>
      {open && (
        <div className="fixed inset-0 top-[60px] z-50 bg-bg/95 backdrop-blur md:top-[74px]" onClick={() => setOpen(false)}>
          <nav className="mx-auto flex max-w-6xl flex-col px-6 py-6" onClick={(e) => e.stopPropagation()}>
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="border-b border-line py-4 font-mono text-2xl font-bold hover:text-accent">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}
