// Campanita: qué está por vencer y qué se venció. La misma lógica la usan la
// pantalla principal y el servidor (recordatorios push), así nunca dicen
// cosas distintas.
import { hoyISO, deISO, ultimoDia, proximoDe, esRecurrente, ventanaAviso, sumarDias } from './recurrencia.js';

// Columnas que necesita el cálculo, por tabla.
const SELECT = {
  cobros: 'cliente, monto, cuenta, estado, frecuencia, fecha_esperada, proximo_vencimiento, cobrado_fecha, activo, moneda',
  deudas: 'acreedor, monto_total, monto_pagado, fecha_limite, cuenta, estado, moneda',
  cuotas: 'monto, fecha_vencimiento, estado, installment_purchases!inner(descripcion, user_id, cuenta, moneda)',
  gastos: 'descripcion, monto, cuenta, activo, pagado_mes, pagado_fecha, frecuencia, dia_vencimiento, proximo_vencimiento, moneda',
  tarjetas: 'card_id, descripcion, monto, fecha:fecha_compra, cuenta, estado',
  cards: 'id, nombre, dia_vencimiento_pago, fecha_limite_pago',
};

// Trae de la base todo lo que puede generar un aviso para un usuario.
// `cliente` es un cliente de Supabase (el del navegador o el del servidor).
export async function cargarAvisos(cliente, userId) {
  const [cobros, deudas, cuotas, gastos, tarjetas, cards] = await Promise.all([
    cliente.from('receivables').select(SELECT.cobros).eq('user_id', userId),
    cliente.from('debts').select(SELECT.deudas).eq('user_id', userId),
    cliente.from('installments').select(SELECT.cuotas).eq('estado', 'pendiente').eq('installment_purchases.user_id', userId),
    cliente.from('recurring_expenses').select(SELECT.gastos).eq('user_id', userId).eq('activo', true),
    cliente.from('card_expenses').select(SELECT.tarjetas).eq('user_id', userId).neq('estado', 'pagado'),
    cliente.from('credit_cards').select(SELECT.cards).eq('user_id', userId),
  ]);
  // Si una consulta falla, mejor cortar que calcular con datos incompletos.
  const fallo = [['cobros', cobros], ['deudas', deudas], ['cuotas', cuotas], ['gastos', gastos], ['tarjetas', tarjetas], ['cards', cards]].find(([, r]) => r.error);
  if (fallo) throw new Error(`avisos/${fallo[0]}: ${fallo[1].error.message}`);
  return { cobros: cobros.data || [], deudas: deudas.data || [], cuotas: cuotas.data || [], gastos: gastos.data || [], tarjetas: tarjetas.data || [], cards: cards.data || [] };
}

// Moneda de un ítem; los cargados antes de las monedas extra valen en guaraníes.
const monedaDe = (i) => (i?.moneda && i.moneda !== 'PYG' ? i.moneda : 'PYG');

// Devuelve { overdue, upcoming } ordenados por fecha. Cada ítem:
// { tipo, label, monto, fecha, cuenta, moneda }. Un aviso por ítem: el próximo
// vencimiento. Los repetitivos avisan con menos anticipación (un semanal
// siempre está a menos de 7 días).
export function calcularAvisos({ cobros = [], deudas = [], cuotas = [], gastos = [], tarjetas = [], cards = [] }, hoy = hoyISO()) {
  const en7 = sumarDias(hoy, 7);
  const overdue = [], upcoming = [];
  const ubicar = (item, ventana) => {
    if (item.fecha < hoy) overdue.push(item);
    else if (item.fecha <= ventana) upcoming.push(item);
  };

  cobros.filter(r => r.activo !== false).forEach(r => {
    const recurrente = esRecurrente(r);
    if (!recurrente && (r.estado === 'cobrado' || !r.fecha_esperada)) return;
    const fecha = recurrente ? proximoDe(r, hoy) : r.fecha_esperada;
    if (!fecha) return;
    ubicar({ tipo: 'cobro', label: r.cliente, monto: r.monto, fecha, cuenta: r.cuenta, moneda: monedaDe(r) }, recurrente ? sumarDias(hoy, ventanaAviso(r.frecuencia)) : en7);
  });

  deudas.filter(r => r.estado !== 'pagado' && r.fecha_limite).forEach(r => {
    ubicar({ tipo: 'deuda', label: r.acreedor, monto: (r.monto_total || 0) - (r.monto_pagado || 0), fecha: r.fecha_limite, cuenta: r.cuenta, moneda: monedaDe(r) }, en7);
  });

  cuotas.filter(r => r.installment_purchases).forEach(r => {
    ubicar({ tipo: 'cuota', label: r.installment_purchases.descripcion, monto: r.monto, fecha: r.fecha_vencimiento, cuenta: r.installment_purchases.cuenta, moneda: monedaDe(r.installment_purchases) }, en7);
  });

  gastos.forEach(g => {
    const fecha = proximoDe(g, hoy);
    if (!fecha) return;
    ubicar({ tipo: 'gasto', label: g.descripcion, monto: g.monto, fecha, cuenta: g.cuenta, moneda: monedaDe(g) }, sumarDias(hoy, ventanaAviso(g.frecuencia || 'mensual')));
  });

  // Tarjetas: una línea por tarjeta y mes de pago. Cada gasto de tarjeta guarda
  // en su fecha el mes en que se paga; el pago vence el día de vencimiento de
  // la tarjeta de ese mes, con el total de lo que quedó sin pagar.
  const porTarjeta = new Map();
  tarjetas.forEach(t => {
    if (!t.fecha) return;
    const card = cards.find(c => c.id === t.card_id);
    // La fecha límite escrita manda; dia_vencimiento_pago queda de respaldo (en tarjetas viejas se guardó un día corrido).
    const dia = card?.fecha_limite_pago ? deISO(card.fecha_limite_pago).getDate() : (Number(card?.dia_vencimiento_pago) || deISO(t.fecha).getDate());
    const fecha = fechaConDia(t.fecha, dia);
    const clave = `${t.card_id}|${fecha}|${t.cuenta}`;
    const linea = porTarjeta.get(clave) || { tipo: 'tarjeta', label: card?.nombre || t.descripcion || 'Tarjeta', monto: 0, fecha, cuenta: t.cuenta };
    linea.monto += Number(t.monto) || 0;
    porTarjeta.set(clave, linea);
  });
  porTarjeta.forEach(linea => ubicar(linea, en7));

  const porFecha = (a, b) => a.fecha < b.fecha ? -1 : 1;
  overdue.sort(porFecha);
  upcoming.sort(porFecha);
  return { overdue, upcoming };
}

// Mismo año y mes que `iso`, con el día pedido (recortado si el mes es más corto).
function fechaConDia(iso, dia) {
  const d = deISO(iso);
  const y = d.getFullYear(), m0 = d.getMonth();
  const dd = Math.min(Math.max(1, dia), ultimoDia(y, m0));
  return `${y}-${String(m0 + 1).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

// Identifica un aviso (la misma clave que usa el app para "ya lo vi").
export const claveAviso = (n) => `${n.tipo}|${n.label}|${n.fecha}`;

// Fecha de hoy en Paraguay, para el servidor (que corre en otro huso horario).
export function hoyEnParaguay() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Asuncion', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

// Texto corto para el push: "Alquiler (20/09), Cobro a Juan (22/09) y 2 más".
const PREFIJO = { cobro: 'Cobro a ', deuda: 'Deuda con ', cuota: 'Cuota ', gasto: '', tarjeta: 'Tarjeta ' };
export function textoAvisos(items, max = 3) {
  const ddmm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  const partes = items.slice(0, max).map(n => `${PREFIJO[n.tipo] ?? ''}${n.label} (${ddmm(n.fecha)})`);
  const resto = items.length - partes.length;
  return resto > 0 ? `${partes.join(', ')} y ${resto} más` : partes.join(', ');
}
