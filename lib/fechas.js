// Suma meses sin que el día se "pase" al mes siguiente: 31/01 + 1 mes = 28/02,
// no 03/03 como hace Date.setMonth. Si se indica `dia`, se usa ese día del mes
// destino (recortado al último día cuando el mes es más corto).
export function sumarMeses(fecha, meses, dia) {
  const base = new Date(fecha);
  const destino = new Date(base.getFullYear(), base.getMonth() + meses, 1, 12);
  const ultimoDia = new Date(destino.getFullYear(), destino.getMonth() + 1, 0).getDate();
  destino.setDate(Math.min(dia ?? base.getDate(), ultimoDia));
  return destino;
}
