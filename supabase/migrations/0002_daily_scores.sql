-- Clasificación del reto diario. Sin políticas: solo se accede con las funciones.
create table public.daily_scores (
  day date not null,
  code text not null check (code ~ '^[A-Z]{4,8}$'),
  names text not null check (char_length(names) <= 80),
  players int not null check (players between 1 and 4),
  score int not null check (score between 0 and 100000),
  won boolean not null default false,
  zone int not null check (zone between 1 and 3),
  updated_at timestamptz not null default now(),
  primary key (day, code)
);
alter table public.daily_scores enable row level security;

create or replace function public.submit_daily(p_day date, p_code text, p_names text, p_players int, p_score int, p_won boolean, p_zone int)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_day < (now() at time zone 'utc')::date - 1 or p_day > (now() at time zone 'utc')::date + 1 then return false; end if;
  insert into public.daily_scores(day, code, names, players, score, won, zone)
  values (p_day, p_code, left(p_names, 80), p_players, p_score, p_won, p_zone)
  on conflict (day, code) do update set score = greatest(public.daily_scores.score, excluded.score),
    won = public.daily_scores.won or excluded.won, zone = greatest(public.daily_scores.zone, excluded.zone),
    names = excluded.names, updated_at = now();
  return true;
end $$;

create or replace function public.top_daily(p_day date)
returns table(names text, players int, score int, won boolean, zone int)
language sql security definer set search_path = '' stable as $$
  select names, players, score, won, zone from public.daily_scores where day = p_day order by score desc, updated_at asc limit 10;
$$;

revoke all on function public.submit_daily(date, text, text, int, int, boolean, int) from public;
revoke all on function public.top_daily(date) from public;
grant execute on function public.submit_daily(date, text, text, int, int, boolean, int) to anon, authenticated;
grant execute on function public.top_daily(date) to anon, authenticated;
