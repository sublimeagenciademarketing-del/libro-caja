// Motor de recurrencia para gastos fijos y cobros repetitivos.
//
// Regla única: cada ítem recurrente tiene un "próximo vencimiento". Pagar o
// cobrar lo corre un período adelante; revertir lo trae un período atrás. Todo
// lo demás (pendientes, atrasos, proyecciones, avisos) se deriva de esa fecha.
//
// Frecuencias:
//   mensual   → un vencimiento por mes, el día ancla (recortado si el mes es corto)
//   quincenal → dos por mes en días fijos: el ancla y 15 después (5 y 20, 15 y 30)
//   semanal   → cada 7 días desde el próximo vencimiento
//
// Las fechas se manejan como 'YYYY-MM-DD' en hora local. Nunca toISOString():
// de noche en Paraguay (UTC-3/-4) devolvería el día siguiente.
import { sumarMeses } from './fechas.js';

export const aISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const deISO = (s) => new Date(s + 'T12:00:00');
export const hoyISO = () => aISO(new Date());
export const mesDe = (iso) => iso.slice(0, 7);

export const ultimoDia = (y, m0) => new Date(y, m0 + 1, 0).getDate();
export const enMes = (y, m0, dia) => {
  const d = new Date(y, m0, 1, 12);
  d.setDate(Math.min(dia, ultimoDia(d.getFullYear(), d.getMonth())));
  return aISO(d);
};
export const limitesMes = (y, m0) => ({ inicio: enMes(y, m0, 1), fin: enMes(y, m0, 31) });
export const sumarDias = (iso, n) => { const d = deISO(iso); d.setDate(d.getDate() + n); return aISO(d); };

// Los cobros 'cobrado' del modelo anterior (sin próximo ni fecha de cobro) son historial de una vez.
export const esRecurrente = (item) =>
  !!item?.frecuencia && item.frecuencia !== 'una_vez'
  && !(item.estado === 'cobrado' && !item.proximo_vencimiento && !item.cobrado_fecha);
export const frecuenciaDe = (item, porDefecto = 'mensual') => item?.frecuencia || porDefecto;

// Día del mes que ancla la cadencia (1-31).
export function diaAncla(item) {
  if (item?.dia_vencimiento) return Number(item.dia_vencimiento);
  const base = item?.proximo_vencimiento || item?.fecha_esperada || item?.pagado_fecha || item?.cobrado_fecha;
  return base ? deISO(base).getDate() : 1;
}

// Quincenal: los dos días fijos del mes a partir del ancla.
function diasQuincena(ancla) {
  const d1 = ancla > 15 ? ancla - 15 : ancla;
  return [d1, d1 + 15];
}

// Primera ocurrencia estrictamente posterior a `iso`.
export function siguiente(iso, frecuencia, ancla) {
  if (frecuencia === 'semanal') return sumarDias(iso, 7);
  if (frecuencia === 'quincenal') {
    const [d1, d2] = diasQuincena(ancla);
    const d = deISO(iso); const y = d.getFullYear(), m0 = d.getMonth();
    const c1 = enMes(y, m0, d1), c2 = enMes(y, m0, d2);
    if (iso < c1) return c1;
    if (iso < c2) return c2;
    return enMes(y, m0 + 1, d1);
  }
  return aISO(sumarMeses(deISO(iso), 1, ancla));
}

// Última ocurrencia estrictamente anterior a `iso`.
export function anterior(iso, frecuencia, ancla) {
  if (frecuencia === 'semanal') return sumarDias(iso, -7);
  if (frecuencia === 'quincenal') {
    const [d1, d2] = diasQuincena(ancla);
    const d = deISO(iso); const y = d.getFullYear(), m0 = d.getMonth();
    const c1 = enMes(y, m0, d1), c2 = enMes(y, m0, d2);
    if (iso > c2) return c2;
    if (iso > c1) return c1;
    return enMes(y, m0 - 1, d2);
  }
  return aISO(sumarMeses(deISO(iso), -1, ancla));
}

// Próximo vencimiento del ítem. Si todavía no tiene la columna cargada (filas
// anteriores al motor), se deduce del estado viejo sin inventar atrasos.
export function proximoDe(item, hoy = hoyISO()) {
  if (!item) return null;
  if (item.proximo_vencimiento) return item.proximo_vencimiento;
  const frec = frecuenciaDe(item);
  const ancla = diaAncla(item);
  const ultimoPago = item.pagado_fecha || item.cobrado_fecha || null;

  // Cobros: la fecha esperada es el ancla original. Sin fecha no hay cadencia.
  if ('fecha_esperada' in item) {
    if (!item.fecha_esperada) return null;
    if (!ultimoPago || ultimoPago < item.fecha_esperada) return item.fecha_esperada;
    return siguiente(ultimoPago, frec, ancla);
  }

  // Gastos fijos heredados (solo tienen dia_vencimiento).
  const h = deISO(hoy); const y = h.getFullYear(), m0 = h.getMonth();
  if (frec === 'mensual') {
    const esteMes = enMes(y, m0, ancla);
    return item.pagado_mes === mesDe(hoy) ? siguiente(esteMes, 'mensual', ancla) : esteMes;
  }
  if (ultimoPago) return siguiente(ultimoPago, frec, ancla);
  // Sin pagos: primera ocurrencia de la cadencia desde ayer (evita un atraso inventado).
  return siguiente(sumarDias(hoy, -1), frec, ancla);
}

const TOPE = 120;

// Ocurrencias pendientes desde el próximo vencimiento hasta `hasta` (inclusive).
export function ocurrenciasHasta(item, hasta, hoy = hoyISO()) {
  const frec = frecuenciaDe(item);
  const ancla = diaAncla(item);
  let f = proximoDe(item, hoy);
  const out = [];
  while (f && f <= hasta && out.length < TOPE) { out.push(f); f = siguiente(f, frec, ancla); }
  return out;
}

// Ocurrencias pendientes que caen en el mes (y, m0). Con incluirAtrasadas
// (mes actual) entran también las anteriores al mes que siguen sin pagar.
export function ocurrenciasEnMes(item, y, m0, hoy = hoyISO(), { incluirAtrasadas = false } = {}) {
  const { inicio, fin } = limitesMes(y, m0);
  return ocurrenciasHasta(item, fin, hoy).filter(f => incluirAtrasadas || f >= inicio);
}

// Todas las fechas de la cadencia dentro del mes, pagadas o no ("total del mes").
export function cadenciaEnMes(item, y, m0, hoy = hoyISO()) {
  const frec = frecuenciaDe(item);
  const ancla = diaAncla(item);
  const { inicio, fin } = limitesMes(y, m0);
  if (frec === 'mensual') return [enMes(y, m0, ancla)];
  if (frec === 'quincenal') { const [d1, d2] = diasQuincena(ancla); return [enMes(y, m0, d1), enMes(y, m0, d2)]; }
  let f = proximoDe(item, hoy);
  if (!f) return [];
  let guard = 0;
  while (f >= inicio && guard++ < TOPE) f = anterior(f, frec, ancla);
  const out = []; guard = 0;
  f = siguiente(f, frec, ancla);
  while (f <= fin && guard++ < TOPE) { if (f >= inicio) out.push(f); f = siguiente(f, frec, ancla); }
  return out;
}

// Días de anticipación con que avisa la campanita, según la frecuencia.
export const ventanaAviso = (frecuencia) =>
  frecuencia === 'semanal' ? 2 : frecuencia === 'quincenal' ? 3 : 7;

// Estado para la tarjeta: cuántas vencidas hay y qué etiqueta mostrar.
export function estadoDe(item, hoy = hoyISO()) {
  const proximo = proximoDe(item, hoy);
  if (!proximo) return { proximo: null, atrasadas: 0, etiqueta: 'sin_fecha' };
  const frec = frecuenciaDe(item);
  const atrasadas = ocurrenciasHasta(item, sumarDias(hoy, -1), hoy).length;
  if (atrasadas > 0) return { proximo, atrasadas, etiqueta: 'vencido' };
  if (proximo === hoy) return { proximo, atrasadas: 0, etiqueta: 'hoy' };
  const enPeriodo = frec === 'mensual'
    ? mesDe(proximo) === mesDe(hoy)
    : proximo <= sumarDias(hoy, frec === 'semanal' ? 7 : 15);
  return { proximo, atrasadas: 0, etiqueta: enPeriodo ? 'pendiente' : 'al_dia' };
}

export const textoEstado = (e) => ({
  vencido: e.atrasadas > 1 ? `Vencido · ${e.atrasadas} atrasadas` : 'Vencido',
  hoy: 'Vence hoy',
  pendiente: 'Pendiente',
  al_dia: 'Al día',
  sin_fecha: 'Sin fecha',
}[e.etiqueta]);

// Campos a guardar al pagar/cobrar y al revertir (el llamador agrega los suyos).
export function alPagar(item, hoy = hoyISO()) {
  const p = proximoDe(item, hoy);
  return { proximo_vencimiento: siguiente(p, frecuenciaDe(item), diaAncla(item)) };
}
export function alRevertir(item, hoy = hoyISO()) {
  const p = proximoDe(item, hoy);
  return { proximo_vencimiento: anterior(p, frecuenciaDe(item), diaAncla(item)) };
}
