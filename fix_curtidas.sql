-- Create curtidas table if it doesn't exist (it might be missing or have wrong schema)
create table if not exists curtidas (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  anuncio_id uuid references anuncios(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, anuncio_id)
);

-- Turn on RLS
alter table curtidas enable row level security;

-- Drop existing policies to avoid conflicts/duplicates
drop policy if exists "Likes are viewable by everyone." on curtidas;
drop policy if exists "Users can insert their own likes." on curtidas;
drop policy if exists "Users can delete their own likes." on curtidas;

-- Create correct policies
create policy "Likes are viewable by everyone." on curtidas
  for select using (true);

create policy "Users can insert their own likes." on curtidas
  for insert with check (auth.uid() = user_id);

create policy "Users can delete their own likes." on curtidas
  for delete using (auth.uid() = user_id);
