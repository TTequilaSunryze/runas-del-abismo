-- Para añadir amigos: devuelve el nombre de cuenta tal como está escrito, o null si no existe.
create or replace function public.account_name(p_name text)
returns text language sql security definer set search_path = '' stable as $$
  select name from public.profiles where lower(name) = lower(p_name) limit 1;
$$;
revoke all on function public.account_name(text) from public, anon;
grant execute on function public.account_name(text) to authenticated;
