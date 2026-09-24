-- Metas de ahorro por cuenta (como el resto de los paneles).
-- Correr una sola vez en el SQL Editor de Supabase.
alter table savings_goals add column if not exists cuenta text;

-- Las metas que ya existen quedan en la cuenta principal de cada usuario.
update savings_goals g
set cuenta = lower(uc.cuenta1)
from user_config uc
where uc.user_id = g.user_id and g.cuenta is null;
