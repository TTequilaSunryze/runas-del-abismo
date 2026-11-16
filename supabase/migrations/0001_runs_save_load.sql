-- Guardado de partidas. La tabla no tiene políticas: solo se accede con las funciones.
create table public.runs (
  code text primary key check (code ~ '^[A-Z]{4,8}$'),
  secret_hash text not null,
  state jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.runs enable row level security;

create or replace function public.save_run(p_code text, p_secret text, p_state jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare h text := encode(sha256(convert_to(p_secret, 'UTF8')), 'hex');
begin
  if length(p_secret) < 16 or octet_length(p_state::text) > 300000 then return false; end if;
  insert into public.runs(code, secret_hash, state) values (p_code, h, p_state)
  on conflict (code) do update set state = excluded.state, updated_at = now()
    where public.runs.secret_hash = h;
  return found;
end $$;

create or replace function public.load_run(p_code text)
returns jsonb language sql security definer set search_path = '' stable as $$
  select state from public.runs where code = p_code;
$$;

revoke all on function public.save_run(text, text, jsonb) from public;
revoke all on function public.load_run(text) from public;
grant execute on function public.save_run(text, text, jsonb) to anon, authenticated;
grant execute on function public.load_run(text) to anon, authenticated;
