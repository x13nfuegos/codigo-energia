import Link from "next/link";
import type { Category } from "@/lib/types";

export function CategoryBadge({ cat, link = true }: { cat: Category; link?: boolean }) {
  const cls = "inline-block rounded-md px-2.5 py-1 text-[0.8rem] font-bold uppercase tracking-wide";
  const style = { background: cat.color, color: cat.text };
  return link ? (
    <Link href={`/seccion/${cat.slug}`} className={cls} style={style}>
      {cat.name}
    </Link>
  ) : (
    <span className={cls} style={style}>
      {cat.name}
    </span>
  );
}
