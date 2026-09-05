-- Ejecutar esto en Supabase: Project → SQL Editor → New query → pegar y correr

create table if not exists transactions (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users not null,
  monto numeric not null,
  fecha date not null,
  categoria text not null,
  tipo text not null check (tipo in ('ingreso', 'gasto')),
  cuenta text not null check (cuenta in ('sublime', 'personal')),
  created_at timestamptz default now()
);

-- Activa seguridad a nivel de fila: cada usuario solo ve/edita sus propios movimientos
alter table transactions enable row level security;

create policy "Ver mis propios movimientos"
  on transactions for select
  using (auth.uid() = user_id);

create policy "Insertar mis propios movimientos"
  on transactions for insert
  with check (auth.uid() = user_id);

create policy "Eliminar mis propios movimientos"
  on transactions for delete
  using (auth.uid() = user_id);

create policy "Actualizar mis propios movimientos"
  on transactions for update
  using (auth.uid() = user_id);
