"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type MenuLink = { href: string; label: string; children?: { href: string; label: string }[] };

export function Menu({ links }: { links: MenuLink[] }) {
  const [open, setOpen] = useState(false);
  const [top, setTop] = useState(57);
  const btn = useRef<HTMLButtonElement>(null);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    // el panel arranca justo debajo del encabezado, mida lo que mida
    if (open) setTop(btn.current?.closest("header")?.getBoundingClientRect().bottom ?? 57);
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);
  return (
    <>
      <button ref={btn} onClick={() => setOpen(!open)} className="ml-auto shrink-0 p-2 md:ml-0" aria-label={open ? "Cerrar menú" : "Abrir menú"} aria-expanded={open}>
        {open ? (
          <svg width="26" height="26" viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden>
            <path d="M4 4l18 18M22 4L4 22" />
          </svg>
        ) : (
          <svg width="28" height="20" viewBox="0 0 28 20" fill="currentColor" aria-hidden>
            <rect y="0" width="28" height="3" rx="1.5" />
            <rect y="8.5" width="28" height="3" rx="1.5" />
            <rect y="17" width="28" height="3" rx="1.5" />
          </svg>
        )}
      </button>
      {/* portal: el header tiene backdrop-filter, que atraparía a un hijo position:fixed */}
      {open &&
        createPortal(
        <div className="fixed inset-x-0 bottom-0 z-50 overflow-y-auto border-t border-line bg-bg" style={{ top }} onClick={() => setOpen(false)}>
          <nav className="mx-auto flex max-w-6xl flex-col px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
            {links.map((l) => (
              <div key={l.href} className="border-b border-line">
                <Link href={l.href} className="block py-3.5 font-mono text-xl font-bold hover:text-accent">
                  {l.label}
                </Link>
                {!!l.children?.length && (
                  <div className="-mt-1 flex flex-wrap gap-x-5 gap-y-1 pb-3 pl-4 font-mono text-sm text-muted">
                    {l.children.map((c) => (
                      <Link key={c.href} href={c.href} className="hover:text-accent">
                        ↳ {c.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>
        </div>,
          document.body,
        )}
    </>
  );
}
