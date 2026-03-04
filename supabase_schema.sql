-- Create a table for public profiles linked to auth.users
create table profiles (
  id uuid references auth.users not null primary key,
  email text,
  full_name text,
  phone text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Turn on Row Level Security for profiles
alter table profiles enable row level security;

-- Create policies for profiles
create policy "Public profiles are viewable by everyone." on profiles
  for select using (true);

create policy "Users can insert their own profile." on profiles
  for insert with check (auth.uid() = id);

create policy "Users can update own profile." on profiles
  for update using (auth.uid() = id);

-- Create a table for car advertisements (anuncios)
create table anuncios (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  marca text not null,
  modelo text not null,
  ano integer not null,
  preco numeric not null,
  quilometragem integer not null,
  telefone text not null,
  descricao text,
  combustivel text not null,
  cambio text not null,
  cor text not null,
  cidade text not null,
  aceita_troca boolean default false,
  imagens text[] default '{}',
  destaque boolean default false,
  impulsionado boolean default false,
  impulsionado_ate timestamp with time zone,
  prioridade integer default 0,
  modelo_3d boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Turn on Row Level Security for anuncios
alter table anuncios enable row level security;

-- Create policies for anuncios
create policy "Adverts are viewable by everyone." on anuncios
  for select using (true);

create policy "Users can insert their own adverts." on anuncios
  for insert with check (auth.uid() = user_id);

create policy "Users can update own adverts." on anuncios
  for update using (auth.uid() = user_id);

create policy "Users can delete own adverts." on anuncios
  for delete using (auth.uid() = user_id);

-- Storage bucket for car images
insert into storage.buckets (id, name, public) 
values ('car-images', 'car-images', true);

-- Storage policies
create policy "Car images are publicly accessible." on storage.objects
  for select using (bucket_id = 'car-images');

create policy "Authenticated users can upload car images." on storage.objects
  for insert with check (bucket_id = 'car-images' and auth.role() = 'authenticated');

create policy "Users can update their own car images." on storage.objects
  for update using (bucket_id = 'car-images' and auth.uid() = owner);

create policy "Users can delete their own car images." on storage.objects
  for delete using (bucket_id = 'car-images' and auth.uid() = owner);
