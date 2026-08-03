-- ============================================================
-- SCHEMA: Dashboard de Página Pessoal (Posts + Livros + Landing)
-- Rode isso no SQL Editor do Supabase
-- ============================================================

-- Extensão pra gerar UUIDs
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- CATEGORIAS (compartilhadas entre posts e livros)
-- ------------------------------------------------------------
create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  applies_to text not null default 'both' check (applies_to in ('post', 'book', 'both')),
  color text default '#C9A24B',
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- POSTS (blog / artigos)
-- ------------------------------------------------------------
create table posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text,
  content_html text,
  cover_image_url text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  -- SEO
  meta_title text,
  meta_description text,
  og_image_url text,
  -- timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create table post_categories (
  post_id uuid references posts(id) on delete cascade,
  category_id uuid references categories(id) on delete cascade,
  primary key (post_id, category_id)
);

-- ------------------------------------------------------------
-- LIVROS (resenhas / indicações)
-- ------------------------------------------------------------
create table books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text,
  slug text not null unique,
  synopsis text,
  review_html text,
  cover_image_url text,
  rating numeric(2,1) check (rating >= 0 and rating <= 5),
  status text not null default 'draft' check (status in ('draft', 'published')),
  -- SEO
  meta_title text,
  meta_description text,
  og_image_url text,
  -- timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create table book_categories (
  book_id uuid references books(id) on delete cascade,
  category_id uuid references categories(id) on delete cascade,
  primary key (book_id, category_id)
);

-- ------------------------------------------------------------
-- BLOCOS DA LANDING PAGE (texto/imagem editáveis)
-- ------------------------------------------------------------
create table landing_blocks (
  id uuid primary key default gen_random_uuid(),
  block_key text not null unique, -- ex: 'hero', 'sobre', 'contato'
  label text not null,             -- nome amigável exibido no dashboard
  block_type text not null default 'text_image' check (block_type in ('text', 'image', 'text_image')),
  title text,
  content_html text,
  image_url text,
  order_index integer not null default 0,
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- CONFIGURAÇÕES DE APARÊNCIA (linha única — controla o site público)
-- ------------------------------------------------------------
create table site_settings (
  id integer primary key default 1,
  site_name text default 'Meu Site',
  tagline text,
  logo_url text,
  favicon_url text,
  color_bg text default '#14161A',
  color_panel text default '#1C1F26',
  color_accent text default '#C9A24B',
  color_accent_secondary text default '#4E7C7C',
  color_text text default '#EDE9E0',
  color_text_dim text default '#9199A8',
  font_display text default 'Newsreader',
  font_body text default 'Inter',
  radius text default '10px',
  updated_at timestamptz not null default now(),
  constraint singleton_row check (id = 1)
);
insert into site_settings (id) values (1) on conflict (id) do nothing;

-- ------------------------------------------------------------
-- MÍDIA (registro do que foi enviado ao Storage, pra listar na biblioteca)
-- ------------------------------------------------------------
create table media (
  id uuid primary key default gen_random_uuid(),
  file_path text not null,
  public_url text not null,
  file_name text,
  size_bytes integer,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- RLS: só usuário autenticado (você) pode escrever; leitura pública
-- pros conteúdos publicados (pra landing page consumir depois)
-- ------------------------------------------------------------
alter table categories enable row level security;
alter table posts enable row level security;
alter table post_categories enable row level security;
alter table books enable row level security;
alter table book_categories enable row level security;
alter table landing_blocks enable row level security;
alter table media enable row level security;
alter table site_settings enable row level security;

-- leitura pública de conteúdo publicado
create policy "public read published posts" on posts
  for select using (status = 'published');
create policy "public read published books" on books
  for select using (status = 'published');
create policy "public read categories" on categories
  for select using (true);
create policy "public read landing blocks" on landing_blocks
  for select using (true);
create policy "public read site settings" on site_settings
  for select using (true);
create policy "public read post_categories" on post_categories
  for select using (true);
create policy "public read book_categories" on book_categories
  for select using (true);

-- escrita e leitura total só pra autenticado (você, no dashboard)
create policy "auth full access posts" on posts
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth full access books" on books
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth full access categories" on categories
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth full access post_categories" on post_categories
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth full access book_categories" on book_categories
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth full access landing_blocks" on landing_blocks
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth full access media" on media
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth full access site_settings" on site_settings
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ------------------------------------------------------------
-- STORAGE: bucket público pra imagens
-- Rode isso separado, ou crie o bucket "media" pela UI do Supabase
-- marcando como público.
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

create policy "public read media bucket"
  on storage.objects for select
  using (bucket_id = 'media');

create policy "auth upload media bucket"
  on storage.objects for insert
  with check (bucket_id = 'media' and auth.role() = 'authenticated');

create policy "auth delete media bucket"
  on storage.objects for delete
  using (bucket_id = 'media' and auth.role() = 'authenticated');

-- ------------------------------------------------------------
-- Trigger pra manter updated_at em dia
-- ------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger posts_updated_at before update on posts
  for each row execute function set_updated_at();
create trigger books_updated_at before update on books
  for each row execute function set_updated_at();
create trigger landing_blocks_updated_at before update on landing_blocks
  for each row execute function set_updated_at();
