-- Arreglo del desorden de la Paraguayo Japonesa (02/10/2026).
--
-- Qué toca: SOLO la fecha de pago (columna fecha_compra) de 7 consumos que
-- quedaron en el período equivocado. No toca montos, ni descripciones, ni
-- nada que ya esté pagado, ni ningún movimiento del panel principal.
--
-- Lo que hace, en palabras:
--   * La Panadería del 25/09 y el Mercado del 26/09 pasan del período que ya
--     pagaste al que vence el 06/11.
--   * Las cuotas del Dron vuelven a su lugar: la 2 al 06/11, la 3 a diciembre,
--     la 4 a enero, la 5 a febrero y la 6 a marzo. (Se habían corrido un mes
--     hacia atrás cada una cuando se cambió el ciclo.)
--
-- Correr una sola vez en el SQL Editor de Supabase.

-- 1) Antes de cambiar nada: así está hoy (solo lectura, para comparar después).
select descripcion, numero_cuota, monto, fecha_operacion as compra, fecha_compra as mes_de_pago, estado
from card_expenses
where estado <> 'pagado'
order by fecha_compra;

-- 2) Los dos consumos de fin de septiembre, al período del 06/11.
update card_expenses set fecha_compra = '2026-11-25' where id = 'dcaa8c18-3eb9-472f-88cc-ac19244352b7';
update card_expenses set fecha_compra = '2026-11-26' where id = 'bc988c87-91c8-4569-90b3-675c5e9d4e45';

-- 3) Las cuotas del Dron, una por período, empezando por la 2 en noviembre.
update card_expenses set fecha_compra = '2026-11-03' where id = '7c9057de-0ebd-4ee4-a365-38000f1343be'; -- cuota 2
update card_expenses set fecha_compra = '2026-12-03' where id = '426ddc1c-36a2-405a-9bc6-fe4f3402d7d9'; -- cuota 3
update card_expenses set fecha_compra = '2027-01-03' where id = '474e9bde-6c85-484f-8964-2fe6e93fc80f'; -- cuota 4
update card_expenses set fecha_compra = '2027-02-03' where id = 'f358f217-348b-4fdf-8b06-ef38d19184c7'; -- cuota 5
update card_expenses set fecha_compra = '2027-03-03' where id = 'c32c7a40-624c-4579-97b8-1e351c5f2ea7'; -- cuota 6

-- 4) Cómo quedó (solo lectura).
select descripcion, numero_cuota, monto, fecha_operacion as compra, fecha_compra as mes_de_pago, estado
from card_expenses
where estado <> 'pagado'
order by fecha_compra;
