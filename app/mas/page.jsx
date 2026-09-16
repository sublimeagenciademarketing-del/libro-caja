'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { DIAS_PRUEBA } from '../../lib/config';
import { sumarMeses } from '../../lib/fechas';
import { hoyISO, deISO, mesDe, enMes, sumarDias, siguiente, proximoDe, esRecurrente, estadoDe, textoEstado, ocurrenciasEnMes, cadenciaEnMes, alPagar, alRevertir } from '../../lib/recurrencia';

const ADMIN_EMAIL = 'sublimeagenciademarketing@gmail.com';
const mismaCuenta = (a, b) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();
// card_expenses.estado no admite 'pendiente': sus valores son
// pendiente_facturacion / facturado / pagado. Este es el valor por defecto.
const TARJETA_PENDIENTE = 'pendiente_facturacion';
const etiquetaCuenta = (valor, cfg) =>
  cfg.single || mismaCuenta(valor, cfg.c1) ? cfg.l1 : cfg.l2;
const fmt = (n) => '₲ ' + Math.round(Math.abs(n)).toLocaleString('es-PY');
const fmtD = (raw) => (raw ? raw.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '');
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
function Resumen({ userId, cfg }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [projection, setProjection] = useState(null);
  const anio = new Date().getFullYear();

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: txs } = await supabase
        .from('transactions')
        .select('monto,tipo,fecha,cuenta')
        .eq('user_id', userId)
        .gte('fecha', `${anio}-01-01`)
        .lte('fecha', `${anio}-12-31`);

      const meses = Array.from({ length: 12 }, (_, i) => {
        const key = `${anio}-${String(i+1).padStart(2,'0')}`;
        const del_mes = (txs || []).filter(t => t.fecha && t.fecha.startsWith(key));
        const ing = del_mes.filter(t => t.tipo === 'ingreso').reduce((s,t) => s + t.monto, 0);
        const gas = del_mes.filter(t => t.tipo === 'gasto').reduce((s,t) => s + t.monto, 0);
        const ing1 = del_mes.filter(t => t.tipo === 'ingreso' && (cfg.single || mismaCuenta(t.cuenta, cfg.c1))).reduce((s,t) => s + t.monto, 0);
        const gas1 = del_mes.filter(t => t.tipo === 'gasto' && (cfg.single || mismaCuenta(t.cuenta, cfg.c1))).reduce((s,t) => s + t.monto, 0);
        const ing2 = del_mes.filter(t => t.tipo === 'ingreso' && mismaCuenta(t.cuenta, cfg.c2)).reduce((s,t) => s + t.monto, 0);
        const gas2 = del_mes.filter(t => t.tipo === 'gasto' && mismaCuenta(t.cuenta, cfg.c2)).reduce((s,t) => s + t.monto, 0);
        return { mes: i, ing, gas, bal: ing - gas, bal1: ing1 - gas1, bal2: ing2 - gas2, tiene: del_mes.length > 0 };
      });
      setData(meses);

      // proyección mes actual
      const now = new Date();
      const y = now.getFullYear(), mo = now.getMonth();
      const mStr = String(mo + 1).padStart(2, '0');
      const lastDay = new Date(y, mo + 1, 0).getDate();
      const mesStart = `${y}-${mStr}-01`, mesEnd = `${y}-${mStr}-${String(lastDay).padStart(2, '0')}`;
      const [r1, r2, r3, r4] = await Promise.all([
        supabase.from('receivables').select('monto, cuenta, estado, frecuencia, fecha_esperada, proximo_vencimiento, cobrado_fecha, activo').eq('user_id', userId),
        supabase.from('debts').select('monto_total, monto_pagado, cuenta, estado').eq('user_id', userId).gte('fecha_limite', mesStart).lte('fecha_limite', mesEnd),
        supabase.from('installments').select('monto, estado, installment_purchases!inner(user_id, cuenta)').eq('estado', 'pendiente').gte('fecha_vencimiento', mesStart).lte('fecha_vencimiento', mesEnd).eq('installment_purchases.user_id', userId),
        supabase.from('recurring_expenses').select('monto, cuenta, activo, pagado_mes, pagado_fecha, frecuencia, dia_vencimiento, proximo_vencimiento').eq('user_id', userId).eq('activo', true),
      ]);
      const hoy = hoyISO();
      setProjection({
        cobros: expandirCobrosDelMes(r1.data || [], y, mo, hoy, mesStart, mesEnd),
        deudas: (r2.data || []).filter(r => r.estado !== 'pagado'),
        cuotas: (r3.data || []).filter(r => r.installment_purchases),
        gastos: expandirGastosDelMes(r4.data || [], y, mo, hoy),
      });

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

  return (
    <div>
      <div className="mas-section-header">
        <div>
          <div className="mas-section-title">Resumen {anio}</div>
        </div>
      </div>

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
          {data.filter(m => m.tiene).map(m => (
            <li key={m.mes}>
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
            </li>
          ))}
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
    </div>
  );
}

/* ─── GASTOS FIJOS ─── */
function GastosFijos({ userId, userEmail, cfg: cfgProp, soloLectura = false }) {
  const cfg = cfgProp || getUserConfig(userEmail);
  const hoy = hoyISO();
  const FORM_VACIO = { descripcion: '', monto: '', montoDisplay: '', dia_vencimiento: '', proximo_vencimiento: '', cuenta: cfg.c1, frecuencia: 'mensual' };
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
    const lista = (data || []).map(g => ({ ...g, _proximo: proximoDe(g, hoyISO()) || '9999' }));
    lista.sort((a, b) => (a.activo === b.activo ? (a._proximo < b._proximo ? -1 : 1) : a.activo ? -1 : 1));
    setGastos(lista);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  function handleMonto(e) {
    const raw = e.target.value.replace(/\D/g, '');
    setForm(f => ({ ...f, monto: raw, montoDisplay: fmtD(raw) }));
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
    const { error: e2 } = await supabase.from('transactions').insert({ user_id: userId, monto: g.monto, tipo: 'gasto', fecha: hoy, categoria: `Gasto fijo: ${g.descripcion}`, cuenta: g.cuenta });
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
  const totalMes = activos.reduce((s, g) => s + cadenciaEnMes(g, anio, mes0, hoy).length * g.monto, 0);
  const pendienteMes = activos.reduce((s, g) => s + ocurrenciasEnMes(g, anio, mes0, hoy, { incluirAtrasadas: true }).length * g.monto, 0);

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
          <div className="mas-section-sub">Este mes: <span style={{ color: '#f87171', fontWeight: 700 }}>{fmt(totalMes)}</span> · Pendiente: <span style={{ color: '#fbbf24', fontWeight: 700 }}>{fmt(pendienteMes)}</span></div>
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
              <label>Monto (₲)</label>
              <input type="text" inputMode="numeric" className="num" value={form.montoDisplay} onChange={handleMonto} placeholder="0" required />
            </div>
            {campoFecha(form, setForm)}
          </div>
          {form.frecuencia === 'quincenal' && form.proximo_vencimiento && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: -6, marginBottom: 10 }}>
              Se repite los días {(() => { const d = deISO(form.proximo_vencimiento).getDate(); const d1 = d > 15 ? d - 15 : d; return `${d1} y ${d1 + 15 > 28 ? 'último' : d1 + 15}`; })()} de cada mes.
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

      {loading ? (
        <div className="mas-loading">Cargando...</div>
      ) : gastos.length === 0 ? (
        <div className="empty">No hay gastos fijos registrados.</div>
      ) : (
        <ul className="mas-list">
          {gastos.map(g => {
            const isExp = expandedId === g.id;
            const est = estadoDe(g, hoy);
            const alDia = est.etiqueta === 'al_dia';
            const frec = g.frecuencia || 'mensual';
            return (
              <li key={g.id} className={g.activo ? '' : 'inactive'}
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
                  <div className="amt" style={{ flexShrink: 0, color: alDia ? '#34d399' : '#f87171' }}>{fmt(g.monto)}</div>
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
                          <div className="field"><label>Monto (₲)</label><input type="text" inputMode="numeric" className="num" value={editForm.monto ? String(editForm.monto).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''} onChange={e => setEditForm(f => ({ ...f, monto: e.target.value.replace(/\D/g, '') }))} /></div>
                          {campoFecha(editForm, setEditForm)}
                        </div>
                        <div className="row"><div className="field"><label>Cuenta</label><CuentaToggle value={editForm.cuenta} onChange={v => setEditForm(f => ({ ...f, cuenta: v }))} cfg={cfg} /></div></div>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 8 }}>
                          <button className="del" style={{ color: '#94a3b8', width: 'auto', padding: '0 12px', fontSize: 12 }} onClick={() => setEditingId(null)}>Cancelar</button>
                          <button className="add-btn" style={{ margin: 0, fontSize: 12, padding: '6px 14px' }} onClick={() => handleSaveEdit(g)}>Guardar</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        {g.activo && est.proximo && (
                          <button className="del" style={{ color: '#34d399', borderColor: 'rgba(52,211,153,0.3)', background: 'rgba(52,211,153,0.1)', width: 'auto', padding: '0 14px', fontSize: 12, fontWeight: 700 }}
                            onClick={() => handlePagar(g)}>✓ Pagar{est.atrasadas > 1 ? ' 1 de ' + est.atrasadas : ''}</button>
                        )}
                        {g.pagado_fecha && (
                          <button className="del" style={{ color: '#fb923c', borderColor: 'rgba(251,146,60,0.3)', background: 'rgba(251,146,60,0.1)', width: 'auto', padding: '0 14px', fontSize: 12, fontWeight: 700 }}
                            onClick={() => handleRevertir(g)}>↩ Revertir</button>
                        )}
                        <button className="del" style={{ color: '#93c5fd', borderColor: 'rgba(147,197,253,0.3)', background: 'rgba(147,197,253,0.1)' }} title="Editar"
                          onClick={() => { setEditingId(g.id); setEditForm({ descripcion: g.descripcion, monto: String(Math.round(g.monto)), dia_vencimiento: String(g.dia_vencimiento || ''), proximo_vencimiento: proximoDe(g, hoy) || '', cuenta: g.cuenta, frecuencia: frec }); }}>✎</button>
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
function Cuotas({ userId, userEmail, cfg: cfgProp, soloLectura = false }) {
  const cfg = cfgProp || getUserConfig(userEmail);
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
    cuenta: cfg.c1, frecuencia: 'mensual',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('installment_purchases').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    setPurchases(data || []);
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

  function handleMonto(e) {
    const raw = e.target.value.replace(/\D/g, '');
    setForm(f => ({ ...f, monto: raw, montoDisplay: fmtD(raw) }));
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

    setForm({ descripcion: '', monto: '', montoDisplay: '', total_cuotas: '', dia_vencimiento: '', fecha_primera_cuota: hoyISO(), cuenta: cfg.c1, frecuencia: 'mensual' });
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
    const diaVenc = (editForm.frecuencia || 'mensual') === 'mensual' ? (parseInt(editForm.dia_vencimiento) || 1) : (editForm.fecha_primera_cuota ? deISO(editForm.fecha_primera_cuota).getDate() : 1);
    await supabase.from('installment_purchases').update({
      descripcion: editForm.descripcion.trim(),
      cuenta: editForm.cuenta,
      frecuencia: frec,
      dia_vencimiento: diaVenc,
      fecha_primera_cuota: editForm.fecha_primera_cuota,
    }).eq('id', id);

    // Regenerar cuotas pendientes con nuevas fechas
    const purchase = purchases.find(p => p.id === id);
    if (purchase && editForm.fecha_primera_cuota) {
      const { data: existing } = await supabase.from('installments').select('*').eq('purchase_id', id).order('numero_cuota');
      const pendientes = (existing || []).filter(c => c.estado === 'pendiente');
      if (pendientes.length > 0) {
        const firstPendiente = pendientes[0].numero_cuota;
        const firstDate = new Date(editForm.fecha_primera_cuota + 'T12:00:00');
        const updates = pendientes.map((c, idx) => {
          const d = new Date(firstDate);
          const i = firstPendiente - 1 + idx;
          if (frec === 'semanal') d.setDate(d.getDate() + i * 7);
          else if (frec === 'quincenal') d.setDate(d.getDate() + i * 15);
          else d.setTime(sumarMeses(firstDate, i, diaVenc).getTime());
          return supabase.from('installments').update({ fecha_vencimiento: d.toISOString().slice(0, 10) }).eq('id', c.id);
        });
        await Promise.all(updates);
      }
    }

    setEditingId(null);
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
              <label>Monto por cuota (₲)</label>
              <input type="text" inputMode="numeric" className="num" value={form.montoDisplay} onChange={handleMonto} placeholder="0" required />
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
              Total: {fmt(parseFloat(form.monto) * parseInt(form.total_cuotas || 0))} en {form.total_cuotas} cuotas de {fmt(parseFloat(form.monto))}
            </div>
          )}
          <button className="add-btn" type="submit">Guardar y generar cuotas</button>
        </form>
      )}

      {loading ? (
        <div className="mas-loading">Cargando...</div>
      ) : purchases.length === 0 ? (
        <div className="empty">No hay compras en cuotas registradas.</div>
      ) : (
        <ul className="mas-list">
          {purchases.map(p => {
            const cuotas = installments[p.id] || [];
            const pagadas = cuotas.filter(c => c.estado === 'pagado').length;
            const pct = p.total_cuotas ? Math.round((pagadas / p.total_cuotas) * 100) : 0;
            return (
              <li key={p.id} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 0, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div className="mas-item-icon" style={{ background: 'rgba(192,132,252,0.15)', border: '1px solid rgba(192,132,252,0.3)' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c084fc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/></svg></div>
                  <div className="meta" style={{ flex: 1 }}>
                    <div className="cat">{p.descripcion}</div>
                    <div className="sub">{pagadas}/{p.total_cuotas} cuotas · {fmt(p.monto_por_cuota)}{p.frecuencia === 'semanal' ? '/sem.' : p.frecuencia === 'quincenal' ? '/quinc.' : '/mes'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="del" style={{ fontSize: 13 }} onClick={() => toggleExpand(p.id)} title="Ver cuotas">
                      {expanded === p.id ? '▲' : '▼'}
                    </button>
                    {!soloLectura && <button className="del" style={{ color: '#93c5fd', borderColor: 'rgba(147,197,253,0.3)', background: 'rgba(147,197,253,0.1)' }} title="Editar"
                      onClick={() => { setEditingId(p.id); setEditForm({ descripcion: p.descripcion, cuenta: p.cuenta || cfg.c1, frecuencia: p.frecuencia || 'mensual', dia_vencimiento: p.dia_vencimiento || '', fecha_primera_cuota: p.fecha_primera_cuota || '' }); }}>✎</button>}
                    {!soloLectura && <button className="del" onClick={() => handleDeletePurchase(p.id)} title="Eliminar">✕</button>}
                  </div>
                </div>
                {editingId === p.id && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="row"><div className="field"><label>Descripción</label><input type="text" value={editForm.descripcion} onChange={e => setEditForm(f => ({...f, descripcion: e.target.value}))} /></div></div>
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
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#f87171' }}>Total restante: {fmt(totalRestante)}</span>
                        </div>
                      ) : null;
                    })()}
                  <ul className="cuota-list">
                    {cuotas.map(c => (
                      <li key={c.id} className={c.estado === 'pagado' ? 'pagado' : ''}>
                        <span className="cuota-num">#{c.numero_cuota}</span>
                        <span className="cuota-fecha">{fmtFecha(c.fecha_vencimiento)}</span>
                        <span className="cuota-monto">{fmt(c.monto)}</span>
                        {c.estado === 'pendiente' ? (
                          !soloLectura && <button className="cuota-pay-btn" onClick={() => handlePagarCuota(c.id, p.id)}>✓ Pagar</button>
                        ) : (
                          !soloLectura && <button className="cuota-pay-btn" style={{ background: 'rgba(251,146,60,0.15)', borderColor: 'rgba(251,146,60,0.3)', color: '#fb923c' }}
                            onClick={async () => {
                              if (!window.confirm(`¿Revertir pago de cuota #${c.numero_cuota}?`)) return;
                              const cat = `${p.descripcion} — Cuota ${c.numero_cuota}/${p.total_cuotas}`;
                              const { data: txs } = await supabase.from('transactions').select('id').eq('user_id', userId).eq('categoria', cat).order('fecha', { ascending: false }).limit(1);
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
        </ul>
      )}
    </div>
  );
}

/* ─── COBROS (Cuentas por cobrar) ─── */
function Cobros({ userId, userEmail, cfg: cfgProp, soloLectura = false }) {
  const cfg = cfgProp || getUserConfig(userEmail);
  const hoy = hoyISO();
  const FORM_VACIO = { cliente: '', monto: '', montoDisplay: '', fecha_esperada: '', forma_pago: 'transferencia', cuenta: cfg.c1, frecuencia: 'una_vez' };
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
    // Orden: pendientes primero por fecha más cercana; cobrados de una vez al final.
    const clave = (i) => {
      if (!i.activo) return '8' + (proximoDe(i, hoyISO()) || '9999');
      if (!esRecurrente(i)) return (i.estado === 'cobrado' ? '9' : '1') + (i.fecha_esperada || '9999');
      return '1' + (proximoDe(i, hoyISO()) || '9999');
    };
    setItems((data || []).sort((a, b) => (clave(a) < clave(b) ? -1 : 1)));
    setLoading(false);
  }, [userId]);

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
      categoria: `Cobro: ${item.cliente}`, cuenta: item.cuenta || cfg.c1,
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
      fecha_esperada: editForm.fecha_esperada || null,
      forma_pago: editForm.forma_pago,
      cuenta: editForm.cuenta,
      frecuencia: frec,
    };
    // Si cambió la fecha o pasó a repetitivo, el próximo cobro es la fecha cargada.
    if (frec !== 'una_vez') {
      const fechaActual = proximoDe(item, hoy);
      if (editForm.fecha_esperada !== fechaActual || !esRecurrente(item)) cambios.proximo_vencimiento = editForm.fecha_esperada;
    } else {
      cambios.proximo_vencimiento = null;
    }
    const { error } = await supabase.from('receivables').update(cambios).eq('id', item.id);
    if (error) { alert(`No se pudo guardar: ${error.message}`); return; }
    setEditingId(null);
    load();
  }

  const h = deISO(hoy); const anio = h.getFullYear(), mes0 = h.getMonth();
  const pendiente = items.filter(i => i.activo !== false).reduce((s, i) => {
    if (!esRecurrente(i)) return s + (i.estado === 'pendiente' ? i.monto : 0);
    return s + ocurrenciasEnMes(i, anio, mes0, hoy, { incluirAtrasadas: true }).length * i.monto;
  }, 0);

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
          <label>Monto (₲)</label>
          <input type="text" inputMode="numeric" className="num" value={f.montoDisplay ?? (f.monto ? String(f.monto).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '')} onChange={e => { const raw = e.target.value.replace(/\D/g, ''); setter({ ...f, monto: raw, montoDisplay: fmtD(raw) }); }} placeholder="0" required />
        </div>
        <div className="field">
          <label>{f.frecuencia === 'una_vez' ? 'Fecha esperada' : 'Próximo cobro'}</label>
          <input type="date" value={f.fecha_esperada || ''} onChange={e => setter({ ...f, fecha_esperada: e.target.value })} required={f.frecuencia !== 'una_vez'} />
        </div>
      </div>
      {f.frecuencia === 'quincenal' && f.fecha_esperada && (
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: -6, marginBottom: 10 }}>
          Se repite los días {(() => { const d = deISO(f.fecha_esperada).getDate(); const d1 = d > 15 ? d - 15 : d; return `${d1} y ${d1 + 15 > 28 ? 'último' : d1 + 15}`; })()} de cada mes.
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
          <div className="mas-section-sub">Pendiente este mes: <span style={{ color: '#34d399', fontWeight: 700 }}>{fmt(pendiente)}</span></div>
        </div>
        {!soloLectura && (
          <button className="mas-add-btn" onClick={() => setShowForm(v => !v)}>
            {showForm ? '✕ Cerrar' : '+ Nuevo'}
          </button>
        )}
      </div>

      {!soloLectura && showForm && formulario(form, setForm, handleAdd, 'Nuevo cobro pendiente', 'Guardar')}

      {loading ? <div className="mas-loading">Cargando...</div> : items.length === 0 ? (
        <div className="empty">No hay cobros registrados.</div>
      ) : (
        <ul className="mas-list">
          {items.map(i => {
            const isExp = expandedId === i.id;
            const recurrente = esRecurrente(i);
            const pausado = i.activo === false;
            const est = recurrente ? estadoDe(i, hoy) : null;
            const cobradoUnaVez = !recurrente && i.estado === 'cobrado';
            const apagada = cobradoUnaVez || pausado;
            const linea = recurrente
              ? <>{est.proximo ? `Próximo: ${fmtFecha(est.proximo)} · ` : ''}{etiquetaCuenta(i.cuenta, cfg)} · {nombreFrec(i.frecuencia).toLowerCase()} · <span style={{ color: pausado ? 'rgba(255,255,255,0.4)' : colorEstado[est.etiqueta], fontWeight: 600 }}>{pausado ? 'Pausado' : textoEstado(est)}</span></>
              : <>{i.fecha_esperada ? `Vence: ${fmtFecha(i.fecha_esperada)} · ` : ''}{etiquetaCuenta(i.cuenta, cfg)} · {cobradoUnaVez ? '✓ Cobrado' : 'Pendiente'}</>;
            return (
              <li key={i.id} className={apagada ? 'inactive' : ''}
                style={{ flexDirection: 'column', alignItems: 'stretch', gap: 0, cursor: 'pointer' }}
                onClick={() => setExpandedId(isExp ? null : i.id)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="mas-item-icon" style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)', flexShrink: 0 }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v13M7 10l5 5 5-5"/><path d="M20 20H4"/></svg></div>
                  <div className="meta">
                    <div className="cat">{i.cliente}</div>
                    <div className="sub">{linea}</div>
                  </div>
                  <div className="amt pos" style={{ flexShrink: 0 }}>{fmt(i.monto)}</div>
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
                        {!soloLectura && <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          {!cobradoUnaVez && !pausado && (recurrente ? !!est.proximo : true) && (
                            <button className="del" style={{ color: '#34d399', borderColor: 'rgba(52,211,153,0.3)', background: 'rgba(52,211,153,0.1)', width: 'auto', padding: '0 14px', fontSize: 12, fontWeight: 700 }}
                              onClick={() => handleCobrar(i)}>✓ Cobrar{recurrente && est.atrasadas > 1 ? ' 1 de ' + est.atrasadas : ''}</button>
                          )}
                          {(cobradoUnaVez || (recurrente && i.cobrado_fecha)) && (
                            <button className="del" style={{ color: '#fb923c', borderColor: 'rgba(251,146,60,0.3)', background: 'rgba(251,146,60,0.1)', width: 'auto', padding: '0 14px', fontSize: 12, fontWeight: 700 }}
                              onClick={() => handleRevertir(i)}>↩ Revertir</button>
                          )}
                          {!cobradoUnaVez && <button className="del" style={{ color: '#93c5fd', borderColor: 'rgba(147,197,253,0.3)', background: 'rgba(147,197,253,0.1)' }} title="Editar"
                            onClick={() => { setEditingId(i.id); setEditForm({ cliente: i.cliente, monto: String(Math.round(i.monto)), fecha_esperada: (recurrente ? proximoDe(i, hoy) : i.fecha_esperada) || '', forma_pago: i.forma_pago || 'transferencia', cuenta: i.cuenta || cfg.c1, frecuencia: i.frecuencia || 'una_vez' }); }}>✎</button>}
                          {recurrente && <button className="del" title={pausado ? 'Activar' : 'Pausar'} onClick={() => handleToggle(i)} style={{ fontSize: 13 }}>{pausado ? '▶' : '⏸'}</button>}
                          <button className="del" onClick={() => handleDelete(i.id)} title="Eliminar">✕</button>
                        </div>}
                      </>
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

/* ─── DEUDAS ─── */
function Deudas({ userId, userEmail, cfg: cfgProp, soloLectura = false }) {
  const cfg = cfgProp || getUserConfig(userEmail);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [form, setForm] = useState({ acreedor: '', monto_total: '', montoDisplay: '', fecha_limite: '', cuenta: cfg.c1 });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('debts').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    setItems(data || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  function handleMonto(e) {
    const raw = e.target.value.replace(/\D/g, '');
    setForm(f => ({ ...f, monto_total: raw, montoDisplay: fmtD(raw) }));
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.acreedor.trim() || !form.monto_total) return;
    await supabase.from('debts').insert({
      user_id: userId, acreedor: form.acreedor.trim(),
      monto_total: parseFloat(form.monto_total),
      fecha_limite: form.fecha_limite || null,
      cuenta: form.cuenta,
    });
    setForm({ acreedor: '', monto_total: '', montoDisplay: '', fecha_limite: '', cuenta: cfg.c1 });
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
        categoria: `Pago deuda: ${item.acreedor}`, cuenta: item.cuenta || cfg.c1,
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
    }).eq('id', id);
    setEditingId(null);
    load();
  }

  const totalDeuda = items.filter(i => i.estado === 'pendiente').reduce((s, i) => s + (i.monto_total - i.monto_pagado), 0);

  return (
    <div>
      <div className="mas-section-header">
        <div>
          <div className="mas-section-title">Deudas</div>
          <div className="mas-section-sub">Total pendiente: <span style={{ color: '#f87171', fontWeight: 700 }}>{fmt(totalDeuda)}</span></div>
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
              <label>Monto (₲)</label>
              <input type="text" inputMode="numeric" className="num" value={form.montoDisplay} onChange={handleMonto} placeholder="0" required />
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

      {loading ? <div className="mas-loading">Cargando...</div> : items.length === 0 ? (
        <div className="empty">No hay deudas registradas.</div>
      ) : (
        <ul className="mas-list">
          {items.map(i => {
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
                  <div className="amt neg" style={{ flexShrink: 0 }}>{fmt(i.monto_total - i.monto_pagado)}</div>
                  <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, flexShrink: 0 }}>{isExp ? '▲' : '▼'}</span>
                </div>
                {isExp && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.08)' }}
                    onClick={e => e.stopPropagation()}>
                    {editingId === i.id ? (
                      <div>
                        <div className="row"><div className="field"><label>A quién le debo</label><input type="text" value={editForm.acreedor} onChange={e => setEditForm(f => ({...f, acreedor: e.target.value}))} /></div></div>
                        <div className="row">
                          <div className="field"><label>Monto total (₲)</label><input type="text" inputMode="numeric" className="num" value={editForm.monto_total ? String(editForm.monto_total).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''} onChange={e => setEditForm(f => ({...f, monto_total: e.target.value.replace(/\D/g, '')}))} /></div>
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
                            <button className="del" style={{ color: '#34d399', borderColor: 'rgba(52,211,153,0.3)', background: 'rgba(52,211,153,0.1)', width: 'auto', padding: '0 14px', fontSize: 12, fontWeight: 700 }}
                              onClick={() => handlePagar(i.id)}>✓ Pagar</button>
                          ) : (
                            <button className="del" style={{ color: '#fb923c', borderColor: 'rgba(251,146,60,0.3)', background: 'rgba(251,146,60,0.1)', width: 'auto', padding: '0 14px', fontSize: 12, fontWeight: 700 }}
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
                            onClick={() => { setEditingId(i.id); setEditForm({ acreedor: i.acreedor, monto_total: String(Math.round(i.monto_total)), fecha_limite: i.fecha_limite || '', cuenta: i.cuenta || cfg.c1 }); }}>✎</button>}
                          <button className="del" onClick={() => handleDelete(i.id)}>✕</button>
                        </div>}
                      </>
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

/* ─── METAS DE AHORRO ─── */
function Metas({ userId, soloLectura = false }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [aportarId, setAportarId] = useState(null);
  const [aporte, setAporte] = useState({ monto: '', montoDisplay: '' });
  const [form, setForm] = useState({ nombre: '', monto_meta: '', metaDisplay: '' });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [historial, setHistorial] = useState({});
  const [showHistorial, setShowHistorial] = useState(null);
  const [editingContrib, setEditingContrib] = useState(null);
  const [editContribMonto, setEditContribMonto] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('savings_goals').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    setItems(data || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  function handleMetaMonto(e) {
    const raw = e.target.value.replace(/\D/g, '');
    setForm(f => ({ ...f, monto_meta: raw, metaDisplay: fmtD(raw) }));
  }

  function handleAporteMonto(e) {
    const raw = e.target.value.replace(/\D/g, '');
    setAporte({ monto: raw, montoDisplay: fmtD(raw) });
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.nombre.trim() || !form.monto_meta) return;
    await supabase.from('savings_goals').insert({ user_id: userId, nombre: form.nombre.trim(), monto_meta: parseFloat(form.monto_meta) });
    setForm({ nombre: '', monto_meta: '', metaDisplay: '' });
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
              <label>Monto objetivo (₲)</label>
              <input type="text" inputMode="numeric" className="num" value={form.metaDisplay} onChange={handleMetaMonto} placeholder="0" required />
            </div>
          </div>
          <button className="add-btn" type="submit">Crear meta</button>
        </form>
      )}

      {loading ? <div className="mas-loading">Cargando...</div> : items.length === 0 ? (
        <div className="empty">No hay metas de ahorro registradas.</div>
      ) : (
        <ul className="mas-list">
          {items.map(i => {
            const pct = i.monto_meta > 0 ? Math.min(100, Math.round((i.monto_actual / i.monto_meta) * 100)) : 0;
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
                    <div className="sub">Meta: {fmt(i.monto_meta)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {!soloLectura && <button className="del" style={{ fontSize: 12, color: '#34d399', borderColor: 'rgba(52,211,153,0.3)' }} onClick={() => setAportarId(aportarId === i.id ? null : i.id)} title="Aportar">+</button>}
                    <button className="del" style={{ fontSize: 11, color: '#94a3b8', borderColor: 'rgba(148,163,184,0.3)' }} onClick={() => toggleHistorial(i.id)} title="Historial">≡</button>
                    {!soloLectura && <button className="del" style={{ color: '#93c5fd', borderColor: 'rgba(147,197,253,0.3)', background: 'rgba(147,197,253,0.1)' }} title="Editar"
                      onClick={() => { setEditingId(i.id); setEditForm({ nombre: i.nombre, monto_meta: String(Math.round(i.monto_meta)) }); }}>✎</button>}
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
                      ? <span style={{ fontSize: 11, color: '#34d399', fontWeight: 600 }}>{fmt(i.monto_actual)}</span>
                      : <span />}
                    <span style={{ fontSize: 11, color: '#f87171', fontWeight: 600 }}>Faltan {fmt(i.monto_meta - i.monto_actual)}</span>
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
                                <input type="text" inputMode="numeric" style={{ flex: 1, minWidth: 0, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(96,165,250,0.5)', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, padding: '5px 10px', outline: 'none', boxSizing: 'border-box' }}
                                  value={editContribMonto.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                                  onChange={e => setEditContribMonto(e.target.value.replace(/\D/g, ''))} />
                                <button className="del" style={{ width: 30, height: 30, minWidth: 30, fontSize: 13, color: '#94a3b8', padding: 0, flexShrink: 0 }} onClick={() => setEditingContrib(null)}>✕</button>
                                <button className="del" style={{ width: 30, height: 30, minWidth: 30, fontSize: 13, color: '#34d399', borderColor: 'rgba(52,211,153,0.4)', background: 'rgba(52,211,153,0.15)', padding: 0, flexShrink: 0 }}
                                  onClick={async () => { await handleEditContrib(h, i.id, parseFloat(editContribMonto)); setEditingContrib(null); }}>✓</button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{fmtFecha(h.fecha)}</span>
                                <span style={{ fontSize: 13, fontWeight: 700, color: '#34d399', marginLeft: 'auto' }}>+{fmt(h.monto)}</span>
                                {!soloLectura && <>
                                  <button className="del" style={{ width: 26, height: 26, minWidth: 26, fontSize: 11, color: '#93c5fd', borderColor: 'rgba(147,197,253,0.3)', background: 'rgba(147,197,253,0.1)', padding: 0 }}
                                    onClick={() => { setEditingContrib(h.id); setEditContribMonto(String(Math.round(h.monto))); }}>✎</button>
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
                    <input type="text" inputMode="numeric" className="num" value={aporte.montoDisplay} onChange={handleAporteMonto} placeholder="Monto a aportar (₲)" style={{ flex: 1 }} />
                    <button className="mas-add-btn" onClick={() => handleAportar(i.id)}>Guardar</button>
                  </div>
                )}
                {editingId === i.id && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="row"><div className="field"><label>Nombre de la meta</label><input type="text" value={editForm.nombre} onChange={e => setEditForm(f => ({...f, nombre: e.target.value}))} /></div></div>
                    <div className="row"><div className="field"><label>Monto objetivo (₲)</label><input type="text" inputMode="numeric" className="num" value={editForm.monto_meta ? String(editForm.monto_meta).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''} onChange={e => setEditForm(f => ({...f, monto_meta: e.target.value.replace(/\D/g, '')}))} /></div></div>
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
    const dCierre = new Date(cardForm.fecha_cierre).getDate();
    const dPago = new Date(cardForm.fecha_limite_pago).getDate();
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
                    return Object.entries(groupMap).map(([key, cuotas]) => {
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
                    });
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
  return { c1, c2, l1: uc.cuenta1 || '', l2: uc.cuenta2 || null, single: !uc.cuenta2 };
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
      case 'resumen': return <Resumen userId={session.user.id} cfg={cfg} />;
      case 'gastos': return <GastosFijos userId={session.user.id} userEmail={email} cfg={cfg} soloLectura={soloLectura} />;
      case 'cuotas': return <Cuotas userId={session.user.id} userEmail={email} cfg={cfg} soloLectura={soloLectura} />;
      case 'tarjetas': return <Tarjetas userId={session.user.id} userEmail={email} cfg={cfg} soloLectura={soloLectura} />;
      case 'cobros': return <Cobros userId={session.user.id} userEmail={email} cfg={cfg} soloLectura={soloLectura} />;
      case 'deudas': return <Deudas userId={session.user.id} userEmail={email} cfg={cfg} soloLectura={soloLectura} />;
      case 'metas': return <Metas userId={session.user.id} soloLectura={soloLectura} />;
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
        <button className="logout-btn" onClick={() => router.push('/')}>← Volver</button>
      </div>

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
