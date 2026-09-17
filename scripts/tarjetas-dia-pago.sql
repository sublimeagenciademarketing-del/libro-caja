-- Corrige el día de cierre y de pago de las tarjetas ya cargadas: se guardaban
-- un día antes de la fecha escrita (huso horario). Correr una vez en Supabase.
update credit_cards
set dia_cierre = extract(day from fecha_cierre::date),
    dia_vencimiento_pago = extract(day from fecha_limite_pago::date)
where fecha_cierre is not null and fecha_limite_pago is not null;
