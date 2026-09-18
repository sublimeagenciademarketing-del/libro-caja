-- Monedas extra (US$ y R$). Correr una sola vez en el SQL Editor de Supabase.
-- Todo lo cargado hasta hoy queda en guaraníes (PYG); nadie ve cambios hasta activar una moneda en Perfil.
alter table transactions add column if not exists moneda text not null default 'PYG';
alter table user_config add column if not exists monedas text[] not null default '{}';
