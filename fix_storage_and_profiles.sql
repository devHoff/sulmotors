-- 1. Create the 'avatars' bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- 2. Storage Policies for 'avatars'
-- These commands might error if the policy already exists. 
-- In Supabase SQL Editor, it's safer to drop them first or just ignore errors.
drop policy if exists "Avatar images are publicly accessible." on storage.objects;
create policy "Avatar images are publicly accessible." on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "Authenticated users can upload avatars." on storage.objects;
create policy "Authenticated users can upload avatars." on storage.objects
  for insert with check (bucket_id = 'avatars' and auth.role() = 'authenticated');

drop policy if exists "Users can update their own avatars." on storage.objects;
create policy "Users can update their own avatars." on storage.objects
  for update using (bucket_id = 'avatars' and auth.uid() = owner);

drop policy if exists "Users can delete their own avatars." on storage.objects;
create policy "Users can delete their own avatars." on storage.objects
  for delete using (bucket_id = 'avatars' and auth.uid() = owner);

-- 3. Backfill Profiles for existing users
-- This inserts a profile row for any user in auth.users that doesn't have one yet.
insert into public.profiles (id, email, full_name, phone)
select 
  id, 
  email, 
  raw_user_meta_data->>'full_name', 
  raw_user_meta_data->>'phone'
from auth.users
on conflict (id) do nothing;

-- 4. Verify/Ensure Profile Policies allow updates
drop policy if exists "Users can update own profile." on profiles;
create policy "Users can update own profile." on profiles
  for update using (auth.uid() = id);

drop policy if exists "Users can insert their own profile." on profiles;
create policy "Users can insert their own profile." on profiles
  for insert with check (auth.uid() = id);

drop policy if exists "Public profiles are viewable by everyone." on profiles;
create policy "Public profiles are viewable by everyone." on profiles
  for select using (true);
