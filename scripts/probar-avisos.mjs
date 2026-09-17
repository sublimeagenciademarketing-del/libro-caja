// Pruebas de la campanita compartida (lib/avisos.js) y de la licencia
// (lib/licencia.js). Correr: node scripts/probar-avisos.mjs
import { calcularAvisos, claveAviso, textoAvisos } from '../lib/avisos.js';
import { estadoLicencia, recibeRecordatorios } from '../lib/licencia.js';

let fallos = 0;
const ok = (cond, msg) => { if (!cond) { fallos++; console.log('  ✗', msg); } else console.log('  ✓', msg); };
const nombres = (lista) => lista.map(n => n.label).join(',');

const HOY = '2026-09-17';
console.log('calcularAvisos con hoy =', HOY);

const datos = {
  gastos: [
    { descripcion: 'Alquiler', monto: 1000, cuenta: 'a', activo: true, frecuencia: 'mensual', dia_vencimiento: 24, proximo_vencimiento: '2026-09-24' },   // 7 días → entra
    { descripcion: 'Internet', monto: 100, cuenta: 'a', activo: true, frecuencia: 'mensual', dia_vencimiento: 25, proximo_vencimiento: '2026-09-25' },    // 8 días → no
    { descripcion: 'Luz', monto: 200, cuenta: 'a', activo: true, frecuencia: 'mensual', dia_vencimiento: 10, proximo_vencimiento: '2026-09-10' },         // vencido
    { descripcion: 'Verdulero', monto: 50, cuenta: 'a', activo: true, frecuencia: 'semanal', proximo_vencimiento: '2026-09-19' },                         // 2 días → entra
    { descripcion: 'Agua', monto: 60, cuenta: 'a', activo: true, frecuencia: 'semanal', proximo_vencimiento: '2026-09-20' },                              // 3 días → no (ventana 2)
    { descripcion: 'Niñera', monto: 300, cuenta: 'a', activo: true, frecuencia: 'quincenal', dia_vencimiento: 5, proximo_vencimiento: '2026-09-20' },     // 3 días → entra (ventana 3)
  ],
  cobros: [
    { cliente: 'Juan', monto: 500, cuenta: 'a', estado: 'pendiente', frecuencia: 'una_vez', fecha_esperada: '2026-09-18', activo: true },               // entra
    { cliente: 'Pedro', monto: 500, cuenta: 'a', estado: 'cobrado', frecuencia: 'una_vez', fecha_esperada: '2026-09-18', activo: true },                 // cobrado → no
    { cliente: 'Ana', monto: 500, cuenta: 'a', estado: 'pendiente', frecuencia: 'mensual', fecha_esperada: '2026-09-01', proximo_vencimiento: '2026-09-01', activo: true }, // vencido
    { cliente: 'Pausado', monto: 500, cuenta: 'a', estado: 'pendiente', frecuencia: 'mensual', fecha_esperada: '2026-09-18', proximo_vencimiento: '2026-09-18', activo: false }, // pausado → no
  ],
  deudas: [
    { acreedor: 'Banco', monto_total: 1000, monto_pagado: 0, fecha_limite: '2026-09-16', cuenta: 'a', estado: 'pendiente' },  // vencida
    { acreedor: 'Tío', monto_total: 1000, monto_pagado: 1000, fecha_limite: '2026-09-16', cuenta: 'a', estado: 'pagado' },    // pagada → no
    { acreedor: 'Sin fecha', monto_total: 1000, monto_pagado: 0, fecha_limite: null, cuenta: 'a', estado: 'pendiente' },      // sin fecha → no
  ],
  cuotas: [
    { monto: 100, fecha_vencimiento: '2026-09-17', estado: 'pendiente', installment_purchases: { descripcion: 'Heladera', user_id: 'u', cuenta: 'b' } }, // hoy → entra (no vencido)
  ],
  tarjetas: [
    { descripcion: 'Súper', monto: 80, fecha: '2026-09-15', cuenta: 'b', estado: 'facturado' }, // vencida
    { descripcion: 'Nafta', monto: 80, fecha: '2026-09-23', cuenta: 'b', estado: 'pendiente_facturacion' }, // entra
  ],
};

const { overdue, upcoming } = calcularAvisos(datos, HOY);
ok(nombres(overdue) === 'Ana,Luz,Súper,Banco', `vencidos en orden de fecha: ${nombres(overdue)}`);
ok(nombres(upcoming) === 'Heladera,Juan,Verdulero,Niñera,Nafta,Alquiler', `por vencer en orden de fecha: ${nombres(upcoming)}`);
ok(upcoming.find(n => n.label === 'Heladera').tipo === 'cuota' && overdue.find(n => n.label === 'Súper').tipo === 'tarjeta', 'tarjeta y cuota con su propio tipo');
ok(overdue.find(n => n.label === 'Banco').monto === 1000, 'deuda: monto = lo que falta pagar');
ok(claveAviso(upcoming[0]) === 'cuota|Heladera|2026-09-17', 'clave tipo|label|fecha');

console.log('\nventanas por frecuencia');
const v = calcularAvisos({ gastos: datos.gastos }, HOY).upcoming.map(n => n.label);
ok(v.includes('Verdulero') && !v.includes('Agua'), 'semanal avisa a 2 días, no a 3');
ok(v.includes('Niñera'), 'quincenal avisa a 3 días');
ok(v.includes('Alquiler') && !v.includes('Internet'), 'mensual avisa a 7 días, no a 8');

console.log('\ntextoAvisos');
ok(textoAvisos(upcoming) === 'Cuota Heladera (17/09), Cobro a Juan (18/09), Verdulero (19/09) y 3 más', textoAvisos(upcoming));
ok(textoAvisos(overdue.slice(0, 2)) === 'Cobro a Ana (01/09), Luz (10/09)', textoAvisos(overdue.slice(0, 2)));
ok(textoAvisos([overdue[2], overdue[3]]) === 'Tarjeta: Súper (15/09), Deuda con Banco (16/09)', textoAvisos([overdue[2], overdue[3]]));

console.log('\nsin datos');
const vacio = calcularAvisos({}, HOY);
ok(vacio.overdue.length === 0 && vacio.upcoming.length === 0, 'sin ítems → sin avisos');

console.log('\nestadoLicencia con hoy =', HOY);
const admin = { email: 'sublimeagenciademarketing@gmail.com' };
ok(estadoLicencia(admin, null, HOY).status === 'active', 'admin siempre activo');
ok(estadoLicencia({ email: 'x', fecha_registro: '2026-09-10' }, null, HOY).status === 'demo', 'sin licencia, registrado hace 7 días → prueba');
ok(estadoLicencia({ email: 'x', fecha_registro: '2026-09-10' }, null, HOY).dias === 38, '38 días de prueba restantes');
ok(estadoLicencia({ email: 'x', fecha_registro: '2026-08-03' }, null, HOY).status === 'solo_lectura', 'registrado hace 45 días → prueba vencida');
ok(estadoLicencia({ email: 'x', fecha_registro: '2026-08-04' }, null, HOY).status === 'demo', 'registrado hace 44 días → todavía en prueba');
ok(estadoLicencia({ email: 'x' }, { activo: true, fecha_vencimiento: '2027-09-17' }, HOY).status === 'active', 'licencia por un año → activa');
ok(estadoLicencia({ email: 'x' }, { activo: true, fecha_vencimiento: '2026-09-30' }, HOY).status === 'expiring', 'vence en 13 días → por vencer (sigue recibiendo)');
ok(estadoLicencia({ email: 'x' }, { activo: true, fecha_vencimiento: '2026-09-16' }, HOY).status === 'solo_lectura', 'venció ayer → solo lectura');
ok(estadoLicencia({ email: 'x' }, { activo: true, solo_lectura: true, fecha_vencimiento: '2027-01-01' }, HOY).status === 'solo_lectura', 'marcada solo lectura por el admin');
ok(estadoLicencia({ email: 'x', fecha_registro: '2026-09-10' }, { activo: false, fecha_vencimiento: '2026-01-01' }, HOY).status === 'demo', 'licencia inactiva → cuenta como sin licencia (prueba)');
ok(recibeRecordatorios({ status: 'demo' }) && recibeRecordatorios({ status: 'expiring' }) && !recibeRecordatorios({ status: 'solo_lectura' }), 'reciben activos, por vencer y prueba; no solo lectura');

console.log(fallos ? `\n${fallos} prueba(s) fallaron` : '\nTodo ok');
process.exit(fallos ? 1 : 0);
