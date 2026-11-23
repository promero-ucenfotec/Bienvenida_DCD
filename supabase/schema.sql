-- TeachDeck · esquema de base de datos para Supabase
-- Pegá todo este archivo en Supabase → SQL Editor → Run. Se puede ejecutar más de una vez.

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now()
);

create table if not exists presentations (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Presentación sin título',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table presentations add column if not exists project_id uuid references projects(id) on delete set null;
create index if not exists presentations_project_idx on presentations(project_id);

create table if not exists items (
  id uuid primary key,
  presentation_id uuid not null references presentations(id) on delete cascade,
  pos double precision not null,
  type text not null,
  data jsonb not null default '{}',
  thumb text,
  updated_at timestamptz not null default now()
);
create index if not exists items_presentation_idx on items(presentation_id, pos);

create table if not exists sessions (
  code text primary key,
  presentation_id uuid not null references presentations(id) on delete cascade,
  title text,
  state jsonb not null default '{}',
  ended boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists players (
  session_code text not null references sessions(code) on delete cascade,
  uid uuid not null,
  name text not null check (char_length(name) between 1 and 60),
  email text check (char_length(email) <= 120),
  seen jsonb not null default '[]',
  joined_at timestamptz not null default now(),
  primary key (session_code, uid)
);

alter table players add column if not exists email text;
alter table players add column if not exists seen jsonb not null default '[]';

create table if not exists answers (
  session_code text not null references sessions(code) on delete cascade,
  item_id uuid not null,
  uid uuid not null,
  name text,
  value jsonb,
  frac real,
  pts integer not null default 0 check (pts between 0 and 1000),
  created_at timestamptz not null default now(),
  primary key (session_code, item_id, uid)
);
create index if not exists answers_session_item_idx on answers(session_code, item_id);

-- Seguridad: los administradores (usuarios con correo y contraseña) gestionan todo;
-- los participantes entran sin cuenta, leen el contenido y registran sus respuestas.
-- La lista de participantes (con sus correos) solo la leen los administradores.
alter table presentations enable row level security;
alter table items enable row level security;
alter table sessions enable row level security;
alter table players enable row level security;
alter table answers enable row level security;

do $$
declare t text;
begin
  foreach t in array array['presentations','items','sessions','players','answers'] loop
    execute format('drop policy if exists "leer" on %I', t);
    execute format('drop policy if exists "admin" on %I', t);
    execute format('create policy "leer" on %I for select to anon, authenticated using (true)', t);
    execute format('create policy "admin" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

drop policy if exists "leer" on players;
drop policy if exists "unirse" on players;
drop policy if exists "renombrarse" on players;

-- Los participantes se registran por medio de funciones, sin acceso directo a la tabla.
create or replace function public.join_session(p_code text, p_uid uuid, p_name text, p_email text)
returns void language sql security definer set search_path = public as $$
  insert into players (session_code, uid, name, email) values (p_code, p_uid, p_name, lower(p_email))
  on conflict (session_code, uid) do update set name = excluded.name, email = excluded.email;
$$;
create or replace function public.mark_seen(p_code text, p_uid uuid, p_seen jsonb)
returns void language sql security definer set search_path = public as $$
  update players set seen = p_seen where session_code = p_code and uid = p_uid and jsonb_typeof(p_seen) = 'array';
$$;
revoke all on function public.join_session(text, uuid, text, text) from public;
revoke all on function public.mark_seen(text, uuid, jsonb) from public;
grant execute on function public.join_session(text, uuid, text, text) to anon, authenticated;
grant execute on function public.mark_seen(text, uuid, jsonb) to anon, authenticated;

grant usage on schema public to anon, authenticated;
grant all on presentations, items, sessions, players, answers to authenticated;
grant select on presentations, items, sessions, answers to anon;
grant insert, update on answers to anon;
revoke all on players from anon;

-- Los proyectos agrupan presentaciones y solo los ven los administradores.
alter table projects enable row level security;
drop policy if exists "admin" on projects;
create policy "admin" on projects for all to authenticated using (true) with check (true);
grant all on projects to authenticated;
revoke all on projects from anon;

drop policy if exists "responder" on answers;
drop policy if exists "corregir" on answers;
create policy "responder" on answers for insert to anon with check (true);
create policy "corregir" on answers for update to anon using (true) with check (true);

-- Edición simultánea entre administradores
alter table items replica identity full;
do $$ begin
  alter publication supabase_realtime add table items;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table presentations;
exception when duplicate_object then null; end $$;

-- Almacenamiento de las diapositivas (lectura pública, escritura solo de administradores)
insert into storage.buckets (id, name, public) values ('slides', 'slides', true)
on conflict (id) do update set public = true;

drop policy if exists "slides lectura" on storage.objects;
drop policy if exists "slides admin" on storage.objects;
create policy "slides lectura" on storage.objects for select to anon, authenticated using (bucket_id = 'slides');
create policy "slides admin" on storage.objects for all to authenticated using (bucket_id = 'slides') with check (bucket_id = 'slides');

-- Limpieza automática: 3 días después de terminar una sala se borran sus datos de participación
-- (participantes, correos, respuestas y puntos). Las presentaciones y los proyectos se conservan.
alter table sessions add column if not exists ended_at timestamptz;
-- Una sala que nunca se terminó se borra a los 7 días de abierta.
create extension if not exists pg_cron;
select cron.schedule('pulso-limpieza', '15 * * * *', $$delete from public.sessions where (ended and coalesce(ended_at, created_at) < now() - interval '3 days') or (not ended and created_at < now() - interval '7 days')$$);
