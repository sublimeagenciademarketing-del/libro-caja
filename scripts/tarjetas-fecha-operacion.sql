-- Tarjetas: guardar la fecha real en que se hizo la compra.
-- Hasta ahora el app guardaba solo el mes en que se paga (compra + 1 mes por cuota)
-- y la fecha original se perdía. Con esta columna el app puede ubicar cada consumo
-- en el período correcto y recalcularlo si cambia la fecha de cierre.
-- Correr una sola vez en el SQL Editor de Supabase.

-- 1) La columna nueva (vacía al principio).
alter table card_expenses add column if not exists fecha_operacion date;

-- 2) Completa lo ya cargado dando vuelta la cuenta: la fecha guardada menos
--    un mes por cada cuota. No cambia ningún dato existente, solo rellena la
--    columna nueva. (En compras hechas el 29, 30 o 31 puede quedar corrida un
--    día por los meses cortos; no afecta el período al que pertenecen.)
update card_expenses
set fecha_operacion = (fecha_compra::date - (coalesce(numero_cuota, 1) || ' month')::interval)::date
where fecha_operacion is null;

-- 3) Para ver cómo quedó (solo lectura).
select descripcion, numero_cuota, cuotas, fecha_operacion as compra_real, fecha_compra as mes_de_pago, monto
from card_expenses
order by fecha_operacion desc
limit 20;
