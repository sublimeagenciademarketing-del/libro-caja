'use client';

import { Fragment, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { DIAS_PRUEBA, ADMIN_EMAIL, puedeUsarMonedas, puedeConvertir, puedeVerMas, puedeResumenAmpliado, puedeMonedasModulos, puedeResumenCuentas } from '../../lib/config';
import { MONEDAS, esGuarani, fmtMoneda, leerMonto } from '../../lib/monedas';
import Convertidor, { BotonConvertir } from '../../components/Convertidor';
import { estadoPush, activarPush, desuscribirPush } from '../../lib/push-cliente';
import { sumarMeses } from '../../lib/fechas';
import { hoyISO, deISO, mesDe, enMes, sumarDias, siguiente, proximoDe, esRecurrente, estadoDe, textoEstado, ocurrenciasEnMes, cadenciaEnMes, alPagar, alRevertir } from '../../lib/recurrencia';

const mismaCuenta = (a, b) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();
// card_expenses.estado no admite 'pendiente': sus valores son
// pendiente_facturacion / facturado / pagado. Este es el valor por defecto.
const TARJETA_PENDIENTE = 'pendiente_facturacion';
const etiquetaCuenta = (valor, cfg) =>
  cfg.single || mismaCuenta(valor, cfg.c1) ? cfg.l1 : cfg.l2;
const fmt = (n) => '₲ ' + Math.round(Math.abs(n)).toLocaleString('es-PY');
const fmtD = (raw) => (raw ? raw.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '');

// Monedas en los módulos (gastos fijos, cuotas, cobros, deudas, metas). Cada
// ítem guarda su moneda; los cargados antes no la tienen y valen en guaraníes.
const monedaDe = (i) => (i?.moneda && MONEDAS[i.moneda] ? i.moneda : 'PYG');
const simboloDe = (m) => (m === 'PYG' ? '₲' : MONEDAS[m].simbolo);
// Qué monedas puede elegir la persona en un formulario (null = solo guaraníes, sin selector).
const opcionesMonedaDe = (cfg, email) => (puedeMonedasModulos(email) && (cfg?.monedas || []).length ? ['PYG', ...cfg.monedas] : null);
const enMoneda = (filtro) => (i) => filtro === 'todas' || monedaDe(i) === filtro;
// Texto de un monto que la persona escribe → valor a guardar + texto a mostrar.
const montoEscrito = (texto, moneda) => leerMonto(texto, moneda);
// Texto para mostrar un monto guardado dentro de un campo editable.
const montoParaEditar = (n, moneda) => leerMonto(String(n ?? '').replace('.', ','), moneda).display;
// "₲ 1.200.000 · US$ 300": suma por moneda de una lista (solo las monedas con algo).
function textoPorMoneda(items, montoDe) {
  const t = {};
  for (const i of items) { const m = monedaDe(i); t[m] = (t[m] || 0) + (Number(montoDe(i)) || 0); }
  const partes = ['PYG', ...Object.keys(MONEDAS)].filter(m => t[m]).map(m => fmtMoneda(t[m], m));
  return partes.length ? partes.join(' · ') : fmt(0);
}
// Etiqueta de un campo de monto con el selector de moneda a la derecha.
function LabelMonto({ texto = 'Monto', moneda = 'PYG', opciones, onChange }) {
  return (
    <label style={opciones ? { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 } : undefined}>
      <span>{texto} ({simboloDe(moneda)})</span>
      {opciones && (
        <span className="moneda-pills">
          {opciones.map(m => <button type="button" key={m} className={moneda === m ? 'on' : ''} onClick={() => onChange(m)}>{simboloDe(m)}</button>)}
        </span>
      )}
    </label>
  );
}
// Filtro de una lista por moneda (solo con monedas activadas).
function FiltroMoneda({ value, onChange, opciones }) {
  if (!opciones) return null;
  return (
    <div className="filters" style={{ marginBottom: 12 }}>
      <button type="button" className={value === 'todas' ? 'active' : ''} onClick={() => onChange('todas')}>Todos</button>
      {opciones.map(m => <button type="button" key={m} className={value === m ? 'active' : ''} onClick={() => onChange(m)}>{simboloDe(m)}</button>)}
    </div>
  );
}
const fmtFecha = (s) => { if (!s) return ''; const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };

function getUserConfig(email) {
  if (email === 'karendanielasanchezjabs@gmail.com') {
    return { c1: 'tienda', c2: 'personal', l1: 'Tienda', l2: 'Personal', single: false };
  }
  if (email === 'khelendaihanaj@gmail.com') {
    return { c1: 'personal', c2: null, l1: 'Personal', l2: null, single: true };
  }
  return { c1: 'sublime', c2: 'personal', l1: 'Sublime', l2: 'Personal', single: false };
}

function CuentaToggle({ value, onChange, cfg }) {
  if (cfg.single) return (
    <div className="toggle">
      <button type="button" className="active sublime" style={{ cursor: 'default' }}>{cfg.l1}</button>
    </div>
  );
  return (
    <div className="toggle">
      <button type="button" className={value === cfg.c1 ? 'active sublime' : ''} onClick={() => onChange(cfg.c1)}>{cfg.l1}</button>
      <button type="button" className={value === cfg.c2 ? 'active personal' : ''} onClick={() => onChange(cfg.c2)}>{cfg.l2}</button>
    </div>
  );
}

const TABS = [
  { id: 'resumen', label: 'Resumen', grad: ['#6366f1','#8b5cf6'], svg: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 17V13M12 17V9M16 17V12"/></svg> },
  { id: 'gastos', label: 'Gastos Fijos', grad: ['#f59e0b','#ef4444'], svg: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/></svg> },
  { id: 'cuotas', label: 'Cuotas', grad: ['#0ea5e9','#06b6d4'], svg: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg> },
  { id: 'tarjetas', label: 'Tarjetas', grad: ['#f59e0b','#f97316'], svg: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/></svg> },
  { id: 'cobros', label: 'Cobros', grad: ['#10b981','#059669'], svg: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/><path d="M9 3.6A9 9 0 0 1 21 12"/></svg> },
  { id: 'deudas', label: 'Deudas', grad: ['#ec4899','#8b5cf6'], svg: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
  { id: 'metas', label: 'Metas', grad: ['#ef4444','#f97316'], svg: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="#fff"/></svg> },
  { id: 'perfil', label: 'Perfil', grad: ['#6366f1','#8b5cf6'], svg: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg> },
];

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// Listas largas: lo ya terminado (cobrado, pagado, cuotas completas) se muestra
// solo de los últimos meses y "Ver más" trae más antiguos. Cada toque suma seis
// meses, y siempre destapa al menos lo siguiente que había oculto.
const VER_MAS_INICIAL = 2, VER_MAS_PASO = 6;
// Primer día del mes que abre una ventana de `meses` meses hasta hoy ('AAAA-MM-01').
function desdeMeses(meses) {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (meses - 1));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
// Meses de ventana necesarios para que una fecha quede adentro.
function mesesHasta(fecha) {
  const hoy = new Date(); const [y, m] = fecha.split('-').map(Number);
  return (hoy.getFullYear() - y) * 12 + (hoy.getMonth() + 1 - m) + 1;
}
// Fecha invertida para ordenar de más nueva a más vieja con una comparación de texto.
const fechaInvertida = (f) => String(99999999 - Number((f || '0000-00-00').replace(/-/g, ''))).padStart(8, '0');
function useVerMas(habilitado) {
  const [meses, setMeses] = useState(VER_MAS_INICIAL);
  const desde = desdeMeses(meses);
  // Separa lo visible de lo oculto según la fecha de cada ítem (sin fecha = visible).
  const recortar = (lista, fechaDe) => {
    if (!habilitado) return { visibles: lista, ocultos: [] };
    const visibles = [], ocultos = [];
    for (const i of lista) { const f = fechaDe(i); (!f || f >= desde ? visibles : ocultos).push(i); }
    return { visibles, ocultos };
  };
  const verMas = (ocultos, fechaDe) => {
    const masNueva = ocultos.map(fechaDe).filter(Boolean).sort().pop();
    setMeses(m => Math.max(m + VER_MAS_PASO, masNueva ? mesesHasta(masNueva) : 0));
  };
  return { recortar, verMas };
}
function BotonVerMas({ ocultos, onClick, texto = 'Ver más antiguos' }) {
  if (!ocultos) return null;
  return (
    <li className="mas-ver-mas">
      <button type="button" onClick={(e) => { e.stopPropagation(); onClick(); }}>{texto} ({ocultos})</button>
    </li>
  );
}

// Un ítem recurrente vale tantas veces como ocurrencias tenga en el mes;
// los de una sola vez, una vez si vencen en el mes. Devuelve {monto, cuenta}.
function expandirGastosDelMes(gastos, y, m0, hoy, esMesActual = true) {
  return gastos.flatMap(g => ocurrenciasEnMes(g, y, m0, hoy, { incluirAtrasadas: esMesActual }).map(() => ({ monto: g.monto, cuenta: g.cuenta })));
}
function expandirCobrosDelMes(cobros, y, m0, hoy, mesStart, mesEnd, esMesActual = true) {
  return cobros.filter(c => c.activo !== false).flatMap(c => {
    if (!esRecurrente(c)) {
      return c.estado !== 'cobrado' && c.fecha_esperada && c.fecha_esperada >= mesStart && c.fecha_esperada <= mesEnd ? [{ monto: c.monto, cuenta: c.cuenta }] : [];
    }
    return ocurrenciasEnMes(c, y, m0, hoy, { incluirAtrasadas: esMesActual }).map(() => ({ monto: c.monto, cuenta: c.cuenta }));
  });
}

/* ─── RESUMEN ANUAL ─── */
function Resumen({ userId, userEmail, cfg }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [projection, setProjection] = useState(null);
  const [mesAbierto, setMesAbierto] = useState(null);
  const [porMoneda, setPorMoneda] = useState({});
  const [compromisos, setCompromisos] = useState(null);
  const [verInfo, setVerInfo] = useState(false);
  const anio = new Date().getFullYear();
  const ampliado = puedeResumenAmpliado(userEmail);
  const resumenV2 = puedeResumenCuentas(userEmail);
  // Cuenta doble: cada bloque se muestra por cuenta, nunca sumado.
  const porCuentas = !cfg.single && resumenV2;
  const CUENTAS = [{ c: cfg.c1, l: cfg.l1, k: '1', color: '#4facfe' }, ...(cfg.single ? [] : [{ c: cfg.c2, l: cfg.l2, k: '2', color: '#a78bfa' }])];
  const monedasActivas = cfg.monedas || [];

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: txs } = await supabase
        .from('transactions')
        .select('monto,tipo,fecha,cuenta,moneda')
        .eq('user_id', userId)
        .gte('fecha', `${anio}-01-01`)
        .lte('fecha', `${anio}-12-31`);

      const meses = Array.from({ length: 12 }, (_, i) => {
        const key = `${anio}-${String(i+1).padStart(2,'0')}`;
        // El resumen es en guaraníes; las monedas extra no se mezclan.
        const del_mes = (txs || []).filter(esGuarani).filter(t => t.fecha && t.fecha.startsWith(key));
        const ing = del_mes.filter(t => t.tipo === 'ingreso').reduce((s,t) => s + t.monto, 0);
        const gas = del_mes.filter(t => t.tipo === 'gasto').reduce((s,t) => s + t.monto, 0);
        const ing1 = del_mes.filter(t => t.tipo === 'ingreso' && (cfg.single || mismaCuenta(t.cuenta, cfg.c1))).reduce((s,t) => s + t.monto, 0);
        const gas1 = del_mes.filter(t => t.tipo === 'gasto' && (cfg.single || mismaCuenta(t.cuenta, cfg.c1))).reduce((s,t) => s + t.monto, 0);
        const ing2 = del_mes.filter(t => t.tipo === 'ingreso' && mismaCuenta(t.cuenta, cfg.c2)).reduce((s,t) => s + t.monto, 0);
        const gas2 = del_mes.filter(t => t.tipo === 'gasto' && mismaCuenta(t.cuenta, cfg.c2)).reduce((s,t) => s + t.monto, 0);
        return { mes: i, ing, gas, bal: ing - gas, ing1, gas1, ing2, gas2, bal1: ing1 - gas1, bal2: ing2 - gas2, tiene: del_mes.length > 0 };
      });
      setData(meses);

      // Monedas extra: el mismo resumen por mes, solo de las monedas activadas con movimientos en el año.
      const pm = {};
      for (const mo of monedasActivas) {
        const txm = (txs || []).filter(t => t.moneda === mo);
        if (!txm.length) continue;
        pm[mo] = Array.from({ length: 12 }, (_, i) => {
          const key = `${anio}-${String(i + 1).padStart(2, '0')}`;
          const del = txm.filter(t => t.fecha && t.fecha.startsWith(key));
          const suma = (tipo, c) => del.filter(t => t.tipo === tipo && (!c || cfg.single || mismaCuenta(t.cuenta, c))).reduce((s, t) => s + Number(t.monto || 0), 0);
          const ing = suma('ingreso'), gas = suma('gasto');
          const ing1 = suma('ingreso', cfg.c1), gas1 = suma('gasto', cfg.c1), ing2 = suma('ingreso', cfg.c2), gas2 = suma('gasto', cfg.c2);
          return { mes: i, ing, gas, bal: ing - gas, ing1, gas1, ing2, gas2, bal1: ing1 - gas1, bal2: ing2 - gas2, tiene: del.length > 0 };
        });
      }
      setPorMoneda(pm);

      // proyección mes actual
      const now = new Date();
      const y = now.getFullYear(), mo = now.getMonth();
      const mStr = String(mo + 1).padStart(2, '0');
      const lastDay = new Date(y, mo + 1, 0).getDate();
      const mesStart = `${y}-${mStr}-01`, mesEnd = `${y}-${mStr}-${String(lastDay).padStart(2, '0')}`;
      const [r1, r2, r3, r4] = await Promise.all([
        supabase.from('receivables').select('monto, cuenta, estado, frecuencia, fecha_esperada, proximo_vencimiento, cobrado_fecha, activo, moneda').eq('user_id', userId),
        supabase.from('debts').select('monto_total, monto_pagado, cuenta, estado, moneda').eq('user_id', userId).gte('fecha_limite', mesStart).lte('fecha_limite', mesEnd),
        supabase.from('installments').select('monto, estado, installment_purchases!inner(user_id, cuenta, moneda)').eq('estado', 'pendiente').gte('fecha_vencimiento', mesStart).lte('fecha_vencimiento', mesEnd).eq('installment_purchases.user_id', userId),
        supabase.from('recurring_expenses').select('monto, cuenta, activo, pagado_mes, pagado_fecha, frecuencia, dia_vencimiento, proximo_vencimiento, moneda').eq('user_id', userId).eq('activo', true),
      ]);
      const hoy = hoyISO();
      // El resumen es en guaraníes: lo cargado en otra moneda queda afuera.
      const enGs = (r) => monedaDe(r) === 'PYG';
      if (r2.data) r2.data = r2.data.filter(enGs);
      if (r3.data) r3.data = r3.data.filter(r => monedaDe(r.installment_purchases) === 'PYG');
      if (r4.data) r4.data = r4.data.filter(enGs);
      setProjection({
        cobros: expandirCobrosDelMes((r1.data || []).filter(enGs), y, mo, hoy, mesStart, mesEnd),
        deudas: (r2.data || []).filter(r => r.estado !== 'pagado'),
        cuotas: (r3.data || []).filter(r => r.installment_purchases),
        gastos: expandirGastosDelMes(r4.data || [], y, mo, hoy),
      });

      // Compromisos del mes: todo lo que vence este mes sí o sí (gastos fijos,
      // cuotas, tarjetas y deudas con fecha), pagado o no, para compararlo con
      // los ingresos. Se cuentan todas las ocurrencias del mes, no solo las pendientes.
      const [{ data: cuotasMes }, { data: tarjetasMes }] = await Promise.all([
        supabase.from('installments').select('monto, installment_purchases!inner(user_id, moneda, cuenta)').gte('fecha_vencimiento', mesStart).lte('fecha_vencimiento', mesEnd).eq('installment_purchases.user_id', userId),
        supabase.from('card_expenses').select('monto, cuenta').eq('user_id', userId).gte('fecha_compra', mesStart).lte('fecha_compra', mesEnd),
      ]);
      // Se calcula para el total y para cada cuenta (en cuenta doble se muestra por cuenta).
      const compromisosDe = (c) => {
        const de = (valor) => !c || cfg.single || mismaCuenta(valor, c);
        const fijos = (r4.data || []).filter(g => de(g.cuenta)).flatMap(g => cadenciaEnMes(g, y, mo, hoy).map(() => g.monto || 0)).reduce((s, n) => s + n, 0);
        const cuotas = (cuotasMes || []).filter(x => monedaDe(x.installment_purchases) === 'PYG' && de(x.installment_purchases?.cuenta)).reduce((s, x) => s + (x.monto || 0), 0);
        const tarjetas = (tarjetasMes || []).filter(x => de(x.cuenta)).reduce((s, x) => s + (x.monto || 0), 0);
        const deudas = (r2.data || []).filter(d => de(d.cuenta)).reduce((s, d) => s + ((d.monto_total || 0) - (d.monto_pagado || 0)), 0);
        return { fijos, cuotas, tarjetas, deudas, total: fijos + cuotas + tarjetas + deudas };
      };
      setCompromisos({ ...compromisosDe(null), c1: compromisosDe(cfg.c1), c2: cfg.single ? null : compromisosDe(cfg.c2) });

      setLoading(false);
    }
    load();
  }, [userId, cfg]);

  const totalAnio = data.reduce((s,m) => s + m.bal, 0);
  const totalAnio1 = data.reduce((s,m) => s + m.bal1, 0);
  const totalAnio2 = data.reduce((s,m) => s + m.bal2, 0);
  const mesesConDatos = data.filter(m => m.tiene);
  const mesActual = new Date().getMonth();
  function calcProjC(c, balActual) {
    if (!projection) return null;
    const deCuenta = (valor) => cfg.single || mismaCuenta(valor, c);
    const inc = projection.cobros.filter(r => deCuenta(r.cuenta)).reduce((s, r) => s + (r.monto || 0), 0);
    const exp = projection.deudas.filter(r => deCuenta(r.cuenta)).reduce((s, r) => s + ((r.monto_total || 0) - (r.monto_pagado || 0)), 0)
      + projection.cuotas.filter(r => deCuenta(r.installment_purchases?.cuenta)).reduce((s, r) => s + (r.monto || 0), 0)
      + projection.gastos.filter(r => deCuenta(r.cuenta)).reduce((s, r) => s + (r.monto || 0), 0);
    return balActual + inc - exp;
  }
  const proj1 = data[mesActual] ? calcProjC(cfg.c1, data[mesActual].bal1) : null;
  const proj2 = (!cfg.single && data[mesActual]) ? calcProjC(cfg.c2, data[mesActual].bal2) : null;

  // Resumen ampliado: este mes contra el anterior, promedios y compromisos.
  const esteMes = data[mesActual] || null;
  const mesAnterior = mesActual > 0 ? data[mesActual - 1] : null;
  const variacion = (ahora, antes) => (antes > 0 ? Math.round(((ahora - antes) / antes) * 100) : null);
  const mesesCerrados = data.filter(m => m.tiene && m.mes < mesActual);
  const promedioBase = mesesCerrados.length ? mesesCerrados : mesesConDatos;
  const promIng = promedioBase.length ? promedioBase.reduce((s, m) => s + m.ing, 0) / promedioBase.length : 0;
  const promGas = promedioBase.length ? promedioBase.reduce((s, m) => s + m.gas, 0) / promedioBase.length : 0;
  // Compromisos contra ingresos: los del mes si ya hay, si no el promedio mensual.
  const ingresoReferencia = esteMes && esteMes.ing > 0 ? esteMes.ing : promIng;
  const pctComprometido = compromisos && ingresoReferencia > 0 ? Math.round((compromisos.total / ingresoReferencia) * 100) : null;
  // Lo mismo, cuenta por cuenta (cuenta doble).
  const promDe = (campo) => (promedioBase.length ? promedioBase.reduce((s, m) => s + m[campo], 0) / promedioBase.length : 0);
  const pctDe = (k) => {
    const c = compromisos?.['c' + k];
    if (!c || !esteMes) return null;
    const ref = esteMes['ing' + k] > 0 ? esteMes['ing' + k] : promDe('ing' + k);
    return ref > 0 ? Math.round((c.total / ref) * 100) : null;
  };
  const colorPct = (p) => (p > 80 ? '#f87171' : p > 50 ? '#fbbf24' : '#34d399');
  const detalleCompromisos = (c) => [c.fijos > 0 && `gastos fijos ${fmt(c.fijos)}`, c.cuotas > 0 && `cuotas ${fmt(c.cuotas)}`, c.tarjetas > 0 && `tarjetas ${fmt(c.tarjetas)}`, c.deudas > 0 && `deudas ${fmt(c.deudas)}`].filter(Boolean).join(' · ');
  // Título "Compromisos del mes" con el iconito de ayuda; tocarlo muestra qué significa.
  const tituloCompromisos = (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>Compromisos del mes</span>
        {resumenV2 && (
          <button type="button" onClick={() => setVerInfo(v => !v)} aria-label="Qué son los compromisos del mes" aria-expanded={verInfo}
            style={{ width: 18, height: 18, borderRadius: 9, border: `1px solid ${verInfo ? 'rgba(165,180,252,0.7)' : 'rgba(255,255,255,0.3)'}`, background: verInfo ? 'rgba(99,102,241,0.25)' : 'transparent', color: verInfo ? '#a5b4fc' : 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0, lineHeight: 1, fontFamily: 'inherit', flexShrink: 0 }}>i</button>
        )}
      </div>
      {resumenV2 && verInfo && (
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, background: 'rgba(99,102,241,0.10)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 10, padding: '8px 10px', marginTop: 8 }}>
          Todo lo que hay que pagar sí o sí este mes, esté pagado o no: gastos fijos, cuotas, pagos de tarjeta y deudas con fecha. Se compara con lo que ingresó en el mes: cuanto más alto el porcentaje, menos margen te queda.
        </div>
      )}
    </div>
  );
  const signo = (n) => (n >= 0 ? '+' : '−');
  const Variacion = ({ v, alReves = false }) => {
    if (v === null) return null;
    const bueno = alReves ? v <= 0 : v >= 0;
    return <span style={{ fontSize: 11, fontWeight: 700, color: bueno ? '#34d399' : '#f87171', marginLeft: 6 }}>{v > 0 ? '↑' : v < 0 ? '↓' : '='} {Math.abs(v)} %</span>;
  };
  const filaDetalle = (etiqueta, ing, gas) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, padding: '4px 0' }}>
      <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{etiqueta}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        <span style={{ color: '#34d399', fontWeight: 700 }}>+{fmt(ing)}</span>
        <span style={{ color: 'rgba(255,255,255,0.3)', margin: '0 6px' }}>·</span>
        <span style={{ color: '#f87171', fontWeight: 700 }}>−{fmt(gas)}</span>
      </span>
    </div>
  );
  const tarjeta = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '14px 16px', marginBottom: 10 };
  const titulo = { fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 };

  return (
    <div>
      <div className="mas-section-header">
        <div>
          <div className="mas-section-title">Resumen {anio}</div>
        </div>
      </div>

      {ampliado && !loading && esteMes && esteMes.tiene && porCuentas && (
        <div style={tarjeta}>
          <div style={titulo}>Este mes · {MESES[mesActual]}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {CUENTAS.map(({ l, k, color }) => (
              <div key={k} style={{ flex: 1, minWidth: 0, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Ingresos</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#34d399', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>+{fmt(esteMes['ing' + k])}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Gastos</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#f87171', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>−{fmt(esteMes['gas' + k])}</span>
                </div>
                <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '2px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: '#fff', fontWeight: 700 }}>En caja</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: esteMes['bal' + k] >= 0 ? '#34d399' : '#f87171', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{signo(esteMes['bal' + k])}{fmt(esteMes['bal' + k])}</span>
                </div>
              </div>
            ))}
          </div>
          {mesAnterior?.tiene && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 8 }}>
              En caja en {MESES[mesActual - 1].toLowerCase()}: {CUENTAS.map(({ l, k }) => `${l} ${signo(mesAnterior['bal' + k])}${fmt(mesAnterior['bal' + k])}`).join(' · ')}.
            </div>
          )}
          {compromisos && CUENTAS.some(({ k }) => compromisos['c' + k]?.total > 0) && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              {tituloCompromisos}
              {CUENTAS.map(({ l, k, color }) => {
                const c = compromisos['c' + k];
                if (!c || c.total <= 0) return null;
                const pct = pctDe(k);
                return (
                  <div key={k} style={{ marginTop: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color }}>{l}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmt(c.total)}</span>
                    </div>
                    {pct !== null && (
                      <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.08)', marginTop: 6, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', borderRadius: 3, background: colorPct(pct), transition: 'width .4s' }} />
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 4, lineHeight: 1.5 }}>
                      {detalleCompromisos(c)}{pct !== null ? ` · ${pct} % de sus ingresos${esteMes['ing' + k] === 0 ? ' (promedio)' : ''}` : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {ampliado && !loading && esteMes && esteMes.tiene && !porCuentas && (
        <div style={tarjeta}>
          <div style={titulo}>Este mes · {MESES[mesActual]}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>Ingresos</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#34d399', fontVariantNumeric: 'tabular-nums' }}>+{fmt(esteMes.ing)}<Variacion v={mesAnterior?.tiene ? variacion(esteMes.ing, mesAnterior.ing) : null} /></span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>Gastos</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#f87171', fontVariantNumeric: 'tabular-nums' }}>−{fmt(esteMes.gas)}<Variacion v={mesAnterior?.tiene ? variacion(esteMes.gas, mesAnterior.gas) : null} alReves /></span>
            </div>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '2px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#fff', fontWeight: 700 }}>En caja</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: esteMes.bal >= 0 ? '#34d399' : '#f87171', fontVariantNumeric: 'tabular-nums' }}>{signo(esteMes.bal)}{fmt(esteMes.bal)}</span>
            </div>
            {mesAnterior?.tiene && (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Comparado con {MESES[mesActual - 1].toLowerCase()}: {signo(mesAnterior.bal)}{fmt(mesAnterior.bal)} en caja.</div>
            )}
          </div>
          {compromisos && compromisos.total > 0 && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>{tituloCompromisos}</div>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#fbbf24', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmt(compromisos.total)}</span>
              </div>
              {pctComprometido !== null && (
                <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', marginTop: 8, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(pctComprometido, 100)}%`, height: '100%', borderRadius: 3, background: pctComprometido > 80 ? '#f87171' : pctComprometido > 50 ? '#fbbf24' : '#34d399', transition: 'width .4s' }} />
                </div>
              )}
              {pctComprometido !== null && (
                <div style={{ fontSize: 12, color: pctComprometido > 80 ? '#f87171' : pctComprometido > 50 ? '#fbbf24' : '#34d399', fontWeight: 700, marginTop: 8 }}>
                  {pctComprometido} % de tus ingresos{esteMes.ing === 0 && promIng > 0 ? ' (promedio)' : ''}
                </div>
              )}
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 4, lineHeight: 1.5 }}>
                {[compromisos.fijos > 0 && `gastos fijos ${fmt(compromisos.fijos)}`, compromisos.cuotas > 0 && `cuotas ${fmt(compromisos.cuotas)}`, compromisos.tarjetas > 0 && `tarjetas ${fmt(compromisos.tarjetas)}`, compromisos.deudas > 0 && `deudas ${fmt(compromisos.deudas)}`].filter(Boolean).join(' · ')}
              </div>
            </div>
          )}
        </div>
      )}

      {ampliado && !loading && promedioBase.length > 0 && porCuentas && (
        <div style={tarjeta}>
          <div style={titulo}>Promedio mensual · {promedioBase.length} {promedioBase.length === 1 ? 'mes' : 'meses'}{mesesCerrados.length ? ' cerrados' : ''}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {CUENTAS.map(({ l, k, color }) => {
              const pi = promDe('ing' + k), pg = promDe('gas' + k), queda = pi - pg;
              return (
                <div key={k} style={{ flex: 1, minWidth: 0, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Ingresos</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#34d399', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>+{fmt(pi)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Gastos</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#f87171', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>−{fmt(pg)}</span>
                  </div>
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '2px 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: '#fff', fontWeight: 700 }}>Te queda</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: queda >= 0 ? '#34d399' : '#f87171', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{signo(queda)}{fmt(queda)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {ampliado && !loading && promedioBase.length > 0 && !porCuentas && (
        <div style={tarjeta}>
          <div style={titulo}>Promedio mensual · {promedioBase.length} {promedioBase.length === 1 ? 'mes' : 'meses'}{mesesCerrados.length ? ' cerrados' : ''}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[{ l: 'Ingresos', v: promIng, c: '#34d399', s: '+' }, { l: 'Gastos', v: promGas, c: '#f87171', s: '−' }, { l: 'Te queda', v: promIng - promGas, c: promIng - promGas >= 0 ? '#34d399' : '#f87171', s: signo(promIng - promGas), fuerte: true }].map(x => (
              <div key={x.l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, paddingTop: x.fuerte ? 6 : 0, borderTop: x.fuerte ? '1px solid rgba(255,255,255,0.08)' : 'none' }}>
                <span style={{ fontSize: 13, color: x.fuerte ? '#fff' : 'rgba(255,255,255,0.6)', fontWeight: x.fuerte ? 700 : 400 }}>{x.l}</span>
                <span style={{ fontSize: x.fuerte ? 15 : 13, fontWeight: x.fuerte ? 800 : 700, color: x.c, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{x.s}{fmt(x.v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {proj1 !== null && (
        <div className="donut-cuentas-bal" style={{ marginBottom: 12, padding: '10px 0' }}>
          <span className={proj1 >= 0 ? 'pos' : 'neg'}>
            {cfg.l1} proyección {MESES[mesActual]}: {proj1 >= 0 ? '+' : '−'}{fmt(Math.abs(proj1))}
          </span>
          {proj2 !== null && (
            <span className={proj2 >= 0 ? 'pos' : 'neg'}>
              {cfg.l2} proyección {MESES[mesActual]}: {proj2 >= 0 ? '+' : '−'}{fmt(Math.abs(proj2))}
            </span>
          )}
        </div>
      )}

      {loading ? <div className="mas-loading">Cargando...</div> : mesesConDatos.length === 0 ? (
        <div className="empty">No hay movimientos registrados en {anio}.</div>
      ) : (
        <ul className="resumen-list">
          {ampliado && <li className="mas-grupo" style={{ padding: '0 4px' }}>Por mes · tocá uno para ver el detalle</li>}
          {data.filter(m => m.tiene).map(m => {
            const abierto = ampliado && mesAbierto === m.mes;
            const previo = m.mes > 0 && data[m.mes - 1]?.tiene ? data[m.mes - 1] : null;
            return (
            <li key={m.mes} style={ampliado ? { flexDirection: 'column', alignItems: 'stretch', cursor: 'pointer' } : undefined}
              onClick={ampliado ? () => setMesAbierto(abierto ? null : m.mes) : undefined}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="resumen-mes-nombre">{MESES[m.mes]}</div>
                <div className="resumen-cuentas">
                  {!cfg.single ? (
                    <>
                      <span className={m.bal1 >= 0 ? 'pos' : 'neg'}>{cfg.l1}: {m.bal1 >= 0 ? '+' : '−'}{fmt(Math.abs(m.bal1))}</span>
                      <span className={m.bal2 >= 0 ? 'pos' : 'neg'}>{cfg.l2}: {m.bal2 >= 0 ? '+' : '−'}{fmt(Math.abs(m.bal2))}</span>
                    </>
                  ) : (
                    <span className={m.bal >= 0 ? 'pos' : 'neg'}>{m.bal >= 0 ? '+' : '−'}{fmt(Math.abs(m.bal))}</span>
                  )}
                </div>
                {ampliado && <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, flexShrink: 0 }}>{abierto ? '▲' : '▼'}</span>}
              </div>
              {abierto && (
                <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  {cfg.single ? filaDetalle('Ingresos · Gastos', m.ing, m.gas) : (
                    <>
                      {filaDetalle(cfg.l1, m.ing1, m.gas1)}
                      {filaDetalle(cfg.l2, m.ing2, m.gas2)}
                      {filaDetalle('Total', m.ing, m.gas)}
                    </>
                  )}
                  {previo && (
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: '2px 4px', alignItems: 'center' }}>
                      Contra {MESES[m.mes - 1].toLowerCase()}: ingresos<Variacion v={variacion(m.ing, previo.ing)} />
                      <span style={{ margin: '0 4px' }}>·</span> gastos<Variacion v={variacion(m.gas, previo.gas)} alReves />
                    </div>
                  )}
                </div>
              )}
            </li>
            );
          })}
          <li className="resumen-total">
            <div className="resumen-mes-nombre" style={{ fontWeight: 800 }}>Total {anio}</div>
            {!cfg.single && (
              <div className="resumen-cuentas">
                <span className={totalAnio1 >= 0 ? 'pos' : 'neg'}>{cfg.l1}: {totalAnio1 >= 0 ? '+' : '−'}{fmt(Math.abs(totalAnio1))}</span>
                <span className={totalAnio2 >= 0 ? 'pos' : 'neg'}>{cfg.l2}: {totalAnio2 >= 0 ? '+' : '−'}{fmt(Math.abs(totalAnio2))}</span>
              </div>
            )}
            <div className={`resumen-bal ${totalAnio >= 0 ? 'pos' : 'neg'}`} style={{ fontSize: 16, fontWeight: 800 }}>
              {totalAnio >= 0 ? '+' : '−'}{fmt(totalAnio)}
            </div>
          </li>
        </ul>
      )}

      {/* Monedas extra activadas con movimientos en el año: mismo resumen, aparte. */}
      {ampliado && !loading && Object.entries(porMoneda).map(([mo, meses]) => {
        const total = meses.reduce((s, m) => s + m.bal, 0);
        const f = (n) => fmtMoneda(Math.abs(n), mo);
        return (
          <div key={mo} style={{ marginTop: 18 }}>
            <div style={{ ...titulo, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ background: 'linear-gradient(135deg,#0ea5e9,#6366f1)', color: '#fff', borderRadius: 7, padding: '2px 7px', fontSize: 10 }}>{MONEDAS[mo].simbolo}</span>
              En {MONEDAS[mo].nombre.toLowerCase()} · {anio}
            </div>
            <ul className="resumen-list">
              {meses.filter(m => m.tiene).map(m => (
                <li key={m.mes}>
                  <div className="resumen-mes-nombre">{MESES[m.mes]}</div>
                  {porCuentas ? (
                    <div className="resumen-cuentas">
                      {CUENTAS.map(({ l, k }) => (
                        <span key={k} className={m['bal' + k] >= 0 ? 'pos' : 'neg'}>{l}: {signo(m['bal' + k])}{f(m['bal' + k])}</span>
                      ))}
                    </div>
                  ) : (
                    <div className="resumen-cuentas" style={{ alignItems: 'flex-end' }}>
                      <span className={m.bal >= 0 ? 'pos' : 'neg'}>{signo(m.bal)}{f(m.bal)}</span>
                      <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>+{f(m.ing)} · −{f(m.gas)}</span>
                    </div>
                  )}
                </li>
              ))}
              <li className="resumen-total">
                <div className="resumen-mes-nombre" style={{ fontWeight: 800 }}>Total {anio}</div>
                {porCuentas && (
                  <div className="resumen-cuentas">
                    {CUENTAS.map(({ l, k }) => { const t = meses.reduce((s, m) => s + m['bal' + k], 0); return <span key={k} className={t >= 0 ? 'pos' : 'neg'}>{l}: {signo(t)}{f(t)}</span>; })}
                  </div>
                )}
                <div className={`resumen-bal ${total >= 0 ? 'pos' : 'neg'}`} style={{ fontSize: 16, fontWeight: 800 }}>{signo(total)}{f(total)}</div>
              </li>
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/* ─── GASTOS FIJOS ─── */
function GastosFijos({ userId, userEmail, cfg: cfgProp, soloLectura = false }) {
  const cfg = cfgProp || getUserConfig(userEmail);
  const hoy = hoyISO();
  const FORM_VACIO = { descripcion: '', monto: '', montoDisplay: '', dia_vencimiento: '', proximo_vencimiento: '', cuenta: cfg.c1, frecuencia: 'mensual', moneda: 'PYG' };
  const opcionesMoneda = opcionesMonedaDe(cfg, userEmail);
  const [filtroMoneda, setFiltroMoneda] = useState('todas');
  const [gastos, setGastos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(FORM_VACIO);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('recurring_expenses').select('*').eq('user_id', userId);
    // Orden: lo que falta pagar primero (el que vence antes, arriba); al día después; pausados al final.
    const hoyStr = hoyISO();
    const lista = (data || []).map(g => ({ ...g, _proximo: proximoDe(g, hoyStr) || '9999' }));
    const clave = (g) => (!g.activo ? '8' : estadoDe(g, hoyStr).etiqueta === 'al_dia' ? '5' : '1') + g._proximo;
    lista.sort((a, b) => (clave(a) < clave(b) ? -1 : 1));
    setGastos(lista);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  function handleMonto(e) {
    const { valor, display } = montoEscrito(e.target.value, form.moneda);
    setForm(f => ({ ...f, monto: valor, montoDisplay: display }));
  }

  // Al cambiar de frecuencia, el campo que aparece arranca con un valor coherente.
  function cambiarFrecuencia(setter, f, frec) {
    const dia = parseInt(f.dia_vencimiento) || (f.proximo_vencimiento ? deISO(f.proximo_vencimiento).getDate() : '');
    if (frec === 'mensual') return setter({ ...f, frecuencia: frec, dia_vencimiento: dia ? String(dia) : '' });
    const prox = f.proximo_vencimiento || (dia ? siguiente(sumarDias(hoy, -1), frec, Number(dia)) : '');
    setter({ ...f, frecuencia: frec, proximo_vencimiento: prox });
  }

  // Día ancla y próximo vencimiento que se guardan, según lo cargado en el formulario.
  function fechasDesde(f, actual) {
    const frec = f.frecuencia || 'mensual';
    if (frec === 'mensual') {
      const dia = parseInt(f.dia_vencimiento);
      if (!dia || dia < 1 || dia > 31) return null;
      // Al editar se conserva el mes del próximo vencimiento (si ya estaba pagado, sigue pagado).
      const base = deISO(actual ? proximoDe(actual, hoy) : hoy);
      return { dia_vencimiento: dia, proximo_vencimiento: enMes(base.getFullYear(), base.getMonth(), dia) };
    }
    if (!f.proximo_vencimiento) return null;
    return { dia_vencimiento: deISO(f.proximo_vencimiento).getDate(), proximo_vencimiento: f.proximo_vencimiento };
  }

  async function handleAdd(e) {
    e.preventDefault();
    const fechas = fechasDesde(form);
    if (!form.descripcion.trim() || !form.monto || !fechas) return;
    const { error } = await supabase.from('recurring_expenses').insert({
      user_id: userId,
      descripcion: form.descripcion.trim(),
      monto: parseFloat(form.monto),
      cuenta: form.cuenta,
      frecuencia: form.frecuencia || 'mensual',
      moneda: form.moneda || 'PYG',
      ...fechas,
    });
    if (error) { alert(`No se pudo guardar: ${error.message}`); return; }
    setForm(FORM_VACIO);
    setShowForm(false);
    load();
  }

  async function handleToggle(id, activo) {
    const { error } = await supabase.from('recurring_expenses').update({ activo: !activo }).eq('id', id);
    if (error) alert(`No se pudo guardar: ${error.message}`);
    load();
  }

  async function handleDelete(id) {
    if (!window.confirm('¿Eliminar este gasto fijo? Los pagos ya anotados en caja se conservan.')) return;
    const { error } = await supabase.from('recurring_expenses').delete().eq('id', id);
    if (error) alert(`No se pudo eliminar: ${error.message}`);
    load();
  }

  async function handleSaveEdit(g) {
    const fechas = fechasDesde(editForm, g);
    if (!editForm.descripcion.trim() || !editForm.monto || !fechas) { alert('Completá la descripción, el monto y la fecha.'); return; }
    const { error } = await supabase.from('recurring_expenses').update({
      descripcion: editForm.descripcion.trim(),
      monto: parseFloat(editForm.monto),
      cuenta: editForm.cuenta,
      frecuencia: editForm.frecuencia || 'mensual',
      moneda: editForm.moneda || 'PYG',
      ...fechas,
    }).eq('id', g.id);
    if (error) { alert(`No se pudo guardar: ${error.message}`); return; }
    setEditingId(null);
    load();
  }

  // Pagar: primero se corre el vencimiento, después se anota el movimiento.
  // Si el movimiento falla, se deshace el primer paso para no quedar a medias.
  async function handlePagar(g) {
    if (!window.confirm(`¿Registrar pago de ${g.descripcion}?`)) return;
    const nuevo = { ...alPagar(g, hoy), pagado_fecha: hoy, pagado_mes: mesDe(hoy) };
    const anteriorEstado = { proximo_vencimiento: g.proximo_vencimiento, pagado_fecha: g.pagado_fecha, pagado_mes: g.pagado_mes };
    const { error: e1 } = await supabase.from('recurring_expenses').update(nuevo).eq('id', g.id);
    if (e1) { alert(`No se pudo registrar el pago: ${e1.message}`); return; }
    const { error: e2 } = await supabase.from('transactions').insert({ user_id: userId, monto: g.monto, tipo: 'gasto', fecha: hoy, categoria: `Gasto fijo: ${g.descripcion}`, cuenta: g.cuenta, moneda: monedaDe(g) });
    if (e2) {
      await supabase.from('recurring_expenses').update(anteriorEstado).eq('id', g.id);
      alert(`No se pudo anotar el movimiento: ${e2.message}`);
    }
    load(); setExpandedId(null);
  }

  async function handleRevertir(g) {
    if (!window.confirm(`¿Revertir el último pago de ${g.descripcion}?`)) return;
    let q = supabase.from('transactions').select('id').eq('user_id', userId).eq('categoria', `Gasto fijo: ${g.descripcion}`);
    if (g.pagado_fecha) q = q.eq('fecha', g.pagado_fecha);
    const { data: txs } = await q.order('id', { ascending: false }).limit(1);
    const { error: e1 } = await supabase.from('recurring_expenses').update({ ...alRevertir(g, hoy), pagado_fecha: null, pagado_mes: null }).eq('id', g.id);
    if (e1) { alert(`No se pudo revertir: ${e1.message}`); return; }
    if (txs?.length) await supabase.from('transactions').delete().eq('id', txs[0].id);
    load(); setExpandedId(null);
  }

  const h = deISO(hoy); const anio = h.getFullYear(), mes0 = h.getMonth();
  const activos = gastos.filter(g => g.activo);
  // Totales del encabezado, moneda por moneda (nunca se suman entre sí).
  const totalMes = textoPorMoneda(activos, g => cadenciaEnMes(g, anio, mes0, hoy).length * g.monto);
  const pendienteMes = textoPorMoneda(activos, g => ocurrenciasEnMes(g, anio, mes0, hoy, { incluirAtrasadas: true }).length * g.monto);

  const FRECUENCIAS = ['mensual', 'quincenal', 'semanal'];
  const etiquetaFrec = (f) => f.charAt(0).toUpperCase() + f.slice(1);

  // Campo de fecha del formulario: día del mes para mensual, calendario para el resto.
  const campoFecha = (f, setter) => f.frecuencia === 'mensual' ? (
    <div className="field" style={{ maxWidth: 110 }}>
      <label>Día vence</label>
      <input type="number" min="1" max="31" value={f.dia_vencimiento} onChange={e => setter({ ...f, dia_vencimiento: e.target.value })} placeholder="10" required />
    </div>
  ) : (
    <div className="field">
      <label>Próximo vencimiento</label>
      <input type="date" value={f.proximo_vencimiento} onChange={e => setter({ ...f, proximo_vencimiento: e.target.value })} required />
    </div>
  );

  const colorEstado = { vencido: '#f87171', hoy: '#fbbf24', pendiente: '#f87171', al_dia: '#34d399', sin_fecha: 'rgba(255,255,255,0.4)' };

  return (
    <div>
      <div className="mas-section-header">
        <div>
          <div className="mas-section-title">Gastos Fijos Recurrentes</div>
          <div className="mas-section-sub">Este mes: <span style={{ color: '#f87171', fontWeight: 700 }}>{totalMes}</span> · Pendiente: <span style={{ color: '#fbbf24', fontWeight: 700 }}>{pendienteMes}</span></div>
        </div>
        {!soloLectura && (
          <button className="mas-add-btn" onClick={() => setShowForm(v => !v)}>
            {showForm ? '✕ Cerrar' : '+ Nuevo'}
          </button>
        )}
      </div>

      {!soloLectura && showForm && (
        <form className="mas-form" onSubmit={handleAdd}>
          <div className="mas-form-title">Nuevo gasto fijo</div>
          <div className="row">
            <div className="field">
              <label>Descripción</label>
              <input type="text" value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Ej: Alquiler, Internet..." required />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label>Frecuencia</label>
              <div className="toggle">
                {FRECUENCIAS.map(fr => (
                  <button key={fr} type="button" className={form.frecuencia === fr ? 'active sublime' : ''} onClick={() => cambiarFrecuencia(setForm, form, fr)}>{etiquetaFrec(fr)}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="row">
            <div className="field">
              <LabelMonto moneda={form.moneda} opciones={opcionesMoneda} onChange={m => setForm(f => ({ ...f, moneda: m, monto: '', montoDisplay: '' }))} />
              <input type="text" inputMode={form.moneda === 'PYG' ? 'numeric' : 'decimal'} className="num" value={form.montoDisplay} onChange={handleMonto} placeholder={form.moneda === 'PYG' ? '0' : '0,00'} required />
            </div>
            {campoFecha(form, setForm)}
          </div>
          {form.frecuencia === 'quincenal' && form.proximo_vencimiento && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: -6, marginBottom: 10 }}>
              Se repite los días {(() => { const d = deISO(form.proximo_vencimiento).getDate(); const d1 = d > 15 ? d - 15 : d; const d2 = d1 + 15; return `${d1} y ${d2 >= 31 ? 'último día' : d2}${d2 >= 29 && d2 < 31 ? ' (o el último si el mes es más corto)' : ''}`; })()} de cada mes.
            </div>
          )}
          <div className="row">
            <div className="field">
              <label>Cuenta</label>
              <CuentaToggle value={form.cuenta} onChange={v => setForm(f => ({ ...f, cuenta: v }))} cfg={cfg} />
            </div>
          </div>
          <button className="add-btn" type="submit">Guardar gasto fijo</button>
        </form>
      )}

      {!loading && gastos.length > 0 && <FiltroMoneda value={filtroMoneda} onChange={setFiltroMoneda} opciones={opcionesMoneda} />}
      {loading ? (
        <div className="mas-loading">Cargando...</div>
      ) : gastos.length === 0 ? (
        <div className="empty">No hay gastos fijos registrados.</div>
      ) : (
        <ul className="mas-list">
          {gastos.filter(enMoneda(filtroMoneda)).map(g => {
            const isExp = expandedId === g.id;
            const est = estadoDe(g, hoy);
            const alDia = est.etiqueta === 'al_dia';
            const frec = g.frecuencia || 'mensual';
            return (
              <li key={g.id} className={!g.activo ? 'inactive' : alDia ? 'al-dia' : ''}
                style={{ flexDirection: 'column', alignItems: 'stretch', gap: 0, cursor: 'pointer' }}
                onClick={() => setExpandedId(isExp ? null : g.id)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="mas-item-icon" style={{ background: alDia ? 'rgba(52,211,153,0.15)' : g.activo ? 'rgba(248,113,113,0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${alDia ? 'rgba(52,211,153,0.3)' : g.activo ? 'rgba(248,113,113,0.3)' : 'rgba(255,255,255,0.1)'}`, flexShrink: 0 }}>
                    {alDia
                      ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                      : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>}
                  </div>
                  <div className="meta">
                    <div className="cat">{g.descripcion}</div>
                    <div className="sub">
                      {est.proximo ? `Próximo: ${fmtFecha(est.proximo)} · ` : ''}{etiquetaCuenta(g.cuenta, cfg)} · {frec}
                      {' · '}<span style={{ color: g.activo ? colorEstado[est.etiqueta] : 'rgba(255,255,255,0.4)', fontWeight: 600 }}>{g.activo ? textoEstado(est) : 'Pausado'}</span>
                    </div>
                  </div>
                  <div className="amt" style={{ flexShrink: 0, color: alDia ? '#34d399' : '#f87171' }}>{fmtMoneda(g.monto, monedaDe(g))}</div>
                  <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, flexShrink: 0 }}>{isExp ? '▲' : '▼'}</span>
                </div>
                {isExp && !soloLectura && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.08)' }}
                    onClick={e => e.stopPropagation()}>
                    {editingId === g.id ? (
                      <div>
                        <div className="row"><div className="field"><label>Descripción</label><input type="text" value={editForm.descripcion} onChange={e => setEditForm(f => ({ ...f, descripcion: e.target.value }))} /></div></div>
                        <div className="row"><div className="field"><label>Frecuencia</label><div className="toggle">{FRECUENCIAS.map(fr => <button key={fr} type="button" className={editForm.frecuencia === fr ? 'active sublime' : ''} onClick={() => cambiarFrecuencia(setEditForm, editForm, fr)}>{etiquetaFrec(fr)}</button>)}</div></div></div>
                        <div className="row">
                          <div className="field"><LabelMonto moneda={editForm.moneda} opciones={opcionesMoneda} onChange={m => setEditForm(f => ({ ...f, moneda: m, monto: '', montoDisplay: '' }))} /><input type="text" inputMode={editForm.moneda === 'PYG' ? 'numeric' : 'decimal'} className="num" value={editForm.montoDisplay ?? ''} onChange={e => { const { valor, display } = montoEscrito(e.target.value, editForm.moneda); setEditForm(f => ({ ...f, monto: valor, montoDisplay: display })); }} /></div>
                          {campoFecha(editForm, setEditForm)}
                        </div>
                        <div className="row"><div className="field"><label>Cuenta</label><CuentaToggle value={editForm.cuenta} onChange={v => setEditForm(f => ({ ...f, cuenta: v }))} cfg={cfg} /></div></div>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 8 }}>
                          <button className="del" style={{ color: '#94a3b8', width: 'auto', padding: '0 12px', fontSize: 12 }} onClick={() => setEditingId(null)}>Cancelar</button>
                          <button className="add-btn" style={{ margin: 0, fontSize: 12, padding: '6px 14px' }} onClick={() => handleSaveEdit(g)}>Guardar</button>
                        </div>
                      </div>
                    ) : (
                      <div className="mas-acciones">
                        {g.activo && est.proximo && (
                          <button className="del" style={{ color: '#34d399', borderColor: 'rgba(52,211,153,0.3)', background: 'rgba(52,211,153,0.1)', width: 'auto', padding: '0 10px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}
                            onClick={() => handlePagar(g)}>✓ Pagar{est.atrasadas > 1 ? ' 1 de ' + est.atrasadas : ''}</button>
                        )}
                        {g.pagado_fecha && (
                          <button className="del" style={{ color: '#fb923c', borderColor: 'rgba(251,146,60,0.3)', background: 'rgba(251,146,60,0.1)', width: 'auto', padding: '0 10px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}
                            onClick={() => handleRevertir(g)}>↩ Revertir</button>
                        )}
                        <button className="del" style={{ color: '#93c5fd', borderColor: 'rgba(147,197,253,0.3)', background: 'rgba(147,197,253,0.1)' }} title="Editar"
                          onClick={() => { setEditingId(g.id); setEditForm({ descripcion: g.descripcion, monto: String(g.monto), montoDisplay: montoParaEditar(g.monto, monedaDe(g)), moneda: monedaDe(g), dia_vencimiento: String(g.dia_vencimiento || ''), proximo_vencimiento: proximoDe(g, hoy) || '', cuenta: g.cuenta, frecuencia: frec }); }}>✎</button>
                        <button className="del" title={g.activo ? 'Pausar' : 'Activar'} onClick={() => handleToggle(g.id, g.activo)} style={{ fontSize: 13 }}>{g.activo ? '⏸' : '▶'}</button>
                        <button className="del" onClick={() => handleDelete(g.id)} title="Eliminar">✕</button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ─── CUOTAS ─── */
// Fecha de la última cuota de una compra (o la primera si no hay cuotas cargadas).
const fechaFinCompra = (p, cuotas) => (cuotas || []).map(c => c.fecha_vencimiento).sort().pop() || p.fecha_primera_cuota || null;

function Cuotas({ userId, userEmail, cfg: cfgProp, soloLectura = false }) {
  const cfg = cfgProp || getUserConfig(userEmail);
  const { recortar, verMas } = useVerMas(puedeVerMas(userEmail));
  const [purchases, setPurchases] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [installments, setInstallments] = useState({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [form, setForm] = useState({
    descripcion: '', monto: '', montoDisplay: '',
    total_cuotas: '', dia_vencimiento: '',
    fecha_primera_cuota: hoyISO(),
    cuenta: cfg.c1, frecuencia: 'mensual', moneda: 'PYG',
  });
  const opcionesMoneda = opcionesMonedaDe(cfg, userEmail);
  const [filtroMoneda, setFiltroMoneda] = useState('todas');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('installment_purchases').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    const compras = data || [];
    // Todas las cuotas de una vez: así el avance (2/5) se ve sin desplegar y se
    // puede ordenar por la próxima cuota pendiente. Terminadas al final.
    const ids = compras.map(p => p.id);
    const { data: todas } = ids.length ? await supabase.from('installments').select('*').in('purchase_id', ids).order('numero_cuota') : { data: [] };
    const porCompra = Object.fromEntries(ids.map(id => [id, []]));
    (todas || []).forEach(c => { (porCompra[c.purchase_id] ||= []).push(c); });
    setInstallments(porCompra);
    const clave = (p) => {
      const pend = (porCompra[p.id] || []).filter(c => c.estado === 'pendiente').map(c => c.fecha_vencimiento).sort();
      return pend.length ? '1' + pend[0] : '9' + fechaInvertida(fechaFinCompra(p, porCompra[p.id]));
    };
    setPurchases(compras.sort((a, b) => (clave(a) < clave(b) ? -1 : 1)));
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  async function loadInstallments(purchaseId) {
    const { data } = await supabase.from('installments').select('*').eq('purchase_id', purchaseId).order('numero_cuota');
    setInstallments(prev => ({ ...prev, [purchaseId]: data || [] }));
  }

  function toggleExpand(id) {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!installments[id]) loadInstallments(id);
  }

  // Compra terminada: su "fecha" es la de la última cuota (para esconder las viejas).
  const terminada = (p) => (installments[p.id] || []).length > 0 && !(installments[p.id] || []).some(c => c.estado === 'pendiente');
  const fechaTerminada = (p) => (terminada(p) ? fechaFinCompra(p, installments[p.id]) : null);
  const { visibles: comprasVisibles, ocultos: comprasOcultas } = recortar(purchases, fechaTerminada);

  function handleMonto(e) {
    const { valor, display } = montoEscrito(e.target.value, form.moneda);
    setForm(f => ({ ...f, monto: valor, montoDisplay: display }));
  }

  async function handleAdd(e) {
    e.preventDefault();
    const monto = parseFloat(form.monto);
    const totalCuotas = parseInt(form.total_cuotas);
    const esMensual = (form.frecuencia || 'mensual') === 'mensual';
    const diaVenc = esMensual ? parseInt(form.dia_vencimiento) : (form.fecha_primera_cuota ? deISO(form.fecha_primera_cuota).getDate() : NaN);
    if (!form.descripcion.trim() || !monto || !totalCuotas || !diaVenc || !form.fecha_primera_cuota) { alert('Completá todos los campos.'); return; }

    const { data: purchase, error } = await supabase.from('installment_purchases').insert({
      user_id: userId,
      descripcion: form.descripcion.trim(),
      monto_por_cuota: monto,
      total_cuotas: totalCuotas,
      dia_vencimiento: diaVenc,
      fecha_primera_cuota: form.fecha_primera_cuota,
      cuenta: form.cuenta,
      frecuencia: form.frecuencia || 'mensual',
      moneda: form.moneda || 'PYG',
    }).select().single();

    if (error || !purchase) return;

    // Generar cuotas automáticamente
    const cuotas = [];
    const firstDate = new Date(form.fecha_primera_cuota + 'T12:00:00');
    const frec = form.frecuencia || 'mensual';
    for (let i = 0; i < totalCuotas; i++) {
      const d = new Date(firstDate);
      if (frec === 'semanal') {
        d.setDate(d.getDate() + i * 7);
      } else if (frec === 'quincenal') {
        d.setDate(d.getDate() + i * 15);
      } else {
        d.setTime(sumarMeses(firstDate, i, diaVenc).getTime());
      }
      cuotas.push({
        purchase_id: purchase.id,
        user_id: userId,
        numero_cuota: i + 1,
        monto,
        fecha_vencimiento: d.toISOString().slice(0, 10),
        estado: 'pendiente',
      });
    }
    await supabase.from('installments').insert(cuotas);

    setForm({ descripcion: '', monto: '', montoDisplay: '', total_cuotas: '', dia_vencimiento: '', fecha_primera_cuota: hoyISO(), cuenta: cfg.c1, frecuencia: 'mensual', moneda: 'PYG' });
    setShowForm(false);
    load();
  }

  async function handlePagarCuota(cuotaId, purchaseId) {
    await supabase.from('installments').update({ estado: 'pagado' }).eq('id', cuotaId);

    // Registrar gasto en el libro principal
    const purchase = purchases.find(p => p.id === purchaseId);
    const cuota = (installments[purchaseId] || []).find(c => c.id === cuotaId);
    if (purchase && cuota) {
      await supabase.from('transactions').insert({
        user_id: userId,
        monto: cuota.monto,
        tipo: 'gasto',
        fecha: hoyISO(),
        categoria: `${purchase.descripcion} — Cuota ${cuota.numero_cuota}/${purchase.total_cuotas}`,
        cuenta: purchase.cuenta,
        moneda: monedaDe(purchase),
      });
    }

    loadInstallments(purchaseId);
  }

  async function handleDeletePurchase(id) {
    if (!window.confirm('¿Eliminar esta compra y todas sus cuotas?')) return;
    await supabase.from('installments').delete().eq('purchase_id', id);
    await supabase.from('installment_purchases').delete().eq('id', id);
    setPurchases(prev => prev.filter(p => p.id !== id));
    if (expanded === id) setExpanded(null);
  }

  async function handleSaveEditCuota(id) {
    const frec = editForm.frecuencia || 'mensual';
    const diaVenc = frec === 'mensual' ? (parseInt(editForm.dia_vencimiento) || 1) : (editForm.fecha_primera_cuota ? deISO(editForm.fecha_primera_cuota).getDate() : 1);
    const monto = parseFloat(editForm.monto);
    const total = parseInt(editForm.total_cuotas);
    if (!editForm.descripcion.trim() || !monto || !total || total < 1 || !editForm.fecha_primera_cuota) { alert('Completá todos los campos.'); return; }

    // Las cuotas ya pagadas no se tocan: se ajustan las pendientes y se agregan
    // o quitan al final. Bajar la cantidad solo vale si las que sobran están pendientes.
    const { data: existing } = await supabase.from('installments').select('*').eq('purchase_id', id).order('numero_cuota');
    const cuotas = existing || [];
    const pagadaFuera = cuotas.find(c => c.estado === 'pagado' && c.numero_cuota > total);
    if (pagadaFuera) { alert(`No se puede bajar a ${total} cuotas: la cuota ${pagadaFuera.numero_cuota} ya está pagada.`); return; }

    const fechaDe = (numero) => {
      const i = numero - 1;
      const d = new Date(editForm.fecha_primera_cuota + 'T12:00:00');
      if (frec === 'semanal') d.setDate(d.getDate() + i * 7);
      else if (frec === 'quincenal') d.setDate(d.getDate() + i * 15);
      else d.setTime(sumarMeses(d, i, diaVenc).getTime());
      return d.toISOString().slice(0, 10);
    };

    await supabase.from('installment_purchases').update({
      descripcion: editForm.descripcion.trim(),
      cuenta: editForm.cuenta,
      frecuencia: frec,
      dia_vencimiento: diaVenc,
      fecha_primera_cuota: editForm.fecha_primera_cuota,
      monto_por_cuota: monto,
      total_cuotas: total,
    }).eq('id', id);

    const sobran = cuotas.filter(c => c.numero_cuota > total).map(c => c.id);
    if (sobran.length) await supabase.from('installments').delete().in('id', sobran);

    const pendientes = cuotas.filter(c => c.estado === 'pendiente' && c.numero_cuota <= total);
    await Promise.all(pendientes.map(c => supabase.from('installments').update({ monto, fecha_vencimiento: fechaDe(c.numero_cuota) }).eq('id', c.id)));

    const ultima = cuotas.reduce((m, c) => Math.max(m, c.numero_cuota), 0);
    const nuevas = [];
    for (let n = ultima + 1; n <= total; n++) {
      nuevas.push({ purchase_id: id, user_id: userId, numero_cuota: n, monto, fecha_vencimiento: fechaDe(n), estado: 'pendiente' });
    }
    if (nuevas.length) await supabase.from('installments').insert(nuevas);

    setEditingId(null);
    if (installments[id]) loadInstallments(id);
    load();
  }

  const pendingThisMonth = () => {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth() + 1;
    let total = 0;
    Object.values(installments).flat().forEach(c => {
      if (c.estado === 'pendiente') {
        const [cy, cm] = c.fecha_vencimiento.split('-').map(Number);
        if (cy === y && cm === m) total += c.monto;
      }
    });
    return total;
  };

  return (
    <div>
      <div className="mas-section-header">
        <div>
          <div className="mas-section-title">Cuotas</div>
          <div className="mas-section-sub">{purchases.length} compra{purchases.length !== 1 ? 's' : ''} en cuotas</div>
        </div>
        {!soloLectura && (
          <button className="mas-add-btn" onClick={() => setShowForm(v => !v)}>
            {showForm ? '✕ Cerrar' : '+ Nueva'}
          </button>
        )}
      </div>

      {!soloLectura && showForm && (
        <form className="mas-form" onSubmit={handleAdd}>
          <div className="mas-form-title">Nueva compra en cuotas</div>
          <div className="row">
            <div className="field">
              <label>Descripción</label>
              <input type="text" value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Ej: Heladera, TV..." required />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <LabelMonto texto="Monto por cuota" moneda={form.moneda} opciones={opcionesMoneda} onChange={m => setForm(f => ({ ...f, moneda: m, monto: '', montoDisplay: '' }))} />
              <input type="text" inputMode={form.moneda === 'PYG' ? 'numeric' : 'decimal'} className="num" value={form.montoDisplay} onChange={handleMonto} placeholder={form.moneda === 'PYG' ? '0' : '0,00'} required />
            </div>
            <div className="field" style={{ maxWidth: 80 }}>
              <label>Cuotas</label>
              <input type="number" min="1" max="60" value={form.total_cuotas} onChange={e => setForm(f => ({ ...f, total_cuotas: e.target.value }))} placeholder="12" required />
            </div>
          </div>
          <div className="row">
            {(form.frecuencia || 'mensual') === 'mensual' && <div className="field" style={{ maxWidth: 110 }}>
              <label>Día vence</label>
              <input type="number" min="1" max="31" value={form.dia_vencimiento} onChange={e => setForm(f => ({ ...f, dia_vencimiento: e.target.value }))} placeholder="10" required />
            </div>}
            <div className="field">
              <label>Primera cuota</label>
              <input type="date" value={form.fecha_primera_cuota} onChange={e => setForm(f => ({ ...f, fecha_primera_cuota: e.target.value }))} required />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label>Frecuencia</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {['mensual', 'quincenal', 'semanal'].map(f => (
                  <button key={f} type="button" onClick={() => setForm(prev => ({ ...prev, frecuencia: f }))}
                    style={{ flex: 1, padding: '6px 0', borderRadius: 8, border: '1px solid', fontSize: 12,
                      background: form.frecuencia === f ? 'rgba(96,165,250,0.2)' : 'transparent',
                      borderColor: form.frecuencia === f ? 'rgba(96,165,250,0.5)' : 'rgba(255,255,255,0.15)',
                      color: form.frecuencia === f ? '#93c5fd' : 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label>Cuenta</label>
              <CuentaToggle value={form.cuenta} onChange={v => setForm(f => ({ ...f, cuenta: v }))} cfg={cfg} />
            </div>
          </div>
          {form.monto && form.total_cuotas && (
            <div className="mas-preview">
              Total: {fmtMoneda(parseFloat(form.monto) * parseInt(form.total_cuotas || 0), form.moneda)} en {form.total_cuotas} cuotas de {fmtMoneda(parseFloat(form.monto), form.moneda)}
            </div>
          )}
          <button className="add-btn" type="submit">Guardar y generar cuotas</button>
        </form>
      )}

      {!loading && purchases.length > 0 && <FiltroMoneda value={filtroMoneda} onChange={setFiltroMoneda} opciones={opcionesMoneda} />}
      {loading ? (
        <div className="mas-loading">Cargando...</div>
      ) : purchases.length === 0 ? (
        <div className="empty">No hay compras en cuotas registradas.</div>
      ) : (
        <ul className="mas-list">
          {comprasVisibles.filter(enMoneda(filtroMoneda)).map(p => {
            const cuotas = installments[p.id] || [];
            const pagadas = cuotas.filter(c => c.estado === 'pagado').length;
            const pct = p.total_cuotas ? Math.round((pagadas / p.total_cuotas) * 100) : 0;
            return (
              <li key={p.id} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 0, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div className="mas-item-icon" style={{ background: 'rgba(192,132,252,0.15)', border: '1px solid rgba(192,132,252,0.3)' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c084fc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/></svg></div>
                  <div className="meta" style={{ flex: 1 }}>
                    <div className="cat">{p.descripcion}</div>
                    <div className="sub">{pagadas}/{p.total_cuotas} cuotas · {fmtMoneda(p.monto_por_cuota, monedaDe(p))}{p.frecuencia === 'semanal' ? '/sem.' : p.frecuencia === 'quincenal' ? '/quinc.' : '/mes'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="del" style={{ fontSize: 13 }} onClick={() => toggleExpand(p.id)} title="Ver cuotas">
                      {expanded === p.id ? '▲' : '▼'}
                    </button>
                    {!soloLectura && <button className="del" style={{ color: '#93c5fd', borderColor: 'rgba(147,197,253,0.3)', background: 'rgba(147,197,253,0.1)' }} title="Editar"
                      onClick={() => { setEditingId(p.id); setEditForm({ descripcion: p.descripcion, cuenta: p.cuenta || cfg.c1, frecuencia: p.frecuencia || 'mensual', dia_vencimiento: p.dia_vencimiento || '', fecha_primera_cuota: p.fecha_primera_cuota || '', monto: String(p.monto_por_cuota || 0), montoDisplay: montoParaEditar(p.monto_por_cuota || 0, monedaDe(p)), moneda: monedaDe(p), total_cuotas: String(p.total_cuotas || '') }); }}>✎</button>}
                    {!soloLectura && <button className="del" onClick={() => handleDeletePurchase(p.id)} title="Eliminar">✕</button>}
                  </div>
                </div>
                {editingId === p.id && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="row"><div className="field"><label>Descripción</label><input type="text" value={editForm.descripcion} onChange={e => setEditForm(f => ({...f, descripcion: e.target.value}))} /></div></div>
                    <div className="row">
                      <div className="field"><label>Monto por cuota ({simboloDe(editForm.moneda || 'PYG')})</label><input type="text" inputMode={(editForm.moneda || 'PYG') === 'PYG' ? 'numeric' : 'decimal'} className="num" value={editForm.montoDisplay ?? ''} onChange={e => { const { valor, display } = montoEscrito(e.target.value, editForm.moneda || 'PYG'); setEditForm(f => ({ ...f, monto: valor, montoDisplay: display })); }} /></div>
                      <div className="field" style={{ maxWidth: 110 }}><label>Cuotas</label><input type="number" inputMode="numeric" min="1" max="120" value={editForm.total_cuotas} onChange={e => setEditForm(f => ({...f, total_cuotas: e.target.value.replace(/\D/g, '')}))} /></div>
                    </div>
                    <div className="row">
                      {(editForm.frecuencia || 'mensual') === 'mensual' && <div className="field" style={{ maxWidth: 100 }}><label>Día vence</label><input type="number" min="1" max="31" value={editForm.dia_vencimiento} onChange={e => setEditForm(f => ({...f, dia_vencimiento: e.target.value}))} placeholder="10" /></div>}
                      <div className="field"><label>Primera cuota</label><input type="date" value={editForm.fecha_primera_cuota} onChange={e => setEditForm(f => ({...f, fecha_primera_cuota: e.target.value}))} /></div>
                    </div>
                    <div className="row"><div className="field"><label>Frecuencia</label><div style={{ display: 'flex', gap: 6 }}>{['mensual','quincenal','semanal'].map(f => (<button key={f} type="button" onClick={() => setEditForm(prev => ({...prev, frecuencia: f}))} style={{ flex: 1, padding: '6px 0', borderRadius: 8, border: '1px solid', fontSize: 12, background: editForm.frecuencia === f ? 'rgba(96,165,250,0.2)' : 'transparent', borderColor: editForm.frecuencia === f ? 'rgba(96,165,250,0.5)' : 'rgba(255,255,255,0.15)', color: editForm.frecuencia === f ? '#93c5fd' : 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>{f.charAt(0).toUpperCase() + f.slice(1)}</button>))}</div></div></div>
                    <div className="row"><div className="field"><label>Cuenta</label><CuentaToggle value={editForm.cuenta} onChange={v => setEditForm(f => ({...f, cuenta: v}))} cfg={cfg} /></div></div>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 8 }}>
                      <button className="del" style={{ color: '#94a3b8', width: 'auto', padding: '0 12px', fontSize: 12 }} onClick={() => setEditingId(null)}>Cancelar</button>
                      <button className="add-btn" style={{ margin: 0, fontSize: 12, padding: '6px 14px' }} onClick={() => handleSaveEditCuota(p.id)}>Guardar</button>
                    </div>
                  </div>
                )}
                <div className="cuota-bar-wrap">
                  <div className="cuota-bar" style={{ width: `${pct}%` }} />
                </div>
                {expanded === p.id && (
                  <>
                    {(() => {
                      const pendientes = cuotas.filter(c => c.estado === 'pendiente');
                      const totalRestante = pendientes.reduce((s, c) => s + c.monto, 0);
                      return pendientes.length > 0 ? (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 4px 6px', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 8 }}>
                          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{pendientes.length} cuota{pendientes.length !== 1 ? 's' : ''} pendiente{pendientes.length !== 1 ? 's' : ''}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#f87171' }}>Total restante: {fmtMoneda(totalRestante, monedaDe(p))}</span>
                        </div>
                      ) : null;
                    })()}
                  <ul className="cuota-list">
                    {cuotas.map(c => (
                      <li key={c.id} className={c.estado === 'pagado' ? 'pagado' : ''}>
                        <span className="cuota-num">#{c.numero_cuota}</span>
                        <span className="cuota-fecha">{fmtFecha(c.fecha_vencimiento)}</span>
                        <span className="cuota-monto">{fmtMoneda(c.monto, monedaDe(p))}</span>
                        {c.estado === 'pendiente' ? (
                          !soloLectura && <button className="cuota-pay-btn" onClick={() => handlePagarCuota(c.id, p.id)}>✓ Pagar</button>
                        ) : (
                          !soloLectura && <button className="cuota-pay-btn" style={{ background: 'rgba(251,146,60,0.15)', borderColor: 'rgba(251,146,60,0.3)', color: '#fb923c' }}
                            onClick={async () => {
                              if (!window.confirm(`¿Revertir pago de cuota #${c.numero_cuota}?`)) return;
                              // El movimiento se busca sin el total ('Cuota 1/'): si la cantidad de cuotas se editó después de pagar, el texto viejo dice otro total.
                              const cat = `${p.descripcion} — Cuota ${c.numero_cuota}/`;
                              const { data: txs } = await supabase.from('transactions').select('id').eq('user_id', userId).like('categoria', cat + '%').order('fecha', { ascending: false }).limit(1);
                              await Promise.all([
                                supabase.from('installments').update({ estado: 'pendiente' }).eq('id', c.id),
                                txs?.length ? supabase.from('transactions').delete().eq('id', txs[0].id) : Promise.resolve(),
                              ]);
                              loadInstallments(p.id);
                            }}>↩ Revertir</button>
                        )}
                      </li>
                    ))}
                  </ul>
                  </>
                )}
              </li>
            );
          })}
          <BotonVerMas ocultos={comprasOcultas.length} onClick={() => verMas(comprasOcultas, fechaTerminada)} texto="Ver compras terminadas anteriores" />
        </ul>
      )}
    </div>
  );
}

/* ─── COBROS (Cuentas por cobrar) ─── */
// Grupos de la lista de cobros, en el orden en que se muestran.
const grupoCobro = (i) => i.activo === false ? '8' : !esRecurrente(i) ? (i.estado === 'cobrado' ? '9' : '5') : '1';
const TITULO_GRUPO_COBRO = { '1': 'Repetitivos', '5': 'Una sola vez', '8': 'Pausados', '9': 'Cobrados' };

function Cobros({ userId, userEmail, cfg: cfgProp, soloLectura = false }) {
  const cfg = cfgProp || getUserConfig(userEmail);
  const hoy = hoyISO();
  const { recortar, verMas } = useVerMas(puedeVerMas(userEmail));
  // Un cobro de una sola vez ya cobrado se ubica por la fecha en que se cobró.
  const fechaCobrado = (i) => (grupoCobro(i) === '9' ? (i.cobrado_fecha || i.fecha_esperada) : null);
  const FORM_VACIO = { cliente: '', monto: '', montoDisplay: '', fecha_esperada: '', forma_pago: 'transferencia', cuenta: cfg.c1, frecuencia: 'una_vez', moneda: 'PYG' };
  const opcionesMoneda = opcionesMonedaDe(cfg, userEmail);
  const [filtroMoneda, setFiltroMoneda] = useState('todas');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [form, setForm] = useState(FORM_VACIO);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('receivables').select('*').eq('user_id', userId);
    // Orden: repetitivos arriba (vuelven cada período), una sola vez después,
    // pausados y cobrados al final. Dentro de cada grupo, el que vence antes primero.
    // Los cobrados van del más reciente al más viejo.
    const clave = (i) => grupoCobro(i) === '9' ? '9' + fechaInvertida(i.cobrado_fecha || i.fecha_esperada)
      : grupoCobro(i) + (esRecurrente(i) ? (proximoDe(i, hoyISO()) || '9999') : (i.fecha_esperada || '9999'));
    setItems((data || []).sort((a, b) => (clave(a) < clave(b) ? -1 : 1)));
    setLoading(false);
  }, [userId]);
  const { visibles: itemsVisibles, ocultos: itemsOcultos } = recortar(items, fechaCobrado);

  useEffect(() => { load(); }, [load]);

  function handleMonto(e) {
    const raw = e.target.value.replace(/\D/g, '');
    setForm(f => ({ ...f, monto: raw, montoDisplay: fmtD(raw) }));
  }

  const FRECUENCIAS = [['una_vez', 'Una vez'], ['mensual', 'Mensual'], ['quincenal', 'Quincenal'], ['semanal', 'Semanal']];
  const nombreFrec = (v) => (FRECUENCIAS.find(([k]) => k === v) || ['', ''])[1];

  async function handleAdd(e) {
    e.preventDefault();
    const frec = form.frecuencia || 'una_vez';
    if (!form.cliente.trim() || !form.monto) return;
    if (frec !== 'una_vez' && !form.fecha_esperada) { alert('Un cobro repetitivo necesita la fecha del próximo cobro.'); return; }
    const { error } = await supabase.from('receivables').insert({
      user_id: userId, cliente: form.cliente.trim(),
      monto: parseFloat(form.monto),
      fecha_esperada: form.fecha_esperada || null,
      proximo_vencimiento: frec !== 'una_vez' ? form.fecha_esperada : null,
      forma_pago: form.forma_pago,
      cuenta: form.cuenta,
      frecuencia: frec,
      moneda: form.moneda || 'PYG',
    });
    if (error) { alert(`No se pudo guardar: ${error.message}`); return; }
    setForm(FORM_VACIO);
    setShowForm(false);
    load();
  }

  // Cobrar: primero se actualiza el cobro, después se anota el ingreso.
  // Si el ingreso falla, se deshace el primer paso.
  async function handleCobrar(item) {
    if (!window.confirm(`¿Marcar como cobrado a ${item.cliente}?`)) return;
    const recurrente = esRecurrente(item);
    const nuevo = recurrente
      ? { ...alPagar(item, hoy), cobrado_fecha: hoy }
      : { estado: 'cobrado', cobrado_fecha: hoy };
    const previo = recurrente
      ? { proximo_vencimiento: item.proximo_vencimiento, cobrado_fecha: item.cobrado_fecha }
      : { estado: item.estado, cobrado_fecha: item.cobrado_fecha };
    const { error: e1 } = await supabase.from('receivables').update(nuevo).eq('id', item.id);
    if (e1) { alert(`No se pudo marcar el cobro: ${e1.message}`); return; }
    const { error: e2 } = await supabase.from('transactions').insert({
      user_id: userId, monto: item.monto, tipo: 'ingreso', fecha: hoy,
      categoria: `Cobro: ${item.cliente}`, cuenta: item.cuenta || cfg.c1, moneda: monedaDe(item),
    });
    if (e2) {
      await supabase.from('receivables').update(previo).eq('id', item.id);
      alert(`No se pudo anotar el ingreso: ${e2.message}`);
    }
    load(); setExpandedId(null);
  }

  async function handleRevertir(item) {
    if (!window.confirm(`¿Revertir el último cobro de ${item.cliente}?`)) return;
    let q = supabase.from('transactions').select('id').eq('user_id', userId).eq('categoria', `Cobro: ${item.cliente}`);
    if (item.cobrado_fecha) q = q.eq('fecha', item.cobrado_fecha);
    const { data: txs } = await q.order('id', { ascending: false }).limit(1);
    const nuevo = esRecurrente(item)
      ? { ...alRevertir(item, hoy), cobrado_fecha: null }
      : { estado: 'pendiente', cobrado_fecha: null };
    const { error: e1 } = await supabase.from('receivables').update(nuevo).eq('id', item.id);
    if (e1) { alert(`No se pudo revertir: ${e1.message}`); return; }
    if (txs?.length) await supabase.from('transactions').delete().eq('id', txs[0].id);
    load(); setExpandedId(null);
  }

  async function handleToggle(item) {
    const { error } = await supabase.from('receivables').update({ activo: !item.activo }).eq('id', item.id);
    if (error) alert(`No se pudo guardar: ${error.message}`);
    load();
  }

  // Eliminar solo saca la tarjeta. Los ingresos ya anotados en caja se conservan.
  async function handleDelete(id) {
    if (!window.confirm('¿Eliminar este cobro? Los ingresos ya anotados en caja se conservan.')) return;
    const { error } = await supabase.from('receivables').delete().eq('id', id);
    if (error) alert(`No se pudo eliminar: ${error.message}`);
    load();
  }

  async function handleSaveEditCobro(item) {
    const frec = editForm.frecuencia || 'una_vez';
    if (!editForm.cliente.trim() || !editForm.monto) { alert('Completá el cliente y el monto.'); return; }
    if (frec !== 'una_vez' && !editForm.fecha_esperada) { alert('Un cobro repetitivo necesita la fecha del próximo cobro.'); return; }
    const cambios = {
      cliente: editForm.cliente.trim(),
      monto: parseFloat(editForm.monto),
      forma_pago: editForm.forma_pago,
      cuenta: editForm.cuenta,
      frecuencia: frec,
      moneda: editForm.moneda || 'PYG',
    };
    if (frec !== 'una_vez') {
      // La fecha cargada pasa a ser el ancla y el próximo cobro solo si el usuario la cambió
      // (o si el cobro recién se vuelve repetitivo). Si no, se respeta el ancla original.
      const fechaActual = proximoDe(item, hoy);
      if (editForm.fecha_esperada !== fechaActual || !esRecurrente(item)) {
        cambios.fecha_esperada = editForm.fecha_esperada;
        cambios.proximo_vencimiento = editForm.fecha_esperada;
      }
    } else {
      cambios.fecha_esperada = editForm.fecha_esperada || null;
      cambios.proximo_vencimiento = null;
    }
    const { error } = await supabase.from('receivables').update(cambios).eq('id', item.id);
    if (error) { alert(`No se pudo guardar: ${error.message}`); return; }
    setEditingId(null);
    load();
  }

  const h = deISO(hoy); const anio = h.getFullYear(), mes0 = h.getMonth();
  const pendiente = textoPorMoneda(items.filter(i => i.activo !== false), i => {
    if (!esRecurrente(i)) return i.estado === 'pendiente' ? i.monto : 0;
    return ocurrenciasEnMes(i, anio, mes0, hoy, { incluirAtrasadas: true }).length * i.monto;
  });

  const colorEstado = { vencido: '#f87171', hoy: '#fbbf24', pendiente: '#34d399', al_dia: '#34d399', sin_fecha: 'rgba(255,255,255,0.4)' };

  const formulario = (f, setter, onSubmit, titulo, botonTexto, onCancel) => (
    <form className="mas-form" onSubmit={onSubmit}>
      <div className="mas-form-title">{titulo}</div>
      <div className="row">
        <div className="field">
          <label>Cliente / Deudor</label>
          <input type="text" value={f.cliente} onChange={e => setter({ ...f, cliente: e.target.value })} placeholder="Nombre..." required />
        </div>
      </div>
      <div className="row">
        <div className="field">
          <label>Frecuencia</label>
          <div className="toggle">
            {FRECUENCIAS.map(([v, l]) => (
              <button key={v} type="button" className={f.frecuencia === v ? 'active sublime' : ''} onClick={() => setter({ ...f, frecuencia: v })}>{l}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="row">
        <div className="field">
          <LabelMonto moneda={f.moneda || 'PYG'} opciones={opcionesMoneda} onChange={m => setter({ ...f, moneda: m, monto: '', montoDisplay: '' })} />
          <input type="text" inputMode={(f.moneda || 'PYG') === 'PYG' ? 'numeric' : 'decimal'} className="num" value={f.montoDisplay ?? montoParaEditar(f.monto, f.moneda || 'PYG')} onChange={e => { const { valor, display } = montoEscrito(e.target.value, f.moneda || 'PYG'); setter({ ...f, monto: valor, montoDisplay: display }); }} placeholder={(f.moneda || 'PYG') === 'PYG' ? '0' : '0,00'} required />
        </div>
        <div className="field">
          <label>{f.frecuencia === 'una_vez' ? 'Fecha esperada' : 'Próximo cobro'}</label>
          <input type="date" value={f.fecha_esperada || ''} onChange={e => setter({ ...f, fecha_esperada: e.target.value })} required={f.frecuencia !== 'una_vez'} />
        </div>
      </div>
      {f.frecuencia === 'quincenal' && f.fecha_esperada && (
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: -6, marginBottom: 10 }}>
          Se repite los días {(() => { const d = deISO(f.fecha_esperada).getDate(); const d1 = d > 15 ? d - 15 : d; const d2 = d1 + 15; return `${d1} y ${d2 >= 31 ? 'último día' : d2}${d2 >= 29 && d2 < 31 ? ' (o el último si el mes es más corto)' : ''}`; })()} de cada mes.
        </div>
      )}
      <div className="row">
        <div className="field">
          <label>Forma de pago</label>
          <div className="toggle">
            {['transferencia', 'efectivo'].map(p => (
              <button key={p} type="button" className={f.forma_pago === p ? 'active sublime' : ''} onClick={() => setter({ ...f, forma_pago: p })}>{p.charAt(0).toUpperCase() + p.slice(1)}</button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Acreditar a</label>
          <CuentaToggle value={f.cuenta} onChange={v => setter({ ...f, cuenta: v })} cfg={cfg} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 8 }}>
        {onCancel && <button type="button" className="del" style={{ color: '#94a3b8', width: 'auto', padding: '0 12px', fontSize: 12 }} onClick={onCancel}>Cancelar</button>}
        <button className="add-btn" type="submit" style={onCancel ? { margin: 0, fontSize: 12, padding: '6px 14px' } : undefined}>{botonTexto}</button>
      </div>
    </form>
  );

  return (
    <div>
      <div className="mas-section-header">
        <div>
          <div className="mas-section-title">Cuentas por Cobrar</div>
          <div className="mas-section-sub">Pendiente este mes: <span style={{ color: '#34d399', fontWeight: 700 }}>{pendiente}</span></div>
        </div>
        {!soloLectura && (
          <button className="mas-add-btn" onClick={() => setShowForm(v => !v)}>
            {showForm ? '✕ Cerrar' : '+ Nuevo'}
          </button>
        )}
      </div>

      {!soloLectura && showForm && formulario(form, setForm, handleAdd, 'Nuevo cobro pendiente', 'Guardar')}

      {!loading && items.length > 0 && <FiltroMoneda value={filtroMoneda} onChange={setFiltroMoneda} opciones={opcionesMoneda} />}
      {loading ? <div className="mas-loading">Cargando...</div> : items.length === 0 ? (
        <div className="empty">No hay cobros registrados.</div>
      ) : (
        <ul className="mas-list">
          {itemsVisibles.filter(enMoneda(filtroMoneda)).map((i, idx, lista) => {
            const isExp = expandedId === i.id;
            const recurrente = esRecurrente(i);
            const pausado = i.activo === false;
            const grupo = grupoCobro(i);
            const separador = (idx === 0 || grupoCobro(lista[idx - 1]) !== grupo) && new Set(items.map(grupoCobro)).size > 1
              ? <li key={'g' + grupo} className="mas-grupo">{TITULO_GRUPO_COBRO[grupo]}</li> : null;
            const est = recurrente ? estadoDe(i, hoy) : null;
            const cobradoUnaVez = !recurrente && i.estado === 'cobrado';
            const apagada = cobradoUnaVez || pausado;
            const linea = recurrente
              ? <>{est.proximo ? `Próximo: ${fmtFecha(est.proximo)} · ` : ''}{etiquetaCuenta(i.cuenta, cfg)} · {nombreFrec(i.frecuencia).toLowerCase()} · <span style={{ color: pausado ? 'rgba(255,255,255,0.4)' : colorEstado[est.etiqueta], fontWeight: 600 }}>{pausado ? 'Pausado' : textoEstado(est)}</span></>
              : <>{i.fecha_esperada ? `Vence: ${fmtFecha(i.fecha_esperada)} · ` : ''}{etiquetaCuenta(i.cuenta, cfg)} · {cobradoUnaVez ? '✓ Cobrado' : 'Pendiente'}</>;
            return (<Fragment key={i.id}>
              {separador}
              <li className={apagada ? 'inactive' : (recurrente && est.etiqueta === 'al_dia') ? 'al-dia' : ''}
                style={{ flexDirection: 'column', alignItems: 'stretch', gap: 0, cursor: 'pointer' }}
                onClick={() => setExpandedId(isExp ? null : i.id)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="mas-item-icon" style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)', flexShrink: 0 }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v13M7 10l5 5 5-5"/><path d="M20 20H4"/></svg></div>
                  <div className="meta">
                    <div className="cat">{i.cliente}</div>
                    <div className="sub">{linea}</div>
                  </div>
                  <div className="amt pos" style={{ flexShrink: 0 }}>{fmtMoneda(i.monto, monedaDe(i))}</div>
                  <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, flexShrink: 0 }}>{isExp ? '▲' : '▼'}</span>
                </div>
                {isExp && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.08)' }}
                    onClick={e => e.stopPropagation()}>
                    {editingId === i.id ? (
                      formulario(editForm, setEditForm, (e) => { e.preventDefault(); handleSaveEditCobro(i); }, 'Editar cobro', 'Guardar', () => setEditingId(null))
                    ) : (
                      <>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>
                          {i.forma_pago}{i.cobrado_fecha ? ` · Último cobro: ${fmtFecha(i.cobrado_fecha)}` : ''}
                        </div>
                        {!soloLectura && <div className="mas-acciones">
                          {!cobradoUnaVez && !pausado && (recurrente ? !!est.proximo : true) && (
                            <button className="del" style={{ color: '#34d399', borderColor: 'rgba(52,211,153,0.3)', background: 'rgba(52,211,153,0.1)', width: 'auto', padding: '0 10px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}
                              onClick={() => handleCobrar(i)}>✓ Cobrar{recurrente && est.atrasadas > 1 ? ' 1 de ' + est.atrasadas : ''}</button>
                          )}
                          {(cobradoUnaVez || (recurrente && i.cobrado_fecha)) && (
                            <button className="del" style={{ color: '#fb923c', borderColor: 'rgba(251,146,60,0.3)', background: 'rgba(251,146,60,0.1)', width: 'auto', padding: '0 10px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}
                              onClick={() => handleRevertir(i)}>↩ Revertir</button>
                          )}
                          {!cobradoUnaVez && <button className="del" style={{ color: '#93c5fd', borderColor: 'rgba(147,197,253,0.3)', background: 'rgba(147,197,253,0.1)' }} title="Editar"
                            onClick={() => { setEditingId(i.id); setEditForm({ cliente: i.cliente, monto: String(i.monto), montoDisplay: montoParaEditar(i.monto, monedaDe(i)), moneda: monedaDe(i), fecha_esperada: (recurrente ? proximoDe(i, hoy) : i.fecha_esperada) || '', forma_pago: i.forma_pago || 'transferencia', cuenta: i.cuenta || cfg.c1, frecuencia: i.frecuencia || 'una_vez' }); }}>✎</button>}
                          {recurrente && <button className="del" title={pausado ? 'Activar' : 'Pausar'} onClick={() => handleToggle(i)} style={{ fontSize: 13 }}>{pausado ? '▶' : '⏸'}</button>}
                          <button className="del" onClick={() => handleDelete(i.id)} title="Eliminar">✕</button>
                        </div>}
                      </>
                    )}
                  </div>
                )}
              </li>
            </Fragment>);
          })}
          {itemsOcultos.length > 0 && !itemsVisibles.some(i => grupoCobro(i) === '9') && new Set(items.map(grupoCobro)).size > 1 && (
            <li className="mas-grupo">{TITULO_GRUPO_COBRO['9']}</li>
          )}
          <BotonVerMas ocultos={itemsOcultos.length} onClick={() => verMas(itemsOcultos, fechaCobrado)} texto="Ver cobros anteriores" />
        </ul>
      )}
    </div>
  );
}

/* ─── DEUDAS ─── */
function Deudas({ userId, userEmail, cfg: cfgProp, soloLectura = false }) {
  const cfg = cfgProp || getUserConfig(userEmail);
  const { recortar, verMas } = useVerMas(puedeVerMas(userEmail));
  const fechaPagada = (d) => (d.estado === 'pagado' ? (d.fecha_limite || (d.created_at || '').slice(0, 10) || null) : null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [form, setForm] = useState({ acreedor: '', monto_total: '', montoDisplay: '', fecha_limite: '', cuenta: cfg.c1, moneda: 'PYG' });
  const opcionesMoneda = opcionesMonedaDe(cfg, userEmail);
  const [filtroMoneda, setFiltroMoneda] = useState('todas');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('debts').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    // Orden: pendientes primero (la fecha límite más cercana arriba, sin fecha al final del grupo);
    // pagadas al final, de la más reciente a la más vieja.
    const clave = (d) => (d.estado === 'pagado' ? '9' + fechaInvertida(d.fecha_limite || (d.created_at || '').slice(0, 10)) : '1' + (d.fecha_limite || '9999'));
    setItems((data || []).sort((a, b) => (clave(a) < clave(b) ? -1 : 1)));
    setLoading(false);
  }, [userId]);
  const { visibles: itemsVisibles, ocultos: itemsOcultos } = recortar(items, fechaPagada);

  useEffect(() => { load(); }, [load]);

  function handleMonto(e) {
    const { valor, display } = montoEscrito(e.target.value, form.moneda);
    setForm(f => ({ ...f, monto_total: valor, montoDisplay: display }));
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.acreedor.trim() || !form.monto_total) return;
    await supabase.from('debts').insert({
      user_id: userId, acreedor: form.acreedor.trim(),
      monto_total: parseFloat(form.monto_total),
      fecha_limite: form.fecha_limite || null,
      cuenta: form.cuenta,
      moneda: form.moneda || 'PYG',
    });
    setForm({ acreedor: '', monto_total: '', montoDisplay: '', fecha_limite: '', cuenta: cfg.c1, moneda: 'PYG' });
    setShowForm(false);
    load();
  }

  async function handlePagar(id) {
    if (!window.confirm('¿Marcar como pagado?')) return;
    const item = items.find(i => i.id === id);
    await supabase.from('debts').update({ estado: 'pagado', monto_pagado: item.monto_total }).eq('id', id);
    if (item) {
      await supabase.from('transactions').insert({
        user_id: userId, monto: item.monto_total - item.monto_pagado, tipo: 'gasto',
        fecha: hoyISO(),
        categoria: `Pago deuda: ${item.acreedor}`, cuenta: item.cuenta || cfg.c1, moneda: monedaDe(item),
      });
    }
    load();
  }

  async function handleDelete(id) {
    if (!window.confirm('¿Eliminar esta deuda?')) return;
    await supabase.from('debts').delete().eq('id', id);
    load();
  }

  async function handleSaveEditDeuda(id) {
    await supabase.from('debts').update({
      acreedor: editForm.acreedor.trim(),
      monto_total: parseFloat(editForm.monto_total),
      fecha_limite: editForm.fecha_limite || null,
      cuenta: editForm.cuenta,
      moneda: editForm.moneda || 'PYG',
    }).eq('id', id);
    setEditingId(null);
    load();
  }

  const totalDeuda = textoPorMoneda(items.filter(i => i.estado === 'pendiente'), i => i.monto_total - i.monto_pagado);

  return (
    <div>
      <div className="mas-section-header">
        <div>
          <div className="mas-section-title">Deudas</div>
          <div className="mas-section-sub">Total pendiente: <span style={{ color: '#f87171', fontWeight: 700 }}>{totalDeuda}</span></div>
        </div>
        {!soloLectura && (
          <button className="mas-add-btn" onClick={() => setShowForm(v => !v)}>
            {showForm ? '✕ Cerrar' : '+ Nueva'}
          </button>
        )}
      </div>

      {!soloLectura && showForm && (
        <form className="mas-form" onSubmit={handleAdd}>
          <div className="mas-form-title">Nueva deuda</div>
          <div className="row">
            <div className="field">
              <label>A quién le debo</label>
              <input type="text" value={form.acreedor} onChange={e => setForm(f => ({ ...f, acreedor: e.target.value }))} placeholder="Nombre, empresa..." required />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <LabelMonto moneda={form.moneda} opciones={opcionesMoneda} onChange={m => setForm(f => ({ ...f, moneda: m, monto_total: '', montoDisplay: '' }))} />
              <input type="text" inputMode={form.moneda === 'PYG' ? 'numeric' : 'decimal'} className="num" value={form.montoDisplay} onChange={handleMonto} placeholder={form.moneda === 'PYG' ? '0' : '0,00'} required />
            </div>
            <div className="field">
              <label>Fecha límite</label>
              <input type="date" value={form.fecha_limite} onChange={e => setForm(f => ({ ...f, fecha_limite: e.target.value }))} />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label>Descontar de</label>
              <CuentaToggle value={form.cuenta} onChange={v => setForm(f => ({ ...f, cuenta: v }))} cfg={cfg} />
            </div>
          </div>
          <button className="add-btn" type="submit">Guardar</button>
        </form>
      )}

      {!loading && items.length > 0 && <FiltroMoneda value={filtroMoneda} onChange={setFiltroMoneda} opciones={opcionesMoneda} />}
      {loading ? <div className="mas-loading">Cargando...</div> : items.length === 0 ? (
        <div className="empty">No hay deudas registradas.</div>
      ) : (
        <ul className="mas-list">
          {itemsVisibles.filter(enMoneda(filtroMoneda)).map(i => {
            const isExp = expandedId === i.id;
            return (
              <li key={i.id} className={i.estado === 'pagado' ? 'inactive' : ''}
                style={{ flexDirection: 'column', alignItems: 'stretch', gap: 0, cursor: 'pointer' }}
                onClick={() => setExpandedId(isExp ? null : i.id)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="mas-item-icon" style={{ background: 'rgba(251,146,60,0.15)', border: '1px solid rgba(251,146,60,0.3)', flexShrink: 0 }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fb923c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22V9M7 14l5-5 5 5"/><path d="M20 4H4"/></svg></div>
                  <div className="meta">
                    <div className="cat">{i.acreedor}</div>
                    <div className="sub">{etiquetaCuenta(i.cuenta, cfg)} · {i.estado === 'pagado' ? '✓ Pagado' : 'Pendiente'}</div>
                  </div>
                  {/* Pagada: se sigue viendo cuánto fue, en verde; pendiente: lo que falta. */}
                  <div className="amt neg" style={{ flexShrink: 0, ...(i.estado === 'pagado' ? { color: '#34d399' } : {}) }}>
                    {fmtMoneda(i.estado === 'pagado' ? i.monto_total : i.monto_total - i.monto_pagado, monedaDe(i))}
                  </div>
                  <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, flexShrink: 0 }}>{isExp ? '▲' : '▼'}</span>
                </div>
                {isExp && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.08)' }}
                    onClick={e => e.stopPropagation()}>
                    {editingId === i.id ? (
                      <div>
                        <div className="row"><div className="field"><label>A quién le debo</label><input type="text" value={editForm.acreedor} onChange={e => setEditForm(f => ({...f, acreedor: e.target.value}))} /></div></div>
                        <div className="row">
                          <div className="field"><LabelMonto texto="Monto total" moneda={editForm.moneda} opciones={opcionesMoneda} onChange={m => setEditForm(f => ({ ...f, moneda: m, monto_total: '', montoDisplay: '' }))} /><input type="text" inputMode={editForm.moneda === 'PYG' ? 'numeric' : 'decimal'} className="num" value={editForm.montoDisplay ?? ''} onChange={e => { const { valor, display } = montoEscrito(e.target.value, editForm.moneda); setEditForm(f => ({ ...f, monto_total: valor, montoDisplay: display })); }} /></div>
                          <div className="field"><label>Fecha límite</label><input type="date" value={editForm.fecha_limite || ''} onChange={e => setEditForm(f => ({...f, fecha_limite: e.target.value}))} /></div>
                        </div>
                        <div className="row"><div className="field"><label>Cuenta</label><CuentaToggle value={editForm.cuenta} onChange={v => setEditForm(f => ({...f, cuenta: v}))} cfg={cfg} /></div></div>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 8 }}>
                          <button className="del" style={{ color: '#94a3b8', width: 'auto', padding: '0 12px', fontSize: 12 }} onClick={() => setEditingId(null)}>Cancelar</button>
                          <button className="add-btn" style={{ margin: 0, fontSize: 12, padding: '6px 14px' }} onClick={() => handleSaveEditDeuda(i.id)}>Guardar</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {i.fecha_limite && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>Fecha límite: {fmtFecha(i.fecha_limite)}</div>}
                        {!soloLectura && <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          {i.estado !== 'pagado' ? (
                            <button className="del" style={{ color: '#34d399', borderColor: 'rgba(52,211,153,0.3)', background: 'rgba(52,211,153,0.1)', width: 'auto', padding: '0 10px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}
                              onClick={() => handlePagar(i.id)}>✓ Pagar</button>
                          ) : (
                            <button className="del" style={{ color: '#fb923c', borderColor: 'rgba(251,146,60,0.3)', background: 'rgba(251,146,60,0.1)', width: 'auto', padding: '0 10px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}
                              onClick={async () => {
                                if (!window.confirm(`¿Revertir pago de ${i.acreedor}?`)) return;
                                const { data: txs } = await supabase.from('transactions').select('id').eq('user_id', userId).eq('categoria', `Pago deuda: ${i.acreedor}`).order('fecha', { ascending: false }).limit(1);
                                await Promise.all([
                                  supabase.from('debts').update({ estado: 'pendiente', monto_pagado: 0 }).eq('id', i.id),
                                  txs?.length ? supabase.from('transactions').delete().eq('id', txs[0].id) : Promise.resolve(),
                                ]);
                                load();
                              }}>↩ Revertir</button>
                          )}
                          {i.estado !== 'pagado' && <button className="del" style={{ color: '#93c5fd', borderColor: 'rgba(147,197,253,0.3)', background: 'rgba(147,197,253,0.1)' }} title="Editar"
                            onClick={() => { setEditingId(i.id); setEditForm({ acreedor: i.acreedor, monto_total: String(i.monto_total), montoDisplay: montoParaEditar(i.monto_total, monedaDe(i)), moneda: monedaDe(i), fecha_limite: i.fecha_limite || '', cuenta: i.cuenta || cfg.c1 }); }}>✎</button>}
                          <button className="del" onClick={() => handleDelete(i.id)}>✕</button>
                        </div>}
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
          <BotonVerMas ocultos={itemsOcultos.length} onClick={() => verMas(itemsOcultos, fechaPagada)} texto="Ver deudas pagadas anteriores" />
        </ul>
      )}
    </div>
  );
}

/* ─── METAS DE AHORRO ─── */
function Metas({ userId, userEmail, cfg, soloLectura = false }) {
  const opcionesMoneda = opcionesMonedaDe(cfg, userEmail);
  const [filtroMoneda, setFiltroMoneda] = useState('todas');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [aportarId, setAportarId] = useState(null);
  const [aporte, setAporte] = useState({ monto: '', montoDisplay: '' });
  const [form, setForm] = useState({ nombre: '', monto_meta: '', metaDisplay: '', moneda: 'PYG' });
  const monedaAporte = monedaDe(items.find(i => i.id === aportarId));
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [historial, setHistorial] = useState({});
  const [showHistorial, setShowHistorial] = useState(null);
  const [editingContrib, setEditingContrib] = useState(null);
  const [editContribMonto, setEditContribMonto] = useState('');
  const [editContribDisplay, setEditContribDisplay] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('savings_goals').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    setItems(data || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  function handleMetaMonto(e) {
    const { valor, display } = montoEscrito(e.target.value, form.moneda);
    setForm(f => ({ ...f, monto_meta: valor, metaDisplay: display }));
  }

  function handleAporteMonto(e) {
    const { valor, display } = montoEscrito(e.target.value, monedaAporte);
    setAporte({ monto: valor, montoDisplay: display });
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.nombre.trim() || !form.monto_meta) return;
    await supabase.from('savings_goals').insert({ user_id: userId, nombre: form.nombre.trim(), monto_meta: parseFloat(form.monto_meta), moneda: form.moneda || 'PYG' });
    setForm({ nombre: '', monto_meta: '', metaDisplay: '', moneda: 'PYG' });
    setShowForm(false);
    load();
  }

  async function handleAportar(id) {
    const item = items.find(i => i.id === id);
    const montoAporte = parseFloat(aporte.monto || 0);
    const nuevo = Math.min(item.monto_actual + montoAporte, item.monto_meta);
    await Promise.all([
      supabase.from('savings_goals').update({ monto_actual: nuevo }).eq('id', id),
      supabase.from('savings_contributions').insert({ goal_id: id, user_id: userId, monto: montoAporte, fecha: hoyISO() }),
    ]);
    setAportarId(null);
    setAporte({ monto: '', montoDisplay: '' });
    if (showHistorial === id) loadHistorial(id);
    load();
  }

  async function loadHistorial(id) {
    const { data } = await supabase.from('savings_contributions').select('*').eq('goal_id', id).order('created_at', { ascending: false });
    setHistorial(prev => ({ ...prev, [id]: data || [] }));
  }

  async function toggleHistorial(id) {
    if (showHistorial === id) { setShowHistorial(null); return; }
    setShowHistorial(id);
    if (!historial[id]) await loadHistorial(id);
  }

  async function handleDeleteContrib(contrib, goalId) {
    if (!window.confirm('¿Eliminar este aporte? Se descontará del total ahorrado.')) return;
    const goal = items.find(i => i.id === goalId);
    const nuevoTotal = Math.max(0, (goal?.monto_actual || 0) - contrib.monto);
    await Promise.all([
      supabase.from('savings_contributions').delete().eq('id', contrib.id),
      supabase.from('savings_goals').update({ monto_actual: nuevoTotal }).eq('id', goalId),
    ]);
    await loadHistorial(goalId);
    load();
  }

  async function handleEditContrib(contrib, goalId, nuevoMonto) {
    const goal = items.find(i => i.id === goalId);
    const diff = nuevoMonto - contrib.monto;
    const nuevoTotal = Math.min(goal?.monto_meta || 0, Math.max(0, (goal?.monto_actual || 0) + diff));
    await Promise.all([
      supabase.from('savings_contributions').update({ monto: nuevoMonto }).eq('id', contrib.id),
      supabase.from('savings_goals').update({ monto_actual: nuevoTotal }).eq('id', goalId),
    ]);
    await loadHistorial(goalId);
    load();
  }

  async function handleDelete(id) {
    if (!window.confirm('¿Eliminar esta meta?')) return;
    await supabase.from('savings_goals').delete().eq('id', id);
    load();
  }

  async function handleSaveEditMeta(id) {
    await supabase.from('savings_goals').update({
      nombre: editForm.nombre.trim(),
      monto_meta: parseFloat(editForm.monto_meta),
    }).eq('id', id);
    setEditingId(null);
    load();
  }

  return (
    <div>
      <div className="mas-section-header">
        <div>
          <div className="mas-section-title">Metas de Ahorro</div>
          <div className="mas-section-sub">{items.length} meta{items.length !== 1 ? 's' : ''}</div>
        </div>
        {!soloLectura && (
          <button className="mas-add-btn" onClick={() => setShowForm(v => !v)}>
            {showForm ? '✕ Cerrar' : '+ Nueva'}
          </button>
        )}
      </div>

      {!soloLectura && showForm && (
        <form className="mas-form" onSubmit={handleAdd}>
          <div className="mas-form-title">Nueva meta de ahorro</div>
          <div className="row">
            <div className="field">
              <label>Nombre de la meta</label>
              <input type="text" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Vacaciones, Auto..." required />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <LabelMonto texto="Monto objetivo" moneda={form.moneda} opciones={opcionesMoneda} onChange={m => setForm(f => ({ ...f, moneda: m, monto_meta: '', metaDisplay: '' }))} />
              <input type="text" inputMode={form.moneda === 'PYG' ? 'numeric' : 'decimal'} className="num" value={form.metaDisplay} onChange={handleMetaMonto} placeholder={form.moneda === 'PYG' ? '0' : '0,00'} required />
            </div>
          </div>
          <button className="add-btn" type="submit">Crear meta</button>
        </form>
      )}

      {!loading && items.length > 0 && <FiltroMoneda value={filtroMoneda} onChange={setFiltroMoneda} opciones={opcionesMoneda} />}
      {loading ? <div className="mas-loading">Cargando...</div> : items.length === 0 ? (
        <div className="empty">No hay metas de ahorro registradas.</div>
      ) : (
        <ul className="mas-list">
          {items.filter(enMoneda(filtroMoneda)).map(i => {
            const pct = i.monto_meta > 0 ? Math.min(100, Math.round((i.monto_actual / i.monto_meta) * 100)) : 0;
            const fm = (n) => fmtMoneda(n, monedaDe(i));
            return (
              <li key={i.id} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 0, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 44, height: 44, flexShrink: 0 }}>
                    {(() => {
                      const r = 18, c = 22, circ = 2 * Math.PI * r;
                      const dash = (pct / 100) * circ;
                      return (
                        <svg width="44" height="44" viewBox="0 0 44 44">
                          <circle cx={c} cy={c} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
                          <circle cx={c} cy={c} r={r} fill="none" stroke="url(#gMeta)" strokeWidth="4"
                            strokeDasharray={`${dash} ${circ}`} strokeDashoffset={circ / 4}
                            strokeLinecap="round" />
                          <defs>
                            <linearGradient id="gMeta" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor="#34d399" />
                              <stop offset="100%" stopColor="#059669" />
                            </linearGradient>
                          </defs>
                          <text x={c} y={c + 4} textAnchor="middle" fontSize="10" fontWeight="700" fill={pct >= 100 ? '#34d399' : 'white'}>
                            {pct}%
                          </text>
                        </svg>
                      );
                    })()}
                  </div>
                  <div className="meta" style={{ flex: 1 }}>
                    <div className="cat">{i.nombre}</div>
                    <div className="sub">Meta: {fm(i.monto_meta)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {!soloLectura && <button className="del" style={{ fontSize: 12, color: '#34d399', borderColor: 'rgba(52,211,153,0.3)' }} onClick={() => setAportarId(aportarId === i.id ? null : i.id)} title="Aportar">+</button>}
                    <button className="del" style={{ fontSize: 11, color: '#94a3b8', borderColor: 'rgba(148,163,184,0.3)' }} onClick={() => toggleHistorial(i.id)} title="Historial">≡</button>
                    {!soloLectura && <button className="del" style={{ color: '#93c5fd', borderColor: 'rgba(147,197,253,0.3)', background: 'rgba(147,197,253,0.1)' }} title="Editar"
                      onClick={() => { setEditingId(i.id); setEditForm({ nombre: i.nombre, monto_meta: String(i.monto_meta), metaDisplay: montoParaEditar(i.monto_meta, monedaDe(i)) }); }}>✎</button>}
                    {!soloLectura && <button className="del" onClick={() => handleDelete(i.id)} title="Eliminar">✕</button>}
                  </div>
                </div>
                <div className="cuota-bar-wrap" style={{ background: 'transparent', overflow: 'hidden', display: 'flex' }}>
                  {i.monto_actual > 0 && (
                    <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #34d399, #059669)', borderRadius: pct >= 100 ? 4 : '4px 0 0 4px', flexShrink: 0 }} />
                  )}
                  {pct < 100 && i.monto_actual > 0 && (
                    <div style={{ flex: 1, height: '100%', background: 'rgba(248,113,113,0.35)', borderRadius: '0 4px 4px 0' }} />
                  )}
                  {i.monto_actual === 0 && (
                    <div style={{ width: '100%', height: '100%', background: 'rgba(255,255,255,0.07)', borderRadius: 4 }} />
                  )}
                </div>
                {pct < 100 ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    {i.monto_actual > 0
                      ? <span style={{ fontSize: 11, color: '#34d399', fontWeight: 600 }}>{fm(i.monto_actual)}</span>
                      : <span />}
                    <span style={{ fontSize: 11, color: '#f87171', fontWeight: 600 }}>Faltan {fm(i.monto_meta - i.monto_actual)}</span>
                  </div>
                ) : (
                  <div style={{ marginTop: 4, fontSize: 11, color: '#34d399', fontWeight: 600, textAlign: 'center' }}>¡Meta cumplida!</div>
                )}
                {showHistorial === i.id && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Historial de aportes</div>
                    {(historial[i.id] || []).length === 0 ? (
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '6px 0' }}>Sin aportes registrados</div>
                    ) : (
                      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {(historial[i.id] || []).map(h => (
                          <li key={h.id} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '7px 10px', listStyle: 'none' }}>
                            {editingContrib === h.id ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap', flexShrink: 0 }}>{fmtFecha(h.fecha)}</span>
                                <input type="text" inputMode={monedaDe(i) === 'PYG' ? 'numeric' : 'decimal'} style={{ flex: 1, minWidth: 0, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(96,165,250,0.5)', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, padding: '5px 10px', outline: 'none', boxSizing: 'border-box' }}
                                  value={editContribDisplay}
                                  onChange={e => { const { valor, display } = montoEscrito(e.target.value, monedaDe(i)); setEditContribMonto(valor); setEditContribDisplay(display); }} />
                                <button className="del" style={{ width: 30, height: 30, minWidth: 30, fontSize: 13, color: '#94a3b8', padding: 0, flexShrink: 0 }} onClick={() => setEditingContrib(null)}>✕</button>
                                <button className="del" style={{ width: 30, height: 30, minWidth: 30, fontSize: 13, color: '#34d399', borderColor: 'rgba(52,211,153,0.4)', background: 'rgba(52,211,153,0.15)', padding: 0, flexShrink: 0 }}
                                  onClick={async () => { await handleEditContrib(h, i.id, parseFloat(editContribMonto)); setEditingContrib(null); }}>✓</button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{fmtFecha(h.fecha)}</span>
                                <span style={{ fontSize: 13, fontWeight: 700, color: '#34d399', marginLeft: 'auto' }}>+{fm(h.monto)}</span>
                                {!soloLectura && <>
                                  <button className="del" style={{ width: 26, height: 26, minWidth: 26, fontSize: 11, color: '#93c5fd', borderColor: 'rgba(147,197,253,0.3)', background: 'rgba(147,197,253,0.1)', padding: 0 }}
                                    onClick={() => { setEditingContrib(h.id); setEditContribMonto(String(h.monto)); setEditContribDisplay(montoParaEditar(h.monto, monedaDe(i))); }}>✎</button>
                                  <button className="del" style={{ width: 26, height: 26, minWidth: 26, fontSize: 11, padding: 0 }}
                                    onClick={() => handleDeleteContrib(h, i.id)}>✕</button>
                                </>}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                {aportarId === i.id && (
                  <div className="mas-aportar">
                    <input type="text" inputMode={monedaDe(i) === 'PYG' ? 'numeric' : 'decimal'} className="num" value={aporte.montoDisplay} onChange={handleAporteMonto} placeholder={`Monto a aportar (${simboloDe(monedaDe(i))})`} style={{ flex: 1 }} />
                    <button className="mas-add-btn" onClick={() => handleAportar(i.id)}>Guardar</button>
                  </div>
                )}
                {editingId === i.id && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="row"><div className="field"><label>Nombre de la meta</label><input type="text" value={editForm.nombre} onChange={e => setEditForm(f => ({...f, nombre: e.target.value}))} /></div></div>
                    <div className="row"><div className="field"><label>Monto objetivo ({simboloDe(monedaDe(i))})</label><input type="text" inputMode={monedaDe(i) === 'PYG' ? 'numeric' : 'decimal'} className="num" value={editForm.metaDisplay ?? ''} onChange={e => { const { valor, display } = montoEscrito(e.target.value, monedaDe(i)); setEditForm(f => ({ ...f, monto_meta: valor, metaDisplay: display })); }} /></div></div>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 8 }}>
                      <button className="del" style={{ color: '#94a3b8', width: 'auto', padding: '0 12px', fontSize: 12 }} onClick={() => setEditingId(null)}>Cancelar</button>
                      <button className="add-btn" style={{ margin: 0, fontSize: 12, padding: '6px 14px' }} onClick={() => handleSaveEditMeta(i.id)}>Guardar</button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ─── TARJETAS DE CRÉDITO ─── */
function Tarjetas({ userId, userEmail, cfg: cfgProp, soloLectura = false }) {
  const cfg = cfgProp || getUserConfig(userEmail);
  const { recortar, verMas } = useVerMas(puedeVerMas(userEmail));
  // Compra de tarjeta ya pagada del todo: su fecha es la de su última cuota.
  const fechaGrupoPagado = ([, cuotas]) => (cuotas.every(c => c.estado === 'pagado') ? cuotas.map(c => c.fecha_compra).sort().pop() : null);
  const [cards, setCards] = useState([]);
  const [expenses, setExpenses] = useState({});
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCardForm, setShowCardForm] = useState(false);
  const [showExpForm, setShowExpForm] = useState(null);
  const [editCiclo, setEditCiclo] = useState(null);
  const [cicloForm, setCicloForm] = useState({ fecha_cierre: '', fecha_limite_pago: '' });
  const [expandedGrupo, setExpandedGrupo] = useState({});
  const [cardForm, setCardForm] = useState({ nombre: '', fecha_cierre: '', fecha_limite_pago: '' });
  const [expForm, setExpForm] = useState({ descripcion: '', monto: '', montoDisplay: '', fecha_compra: hoyISO(), cuotas: '1', cuenta: cfg.c1 });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('credit_cards').select('*').eq('user_id', userId).order('created_at');
    setCards(data || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  async function loadExpenses(cardId) {
    const { data } = await supabase.from('card_expenses').select('*').eq('card_id', cardId).order('fecha_compra', { ascending: false });
    setExpenses(prev => ({ ...prev, [cardId]: data || [] }));
  }

  function toggleExpand(id) {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!expenses[id]) loadExpenses(id);
  }

  async function handleAddCard(e) {
    e.preventDefault();
    if (!cardForm.nombre.trim() || !cardForm.fecha_cierre || !cardForm.fecha_limite_pago) return;
    // deISO lee la fecha en hora local: new Date('2026-09-20') es medianoche UTC y en Paraguay da el día 19.
    const dCierre = deISO(cardForm.fecha_cierre).getDate();
    const dPago = deISO(cardForm.fecha_limite_pago).getDate();
    await supabase.from('credit_cards').insert({
      user_id: userId,
      nombre: cardForm.nombre.trim(),
      dia_cierre: dCierre,
      dia_vencimiento_pago: dPago,
      fecha_cierre: cardForm.fecha_cierre,
      fecha_limite_pago: cardForm.fecha_limite_pago,
    });
    setCardForm({ nombre: '', fecha_cierre: '', fecha_limite_pago: '' });
    setShowCardForm(false);
    load();
  }

  async function handleAddExp(e, cardId) {
    e.preventDefault();
    if (!expForm.descripcion.trim() || !expForm.monto) return;
    const totalMonto = parseFloat(expForm.monto);
    const numCuotas = parseInt(expForm.cuotas) || 1;
    const montoPorCuota = Math.round(totalMonto / numCuotas);
    const baseDate = new Date(expForm.fecha_compra + 'T12:00:00');
    const grupoId = crypto.randomUUID();
    const rows = [];
    for (let i = 0; i < numCuotas; i++) {
      const d = new Date(baseDate);
      d.setTime(sumarMeses(baseDate, i + 1).getTime());
      rows.push({
        user_id: userId, card_id: cardId,
        descripcion: expForm.descripcion.trim(),
        monto: montoPorCuota,
        fecha_compra: d.toISOString().slice(0, 10),
        cuotas: numCuotas,
        numero_cuota: i + 1,
        grupo_id: grupoId,
        cuenta: expForm.cuenta,
      });
    }
    await supabase.from('card_expenses').insert(rows);
    setExpForm({ descripcion: '', monto: '', montoDisplay: '', fecha_compra: hoyISO(), cuotas: '1', cuenta: cfg.c1 });
    setShowExpForm(null);
    loadExpenses(cardId);
  }

  async function handleEditCiclo(e, cardId) {
    e.preventDefault();
    if (!cicloForm.fecha_cierre || !cicloForm.fecha_limite_pago) return;
    await supabase.from('credit_cards').update({
      nombre: cicloForm.nombre.trim(),
      fecha_cierre: cicloForm.fecha_cierre,
      fecha_limite_pago: cicloForm.fecha_limite_pago,
      dia_cierre: deISO(cicloForm.fecha_cierre).getDate(),
      dia_vencimiento_pago: deISO(cicloForm.fecha_limite_pago).getDate(),
    }).eq('id', cardId);
    setEditCiclo(null);
    load();
  }

  async function handlePagarTarjeta(expId, cardId) {
    if (!window.confirm('¿Marcar gasto como pagado y registrar en el panel principal?')) return;
    const exp = (expenses[cardId] || []).find(e => e.id === expId);
    await supabase.from('card_expenses').update({ estado: 'pagado' }).eq('id', expId);
    if (exp) {
      const suffix = exp.cuotas > 1 ? ` (${exp.numero_cuota}/${exp.cuotas})` : '';
      await supabase.from('transactions').insert({
        user_id: userId, monto: exp.monto, tipo: 'gasto',
        fecha: hoyISO(),
        categoria: `Tarjeta: ${exp.descripcion}${suffix}`, cuenta: exp.cuenta || cfg.c1,
      });
    }
    loadExpenses(cardId);
  }

  async function handleDeleteCard(id) {
    if (!window.confirm('¿Eliminar esta tarjeta y todos sus gastos?')) return;
    await supabase.from('card_expenses').delete().eq('card_id', id);
    await supabase.from('credit_cards').delete().eq('id', id);
    setCards(prev => prev.filter(c => c.id !== id));
    if (expanded === id) setExpanded(null);
  }

  async function handleRevertirTarjeta(c, cardId) {
    // Optimistic update — cambia UI inmediatamente
    setExpenses(prev => ({
      ...prev,
      [cardId]: (prev[cardId] || []).map(e => e.id === c.id ? { ...e, estado: TARJETA_PENDIENTE } : e),
    }));
    const suffix = c.cuotas > 1 ? ` (${c.numero_cuota}/${c.cuotas})` : '';
    const { data: txs } = await supabase.from('transactions').select('id').eq('user_id', userId).eq('categoria', `Tarjeta: ${c.descripcion}${suffix}`).order('fecha', { ascending: false }).limit(1);
    // .select() devuelve las filas realmente modificadas. Sin esto la base
    // responde sin error aunque no haya tocado ninguna, y se borraba el
    // movimiento del panel principal mientras la tarjeta seguía pagada.
    const { data: revertidos, error } = await supabase
      .from('card_expenses').update({ estado: TARJETA_PENDIENTE }).eq('id', c.id).select('id');
    if (error || !revertidos?.length) {
      await loadExpenses(cardId);
      setTimeout(() => alert(
        error ? `No se pudo revertir el pago: ${error.message}`
              : 'No se pudo revertir el pago. El movimiento del panel principal no se tocó.'
      ), 0);
      return;
    }
    if (txs?.length) await supabase.from('transactions').delete().eq('id', txs[0].id);
    await loadExpenses(cardId);
    load();
  }

  async function handleDeleteExp(expId, cardId) {
    if (!window.confirm('¿Eliminar este gasto?')) return;
    const exp = (expenses[cardId] || []).find(e => e.id === expId);
    if (exp) {
      const suffix = exp.cuotas > 1 ? ` (${exp.numero_cuota}/${exp.cuotas})` : '';
      const { data: txs } = await supabase.from('transactions').select('id').eq('user_id', userId).eq('categoria', `Tarjeta: ${exp.descripcion}${suffix}`).order('fecha', { ascending: false }).limit(1);
      await Promise.all([
        supabase.from('card_expenses').delete().eq('id', expId),
        txs?.length ? supabase.from('transactions').delete().eq('id', txs[0].id) : Promise.resolve(),
      ]);
    } else {
      await supabase.from('card_expenses').delete().eq('id', expId);
    }
    loadExpenses(cardId);
  }

  async function handleDeleteGrupo(grupoId, ids, cardId) {
    if (!window.confirm('¿Eliminar esta compra y todas sus cuotas?')) return;
    // Borrar transacciones asociadas a los gastos pagados
    const expsToDelete = (expenses[cardId] || []).filter(e => ids.includes(e.id) && e.estado === 'pagado');
    for (const e of expsToDelete) {
      const suffix = e.cuotas > 1 ? ` (${e.numero_cuota}/${e.cuotas})` : '';
      const { data: txs } = await supabase.from('transactions').select('id').eq('user_id', userId).eq('categoria', `Tarjeta: ${e.descripcion}${suffix}`).order('fecha', { ascending: false }).limit(1);
      if (txs?.length) await supabase.from('transactions').delete().eq('id', txs[0].id);
    }
    if (grupoId) {
      await supabase.from('card_expenses').delete().eq('grupo_id', grupoId);
    } else {
      await supabase.from('card_expenses').delete().in('id', ids);
    }
    loadExpenses(cardId);
    load();
  }

  return (
    <div>
      <div className="mas-section-header">
        <div>
          <div className="mas-section-title">Tarjetas de Crédito</div>
          <div className="mas-section-sub">{cards.length} tarjeta{cards.length !== 1 ? 's' : ''}</div>
        </div>
        {!soloLectura && (
          <button className="mas-add-btn" onClick={() => setShowCardForm(v => !v)}>
            {showCardForm ? '✕ Cerrar' : '+ Tarjeta'}
          </button>
        )}
      </div>

      {!soloLectura && showCardForm && (
        <form className="mas-form" onSubmit={handleAddCard}>
          <div className="mas-form-title">Nueva tarjeta</div>
          <div className="row">
            <div className="field">
              <label>Nombre de la tarjeta</label>
              <input type="text" value={cardForm.nombre} onChange={e => setCardForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Visa Personal, Bancop..." required />
            </div>
          </div>
          <div className="field" style={{ marginBottom: 10 }}>
            <label>Fecha de cierre</label>
            <input type="date" value={cardForm.fecha_cierre} onChange={e => setCardForm(f => ({ ...f, fecha_cierre: e.target.value }))} required />
          </div>
          <div className="field" style={{ marginBottom: 10 }}>
            <label>Fecha límite de pago</label>
            <input type="date" value={cardForm.fecha_limite_pago} onChange={e => setCardForm(f => ({ ...f, fecha_limite_pago: e.target.value }))} required />
          </div>
          <button className="add-btn" type="submit">Guardar tarjeta</button>
        </form>
      )}

      {loading ? <div className="mas-loading">Cargando...</div> : cards.length === 0 ? (
        <div className="empty">No hay tarjetas registradas. Agregá una arriba.</div>
      ) : (
        <ul className="mas-list">
          {cards.map(card => {
            const exps = expenses[card.id] || [];
            const pendTotal = exps.filter(e => e.estado !== 'pagado').reduce((s, e) => s + e.monto, 0);
            return (
              <li key={card.id} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 0, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div className="mas-item-icon" style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/></svg></div>
                  <div className="meta" style={{ flex: 1 }}>
                    <div className="cat">{card.nombre}</div>
                    <div className="sub">{pendTotal > 0 ? `Pendiente: ${fmt(pendTotal)}` : 'Sin gastos pendientes'} · Tocá ▼ para ver detalle</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {!soloLectura && <button className="del" style={{ fontSize: 12, fontWeight: 700, color: '#93c5fd', background: 'rgba(96,165,250,0.15)', borderColor: 'rgba(96,165,250,0.35)', width: 36, padding: 0 }} title="Agregar gasto"
                      onClick={() => { setShowExpForm(showExpForm === card.id ? null : card.id); setEditCiclo(null); setExpanded(card.id); if (!expenses[card.id]) loadExpenses(card.id); }}>
                      +
                    </button>}
                    {!soloLectura && <button className="del" style={{ fontSize: 14, color: '#fcd34d', background: 'rgba(251,191,36,0.15)', borderColor: 'rgba(251,191,36,0.35)', width: 36, padding: 0 }} title="Editar ciclo"
                      onClick={() => { setEditCiclo(editCiclo === card.id ? null : card.id); setCicloForm({ nombre: card.nombre || '', fecha_cierre: card.fecha_cierre || '', fecha_limite_pago: card.fecha_limite_pago || '' }); setShowExpForm(null); }}>
                      ✏️
                    </button>}
                    <button className="del" style={{ fontSize: 13 }} onClick={() => toggleExpand(card.id)}>{expanded === card.id ? '▲' : '▼'}</button>
                    {!soloLectura && <button className="del" onClick={() => handleDeleteCard(card.id)} title="Eliminar tarjeta">✕</button>}
                  </div>
                </div>

                {editCiclo === card.id && (
                  <form className="mas-form" style={{ marginTop: 12, marginBottom: 0 }} onSubmit={e => handleEditCiclo(e, card.id)}>
                    <div className="mas-form-title">Editar ciclo actual</div>
                    <div className="field">
                      <label>Nombre</label>
                      <input type="text" value={cicloForm.nombre} onChange={e => setCicloForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Visa, Mastercard..." required />
                    </div>
                    <div className="field" style={{ marginTop: 10 }}>
                      <label>Fecha de cierre</label>
                      <input type="date" value={cicloForm.fecha_cierre} onChange={e => setCicloForm(f => ({ ...f, fecha_cierre: e.target.value }))} required />
                    </div>
                    <div className="field" style={{ marginTop: 10 }}>
                      <label>Fecha límite de pago</label>
                      <input type="date" value={cicloForm.fecha_limite_pago} onChange={e => setCicloForm(f => ({ ...f, fecha_limite_pago: e.target.value }))} required />
                    </div>
                    <button className="add-btn" type="submit">Guardar ciclo</button>
                  </form>
                )}

                {showExpForm === card.id && (
                  <form className="mas-form" style={{ marginTop: 12, marginBottom: 0 }} onSubmit={e => handleAddExp(e, card.id)}>
                    <div className="row">
                      <div className="field">
                        <label>Descripción del gasto</label>
                        <input type="text" value={expForm.descripcion} onChange={e => setExpForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Ej: Supermercado..." required />
                      </div>
                    </div>
                    <div className="row">
                      <div className="field">
                        <label>Monto total (₲)</label>
                        <input type="text" inputMode="numeric" className="num" value={expForm.montoDisplay}
                          onChange={e => { const r = e.target.value.replace(/\D/g,''); setExpForm(f=>({...f,monto:r,montoDisplay:fmtD(r)})); }}
                          placeholder="0" required />
                      </div>
                      <div className="field" style={{ maxWidth: 90 }}>
                        <label>Cuotas</label>
                        <input type="text" inputMode="numeric" value={expForm.cuotas}
                          onChange={e => { const v = e.target.value.replace(/\D/g,''); setExpForm(f => ({ ...f, cuotas: v || '1' })); }}
                          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, color: '#fff', padding: '10px 8px', fontSize: 14, width: '100%', fontFamily: 'inherit' }}
                          placeholder="1" />
                      </div>
                    </div>
                    {expForm.monto && parseInt(expForm.cuotas) > 1 && (
                      <div className="mas-preview">
                        {expForm.cuotas} cuotas de {fmt(Math.round(parseFloat(expForm.monto) / parseInt(expForm.cuotas)))} / mes
                      </div>
                    )}
                    <div className="row">
                      <div className="field">
                        <label>Fecha de compra</label>
                        <input type="date" value={expForm.fecha_compra} onChange={e => setExpForm(f => ({ ...f, fecha_compra: e.target.value }))} required />
                      </div>
                    </div>
                    <div className="row">
                      <div className="field">
                        <label>Descontar de</label>
                        <CuentaToggle value={expForm.cuenta} onChange={v => setExpForm(f => ({ ...f, cuenta: v }))} cfg={cfg} />
                      </div>
                    </div>
                    <button className="add-btn" type="submit">Agregar gasto</button>
                  </form>
                )}

                {expanded === card.id && (
                  <>
                  <div style={{ display: 'flex', gap: 8, padding: '10px 4px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 6 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 3 }}>Cierre</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#fbbf24' }}>{card.fecha_cierre ? fmtFecha(card.fecha_cierre) : `Día ${card.dia_cierre}`}</div>
                    </div>
                    <div style={{ width: 1, background: 'rgba(255,255,255,0.08)' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 3 }}>Límite de pago</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#f87171' }}>{card.fecha_limite_pago ? fmtFecha(card.fecha_limite_pago) : `Día ${card.dia_vencimiento_pago}`}</div>
                    </div>
                    {pendTotal > 0 && (
                      <>
                      <div style={{ width: 1, background: 'rgba(255,255,255,0.08)' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 3 }}>Total pendiente</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#f87171' }}>{fmt(pendTotal)}</div>
                      </div>
                      </>
                    )}
                  </div>
                  {(() => {
                    const exps = expenses[card.id] || [];
                    if (exps.length === 0) return <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>Sin gastos registrados</div>;
                    const groupMap = {};
                    exps.forEach(exp => {
                      const key = exp.grupo_id || exp.id;
                      if (!groupMap[key]) groupMap[key] = [];
                      groupMap[key].push(exp);
                    });
                    const { visibles: gruposVisibles, ocultos: gruposOcultos } = recortar(Object.entries(groupMap), fechaGrupoPagado);
                    return [...gruposVisibles.map(([key, cuotas]) => {
                      cuotas.sort((a, b) => a.numero_cuota - b.numero_cuota);
                      const total = cuotas.reduce((s, c) => s + c.monto, 0);
                      const paid = cuotas.filter(c => c.estado === 'pagado').length;
                      const allPaid = paid === cuotas.length;
                      const isOpen = expandedGrupo[key];
                      return (
                        <div key={key} style={{ marginBottom: 8, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', opacity: allPaid ? 0.5 : 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'rgba(255,255,255,0.04)' }}>
                            <div onClick={() => setExpandedGrupo(p => ({ ...p, [key]: !p[key] }))} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cuotas[0].descripcion}</div>
                              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                                {cuotas.length > 1 ? `${paid}/${cuotas.length} cuotas pagadas` : (allPaid ? 'Pagado' : `Vence: ${fmtFecha(cuotas[0].fecha_compra)}`)}
                              </div>
                            </div>
                            <span onClick={() => setExpandedGrupo(p => ({ ...p, [key]: !p[key] }))} style={{ fontSize: 13, fontWeight: 700, color: allPaid ? '#34d399' : '#f87171', whiteSpace: 'nowrap', cursor: 'pointer' }}>{fmt(total)}</span>
                            <span onClick={() => setExpandedGrupo(p => ({ ...p, [key]: !p[key] }))} style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', cursor: 'pointer' }}>{isOpen ? '▲' : '▼'}</span>
                            <button className="del" style={{ width: 28, height: 28, minWidth: 28, minHeight: 28, borderRadius: 8, fontSize: 11 }} onClick={() => handleDeleteGrupo(cuotas[0].grupo_id, cuotas.map(c => c.id), card.id)}>✕</button>
                          </div>
                          {isOpen && (
                            <div style={{ padding: '6px 12px 10px' }}>
                              {cuotas.map(c => (
                                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', minWidth: 50 }}>
                                    {cuotas.length > 1 ? `Cuota ${c.numero_cuota}/${cuotas.length}` : 'Pago'}
                                  </span>
                                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', flex: 1 }}>{fmtFecha(c.fecha_compra)}</span>
                                  <span style={{ fontSize: 12, fontWeight: 700, color: c.estado === 'pagado' ? '#34d399' : '#f87171' }}>{fmt(c.monto)}</span>
                                  {!soloLectura && (c.estado !== 'pagado' ? (
                                    <button className="cuota-pay-btn" onClick={() => handlePagarTarjeta(c.id, card.id)}>✓ Pagar</button>
                                  ) : (
                                    <button className="cuota-pay-btn" style={{ background: 'rgba(251,146,60,0.15)', borderColor: 'rgba(251,146,60,0.3)', color: '#fb923c' }}
                                      onClick={() => handleRevertirTarjeta(c, card.id)}>↩ Revertir</button>
                                  ))}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    }), gruposOcultos.length > 0 && (
                      <div key="ver-mas" className="mas-ver-mas" style={{ marginBottom: 8 }}>
                        <button type="button" onClick={(e) => { e.stopPropagation(); verMas(gruposOcultos, fechaGrupoPagado); }}>Ver compras pagadas anteriores ({gruposOcultos.length})</button>
                      </div>
                    )];
                  })()}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ─── PERFIL ─── */
// Monedas extra (US$ y R$): bolsillos aparte del guaraní. Se guardan en
// user_config.monedas; el panel principal muestra el selector solo si hay alguna.
function MonedasExtra({ userId }) {
  const [activas, setActivas] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    supabase.from('user_config').select('monedas').eq('user_id', userId).single()
      .then(({ data }) => setActivas(Array.isArray(data?.monedas) ? data.monedas : []));
  }, [userId]);

  async function alternar(m) {
    if (ocupado || activas === null) return;
    setOcupado(true);
    const nuevas = activas.includes(m) ? activas.filter(x => x !== m) : [...activas, m];
    const { error } = await supabase.from('user_config').update({ monedas: nuevas }).eq('user_id', userId);
    if (!error) setActivas(nuevas);
    setOcupado(false);
  }

  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 16, padding: '18px 16px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Monedas extra</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {Object.entries(MONEDAS).map(([codigo, info]) => {
          const on = !!activas?.includes(codigo);
          return (
            <div key={codigo} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: on ? 'linear-gradient(135deg,#0ea5e9,#6366f1)' : 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12, fontWeight: 800, color: on ? '#fff' : 'rgba(255,255,255,0.5)' }}>{info.simbolo}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{info.nombre} ({info.simbolo})</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2, lineHeight: 1.5 }}>{on ? 'Podés cargar movimientos en esta moneda.' : 'Apagado: el formulario no la ofrece.'}</div>
              </div>
              <button type="button" role="switch" aria-checked={on} aria-label={info.nombre} className={`switch${on ? ' on' : ''}`} onClick={() => alternar(codigo)} disabled={ocupado || activas === null} />
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 12, fontSize: 11, color: 'rgba(255,255,255,0.35)', lineHeight: 1.6 }}>
        Los movimientos en moneda extra se guardan aparte: no se suman ni se convierten a guaraníes. El balance y las proyecciones siguen en ₲.
      </div>
    </div>
  );
}

// Recordatorios push en este dispositivo (se muestra dentro de Perfil).
function Recordatorios({ userId }) {
  const [estado, setEstado] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => { estadoPush().then(setEstado); }, []);

  async function alternar() {
    if (ocupado) return;
    setOcupado(true);
    if (estado === 'activado') await desuscribirPush();
    else await activarPush(userId);
    setEstado(await estadoPush());
    setOcupado(false);
  }

  const activo = estado === 'activado';
  const conInterruptor = estado === 'activado' || estado === 'desactivado';
  const aviso = {
    sin_instalar: 'En iPhone, primero agregá MiCaja a tu pantalla de inicio: botón Compartir → "Agregar a inicio". Después volvé acá para activarlos.',
    no_soportado: 'Este navegador no permite recordatorios en el teléfono.',
    bloqueado: 'Los avisos están bloqueados en el teléfono. Activalos en Ajustes → Notificaciones → MiCaja y volvé acá.',
  }[estado];

  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 16, padding: '18px 16px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Recordatorios en el teléfono</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: activo ? 'linear-gradient(135deg,#f59e0b,#f97316)' : 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={activo ? '#fff' : 'rgba(255,255,255,0.5)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
            {estado === null ? 'Revisando…' : activo ? 'Activados en este teléfono' : 'Desactivados'}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2, lineHeight: 1.5 }}>
            Pagos, cuotas, tarjetas y cobros por vencer o vencidos. Un aviso por día, a la mañana.
          </div>
        </div>
        {conInterruptor && (
          <button type="button" role="switch" aria-checked={activo} aria-label="Recordatorios en el teléfono" className={`switch${activo ? ' on' : ''}`} onClick={alternar} disabled={ocupado} />
        )}
      </div>
      {aviso && (
        <div style={{ marginTop: 12, fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 12px' }}>{aviso}</div>
      )}
    </div>
  );
}

function Perfil({ userId, userEmail }) {
  const [cuenta1, setCuenta1] = useState('');
  const [cuenta2, setCuenta2] = useState('');
  const [plan, setPlan] = useState('');
  const [origPlan, setOrigPlan] = useState('');
  const [origC1, setOrigC1] = useState('');
  const [origC2, setOrigC2] = useState('');
  const [origLabel1, setOrigLabel1] = useState('');
  const [origLabel2, setOrigLabel2] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [modal, setModal] = useState(null);
  // modal: null | { type:'2to1', step:1|2, accion:null|'unificar'|'descartar' } | { type:'1to2' }

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('user_config').select('*').eq('user_id', userId).single();
      if (data) {
        setCuenta1(data.cuenta1 || '');
        setCuenta2(data.cuenta2 || '');
        setPlan(data.plan || 'personal');
        setOrigPlan(data.plan || 'personal');
        setOrigC1((data.cuenta1 || '').toLowerCase());
        setOrigC2((data.cuenta2 || '').toLowerCase());
        setOrigLabel1(data.cuenta1 || '');
        setOrigLabel2(data.cuenta2 || '');
      }
      setLoading(false);
    }
    load();
  }, [userId]);

  function handleSave(e) {
    e.preventDefault();
    if (!cuenta1.trim()) return;
    if (plan === 'negocio' && !cuenta2.trim()) return;

    const cambioA1 = origPlan === 'negocio' && plan === 'personal';
    const cambioA2 = origPlan === 'personal' && plan === 'negocio';

    if (cambioA1) { setModal({ type: '2to1', step: 0, cuentaElegida: null, accion: null }); return; }
    if (cambioA2) { setModal({ type: '1to2' }); return; }
    executeSave(null, null, null);
  }

  async function renameCuentaEnTodo(uid, oldKey, newKey) {
    const tables = ['transactions', 'receivables', 'debts', 'recurring_expenses', 'card_expenses', 'installment_purchases'];
    await Promise.all(tables.map(t =>
      supabase.from(t).update({ cuenta: newKey }).eq('user_id', uid).eq('cuenta', oldKey)
    ));
  }

  async function deleteCuentaEnTodo(uid, key) {
    await supabase.from('transactions').delete().eq('user_id', uid).eq('cuenta', key);
    await supabase.from('receivables').delete().eq('user_id', uid).eq('cuenta', key);
    await supabase.from('debts').delete().eq('user_id', uid).eq('cuenta', key);
    await supabase.from('recurring_expenses').delete().eq('user_id', uid).eq('cuenta', key);
    await supabase.from('card_expenses').delete().eq('user_id', uid).eq('cuenta', key);
    await supabase.from('installment_purchases').delete().eq('user_id', uid).eq('cuenta', key);
  }

  async function executeSave(tipo, accion, cuentaElegida) {
    setSaving(true); setSuccess(false); setModal(null);

    // Determinar qué cuenta queda y cuál se va
    const keptKey   = cuentaElegida === 'c2' ? origC2 : origC1;
    const keptLabel = cuentaElegida === 'c2' ? origLabel2 : (cuenta1.trim() || origLabel1);
    const goneKey   = cuentaElegida === 'c2' ? origC1 : origC2;
    const newSingle = keptLabel.toLowerCase();
    const newC2db   = plan === 'negocio' ? cuenta2.trim() : null;

    // Guardar user_config
    await supabase.from('user_config').update({
      cuenta1: cuentaElegida === 'c2' ? origLabel2 : cuenta1.trim(),
      cuenta2: plan === 'negocio' ? cuenta2.trim() : null,
      plan,
    }).eq('user_id', userId);

    if (tipo === '2to1') {
      if (keptKey && newSingle && keptKey !== newSingle) {
        await renameCuentaEnTodo(userId, keptKey, newSingle);
      }
      if (accion === 'unificar') {
        await renameCuentaEnTodo(userId, goneKey, newSingle);
      } else if (accion === 'descartar') {
        await deleteCuentaEnTodo(userId, goneKey);
      }
      setOrigC1(newSingle); setOrigLabel1(keptLabel);
      setOrigC2(''); setOrigLabel2('');
    } else if (tipo === '1to2') {
      if (origC1 && origC1 !== cuenta1.trim().toLowerCase()) {
        await renameCuentaEnTodo(userId, origC1, cuenta1.trim().toLowerCase());
      }
      setOrigC1(cuenta1.trim().toLowerCase()); setOrigLabel1(cuenta1.trim());
      setOrigC2(newC2db?.toLowerCase() || ''); setOrigLabel2(cuenta2.trim());
    } else {
      if (origC1 && cuenta1.trim().toLowerCase() !== origC1) {
        await renameCuentaEnTodo(userId, origC1, cuenta1.trim().toLowerCase());
        setOrigC1(cuenta1.trim().toLowerCase()); setOrigLabel1(cuenta1.trim());
      }
      if (origC2 && newC2db && newC2db.toLowerCase() !== origC2) {
        await renameCuentaEnTodo(userId, origC2, newC2db.toLowerCase());
        setOrigC2(newC2db.toLowerCase()); setOrigLabel2(cuenta2.trim());
      }
    }

    setOrigPlan(plan);
    setSaving(false); setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  }

  if (loading) return <div className="mas-loading">Cargando...</div>;

  return (
    <div>
      {/* MODAL 2→1 */}
      {modal?.type === '2to1' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#0f1f35', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 22, padding: 24, width: '100%', maxWidth: 360 }}>

            {/* PASO 0: elegir cuál cuenta conservar */}
            {modal.step === 0 && (
              <>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 6 }}>¿Cuál cuenta conservás?</div>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 20, lineHeight: 1.6 }}>
                  Pasás a una sola cuenta. Elegí cuál querés mantener.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                  {[
                    { key: 'c1', label: origLabel1, desc: 'Cuenta 1' },
                    { key: 'c2', label: origLabel2, desc: 'Cuenta 2' },
                  ].map(op => (
                    <button key={op.key} onClick={() => setModal(m => ({ ...m, step: 1, cuentaElegida: op.key }))}
                      style={{ padding: '14px 16px', borderRadius: 14, border: '1px solid rgba(165,180,252,0.3)', background: 'rgba(99,102,241,0.08)', color: '#fff', fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#a5b4fc', marginBottom: 3 }}>{op.label}</div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{op.desc} · Sus movimientos se conservan</div>
                    </button>
                  ))}
                </div>
                <button onClick={() => setModal(null)} style={{ width: '100%', padding: '12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.4)', fontFamily: 'inherit', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
              </>
            )}

            {/* PASO 1: qué hacer con la otra cuenta */}
            {modal.step === 1 && (
              <>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Movimientos de {modal.cuentaElegida === 'c1' ? origLabel2 : origLabel1}</div>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 20, lineHeight: 1.6 }}>
                  Conservás <b style={{ color: '#a5b4fc' }}>{modal.cuentaElegida === 'c1' ? origLabel1 : origLabel2}</b>. ¿Qué hacemos con los movimientos de la otra cuenta?
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                  <button onClick={() => setModal(m => ({ ...m, step: 2, accion: 'unificar' }))}
                    style={{ padding: '14px 16px', borderRadius: 14, border: '1px solid rgba(52,211,153,0.3)', background: 'rgba(52,211,153,0.08)', color: '#fff', fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#34d399', marginBottom: 4 }}>Unificar todo en {modal.cuentaElegida === 'c1' ? origLabel1 : origLabel2}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Los movimientos de las dos cuentas quedan juntos. No se pierde nada.</div>
                  </button>
                  <button onClick={() => setModal(m => ({ ...m, step: 2, accion: 'descartar' }))}
                    style={{ padding: '14px 16px', borderRadius: 14, border: '1px solid rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.08)', color: '#fff', fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#f87171', marginBottom: 4 }}>Eliminar movimientos de {modal.cuentaElegida === 'c1' ? origLabel2 : origLabel1}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Se borran permanentemente. No se puede deshacer.</div>
                  </button>
                </div>
                <button onClick={() => setModal(m => ({ ...m, step: 0 }))} style={{ width: '100%', padding: '12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.4)', fontFamily: 'inherit', cursor: 'pointer', fontSize: 13 }}>← Atrás</button>
              </>
            )}

            {/* PASO 2: confirmación */}
            {modal.step === 2 && (
              <>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Confirmá el cambio</div>
                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '14px 16px', marginBottom: 20, fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.9 }}>
                  ✓ Cuenta que conservás: <b style={{ color: '#a5b4fc' }}>{modal.cuentaElegida === 'c1' ? origLabel1 : origLabel2}</b><br/>
                  {modal.accion === 'unificar'
                    ? <>✓ Movimientos de <b style={{ color: '#fff' }}>{modal.cuentaElegida === 'c1' ? origLabel2 : origLabel1}</b> se <b style={{ color: '#34d399' }}>unifican</b>. No se pierde nada.</>
                    : <>⚠ Movimientos de <b style={{ color: '#fff' }}>{modal.cuentaElegida === 'c1' ? origLabel2 : origLabel1}</b> se <b style={{ color: '#f87171' }}>eliminan permanentemente</b>.</>
                  }
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setModal(m => ({ ...m, step: 1 }))} style={{ flex: 1, padding: '13px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.5)', fontFamily: 'inherit', cursor: 'pointer', fontSize: 13 }}>← Atrás</button>
                  <button onClick={() => executeSave('2to1', modal.accion, modal.cuentaElegida)} disabled={saving}
                    style={{ flex: 2, padding: '13px', borderRadius: 12, border: 'none', background: modal.accion === 'unificar' ? 'linear-gradient(135deg,#34d399,#059669)' : 'linear-gradient(135deg,#ef4444,#dc2626)', color: '#fff', fontFamily: 'inherit', cursor: 'pointer', fontWeight: 700, fontSize: 13, opacity: saving ? 0.7 : 1 }}>
                    {saving ? 'Guardando...' : 'Confirmar y guardar'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1→2 */}
      {modal?.type === '1to2' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#0f1f35', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 22, padding: 24, width: '100%', maxWidth: 360 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Agregás una segunda cuenta</div>
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '14px 16px', marginBottom: 20, fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.8 }}>
              ✓ <b style={{ color: '#fff' }}>{origLabel1}</b> conserva todos sus movimientos actuales<br/>
              ✓ <b style={{ color: '#a5b4fc' }}>{cuenta2.trim()}</b> empezará con saldo en cero
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setModal(null)} style={{ flex: 1, padding: '13px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.5)', fontFamily: 'inherit', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
              <button onClick={() => executeSave('1to2', null)}
                style={{ flex: 2, padding: '13px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontFamily: 'inherit', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                {saving ? 'Guardando...' : 'Confirmar y guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mas-section-header">
        <div>
          <div className="mas-section-title">Mi perfil</div>
          <div className="mas-section-sub">{userEmail}</div>
        </div>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 16, padding: '18px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Tipo de cuenta</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { val: 'personal', label: 'Personal', desc: 'Una sola cuenta para tus finanzas', grad: 'linear-gradient(135deg,#6366f1,#8b5cf6)' },
              { val: 'negocio', label: 'Negocio + Personal', desc: 'Dos cuentas separadas', grad: 'linear-gradient(135deg,#0ea5e9,#6366f1)' },
            ].map(p => (
              <button key={p.val} type="button" onClick={() => setPlan(p.val)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, border: plan === p.val ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.08)', background: plan === p.val ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.03)', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: p.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{p.label}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{p.desc}</div>
                </div>
                {plan === p.val && <svg style={{ marginLeft: 'auto', flexShrink: 0 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
              </button>
            ))}
          </div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 16, padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Nombre de cuentas</div>
          <div className="field" style={{ margin: 0 }}>
            <label>{plan === 'negocio' ? 'Cuenta 1 (negocio)' : 'Nombre de tu cuenta'}</label>
            <input type="text" maxLength={20} value={cuenta1} onChange={e => setCuenta1(e.target.value)} placeholder={plan === 'negocio' ? 'Ej: Mi Tienda' : 'Ej: Personal'} required />
          </div>
          {plan === 'negocio' && (
            <div className="field" style={{ margin: 0 }}>
              <label>Cuenta 2 (personal)</label>
              <input type="text" maxLength={20} value={cuenta2} onChange={e => setCuenta2(e.target.value)} placeholder="Ej: Personal" required />
            </div>
          )}
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', lineHeight: 1.5 }}>
            Estos nombres aparecen en toda la app. Recargá la pantalla principal después de guardar para ver los cambios.
          </div>
        </div>

        {success && (
          <div style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: '#34d399', display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            ¡Guardado correctamente!
          </div>
        )}

        <Recordatorios userId={userId} />

        {puedeUsarMonedas(userEmail) && <MonedasExtra userId={userId} />}

        <button type="submit" disabled={saving} style={{ padding: '14px', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </form>
    </div>
  );
}

/* ─── PÁGINA PRINCIPAL MÁS ─── */
function buildCfgFromDB(uc) {
  const c1 = (uc.cuenta1 || '').toLowerCase();
  const c2 = uc.cuenta2 ? uc.cuenta2.toLowerCase() : null;
  return { c1, c2, l1: uc.cuenta1 || '', l2: uc.cuenta2 || null, single: !uc.cuenta2, monedas: Array.isArray(uc.monedas) ? uc.monedas.filter(m => MONEDAS[m]) : [] };
}

export default function Mas() {
  const router = useRouter();
  const [session, setSession] = useState(undefined);
  const [activeTab, setActiveTab] = useState('resumen');

  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get('tab');
    if (tab && TABS.some(t => t.id === tab)) setActiveTab(tab);
  }, []);
  const [isAdmin, setIsAdmin] = useState(false);
  const [cfg, setCfg] = useState(null);
  const [soloLectura, setSoloLectura] = useState(false);
  const [showConvertir, setShowConvertir] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.push('/login'); return; }
      const userId = data.session.user.id;
      const email = data.session.user.email;
      const [{ data: uc }, { data: lic }] = await Promise.all([
        supabase.from('user_config').select('*').eq('user_id', userId).single(),
        supabase.from('licencias').select('activo, solo_lectura, fecha_vencimiento').eq('email', email).single(),
      ]);
      setIsAdmin(email === ADMIN_EMAIL);
      setCfg(uc ? buildCfgFromDB(uc) : getUserConfig(email));
      const adminSetSoloLectura = !!(lic?.activo && lic?.solo_lectura);
      const demoExpired = !lic?.activo && (() => {
        const today = new Date(); today.setHours(0,0,0,0);
        const regDate = new Date(uc?.fecha_registro || new Date()); regDate.setHours(0,0,0,0);
        return DIAS_PRUEBA - Math.ceil((today - regDate) / 86400000) <= 0;
      })();
      const licVencida = !!(lic?.activo && lic?.fecha_vencimiento && (() => {
        const today = new Date(); today.setHours(0,0,0,0);
        const vence = new Date(lic.fecha_vencimiento); vence.setHours(0,0,0,0);
        return vence < today;
      })());
      setSoloLectura(adminSetSoloLectura || demoExpired || licVencida);
      setSession(data.session);
    });
  }, [router]);

  if (!session || !cfg) return null;

  const email = session.user.email;
  const renderTab = () => {
    switch (activeTab) {
      case 'resumen': return <Resumen userId={session.user.id} userEmail={email} cfg={cfg} />;
      case 'gastos': return <GastosFijos userId={session.user.id} userEmail={email} cfg={cfg} soloLectura={soloLectura} />;
      case 'cuotas': return <Cuotas userId={session.user.id} userEmail={email} cfg={cfg} soloLectura={soloLectura} />;
      case 'tarjetas': return <Tarjetas userId={session.user.id} userEmail={email} cfg={cfg} soloLectura={soloLectura} />;
      case 'cobros': return <Cobros userId={session.user.id} userEmail={email} cfg={cfg} soloLectura={soloLectura} />;
      case 'deudas': return <Deudas userId={session.user.id} userEmail={email} cfg={cfg} soloLectura={soloLectura} />;
      case 'metas': return <Metas userId={session.user.id} userEmail={email} cfg={cfg} soloLectura={soloLectura} />;
      case 'perfil': return <Perfil userId={session.user.id} userEmail={email} />;
      default: return null;
    }
  };

  return (
    <div className="wrap">
      <div className="top-bar">
        <div>
          <h1>Gestión avanzada</h1>
          <p>Finanzas</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {(cfg.monedas || []).length > 0 && puedeConvertir(email) && (
            <BotonConvertir onClick={() => setShowConvertir(true)} />
          )}
          <button className="logout-btn" onClick={() => router.push('/')}>← Volver</button>
        </div>
      </div>

      {showConvertir && (
        <Convertidor userId={session.user.id} monedas={cfg.monedas} onCerrar={() => setShowConvertir(false)} />
      )}

      <div className="mas-tabs">
        {TABS.map(t => (
          <button key={t.id} className={`mas-tab${activeTab === t.id ? ' active' : ''}`} onClick={() => setActiveTab(t.id)}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: `linear-gradient(135deg,${t.grad[0]},${t.grad[1]})`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6, boxShadow: `0 4px 12px ${t.grad[0]}55` }}>{t.svg}</div>
            <span className="mas-tab-label">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="mas-content">
        {renderTab()}
      </div>
    </div>
  );
}
