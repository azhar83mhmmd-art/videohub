-- ============================================================
-- VideoHub Downloader Premium — Supabase Schema (scaffold)
-- Jalankan di Supabase SQL Editor setelah project dibuat.
-- Auth dasar (email/password) ditangani oleh Supabase Auth;
-- tabel `users` di sini menyimpan profil & data tambahan,
-- terhubung 1:1 ke auth.users via id.
-- ============================================================

create extension if not exists "uuid-ossp";

-- ---------- users ----------
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  email text unique not null,
  avatar text,
  role text not null default 'user' check (role in ('user','admin','SUPER_ADMIN')),
  plan text not null default 'free' check (plan in ('free','trial','monthly','quarterly','yearly')),
  vip_expired_at timestamptz,
  trial_used boolean not null default false,
  downloads_today int not null default 0,
  last_download_date date not null default current_date,
  total_downloads int not null default 0,
  suspended boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- downloads ----------
create table if not exists public.downloads (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade,
  video_title text,
  quality text,
  source text check (source in ('tiktok','youtube')),
  created_at timestamptz not null default now()
);

-- ---------- subscriptions ----------
create table if not exists public.subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade,
  plan text not null check (plan in ('trial','monthly','quarterly','yearly')),
  amount numeric(12,2) not null default 0,
  status text not null default 'pending' check (status in ('pending','active','expired','cancelled')),
  expired_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- site settings (admin-managed) ----------
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ============================================================
-- Auto-create SUPER_ADMIN profile when that specific account
-- registers via Supabase Auth.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, username, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)),
    new.email,
    case when new.email = 'muhammadazhar112026@gmail.com' then 'SUPER_ADMIN' else 'user' end
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.users enable row level security;
alter table public.downloads enable row level security;
alter table public.subscriptions enable row level security;

create policy "Users can view own profile" on public.users
  for select using (auth.uid() = id);
create policy "Users can update own profile" on public.users
  for update using (auth.uid() = id);

create policy "Users can view own downloads" on public.downloads
  for select using (auth.uid() = user_id);
create policy "Users can insert own downloads" on public.downloads
  for insert with check (auth.uid() = user_id);

create policy "Users can view own subscriptions" on public.subscriptions
  for select using (auth.uid() = user_id);

-- SUPER_ADMIN / admin full access (checked via role column)
create policy "Admins can manage all users" on public.users
  for all using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin','SUPER_ADMIN'))
  );
