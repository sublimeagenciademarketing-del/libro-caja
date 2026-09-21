-- Monedas en gastos fijos, cuotas, cobros, deudas y metas. Correr una sola vez
-- en el SQL Editor de Supabase, ANTES de publicar el código que las usa.
-- Todo lo cargado hasta hoy queda en guaraníes (PYG). Nadie ve cambios hasta
-- activar una moneda en Perfil, y las tarjetas siguen solo en guaraníes.
alter table recurring_expenses    add column if not exists moneda text not null default 'PYG';
alter table installment_purchases add column if not exists moneda text not null default 'PYG';
alter table receivables           add column if not exists moneda text not null default 'PYG';
alter table debts                 add column if not exists moneda text not null default 'PYG';
alter table savings_goals         add column if not exists moneda text not null default 'PYG';
