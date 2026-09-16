// Prueba el motor de recurrencia sin navegador ni base: node scripts/probar-recurrencia.mjs
import {
  siguiente, anterior, proximoDe, ocurrenciasEnMes, ocurrenciasHasta, cadenciaEnMes,
  estadoDe, alPagar, alRevertir, sumarDias,
} from '../lib/recurrencia.js';

const HOY = '2026-09-16';
let fallos = 0;
const igual = (nombre, real, esperado) => {
  const r = JSON.stringify(real), e = JSON.stringify(esperado);
  const ok = r === e; if (!ok) fallos++;
  console.log(`${ok ? 'OK ' : 'MAL'}  ${nombre.padEnd(52)} ${r}${ok ? '' : `   esperado ${e}`}`);
};

console.log('— siguiente / anterior —');
igual('mensual 31/01 → 28/02',            siguiente('2026-01-31', 'mensual', 31), '2026-02-28');
igual('mensual 28/02 (ancla 31) → 31/03', siguiente('2026-02-28', 'mensual', 31), '2026-03-31');
igual('mensual 31/12 → 31/01 (año)',      siguiente('2026-12-31', 'mensual', 31), '2027-01-31');
igual('mensual atrás 28/02 → 31/01',      anterior('2026-02-28', 'mensual', 31),  '2026-01-31');
igual('quincenal ancla15: 10/09 → 15/09', siguiente('2026-09-10', 'quincenal', 15), '2026-09-15');
igual('quincenal ancla15: 15/09 → 30/09', siguiente('2026-09-15', 'quincenal', 15), '2026-09-30');
igual('quincenal ancla15: 30/09 → 15/10', siguiente('2026-09-30', 'quincenal', 15), '2026-10-15');
igual('quincenal ancla15: 15/02 → 28/02', siguiente('2026-02-15', 'quincenal', 15), '2026-02-28');
igual('quincenal ancla15: 28/02 → 15/03', siguiente('2026-02-28', 'quincenal', 15), '2026-03-15');
igual('quincenal ancla20 (5 y 20): 16/09 → 20/09', siguiente('2026-09-16', 'quincenal', 20), '2026-09-20');
igual('quincenal ancla20: 20/09 → 05/10', siguiente('2026-09-20', 'quincenal', 20), '2026-10-05');
igual('quincenal ancla20: 20/12 → 05/01', siguiente('2026-12-20', 'quincenal', 20), '2027-01-05');
igual('quincenal atrás 05/01 → 20/12',    anterior('2027-01-05', 'quincenal', 20),  '2026-12-20');
igual('quincenal ancla31 (16 y 31): 16/09 → 30/09', siguiente('2026-09-16', 'quincenal', 31), '2026-09-30');
igual('semanal 18/09 → 25/09',            siguiente('2026-09-18', 'semanal', 18), '2026-09-25');
igual('semanal atrás 25/09 → 18/09',      anterior('2026-09-25', 'semanal', 18),  '2026-09-18');

console.log('\n— proximoDe (filas viejas sin proximo_vencimiento) —');
igual('gasto mensual día 25, sin pagar',         proximoDe({ frecuencia: 'mensual', dia_vencimiento: 25 }, HOY), '2026-09-25');
igual('gasto mensual día 25, pagado este mes',   proximoDe({ frecuencia: 'mensual', dia_vencimiento: 25, pagado_mes: '2026-09' }, HOY), '2026-10-25');
igual('gasto mensual día 10, sin pagar (vencido)', proximoDe({ frecuencia: 'mensual', dia_vencimiento: 10 }, HOY), '2026-09-10');
igual('gasto semanal día 15, sin pagos → no inventa atraso', proximoDe({ frecuencia: 'semanal', dia_vencimiento: 15 }, HOY), '2026-09-22');
igual('gasto semanal pagado 01/09 → 08/09 (atraso real)', proximoDe({ frecuencia: 'semanal', dia_vencimiento: 1, pagado_fecha: '2026-09-01' }, HOY), '2026-09-08');
igual('gasto quincenal día 15 sin pagos → 30/09', proximoDe({ frecuencia: 'quincenal', dia_vencimiento: 15 }, HOY), '2026-09-30');
igual('gasto sin frecuencia = mensual',          proximoDe({ dia_vencimiento: 20 }, HOY), '2026-09-20');
igual('cobro mensual 24/09 sin cobrar',          proximoDe({ frecuencia: 'mensual', fecha_esperada: '2026-09-24' }, HOY), '2026-09-24');
igual('cobro mensual cobrado el 24/09 → 24/10',  proximoDe({ frecuencia: 'mensual', fecha_esperada: '2026-09-24', cobrado_fecha: '2026-09-24' }, HOY), '2026-10-24');
igual('cobro con proximo cargado manda',         proximoDe({ frecuencia: 'mensual', fecha_esperada: '2026-09-24', proximo_vencimiento: '2026-11-24' }, HOY), '2026-11-24');
igual('cobro sin fecha → null',                  proximoDe({ frecuencia: 'mensual', fecha_esperada: null }, HOY), null);

console.log('\n— ocurrencias por mes —');
const sem = { frecuencia: 'semanal', proximo_vencimiento: '2026-09-18' };
igual('semanal 18/09: septiembre (desde hoy)', ocurrenciasEnMes(sem, 2026, 8, HOY, { incluirAtrasadas: true }), ['2026-09-18', '2026-09-25']);
igual('semanal 18/09: octubre (5)',            ocurrenciasEnMes(sem, 2026, 9, HOY), ['2026-10-02', '2026-10-09', '2026-10-16', '2026-10-23', '2026-10-30']);
igual('semanal 18/09: noviembre (4)',          ocurrenciasEnMes(sem, 2026, 10, HOY), ['2026-11-06', '2026-11-13', '2026-11-20', '2026-11-27']);
const qui = { frecuencia: 'quincenal', dia_vencimiento: 15, proximo_vencimiento: '2026-09-15' };
igual('quincenal 15: septiembre',              ocurrenciasEnMes(qui, 2026, 8, HOY, { incluirAtrasadas: true }), ['2026-09-15', '2026-09-30']);
igual('quincenal 15: febrero 2027 (28)',       ocurrenciasEnMes(qui, 2027, 1, HOY), ['2027-02-15', '2027-02-28']);
const men = { frecuencia: 'mensual', dia_vencimiento: 31, proximo_vencimiento: '2026-10-31' };
igual('mensual 31: octubre',                   ocurrenciasEnMes(men, 2026, 9, HOY), ['2026-10-31']);
igual('mensual 31: febrero 2027',              ocurrenciasEnMes(men, 2027, 1, HOY), ['2027-02-28']);
igual('mensual 31: marzo 2027 vuelve al 31',   ocurrenciasEnMes(men, 2027, 2, HOY), ['2027-03-31']);
igual('mensual pagado (proximo en oct): septiembre vacío', ocurrenciasEnMes(men, 2026, 8, HOY, { incluirAtrasadas: true }), []);

console.log('\n— atrasos —');
const atras = { frecuencia: 'semanal', proximo_vencimiento: '2026-08-25' };
igual('semanal desde 25/08: atrasadas al 16/09', ocurrenciasHasta(atras, sumarDias(HOY, -1), HOY).length, 4);
igual('semanal desde 25/08: septiembre incl. atraso (6)', ocurrenciasEnMes(atras, 2026, 8, HOY, { incluirAtrasadas: true }).length, 6);
igual('semanal desde 25/08: septiembre sin atraso (5 martes)', ocurrenciasEnMes(atras, 2026, 8, HOY).length, 5);
igual('mensual atrasado 2 meses: noviembre incl. atraso', ocurrenciasEnMes({ frecuencia: 'mensual', dia_vencimiento: 25, proximo_vencimiento: '2026-09-25' }, 2026, 10, '2026-11-02', { incluirAtrasadas: true }), ['2026-09-25', '2026-10-25', '2026-11-25']);

console.log('\n— estado de la tarjeta —');
const est = (item) => { const e = estadoDe(item, HOY); return [e.etiqueta, e.atrasadas]; };
igual('mensual próximo 25/10 → al día',         est({ frecuencia: 'mensual', dia_vencimiento: 25, proximo_vencimiento: '2026-10-25' }), ['al_dia', 0]);
igual('mensual próximo 25/09 → pendiente',      est({ frecuencia: 'mensual', dia_vencimiento: 25, proximo_vencimiento: '2026-09-25' }), ['pendiente', 0]);
igual('mensual próximo hoy → hoy',              est({ frecuencia: 'mensual', dia_vencimiento: 16, proximo_vencimiento: '2026-09-16' }), ['hoy', 0]);
igual('mensual próximo 10/09 → vencido 1',      est({ frecuencia: 'mensual', dia_vencimiento: 10, proximo_vencimiento: '2026-09-10' }), ['vencido', 1]);
igual('semanal desde 25/08 → vencido 4',        est(atras), ['vencido', 4]);
igual('semanal próximo 18/09 → pendiente',      est(sem), ['pendiente', 0]);
igual('semanal próximo 30/09 → al día',         est({ frecuencia: 'semanal', proximo_vencimiento: '2026-09-30' }), ['al_dia', 0]);

console.log('\n— total del mes por cadencia (pagadas o no) —');
igual('semanal pagada hasta 25/09: septiembre = 4', cadenciaEnMes({ frecuencia: 'semanal', proximo_vencimiento: '2026-09-25' }, 2026, 8, HOY), ['2026-09-04', '2026-09-11', '2026-09-18', '2026-09-25']);
igual('semanal: octubre = 5',                  cadenciaEnMes({ frecuencia: 'semanal', proximo_vencimiento: '2026-09-25' }, 2026, 9, HOY).length, 5);
igual('quincenal 15: 2 por mes',               cadenciaEnMes(qui, 2026, 9, HOY), ['2026-10-15', '2026-10-30']);
igual('mensual: 1',                            cadenciaEnMes(men, 2026, 8, HOY), ['2026-09-30']);

console.log('\n— pagar / revertir ida y vuelta —');
const q30 = { frecuencia: 'quincenal', dia_vencimiento: 15, proximo_vencimiento: '2026-09-30' };
const pag = alPagar(q30, HOY);
igual('quincenal 30/09 pagar → 15/10',         pag.proximo_vencimiento, '2026-10-15');
igual('… revertir → 30/09',                    alRevertir({ ...q30, ...pag }, HOY).proximo_vencimiento, '2026-09-30');
const m31 = { frecuencia: 'mensual', dia_vencimiento: 31, proximo_vencimiento: '2026-01-31' };
const pag2 = alPagar(m31, '2026-01-20');
igual('mensual 31/01 pagar → 28/02',            pag2.proximo_vencimiento, '2026-02-28');
igual('… revertir → 31/01',                    alRevertir({ ...m31, ...pag2 }, '2026-01-20').proximo_vencimiento, '2026-01-31');
igual('cobro viejo cobrado (sin proximo) revertir → 24/09', alRevertir({ frecuencia: 'mensual', fecha_esperada: '2026-09-24', cobrado_fecha: '2026-09-24' }, HOY).proximo_vencimiento, '2026-09-24');

console.log(fallos ? `\n${fallos} FALLOS` : '\nTodos los casos pasan');
process.exit(fallos ? 1 : 0);
