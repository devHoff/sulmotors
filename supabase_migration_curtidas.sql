-- Migration: Create curtidas (likes) table
-- Run this in your Supabase SQL Editor

create table if not exists curtidas (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  anuncio_id uuid references anuncios(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, anuncio_id)
);

-- Turn on Row Level Security
alter table curtidas enable row level security;

-- Policies
create policy "Anyone can view likes count." on curtidas
  for select using (true);

create policy "Authenticated users can like." on curtidas
  for insert with check (auth.uid() = user_id);

create policy "Users can remove their own likes." on curtidas
  for delete using (auth.uid() = user_id);
