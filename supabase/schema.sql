-- TimeBottle · run this once in the Supabase SQL Editor
-- https://supabase.com/dashboard → your project → SQL Editor

-- 1) profiles table (display names, one row per auth user)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  created_at timestamptz not null default now()
);

-- 2) capsules table
create table if not exists public.capsules (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  note text,
  lat double precision not null,
  lng double precision not null,
  unlock_at timestamptz not null,
  photo_url text,
  audio_url text,
  created_at timestamptz not null default now()
);

-- anyone may read capsules (they are only revealed client-side by GPS/time)
alter table public.capsules enable row level security;
drop policy if exists "capsules_select_all" on public.capsules;
create policy "capsules_select_all" on public.capsules
  for select using (true);

-- only the author may insert/update/delete their own
drop policy if exists "capsules_insert_own" on public.capsules;
create policy "capsules_insert_own" on public.capsules
  for insert with check (auth.uid() = author_id);

drop policy if exists "capsules_delete_own" on public.capsules;
create policy "capsules_delete_own" on public.capsules
  for delete using (auth.uid() = author_id);

-- profiles readable by all, editable only by the owner
alter table public.profiles enable row level security;
drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all" on public.profiles
  for select using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

-- 3) storage bucket for photos + audio (public so stangers can visit media)
insert into storage.buckets (id, name, public)
values ('capsule-media', 'capsule-media', true)
on conflict (id) do update set public = true;

create policy "capsule_media_insert" on storage.objects
  for insert with check (bucket_id = 'capsule-media' and auth.uid() is not null);

create policy "capsule_media_delete" on storage.objects
  for delete using (bucket_id = 'capsule-media' and auth.uid() = owner);

create policy "capsule_media_select" on storage.objects
  for select using (bucket_id = 'capsule-media');