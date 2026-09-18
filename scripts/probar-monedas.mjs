// Pruebas de lib/monedas.js. Correr: node scripts/probar-monedas.mjs
import { esGuarani, fmtMoneda, resumenMonedas, textoAcumulados, leerMonto } from '../lib/monedas.js';

let fallos = 0;
const ok = (cond, msg) => { if (!cond) { fallos++; console.log('  ✗', msg); } else console.log('  ✓', msg); };

console.log('leerMonto');
ok(leerMonto('1500', 'PYG').valor === '1500' && leerMonto('1500', 'PYG').display === '1.500', '₲: 1500 → 1.500');
ok(leerMonto('1.500,25', 'PYG').valor === '150025', '₲: ignora separadores, solo dígitos');
ok(leerMonto('1500', 'USD').display === '1.500' && leerMonto('1500', 'USD').valor === '1500', 'US$: 1500 → 1.500');
ok(leerMonto('1.500', 'USD').valor === '1500', 'US$: 1.500 es mil quinientos (punto de miles)');
ok(leerMonto('1.5', 'USD').valor === '1.5' && leerMonto('1.5', 'USD').display === '1,5', 'US$: 1.5 es uno y medio');
ok(leerMonto('1,5', 'USD').valor === '1.5', 'US$: 1,5 es uno y medio');
ok(leerMonto('1.500,25', 'USD').valor === '1500.25' && leerMonto('1.500,25', 'USD').display === '1.500,25', 'US$: 1.500,25');
ok(leerMonto('1.500,', 'USD').display === '1.500,' && leerMonto('1.500,', 'USD').valor === '1500', 'US$: coma recién escrita se conserva en pantalla');
ok(leerMonto('12,345', 'USD').valor === '12.34', 'US$: máximo 2 decimales');
ok(leerMonto('1.234.567', 'USD').valor === '1234567', 'US$: varios puntos → miles');
ok(leerMonto('', 'USD').valor === '' && leerMonto('abc', 'USD').valor === '', 'vacío o basura → vacío');

console.log('\nfmtMoneda');
ok(fmtMoneda(1234, 'PYG') === '₲ 1.234' && fmtMoneda(1234) === '₲ 1.234', '₲ 1.234');
ok(fmtMoneda(1234.5, 'USD') === 'US$ 1.234,5', 'US$ 1.234,5');
ok(fmtMoneda(-50, 'BRL') === 'R$ 50', 'R$ sin signo (el signo lo pone quien muestra)');

console.log('\nresumenMonedas');
const txs = [
  { monto: 1000, tipo: 'ingreso', fecha: '2026-09-02' },
  { monto: 200, tipo: 'gasto', fecha: '2026-09-05', moneda: 'PYG' },
  { monto: 300, tipo: 'ingreso', fecha: '2026-09-10', moneda: 'USD' },
  { monto: 50.5, tipo: 'gasto', fecha: '2026-09-12', moneda: 'USD' },
  { monto: 100, tipo: 'ingreso', fecha: '2026-08-01', moneda: 'USD' },
  { monto: 40, tipo: 'gasto', fecha: '2026-09-15', moneda: 'BRL' },
];
ok(txs.filter(esGuarani).length === 2, 'esGuarani: sin moneda o PYG');
const r = resumenMonedas(txs, '2026-09');
ok(r.USD.total === 349.5 && r.USD.ing === 300 && r.USD.gas === 50.5, 'USD: total 349,5; septiembre +300 −50,5');
ok(r.BRL.total === -40 && r.BRL.tieneMes, 'BRL: −40 en septiembre');
ok(!('PYG' in r), 'los guaraníes no aparecen en el resumen de monedas extra');
ok(Object.keys(resumenMonedas(txs.slice(0, 2))).length === 0, 'sin movimientos en moneda extra → resumen vacío');
ok(textoAcumulados(r) === 'US$ 349,5 · −R$ 40', textoAcumulados(r));

console.log(fallos ? `\n${fallos} prueba(s) fallaron` : '\nTodo ok');
process.exit(fallos ? 1 : 0);
