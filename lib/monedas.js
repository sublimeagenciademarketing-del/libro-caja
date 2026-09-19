// Monedas extra (US$ y R$): bolsillos aparte del guaraní, sin cotización ni
// conversión. Un movimiento en moneda extra nunca entra en los totales en ₲.
export const MONEDAS = {
  USD: { simbolo: 'US$', nombre: 'Dólares' },
  BRL: { simbolo: 'R$', nombre: 'Reales' },
};

export const esGuarani = (t) => !t?.moneda || t.moneda === 'PYG';

// "₲ 1.234" para guaraníes; "US$ 1.234,50" para monedas extra (hasta 2 decimales).
export function fmtMoneda(n, moneda) {
  if (!moneda || moneda === 'PYG') return '₲ ' + Math.round(Math.abs(n)).toLocaleString('es-PY');
  const simbolo = MONEDAS[moneda]?.simbolo || moneda;
  return simbolo + ' ' + Math.abs(Number(n) || 0).toLocaleString('es-PY', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// Resumen por moneda extra: acumulado (total) y, si se pasa el mes "AAAA-MM",
// ingresos y gastos de ese mes. Solo aparecen las monedas con movimientos.
export function resumenMonedas(transactions, mesStr) {
  const r = {};
  for (const t of transactions || []) {
    if (esGuarani(t)) continue;
    const m = r[t.moneda] || (r[t.moneda] = { total: 0, ing: 0, gas: 0, tieneMes: false });
    const monto = Number(t.monto) || 0;
    m.total += t.tipo === 'ingreso' ? monto : -monto;
    if (mesStr && t.fecha && t.fecha.startsWith(mesStr)) {
      m.tieneMes = true;
      if (t.tipo === 'ingreso') m.ing += monto; else m.gas += monto;
    }
  }
  return r;
}

// Acumulado (ingresos − gastos) de cada moneda presente, incluido el guaraní ('PYG').
export function totalesPorMoneda(transactions) {
  const r = {};
  for (const t of transactions || []) {
    const m = esGuarani(t) ? 'PYG' : t.moneda;
    const monto = Number(t.monto) || 0;
    r[m] = (r[m] || 0) + (t.tipo === 'ingreso' ? monto : -monto);
  }
  return r;
}

// Texto corto de los acumulados: "US$ 350 · R$ −120".
export function textoAcumulados(resumen) {
  return Object.entries(resumen).map(([m, v]) => (v.total < 0 ? '−' : '') + fmtMoneda(v.total, m)).join(' · ');
}

// Lo que el usuario escribe en el campo de monto → valor para guardar y texto para mostrar.
// Guaraníes: solo enteros. Monedas extra: hasta 2 decimales; la coma es decimal y el
// punto también, salvo que parezca separador de miles (1.500 → mil quinientos).
export function leerMonto(texto, moneda) {
  const miles = (s) => (s ? s.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '');
  if (!moneda || moneda === 'PYG') {
    const raw = (texto || '').replace(/\D/g, '');
    return { valor: raw, display: miles(raw) };
  }
  let s = (texto || '').replace(/[^\d.,]/g, '');
  let ent = s, dec = null;
  const coma = s.lastIndexOf(',');
  if (coma >= 0) {
    ent = s.slice(0, coma); dec = s.slice(coma + 1);
  } else {
    const punto = s.lastIndexOf('.');
    // Un solo punto con 0–2 dígitos después se toma como decimal; si no, es separador de miles.
    if (punto >= 0 && s.indexOf('.') === punto && s.length - punto - 1 <= 2) { ent = s.slice(0, punto); dec = s.slice(punto + 1); }
  }
  ent = ent.replace(/\D/g, '');
  if (dec !== null) dec = dec.replace(/\D/g, '').slice(0, 2);
  const valor = ent + (dec !== null && dec !== '' ? '.' + dec : '');
  const display = miles(ent) + (dec !== null ? ',' + dec : '');
  return { valor: valor === '' && dec !== null ? '' : valor, display };
}
