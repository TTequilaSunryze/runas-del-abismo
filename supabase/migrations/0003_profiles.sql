-- Cuentas: progreso de cada jugador y su equipo de duelo. Cada uno solo ve y cambia su fila.
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 3 and 14 and name ~ '^[A-Za-z0-9_ñÑáéíóúÁÉÍÓÚ-]+$'),
  meta jsonb not null default '{}'::jsonb check (octet_length(meta::text) < 200000),
  team jsonb not null default '[]'::jsonb check (octet_length(team::text) < 40000),
  updated_at timestamptz not null default now()
);
create unique index profiles_name_key on public.profiles (lower(name));
alter table public.profiles enable row level security;

create policy "leer mi perfil" on public.profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy "crear mi perfil" on public.profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "cambiar mi perfil" on public.profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- El equipo de duelo de un jugador, buscado por su nombre de cuenta: es lo único público.
create or replace function public.get_team(p_name text)
returns jsonb language sql security definer set search_path = '' stable as $$
  select jsonb_build_object('name', name, 'team', team) from public.profiles where lower(name) = lower(p_name) and jsonb_array_length(team) > 0;
$$;
revoke all on function public.get_team(text) from public;
grant execute on function public.get_team(text) to anon, authenticated;
