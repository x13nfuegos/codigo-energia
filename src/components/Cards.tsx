import Link from "next/link";
import { timeAgo } from "@/lib/format";
import type { Article, Category } from "@/lib/types";
import { CategoryBadge } from "./CategoryBadge";
import { Img } from "./Img";

type P = { a: Article; cat: Category };

export function HeroCard({ a, cat }: P) {
  return (
    <article>
      <Link href={`/nota/${a.id}`} className="block">
        <Img src={a.image} alt={a.title} cat={cat} className="aspect-[16/9] w-full rounded-xl" />
      </Link>
      <div className="mt-5">
        <CategoryBadge cat={cat} />
      </div>
      <Link href={`/nota/${a.id}`}>
        <h2 className="mt-3 text-[2rem] font-extrabold leading-tight tracking-tight hover:underline md:text-5xl">{a.title}</h2>
      </Link>
      {a.summary && <p className="mt-4 line-clamp-3 text-lg text-muted md:text-xl">{a.summary}</p>}
      <p className="mt-4 text-sm text-dim">
        {timeAgo(a.published_at)}
        {a.source_name && <> · {a.source_name}</>}
      </p>
    </article>
  );
}

export function ListItem({ a, cat }: P) {
  return (
    <article className="flex gap-4 border-b border-line py-5 last:border-0">
      <Link href={`/nota/${a.id}`} className="shrink-0">
        <Img src={a.image} alt="" cat={cat} className="h-24 w-24 rounded-lg md:h-28 md:w-40" />
      </Link>
      <div className="min-w-0">
        <Link href={`/nota/${a.id}`}>
          <h3 className="text-lg font-bold leading-snug hover:underline">{a.title}</h3>
        </Link>
        <p className="mt-2 text-sm text-dim">
          {timeAgo(a.published_at)}
          {a.source_name && <span className="hidden sm:inline"> · {a.source_name}</span>}
        </p>
      </div>
    </article>
  );
}

export function GridCard({ a, cat }: P) {
  return (
    <article>
      <Link href={`/nota/${a.id}`} className="block">
        <Img src={a.image} alt="" cat={cat} className="aspect-[4/3] w-full rounded-lg" />
      </Link>
      <div className="mt-3">
        <CategoryBadge cat={cat} />
      </div>
      <Link href={`/nota/${a.id}`}>
        <h3 className="mt-2 text-lg font-bold leading-snug hover:underline">{a.title}</h3>
      </Link>
      <p className="mt-2 text-sm text-dim">{timeAgo(a.published_at)}</p>
    </article>
  );
}

export function SectionTitle({ title, href }: { title: string; href?: string }) {
  return (
    <div className="mb-6 flex items-center gap-3 border-b-2 border-line pb-3">
      <span className="h-8 w-2 rounded-sm bg-accent" />
      <h2 className="text-2xl font-extrabold tracking-tight md:text-3xl">{title}</h2>
      {href && (
        <Link href={href} className="ml-auto text-sm text-muted hover:text-ink">
          Ver más →
        </Link>
      )}
    </div>
  );
}
