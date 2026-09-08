'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

const fmt = (n) => '₲ ' + Math.round(Math.abs(n)).toLocaleString('es-PY');
const fmtD = (raw) => (raw ? raw.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '');

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
  { id: 'gastos', label: 'Gastos Fijos', icon: '📋' },
  { id: 'cuotas', label: 'Cuotas', icon: '🗓️' },
  { id: 'tarjetas', label: 'Tarjetas', icon: '💳' },
  { id: 'cobros', label: 'Cobros', icon: '💰' },
  { id: 'deudas', label: 'Deudas', icon: '🤝' },
  { id: 'metas', label: 'Metas', icon: '🎯' },
];

/* ─── GASTOS FIJOS ─── */
function GastosFijos({ userId, userEmail }) {
  const cfg = getUserConfig(userEmail);
  const [gastos, setGastos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ descripcion: '', monto: '', montoDisplay: '', dia_vencimiento: '', cuenta: cfg.c1 });
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('recurring_expenses').select('*').eq('user_id', userId).order('dia_vencimiento');
    setGastos(data || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  function handleMonto(e) {
    const raw = e.target.value.replace(/\D/g, '');
    setForm(f => ({ ...f, monto: raw, montoDisplay: fmtD(raw) }));
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.descripcion.trim() || !form.monto || !form.dia_vencimiento) return;
    await supabase.from('recurring_expenses').insert({
      user_id: userId,
      descripcion: form.descripcion.trim(),
      monto: parseFloat(form.monto),
      dia_vencimiento: parseInt(form.dia_vencimiento),
      cuenta: form.cuenta,
    });
    setForm({ descripcion: '', monto: '', montoDisplay: '', dia_vencimiento: '', cuenta: 'sublime' });
    setShowForm(false);
    load();
  }

  async function handleToggle(id, activo) {
    await supabase.from('recurring_expenses').update({ activo: !activo }).eq('id', id);
    load();
  }

  async function handleDelete(id) {
    if (!window.confirm('¿Eliminar este gasto fijo?')) return;
    await supabase.from('recurring_expenses').delete().eq('id', id);
    load();
  }

  const total = gastos.filter(g => g.activo).reduce((s, g) => s + g.monto, 0);

  return (
    <div>
      <div className="mas-section-header">
        <div>
          <div className="mas-section-title">Gastos Fijos Recurrentes</div>
          <div className="mas-section-sub">Total mensual: <span style={{ color: '#f87171', fontWeight: 700 }}>{fmt(total)}</span></div>
        </div>
        <button className="mas-add-btn" onClick={() => setShowForm(v => !v)}>
          {showForm ? '✕ Cerrar' : '+ Nuevo'}
        </button>
      </div>

      {showForm && (
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
              <label>Monto (₲)</label>
              <input type="text" inputMode="numeric" className="num" value={form.montoDisplay} onChange={handleMonto} placeholder="0" required />
            </div>
            <div className="field" style={{ maxWidth: 100 }}>
              <label>Día vence</label>
              <input type="number" min="1" max="31" value={form.dia_vencimiento} onChange={e => setForm(f => ({ ...f, dia_vencimiento: e.target.value }))} placeholder="10" required />
            </div>
          </div>
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
          {gastos.map(g => (
            <li key={g.id} className={g.activo ? '' : 'inactive'}>
              <div className="mas-item-icon" style={{ background: g.activo ? 'rgba(248,113,113,0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${g.activo ? 'rgba(248,113,113,0.3)' : 'rgba(255,255,255,0.1)'}` }}>🔄</div>
              <div className="meta">
                <div className="cat">{g.descripcion}</div>
                <div className="sub">Día {g.dia_vencimiento} · {g.cuenta === cfg.c1 ? cfg.l1 : cfg.l2} · {g.activo ? 'Activo' : 'Pausado'}</div>
              </div>
              <div className="amt neg">{fmt(g.monto)}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {g.activo && (
                  <button className="del" style={{ fontSize: 11, color: '#34d399', borderColor: 'rgba(52,211,153,0.3)', width: 'auto', padding: '0 8px' }}
                    title="Pagar este mes"
                    onClick={async () => {
                      if (!window.confirm(`¿Registrar pago de ${g.descripcion}?`)) return;
                      await supabase.from('transactions').insert({
                        user_id: userId, monto: g.monto, tipo: 'gasto',
                        fecha: new Date().toISOString().slice(0, 10),
                        categoria: `Gasto fijo: ${g.descripcion}`, cuenta: g.cuenta,
                      });
                      alert('Pago registrado en el panel principal.');
                    }}>
                    Pagar
                  </button>
                )}
                <button className="del" title={g.activo ? 'Pausar' : 'Activar'} onClick={() => handleToggle(g.id, g.activo)} style={{ fontSize: 13 }}>
                  {g.activo ? '⏸' : '▶'}
                </button>
                <button className="del" onClick={() => handleDelete(g.id)} title="Eliminar">✕</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ─── CUOTAS ─── */
function Cuotas({ userId, userEmail }) {
  const cfg = getUserConfig(userEmail);
  const [purchases, setPurchases] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [installments, setInstallments] = useState({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    descripcion: '', monto: '', montoDisplay: '',
    total_cuotas: '', dia_vencimiento: '',
    fecha_primera_cuota: new Date().toISOString().slice(0, 10),
    cuenta: cfg.c1,
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
    const diaVenc = parseInt(form.dia_vencimiento);
    if (!form.descripcion.trim() || !monto || !totalCuotas || !diaVenc || !form.fecha_primera_cuota) return;

    const { data: purchase, error } = await supabase.from('installment_purchases').insert({
      user_id: userId,
      descripcion: form.descripcion.trim(),
      monto_por_cuota: monto,
      total_cuotas: totalCuotas,
      dia_vencimiento: diaVenc,
      fecha_primera_cuota: form.fecha_primera_cuota,
      cuenta: form.cuenta,
    }).select().single();

    if (error || !purchase) return;

    // Generar cuotas automáticamente
    const cuotas = [];
    const firstDate = new Date(form.fecha_primera_cuota + 'T12:00:00');
    for (let i = 0; i < totalCuotas; i++) {
      const d = new Date(firstDate);
      d.setMonth(d.getMonth() + i);
      d.setDate(diaVenc);
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

    setForm({ descripcion: '', monto: '', montoDisplay: '', total_cuotas: '', dia_vencimiento: '', fecha_primera_cuota: new Date().toISOString().slice(0, 10), cuenta: 'sublime' });
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
        fecha: new Date().toISOString().slice(0, 10),
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
        <button className="mas-add-btn" onClick={() => setShowForm(v => !v)}>
          {showForm ? '✕ Cerrar' : '+ Nueva'}
        </button>
      </div>

      {showForm && (
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
            <div className="field" style={{ maxWidth: 110 }}>
              <label>Día vence</label>
              <input type="number" min="1" max="31" value={form.dia_vencimiento} onChange={e => setForm(f => ({ ...f, dia_vencimiento: e.target.value }))} placeholder="10" required />
            </div>
            <div className="field">
              <label>Primera cuota</label>
              <input type="date" value={form.fecha_primera_cuota} onChange={e => setForm(f => ({ ...f, fecha_primera_cuota: e.target.value }))} required />
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
                  <div className="mas-item-icon" style={{ background: 'rgba(192,132,252,0.15)', border: '1px solid rgba(192,132,252,0.3)' }}>💳</div>
                  <div className="meta" style={{ flex: 1 }}>
                    <div className="cat">{p.descripcion}</div>
                    <div className="sub">{pagadas}/{p.total_cuotas} cuotas · {fmt(p.monto_por_cuota)}/mes</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="del" style={{ fontSize: 13 }} onClick={() => toggleExpand(p.id)} title="Ver cuotas">
                      {expanded === p.id ? '▲' : '▼'}
                    </button>
                    <button className="del" onClick={() => handleDeletePurchase(p.id)} title="Eliminar">✕</button>
                  </div>
                </div>
                <div className="cuota-bar-wrap">
                  <div className="cuota-bar" style={{ width: `${pct}%` }} />
                </div>
                {expanded === p.id && (
                  <ul className="cuota-list">
                    {cuotas.map(c => (
                      <li key={c.id} className={c.estado === 'pagado' ? 'pagado' : ''}>
                        <span className="cuota-num">#{c.numero_cuota}</span>
                        <span className="cuota-fecha">{c.fecha_vencimiento}</span>
                        <span className="cuota-monto">{fmt(c.monto)}</span>
                        {c.estado === 'pendiente' ? (
                          <button className="cuota-pay-btn" onClick={() => handlePagarCuota(c.id, p.id)}>✓ Pagar</button>
                        ) : (
                          <span className="cuota-paid-tag">Pagado ✓</span>
                        )}
                      </li>
                    ))}
                  </ul>
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
function Cobros({ userId, userEmail }) {
  const cfg = getUserConfig(userEmail);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ cliente: '', monto: '', montoDisplay: '', fecha_esperada: '', forma_pago: 'transferencia', cuenta: cfg.c1 });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('receivables').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    setItems(data || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  function handleMonto(e) {
    const raw = e.target.value.replace(/\D/g, '');
    setForm(f => ({ ...f, monto: raw, montoDisplay: fmtD(raw) }));
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.cliente.trim() || !form.monto) return;
    await supabase.from('receivables').insert({
      user_id: userId, cliente: form.cliente.trim(),
      monto: parseFloat(form.monto),
      fecha_esperada: form.fecha_esperada || null,
      forma_pago: form.forma_pago,
      cuenta: form.cuenta,
    });
    setForm({ cliente: '', monto: '', montoDisplay: '', fecha_esperada: '', forma_pago: 'transferencia', cuenta: cfg.c1 });
    setShowForm(false);
    load();
  }

  async function handleCobrar(id) {
    if (!window.confirm('¿Marcar como cobrado?')) return;
    await supabase.from('receivables').update({ estado: 'cobrado' }).eq('id', id);
    const item = items.find(i => i.id === id);
    if (item) {
      await supabase.from('transactions').insert({
        user_id: userId, monto: item.monto, tipo: 'ingreso',
        fecha: new Date().toISOString().slice(0, 10),
        categoria: `Cobro: ${item.cliente}`, cuenta: item.cuenta || cfg.c1,
      });
    }
    load();
  }

  async function handleDelete(id) {
    if (!window.confirm('¿Eliminar este cobro?')) return;
    await supabase.from('receivables').delete().eq('id', id);
    load();
  }

  const pendiente = items.filter(i => i.estado === 'pendiente').reduce((s, i) => s + i.monto, 0);

  return (
    <div>
      <div className="mas-section-header">
        <div>
          <div className="mas-section-title">Cuentas por Cobrar</div>
          <div className="mas-section-sub">Pendiente: <span style={{ color: '#34d399', fontWeight: 700 }}>{fmt(pendiente)}</span></div>
        </div>
        <button className="mas-add-btn" onClick={() => setShowForm(v => !v)}>
          {showForm ? '✕ Cerrar' : '+ Nuevo'}
        </button>
      </div>

      {showForm && (
        <form className="mas-form" onSubmit={handleAdd}>
          <div className="mas-form-title">Nuevo cobro pendiente</div>
          <div className="row">
            <div className="field">
              <label>Cliente / Deudor</label>
              <input type="text" value={form.cliente} onChange={e => setForm(f => ({ ...f, cliente: e.target.value }))} placeholder="Nombre..." required />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label>Monto (₲)</label>
              <input type="text" inputMode="numeric" className="num" value={form.montoDisplay} onChange={handleMonto} placeholder="0" required />
            </div>
            <div className="field">
              <label>Fecha esperada</label>
              <input type="date" value={form.fecha_esperada} onChange={e => setForm(f => ({ ...f, fecha_esperada: e.target.value }))} />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label>Forma de pago</label>
              <div className="toggle">
                {['transferencia','efectivo'].map(p => (
                  <button key={p} type="button" className={form.forma_pago === p ? 'active sublime' : ''} onClick={() => setForm(f => ({ ...f, forma_pago: p }))}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label>Acreditar a</label>
              <CuentaToggle value={form.cuenta} onChange={v => setForm(f => ({ ...f, cuenta: v }))} cfg={cfg} />
            </div>
          </div>
          <button className="add-btn" type="submit">Guardar</button>
        </form>
      )}

      {loading ? <div className="mas-loading">Cargando...</div> : items.length === 0 ? (
        <div className="empty">No hay cobros registrados.</div>
      ) : (
        <ul className="mas-list">
          {items.map(i => (
            <li key={i.id} className={i.estado === 'cobrado' ? 'inactive' : ''}>
              <div className="mas-item-icon" style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)' }}>📥</div>
              <div className="meta">
                <div className="cat">{i.cliente}</div>
                <div className="sub">{i.fecha_esperada ? `Vence: ${i.fecha_esperada} · ` : ''}{i.forma_pago} · {i.cuenta === cfg.c1 ? cfg.l1 : cfg.l2} · {i.estado === 'cobrado' ? '✓ Cobrado' : 'Pendiente'}</div>
              </div>
              <div className="amt pos">{fmt(i.monto)}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {i.estado === 'pendiente' && <button className="del" style={{ fontSize: 12, color: '#34d399', borderColor: 'rgba(52,211,153,0.3)' }} onClick={() => handleCobrar(i.id)} title="Marcar cobrado">✓</button>}
                <button className="del" onClick={() => handleDelete(i.id)} title="Eliminar">✕</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ─── DEUDAS ─── */
function Deudas({ userId, userEmail }) {
  const cfg = getUserConfig(userEmail);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
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
        fecha: new Date().toISOString().slice(0, 10),
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

  const totalDeuda = items.filter(i => i.estado === 'pendiente').reduce((s, i) => s + (i.monto_total - i.monto_pagado), 0);

  return (
    <div>
      <div className="mas-section-header">
        <div>
          <div className="mas-section-title">Deudas</div>
          <div className="mas-section-sub">Total pendiente: <span style={{ color: '#f87171', fontWeight: 700 }}>{fmt(totalDeuda)}</span></div>
        </div>
        <button className="mas-add-btn" onClick={() => setShowForm(v => !v)}>
          {showForm ? '✕ Cerrar' : '+ Nueva'}
        </button>
      </div>

      {showForm && (
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
          {items.map(i => (
            <li key={i.id} className={i.estado === 'pagado' ? 'inactive' : ''}>
              <div className="mas-item-icon" style={{ background: 'rgba(251,146,60,0.15)', border: '1px solid rgba(251,146,60,0.3)' }}>📤</div>
              <div className="meta">
                <div className="cat">{i.acreedor}</div>
                <div className="sub">{i.fecha_limite ? `Límite: ${i.fecha_limite} · ` : ''}{i.estado === 'pagado' ? '✓ Pagado' : 'Pendiente'}</div>
              </div>
              <div className="amt neg">{fmt(i.monto_total - i.monto_pagado)}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {i.estado === 'pendiente' && <button className="del" style={{ fontSize: 12, color: '#34d399', borderColor: 'rgba(52,211,153,0.3)' }} onClick={() => handlePagar(i.id)} title="Marcar pagado">✓</button>}
                <button className="del" onClick={() => handleDelete(i.id)} title="Eliminar">✕</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ─── METAS DE AHORRO ─── */
function Metas({ userId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [aportarId, setAportarId] = useState(null);
  const [aporte, setAporte] = useState({ monto: '', montoDisplay: '' });
  const [form, setForm] = useState({ nombre: '', monto_meta: '', metaDisplay: '' });

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
    const nuevo = Math.min(item.monto_actual + parseFloat(aporte.monto || 0), item.monto_meta);
    await supabase.from('savings_goals').update({ monto_actual: nuevo }).eq('id', id);
    setAportarId(null);
    setAporte({ monto: '', montoDisplay: '' });
    load();
  }

  async function handleDelete(id) {
    if (!window.confirm('¿Eliminar esta meta?')) return;
    await supabase.from('savings_goals').delete().eq('id', id);
    load();
  }

  return (
    <div>
      <div className="mas-section-header">
        <div>
          <div className="mas-section-title">Metas de Ahorro</div>
          <div className="mas-section-sub">{items.length} meta{items.length !== 1 ? 's' : ''}</div>
        </div>
        <button className="mas-add-btn" onClick={() => setShowForm(v => !v)}>
          {showForm ? '✕ Cerrar' : '+ Nueva'}
        </button>
      </div>

      {showForm && (
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
                  <div className="mas-item-icon" style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)' }}>🎯</div>
                  <div className="meta" style={{ flex: 1 }}>
                    <div className="cat">{i.nombre}</div>
                    <div className="sub">{fmt(i.monto_actual)} / {fmt(i.monto_meta)} · {pct}%</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="del" style={{ fontSize: 12, color: '#34d399', borderColor: 'rgba(52,211,153,0.3)' }} onClick={() => setAportarId(aportarId === i.id ? null : i.id)} title="Aportar">+</button>
                    <button className="del" onClick={() => handleDelete(i.id)} title="Eliminar">✕</button>
                  </div>
                </div>
                <div className="cuota-bar-wrap">
                  <div className="cuota-bar" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #34d399, #059669)' }} />
                </div>
                {aportarId === i.id && (
                  <div className="mas-aportar">
                    <input type="text" inputMode="numeric" className="num" value={aporte.montoDisplay} onChange={handleAporteMonto} placeholder="Monto a aportar (₲)" style={{ flex: 1 }} />
                    <button className="mas-add-btn" onClick={() => handleAportar(i.id)}>Guardar</button>
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
function Tarjetas({ userId, userEmail }) {
  const cfg = getUserConfig(userEmail);
  const [cards, setCards] = useState([]);
  const [expenses, setExpenses] = useState({});
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCardForm, setShowCardForm] = useState(false);
  const [showExpForm, setShowExpForm] = useState(null);
  const [cardForm, setCardForm] = useState({ nombre: '', dia_cierre: '', dia_vencimiento_pago: '' });
  const [expForm, setExpForm] = useState({ descripcion: '', monto: '', montoDisplay: '', fecha_compra: new Date().toISOString().slice(0, 10), cuenta: cfg.c1 });

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
    if (!cardForm.nombre.trim() || !cardForm.dia_cierre || !cardForm.dia_vencimiento_pago) return;
    await supabase.from('credit_cards').insert({ user_id: userId, nombre: cardForm.nombre.trim(), dia_cierre: parseInt(cardForm.dia_cierre), dia_vencimiento_pago: parseInt(cardForm.dia_vencimiento_pago) });
    setCardForm({ nombre: '', dia_cierre: '', dia_vencimiento_pago: '' });
    setShowCardForm(false);
    load();
  }

  async function handleAddExp(e, cardId) {
    e.preventDefault();
    if (!expForm.descripcion.trim() || !expForm.monto) return;
    await supabase.from('card_expenses').insert({
      user_id: userId, card_id: cardId,
      descripcion: expForm.descripcion.trim(),
      monto: parseFloat(expForm.monto),
      fecha_compra: expForm.fecha_compra,
      cuenta: expForm.cuenta,
    });
    setExpForm({ descripcion: '', monto: '', montoDisplay: '', fecha_compra: new Date().toISOString().slice(0, 10), cuenta: cfg.c1 });
    setShowExpForm(null);
    loadExpenses(cardId);
  }

  async function handlePagarTarjeta(expId, cardId) {
    if (!window.confirm('¿Marcar gasto como pagado y registrar en el panel principal?')) return;
    const exp = (expenses[cardId] || []).find(e => e.id === expId);
    await supabase.from('card_expenses').update({ estado: 'pagado' }).eq('id', expId);
    if (exp) {
      await supabase.from('transactions').insert({
        user_id: userId, monto: exp.monto, tipo: 'gasto',
        fecha: new Date().toISOString().slice(0, 10),
        categoria: `Tarjeta: ${exp.descripcion}`, cuenta: exp.cuenta || cfg.c1,
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

  async function handleDeleteExp(expId, cardId) {
    if (!window.confirm('¿Eliminar este gasto?')) return;
    await supabase.from('card_expenses').delete().eq('id', expId);
    loadExpenses(cardId);
  }

  return (
    <div>
      <div className="mas-section-header">
        <div>
          <div className="mas-section-title">Tarjetas de Crédito</div>
          <div className="mas-section-sub">{cards.length} tarjeta{cards.length !== 1 ? 's' : ''}</div>
        </div>
        <button className="mas-add-btn" onClick={() => setShowCardForm(v => !v)}>
          {showCardForm ? '✕ Cerrar' : '+ Tarjeta'}
        </button>
      </div>

      {showCardForm && (
        <form className="mas-form" onSubmit={handleAddCard}>
          <div className="mas-form-title">Nueva tarjeta</div>
          <div className="row">
            <div className="field">
              <label>Nombre de la tarjeta</label>
              <input type="text" value={cardForm.nombre} onChange={e => setCardForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Visa Personal, Bancop..." required />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label>Día de cierre</label>
              <input type="number" min="1" max="31" value={cardForm.dia_cierre} onChange={e => setCardForm(f => ({ ...f, dia_cierre: e.target.value }))} placeholder="15" required />
            </div>
            <div className="field">
              <label>Día vence pago</label>
              <input type="number" min="1" max="31" value={cardForm.dia_vencimiento_pago} onChange={e => setCardForm(f => ({ ...f, dia_vencimiento_pago: e.target.value }))} placeholder="25" required />
            </div>
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
                  <div className="mas-item-icon" style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)' }}>🪙</div>
                  <div className="meta" style={{ flex: 1 }}>
                    <div className="cat">{card.nombre}</div>
                    <div className="sub">Cierre día {card.dia_cierre} · Pago día {card.dia_vencimiento_pago}{pendTotal > 0 ? ` · Pendiente: ${fmt(pendTotal)}` : ''}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="del" style={{ fontSize: 11, color: '#60a5fa', borderColor: 'rgba(96,165,250,0.3)', width: 'auto', padding: '0 8px' }}
                      onClick={() => { setShowExpForm(showExpForm === card.id ? null : card.id); setExpanded(card.id); if (!expenses[card.id]) loadExpenses(card.id); }}>
                      + Gasto
                    </button>
                    <button className="del" style={{ fontSize: 13 }} onClick={() => toggleExpand(card.id)}>{expanded === card.id ? '▲' : '▼'}</button>
                    <button className="del" onClick={() => handleDeleteCard(card.id)} title="Eliminar tarjeta">✕</button>
                  </div>
                </div>

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
                        <label>Monto (₲)</label>
                        <input type="text" inputMode="numeric" className="num" value={expForm.montoDisplay}
                          onChange={e => { const r = e.target.value.replace(/\D/g,''); setExpForm(f=>({...f,monto:r,montoDisplay:fmtD(r)})); }}
                          placeholder="0" required />
                      </div>
                      <div className="field">
                        <label>Fecha</label>
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
                  <ul className="cuota-list">
                    {(expenses[card.id] || []).length === 0 && <li style={{ color: 'rgba(255,255,255,0.3)', justifyContent: 'center' }}>Sin gastos registrados</li>}
                    {(expenses[card.id] || []).map(exp => (
                      <li key={exp.id} className={exp.estado === 'pagado' ? 'pagado' : ''}>
                        <span className="cuota-fecha" style={{ flex: 1 }}>{exp.descripcion}</span>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginRight: 6 }}>{exp.fecha_compra}</span>
                        <span className="cuota-monto">{fmt(exp.monto)}</span>
                        {exp.estado !== 'pagado' ? (
                          <button className="cuota-pay-btn" onClick={() => handlePagarTarjeta(exp.id, card.id)}>✓ Pagar</button>
                        ) : (
                          <span className="cuota-paid-tag">Pagado ✓</span>
                        )}
                        <button className="del" style={{ width: 24, height: 24, borderRadius: 7, fontSize: 10 }} onClick={() => handleDeleteExp(exp.id, card.id)}>✕</button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ─── PÁGINA PRINCIPAL MÁS ─── */
export default function Mas() {
  const router = useRouter();
  const [session, setSession] = useState(undefined);
  const [activeTab, setActiveTab] = useState('gastos');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.push('/login'); return; }
      const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', data.session.user.id).single();
      if (profile?.role !== 'admin') { router.push('/'); return; }
      setIsAdmin(true);
      setSession(data.session);
    });
  }, [router]);

  if (!session || !isAdmin) return null;

  const email = session.user.email;
  const renderTab = () => {
    switch (activeTab) {
      case 'gastos': return <GastosFijos userId={session.user.id} userEmail={email} />;
      case 'cuotas': return <Cuotas userId={session.user.id} userEmail={email} />;
      case 'tarjetas': return <Tarjetas userId={session.user.id} userEmail={email} />;
      case 'cobros': return <Cobros userId={session.user.id} userEmail={email} />;
      case 'deudas': return <Deudas userId={session.user.id} userEmail={email} />;
      case 'metas': return <Metas userId={session.user.id} />;
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
            <span className="mas-tab-icon">{t.icon}</span>
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
