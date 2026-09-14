-- Supabase → SQL Editor → New query. Correr cada bloque por separado.

-- ─────────────────────────────────────────────────────────────
-- 1) SEGURIDAD: dejar admin solo a sublimeagenciademarketing
-- ─────────────────────────────────────────────────────────────

-- 1a. Ver primero quién tiene admin hoy (no cambia nada)
select p.id, u.email, p.role
from user_profiles p
join auth.users u on u.id = p.id
where p.role = 'admin';

-- 1b. Quitar admin a todos menos a la cuenta dueña
update user_profiles p
set role = 'basico'
where p.role = 'admin'
  and p.id <> (select id from auth.users
               where email = 'sublimeagenciademarketing@gmail.com');

-- 1c. Asegurar que la cuenta dueña sí tenga admin
update user_profiles
set role = 'admin'
where id = (select id from auth.users
            where email = 'sublimeagenciademarketing@gmail.com');


-- ─────────────────────────────────────────────────────────────
-- 2) DIAGNÓSTICO: por qué una cuenta muestra balance ₲ 0
--    (solo lectura, no modifica nada)
-- ─────────────────────────────────────────────────────────────

-- 2a. Comparar el nombre de cuenta configurado contra el que
--     realmente tienen guardado los movimientos.
--     Si "cuenta_en_config" y "cuenta_en_movimiento" no coinciden,
--     ese era el motivo del ₲ 0.
select
  uc.email,
  uc.cuenta1                as cuenta_en_config,
  uc.cuenta2                as segunda_cuenta,
  t.cuenta                  as cuenta_en_movimiento,
  count(*)                  as movimientos,
  sum(case when t.tipo = 'ingreso' then t.monto else -t.monto end) as balance
from user_config uc
left join transactions t on t.user_id = uc.user_id
group by uc.email, uc.cuenta1, uc.cuenta2, t.cuenta
order by uc.email, t.cuenta;

-- 2b. Cuentas registradas sin ningún movimiento cargado
select uc.email, uc.cuenta1, uc.fecha_registro
from user_config uc
where not exists (
  select 1 from transactions t where t.user_id = uc.user_id
)
order by uc.fecha_registro desc;

-- 2c. Filas de user_config cuyo usuario ya no existe en Auth
--     (cuentas fantasma que aparecían en el panel admin)
select uc.email, uc.user_id
from user_config uc
where not exists (select 1 from auth.users u where u.id = uc.user_id);

-- 2d. Si 2c devuelve filas y querés limpiarlas:
-- delete from user_config uc
-- where not exists (select 1 from auth.users u where u.id = uc.user_id);
