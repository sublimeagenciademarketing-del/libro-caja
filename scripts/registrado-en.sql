-- Fecha Y HORA de registro (fecha_registro guarda solo la fecha).
-- Correr una sola vez en el SQL Editor de Supabase.

-- 1) Columna nueva; los registros futuros la llenan solos.
alter table user_config add column if not exists registrado_en timestamptz default now();

-- 2) Usuarios actuales: su fecha de registro a las 00:00 (y una fecha vieja si no tenían),
--    así ninguno aparece como "nuevo" en el botón admin.
update user_config
set registrado_en = coalesce(fecha_registro::timestamptz, '2000-01-01T00:00:00Z');
