-- Tutorial en video "Cómo se usa MiCaja".
--
-- Una columna nueva para anotar cuándo cada persona terminó de verlo. Se
-- guarda en la base y no en el teléfono, así no le vuelve a aparecer aunque
-- cambie de celular o entre desde otra computadora.
--
-- No toca ningún dato existente: la columna nace vacía para todos, que es lo
-- que corresponde (nadie lo vio todavía).
--
-- Correr una sola vez en el SQL Editor de Supabase.

alter table user_config add column if not exists tutorial_visto timestamptz;

-- Para ver cómo quedó (solo lectura).
select email, cuenta1, tutorial_visto from user_config order by registrado_en;
