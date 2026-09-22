-- Pantalla de ingreso: saber si un email ya tiene cuenta y si la confirmó.
-- Correr una sola vez en el SQL Editor de Supabase.
-- Responde solo 'no_existe' | 'sin_confirmar' | 'confirmado'; no expone datos.
create or replace function public.estado_email(p_email text)
returns text
language sql
security definer
set search_path = public, auth
as $$
  select coalesce(
    (select case when u.email_confirmed_at is null then 'sin_confirmar' else 'confirmado' end
     from auth.users u
     where lower(u.email) = lower(trim(p_email))
     limit 1),
    'no_existe');
$$;

revoke all on function public.estado_email(text) from public;
grant execute on function public.estado_email(text) to anon, authenticated;
