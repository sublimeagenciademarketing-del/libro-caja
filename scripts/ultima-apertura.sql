-- Última vez que cada usuario abrió el app (la anota el app una vez por día).
-- Correr una sola vez en el SQL Editor de Supabase.
alter table user_config add column if not exists ultima_apertura timestamptz;
