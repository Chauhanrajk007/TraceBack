-- TimeBottle · run this ONCE in the Supabase SQL Editor
-- https://supabase.com/dashboard → your project → SQL Editor
--
-- Recommended: Authentication → Providers → Email → turn OFF "Confirm email"
-- so sign-ups log you in immediately.

-- 1) profiles table (display names, one row per auth user)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  created_at timestamptz not null default now()
);

-- 2) places — a physical spot people share (mountain, college, cafe…)
create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  lat double precision not null,
  lng double precision not null,
  created_at timestamptz not null default now()
);

-- 3) memories — one person's trace, locked to a place and a time
create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  note text,
  lat double precision not null,
  lng double precision not null,
  year integer not null,
  unlock_at timestamptz not null,
  photo_url text,
  created_at timestamptz not null default now()
);

-- 4) links — one memory continuing another (a trail)
create table if not exists public.links (
  id uuid primary key default gen_random_uuid(),
  from_memory_id uuid not null references public.memories (id) on delete cascade,
  to_memory_id uuid not null references public.memories (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

grant usage on schema public to anon, authenticated;
grant all on public.places to anon, authenticated;
grant all on public.memories to anon, authenticated;
grant all on public.links to anon, authenticated;
grant all on public.profiles to anon, authenticated;

-- places: readable by all, only signed-in users may create
alter table public.places enable row level security;
drop policy if exists "places_select_all" on public.places;
create policy "places_select_all" on public.places
  for select using (true);

drop policy if exists "places_insert_auth" on public.places;
create policy "places_insert_auth" on public.places
  for insert with check (auth.uid() is not null);

-- memories: readable by all (revealed client-side by GPS/time), writable by author
alter table public.memories enable row level security;
drop policy if exists "memories_select_all" on public.memories;
create policy "memories_select_all" on public.memories
  for select using (true);

drop policy if exists "memories_insert_own" on public.memories;
create policy "memories_insert_own" on public.memories
  for insert with check (auth.uid() = author_id);

drop policy if exists "memories_delete_own" on public.memories;
create policy "memories_delete_own" on public.memories
  for delete using (auth.uid() = author_id);

-- links: readable by all, writable by author
alter table public.links enable row level security;
drop policy if exists "links_select_all" on public.links;
create policy "links_select_all" on public.links
  for select using (true);

drop policy if exists "links_insert_own" on public.links;
create policy "links_insert_own" on public.links
  for insert with check (auth.uid() = author_id);

drop policy if exists "links_delete_own" on public.links;
create policy "links_delete_own" on public.links
  for delete using (auth.uid() = author_id);

-- profiles readable by all, editable only by the owner
alter table public.profiles enable row level security;
drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all" on public.profiles
  for select using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

-- auto-create a profile row whenever a new user signs up
-- (runs server-side, so it works even with email confirmation on)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5) storage bucket for photos (public so strangers can visit media)
insert into storage.buckets (id, name, public)
values ('capsule-media', 'capsule-media', true)
on conflict (id) do update set public = true;

drop policy if exists "capsule_media_insert" on storage.objects;
drop policy if exists "capsule_media_delete" on storage.objects;
drop policy if exists "capsule_media_select" on storage.objects;

-- storage policies are created one-by-one so a partial failure
-- (policy already exists) doesn't abort the whole script
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'capsule_media_insert'
  ) then
    create policy "capsule_media_insert" on storage.objects
      for insert with check (bucket_id = 'capsule-media' and auth.uid() is not null);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'capsule_media_delete'
  ) then
    create policy "capsule_media_delete" on storage.objects
      for delete using (bucket_id = 'capsule-media' and auth.uid() = owner);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'capsule_media_select'
  ) then
    create policy "capsule_media_select" on storage.objects
      for select using (bucket_id = 'capsule-media');
  end if;
end $$;