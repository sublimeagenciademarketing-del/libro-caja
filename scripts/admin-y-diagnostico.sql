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


-- ─────────────────────────────────────────────────────────────
-- 3) TARJETAS: por qué "Revertir" no se guarda
--    Marcar como pagado sí funciona, revertir no. Eso apunta a
--    que falta el permiso de UPDATE en card_expenses, o que la
--    condición del permiso solo deja pasar los pendientes.
-- ─────────────────────────────────────────────────────────────

-- 3a. Ver los permisos de card_expenses (solo lectura).
--     Comparalos con los de installments, donde revertir sí anda.
select tablename, policyname, cmd, qual as condicion, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('card_expenses', 'installments')
order by tablename, cmd;

-- 3b. Ver si hay filas sin dueño: si user_id es null, ningún
--     permiso las deja tocar.
select estado, count(*) as filas, count(user_id) as con_user_id
from card_expenses
group by estado;

-- 3c. Si 3a muestra que NO hay una política de update para
--     card_expenses, este bloque la crea (misma regla que el resto
--     de las tablas: cada quien toca solo lo suyo).
-- create policy "Actualizar mis propios gastos de tarjeta"
--   on card_expenses for update
--   using (auth.uid() = user_id)
--   with check (auth.uid() = user_id);

-- 3d. Si 3a muestra una política de update cuya condición menciona
--     estado = 'pendiente', esa es la culpable: solo permite pasar
--     de pendiente a pagado. Se reemplaza por la de arriba:
-- drop policy "<nombre exacto que devolvió 3a>" on card_expenses;
-- create policy "Actualizar mis propios gastos de tarjeta"
--   on card_expenses for update
--   using (auth.uid() = user_id)
--   with check (auth.uid() = user_id);
