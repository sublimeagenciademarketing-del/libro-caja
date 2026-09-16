-- AUDITORÍA: ¿existe en la base cada columna que el app usa?
-- Solo lectura. Si devuelve 0 filas, no hay desajustes.
-- Cada fila que devuelva es una consulta del app que falla en silencio.

with usadas(tabla, columna) as (values
  ('card_expenses','id'),('card_expenses','user_id'),('card_expenses','card_id'),
  ('card_expenses','grupo_id'),('card_expenses','cuenta'),('card_expenses','descripcion'),
  ('card_expenses','monto'),('card_expenses','fecha'),('card_expenses','fecha_compra'),
  ('card_expenses','estado'),('card_expenses','cuotas'),('card_expenses','numero_cuota'),

  ('credit_cards','id'),('credit_cards','user_id'),('credit_cards','nombre'),
  ('credit_cards','dia_cierre'),('credit_cards','dia_vencimiento_pago'),
  ('credit_cards','fecha_cierre'),('credit_cards','fecha_limite_pago'),('credit_cards','created_at'),

  ('debts','id'),('debts','user_id'),('debts','cuenta'),('debts','acreedor'),
  ('debts','monto_total'),('debts','monto_pagado'),('debts','fecha_limite'),('debts','estado'),

  ('installment_purchases','id'),('installment_purchases','user_id'),('installment_purchases','cuenta'),
  ('installment_purchases','descripcion'),('installment_purchases','dia_vencimiento'),
  ('installment_purchases','fecha_primera_cuota'),('installment_purchases','frecuencia'),
  ('installment_purchases','monto_por_cuota'),('installment_purchases','total_cuotas'),

  ('installments','id'),('installments','user_id'),('installments','purchase_id'),
  ('installments','numero_cuota'),('installments','monto'),
  ('installments','fecha_vencimiento'),('installments','estado'),

  ('licencias','email'),('licencias','activo'),('licencias','solo_lectura'),
  ('licencias','fecha_inicio'),('licencias','fecha_vencimiento'),

  ('receivables','id'),('receivables','user_id'),('receivables','cuenta'),('receivables','cliente'),
  ('receivables','monto'),('receivables','fecha_esperada'),('receivables','forma_pago'),
  ('receivables','frecuencia'),('receivables','estado'),('receivables','proximo_vencimiento'),('receivables','cobrado_fecha'),('receivables','activo'),

  ('recurring_expenses','id'),('recurring_expenses','user_id'),('recurring_expenses','cuenta'),
  ('recurring_expenses','descripcion'),('recurring_expenses','monto'),
  ('recurring_expenses','dia_vencimiento'),('recurring_expenses','frecuencia'),
  ('recurring_expenses','activo'),('recurring_expenses','pagado_mes'),('recurring_expenses','pagado_fecha'),('recurring_expenses','proximo_vencimiento'),

  ('savings_contributions','id'),('savings_contributions','goal_id'),
  ('savings_contributions','user_id'),('savings_contributions','monto'),('savings_contributions','fecha'),

  ('savings_goals','id'),('savings_goals','user_id'),('savings_goals','nombre'),
  ('savings_goals','monto_meta'),('savings_goals','monto_actual'),

  ('transactions','id'),('transactions','user_id'),('transactions','cuenta'),
  ('transactions','categoria'),('transactions','monto'),('transactions','tipo'),('transactions','fecha'),

  ('user_config','user_id'),('user_config','email'),('user_config','plan'),
  ('user_config','cuenta1'),('user_config','cuenta2'),
  ('user_config','fecha_registro'),('user_config','admin_last_visit'),

  ('user_profiles','id')
)
select u.tabla, u.columna as columna_que_falta
from usadas u
where not exists (
  select 1 from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = u.tabla
    and c.column_name = u.columna
)
order by u.tabla, u.columna;
