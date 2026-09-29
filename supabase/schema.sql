-- Código Energía — esquema de base de datos (Supabase / Postgres)
-- Ejecutar una vez en el SQL Editor del proyecto de Supabase.
-- El sitio accede con la service role key desde el servidor; RLS queda activado
-- sin políticas públicas para que la anon key no pueda leer ni escribir.

create table if not exists settings (
  id text primary key,
  value jsonb not null
);

create table if not exists sources (
  id text primary key,
  name text not null,
  type text not null check (type in ('rss', 'google_news', 'html')),
  url text not null,
  category text not null default 'energia',
  enabled boolean not null default true,
  auto_publish boolean not null default true,
  include_keywords jsonb not null default '[]',
  exclude_keywords jsonb not null default '[]',
  max_items int not null default 20,
  fetch_meta boolean not null default false,
  selectors jsonb,
  last_run_at timestamptz,
  last_status text,
  last_count int
);

create table if not exists articles (
  id text primary key,
  url text not null,
  title text not null,
  summary text not null default '',
  body text,
  image text,
  source_id text,
  source_name text,
  category text not null,
  tags jsonb not null default '[]',
  published_at timestamptz not null,
  scraped_at timestamptz not null default now(),
  status text not null default 'published' check (status in ('published', 'draft', 'hidden')),
  featured boolean not null default false,
  views int not null default 0,
  geo jsonb,
  enriched boolean not null default false
);
create index if not exists articles_published_idx on articles (status, published_at desc);
create index if not exists articles_category_idx on articles (category, published_at desc);
create index if not exists articles_views_idx on articles (views desc);

create table if not exists indicators (
  id text primary key,
  label text not null,
  "group" text not null default 'General',
  provider text not null,
  param text not null default '',
  json_path text,
  unit text not null default '',
  decimals int not null default 2,
  multiplier double precision,
  show_in_ticker boolean not null default true,
  show_in_panel boolean not null default true,
  enabled boolean not null default true,
  "order" int not null default 0,
  value double precision,
  change_pct double precision,
  history jsonb not null default '[]',
  updated_at timestamptz,
  note text,
  counter_start timestamptz,
  counter_base double precision,
  counter_rate_per_day double precision,
  counter_since timestamptz,
  counter_label text,
  source text,
  source_url text,
  fallback_provider text,
  fallback_param text,
  metric text
);

create table if not exists sections (
  id text primary key,
  type text not null,
  title text not null default '',
  category text not null default '',
  "limit" int not null default 6,
  "order" int not null default 0,
  enabled boolean not null default true,
  html text,
  columns int,
  "offset" int
);

create table if not exists map_points (
  id text primary key,
  name text not null,
  type text not null,
  lat double precision not null,
  lng double precision not null,
  province text not null default '',
  operator text,
  description text,
  link text,
  enabled boolean not null default true
);

create table if not exists briefs (
  id text primary key,
  date date not null,
  title text not null,
  bullets jsonb not null default '[]',
  text text not null default '',
  script text not null default '',
  article_ids jsonb not null default '[]',
  audio_url text,
  video_id text,
  video_url text,
  video_status text,
  created_at timestamptz not null default now()
);

create or replace function increment_article_views(article_id text)
returns void language sql security definer as $$
  update articles set views = views + 1 where id = article_id;
$$;
revoke execute on function increment_article_views(text) from public, anon, authenticated;

alter table settings enable row level security;
alter table sources enable row level security;
alter table articles enable row level security;
alter table indicators enable row level security;
alter table sections enable row level security;
alter table map_points enable row level security;
alter table briefs enable row level security;

-- Bucket público para audios y videos del resumen diario
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

-- Si la base ya existía antes de la geolocalización de noticias:
alter table articles add column if not exists geo jsonb;

-- Columnas agregadas después (fuentes oficiales, imágenes): seguras de correr sobre una base existente
alter table articles add column if not exists enriched boolean not null default false;
alter table indicators add column if not exists counter_since timestamptz;
alter table indicators add column if not exists counter_label text;
alter table indicators add column if not exists source text;
alter table indicators add column if not exists source_url text;
alter table indicators add column if not exists fallback_provider text;
alter table indicators add column if not exists fallback_param text;
alter table indicators add column if not exists metric text;
