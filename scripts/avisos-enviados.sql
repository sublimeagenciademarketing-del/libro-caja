-- Recordatorios push: qué aviso ya se mandó a cada usuario, para no repetirlo.
-- Correr una sola vez en el SQL Editor de Supabase.
--
-- Solo escribe y lee el servidor (con la clave de servicio). Con RLS activado y
-- sin políticas, desde el app nadie puede ver ni tocar esta tabla.

create table if not exists avisos_enviados (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  clave text not null,
  enviado_en timestamptz not null default now(),
  unique (user_id, clave)
);

alter table avisos_enviados enable row level security;

create index if not exists avisos_enviados_user_idx on avisos_enviados (user_id);
