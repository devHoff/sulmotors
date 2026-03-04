
-- ==========================================
-- SCRIPT DE CORREÇÃO COMPLETA: STORAGE E PERFIL
-- ==========================================

-- 1. Create/Ensure 'avatars' bucket exists
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- 2. Drop existing policies to ensure clean slate
drop policy if exists "Avatar images are publicly accessible." on storage.objects;
drop policy if exists "Authenticated users can upload avatars." on storage.objects;
drop policy if exists "Users can update their own avatars." on storage.objects;
drop policy if exists "Users can delete their own avatars." on storage.objects;

-- 3. Create new reliable policies
create policy "Avatar images are publicly accessible." 
  on storage.objects for select 
  using ( bucket_id = 'avatars' );

create policy "Authenticated users can upload avatars." 
  on storage.objects for insert 
  with check ( bucket_id = 'avatars' and auth.role() = 'authenticated' );

create policy "Users can update their own avatars." 
  on storage.objects for update 
  using ( bucket_id = 'avatars' and auth.uid() = owner );

create policy "Users can delete their own avatars." 
  on storage.objects for delete 
  using ( bucket_id = 'avatars' and auth.uid() = owner );

-- 4. Ensure 'profiles' table exists and has RLS enabled
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  full_name text,
  email text,
  phone text,
  avatar_url text,
  updated_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

alter table public.profiles enable row level security;

-- 5. Profile Policies
drop policy if exists "Public profiles are viewable by everyone." on profiles;
create policy "Public profiles are viewable by everyone." 
  on profiles for select 
  using ( true );

drop policy if exists "Users can insert their own profile." on profiles;
create policy "Users can insert their own profile." 
  on profiles for insert 
  with check ( auth.uid() = id );

drop policy if exists "Users can update own profile." on profiles;
create policy "Users can update own profile." 
  on profiles for update 
  using ( auth.uid() = id );

-- 6. Trigger for new users (optional but good)
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'phone');
  return new;
end;
$$ language plpgsql security definer;

-- Recreate trigger
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 7. Backfill existing users into profiles
insert into public.profiles (id, email, full_name, phone)
select 
  id, 
  email, 
  raw_user_meta_data->>'full_name', 
  raw_user_meta_data->>'phone'
from auth.users
on conflict (id) do nothing;
