-- TimeBottle · run this ONCE in the Supabase SQL Editor
-- https://supabase.com/dashboard → your project → SQL Editor
--
-- Optional: for instant sign-in (no email confirmation step),
-- go to Authentication → Providers → Email → turn OFF "Confirm email".
-- Sign-ups will then log you in immediately.

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

grant usage on schema public to anon, authenticated;
grant all on public.capsules to anon, authenticated;
grant all on public.profiles to anon, authenticated;

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

-- 3) storage bucket for photos + audio (public so stangers can visit media)
insert into storage.buckets (id, name, public)
values ('capsule-media', 'capsule-media', true)
on conflict (id) do update set public = true;

drop policy if exists "capsule_media_insert" on storage.objects;
create policy "capsule_media_insert" on storage.objects
  for insert with check (bucket_id = 'capsule-media' and auth.uid() is not null);

drop policy if exists "capsule_media_delete" on storage.objects;
create policy "capsule_media_delete" on storage.objects
  for delete using (bucket_id = 'capsule-media' and auth.uid() = owner);

drop policy if exists "capsule_media_select" on storage.objects;
create policy "capsule_media_select" on storage.objects
  for select using (bucket_id = 'capsule-media');