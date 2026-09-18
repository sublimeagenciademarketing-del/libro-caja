'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { DIAS_PRUEBA } from '../../lib/config';
import { hoyISO } from '../../lib/recurrencia';

const ADMIN_EMAIL = 'sublimeagenciademarketing@gmail.com';
const fmt = (s) => s ? new Date(s).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

// Días entre una fecha (ISO o timestamp) y hoy, en días calendario.
const diasDesde = (s) => {
  if (!s) return null;
  const d = new Date(String(s).length === 10 ? s + 'T12:00:00' : s); d.setHours(0, 0, 0, 0);
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  return Math.round((hoy - d) / 86400000);
};
const hace = (s) => { const n = diasDesde(s); return n === null ? '—' : n <= 0 ? 'hoy' : n === 1 ? 'ayer' : n < 60 ? `hace ${n} días` : fmt(s); };

// Actividad por último movimiento cargado: activo (≤7 días), sin actividad (8–30), inactivo (+30), nunca cargó.
const ACTIVIDAD = {
  activo:  { label: 'En uso',        color: '#34d399' },
  quieto:  { label: 'Sin actividad', color: '#fbbf24' },
  inactivo:{ label: 'Inactivo',      color: 'rgba(255,255,255,0.45)' },
  nunca:   { label: 'Nunca cargó',   color: '#f87171' },
};
const clasificar = (a) => {
  if (!a || !a.movimientos) return 'nunca';
  const n = diasDesde(a.ultimo_movimiento);
  return n <= 7 ? 'activo' : n <= 30 ? 'quieto' : 'inactivo';
};

function Badge({ status }) {
  const map = {
    active:       { label: 'Activa',       bg: 'rgba(52,211,153,0.15)',  color: '#34d399', border: 'rgba(52,211,153,0.3)' },
    expiring:     { label: 'Por vencer',   bg: 'rgba(251,191,36,0.15)',  color: '#fbbf24', border: 'rgba(251,191,36,0.3)' },
    blocked:      { label: 'Vencida',      bg: 'rgba(248,113,113,0.15)', color: '#f87171', border: 'rgba(248,113,113,0.3)' },
    demo:         { label: 'Demo',         bg: 'rgba(165,180,252,0.15)', color: '#a5b4fc', border: 'rgba(165,180,252,0.3)' },
    solo_lectura: { label: 'Solo lectura', bg: 'rgba(251,191,36,0.15)',  color: '#fbbf24', border: 'rgba(251,191,36,0.3)' },
  };
  const s = map[status] || map.demo;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: s.bg, color: s.color, border: `1px solid ${s.border}`, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // { user, fechaVenc, activo }
  const [saving, setSaving] = useState(false);
  const [successId, setSuccessId] = useState(null);
  const [filterCard, setFilterCard] = useState('total');
  const [actividad, setActividad] = useState({});
  const [filtroAct, setFiltroAct] = useState('todos');
  const [copiado, setCopiado] = useState(false);
  const [pushInfo, setPushInfo] = useState({ dispositivos: null, mensaje: '', enviando: false });

  // Cuántos dispositivos del admin reciben avisos push
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      const { count } = await supabase.from('push_subscriptions').select('id', { count: 'exact', head: true }).eq('user_id', data.session.user.id);
      setPushInfo(p => ({ ...p, dispositivos: count || 0 }));
    });
  }, []);

  // Actividad de cada usuario (fechas y cantidades, nunca contenido).
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      const r = await fetch('/api/admin/actividad', { headers: { Authorization: `Bearer ${data.session.access_token}` } }).then(x => x.json()).catch(() => ({}));
      if (r?.actividad) setActividad(r.actividad);
    });
  }, []);

  async function copiarEmails(lista) {
    try {
      await navigator.clipboard.writeText(lista.map(u => u.email).join(', '));
      setCopiado(true); setTimeout(() => setCopiado(false), 2000);
    } catch { alert(lista.map(u => u.email).join(', ')); }
  }

  async function enviarPushPrueba() {
    setPushInfo(p => ({ ...p, enviando: true, mensaje: '' }));
    const { data } = await supabase.auth.getSession();
    const r = await fetch('/api/push/prueba', { method: 'POST', headers: { Authorization: `Bearer ${data.session.access_token}` } }).then(x => x.json()).catch(e => ({ error: e.message }));
    setPushInfo(p => ({ ...p, enviando: false, mensaje: r.error ? `Error: ${r.error}` : `Enviado a ${r.enviados} de ${r.dispositivos} dispositivo(s)${r.fallidos ? ` · ${r.fallidos} falló` : ''}` }));
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session || data.session.user.email !== ADMIN_EMAIL) {
        router.push('/');
        return;
      }
      await loadUsers(true);
      setLoading(false);
    });
  }, [router]);

  async function loadUsers(markVisit = false) {
    if (markVisit) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) await supabase.from('user_config').update({ admin_last_visit: new Date().toISOString() }).eq('user_id', session.user.id);
    }
    const [{ data: configs }, { data: lics }] = await Promise.all([
      supabase.from('user_config').select('user_id, email, plan, cuenta1, cuenta2, fecha_registro').order('fecha_registro', { ascending: false }),
      supabase.from('licencias').select('email, activo, solo_lectura, fecha_vencimiento'),
    ]);

    const today = new Date(); today.setHours(0,0,0,0);
    const licMap = {};
    (lics || []).forEach(l => { licMap[l.email] = l; });

    const rows = (configs || []).map(uc => {
      const lic = licMap[uc.email];
      const regDate = new Date(uc.fecha_registro || today); regDate.setHours(0,0,0,0);
      const diasDemo = DIAS_PRUEBA - Math.ceil((today - regDate) / 86400000);

      let status, diasRestantes = null, fechaVenc = null;
      if (uc.email === ADMIN_EMAIL) {
        status = 'active';
      } else if (lic && lic.activo && lic.solo_lectura) {
        status = 'solo_lectura';
        fechaVenc = lic.fecha_vencimiento;
      } else if (lic && lic.activo) {
        const vence = new Date(lic.fecha_vencimiento); vence.setHours(0,0,0,0);
        const dias = Math.ceil((vence - today) / 86400000);
        fechaVenc = lic.fecha_vencimiento;
        if (dias < 0) { status = 'blocked'; diasRestantes = 0; }
        else if (dias <= 14) { status = 'expiring'; diasRestantes = dias; }
        else { status = 'active'; diasRestantes = dias; }
      } else {
        status = diasDemo <= 0 ? 'blocked' : 'demo';
        diasRestantes = Math.max(0, diasDemo);
      }

      return { ...uc, lic, status, diasRestantes, fechaVenc };
    });

    setUsers(rows);
  }

  async function handleDeleteUser() {
    if (!modal) return;
    if (!window.confirm(`¿Eliminar a ${modal.user.email} del sistema? Esta acción no se puede deshacer.`)) return;
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.from('licencias').delete().eq('email', modal.user.email);
    await supabase.from('user_config').delete().eq('user_id', modal.user.user_id);
    try {
      const res = await fetch('/api/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: modal.user.user_id, requesterEmail: session?.user?.email }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        alert(`Error al eliminar de Auth: ${json.error || res.status}`);
      }
    } catch (e) {
      alert(`Error de red: ${e.message}`);
    }
    setModal(null);
    setSaving(false);
    await loadUsers();
  }

  async function handleSaveLic() {
    if (!modal) return;
    setSaving(true);
    const { user, fechaVenc, activo, soloLectura } = modal;
    await supabase.from('licencias').upsert({
      email: user.email,
      activo,
      solo_lectura: soloLectura ?? false,
      fecha_inicio: user.lic?.fecha_inicio || hoyISO(),
      fecha_vencimiento: fechaVenc,
    }, { onConflict: 'email' });
    setSuccessId(user.email);
    setTimeout(() => setSuccessId(null), 3000);
    setModal(null);
    setSaving(false);
    await loadUsers();
  }

  const filtered = users.filter(u => {
    const matchSearch = u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.cuenta1 || '').toLowerCase().includes(search.toLowerCase());
    const matchCard =
      filterCard === 'total' ? true :
      filterCard === 'active' ? (u.status === 'active' || u.status === 'expiring') :
      filterCard === 'solo_lectura' ? u.status === 'solo_lectura' :
      filterCard === 'demo' ? (u.status === 'demo' || u.status === 'blocked') : true;
    const matchAct = filtroAct === 'todos' || clasificar(actividad[u.user_id]) === filtroAct;
    return matchSearch && matchCard && matchAct;
  });
  const conteoAct = Object.fromEntries(Object.keys(ACTIVIDAD).map(k => [k, users.filter(u => clasificar(actividad[u.user_id]) === k).length]));

  const counts = {
    total: users.length,
    active: users.filter(u => u.status === 'active' || u.status === 'expiring').length,
    solo_lectura: users.filter(u => u.status === 'solo_lectura').length,
    demo: users.filter(u => u.status === 'demo' || u.status === 'blocked').length,
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a' }}>
      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Cargando...</div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', padding: '20px 16px 40px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>MiCaja</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>Panel Admin</div>
        </div>
        <button onClick={() => router.push('/')} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 14px', color: 'rgba(255,255,255,0.6)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
          ← Volver
        </button>
      </div>

      {/* Avisos push del admin */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 12, padding: '10px 14px', marginBottom: 16 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Avisos en el teléfono</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
            {pushInfo.dispositivos === null ? '…' : pushInfo.dispositivos === 0 ? 'Ningún dispositivo suscripto todavía. Abrí el app en el iPhone con el permiso dado.' : `${pushInfo.dispositivos} dispositivo(s) suscripto(s)`}
            {pushInfo.mensaje && <div style={{ color: '#a5b4fc', marginTop: 2 }}>{pushInfo.mensaje}</div>}
          </div>
        </div>
        <button onClick={enviarPushPrueba} disabled={pushInfo.enviando || !pushInfo.dispositivos} style={{ flexShrink: 0, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: 10, padding: '8px 12px', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: pushInfo.enviando || !pushInfo.dispositivos ? 0.5 : 1 }}>
          {pushInfo.enviando ? 'Enviando…' : 'Probar aviso'}
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { key: 'total',        label: 'Total',           value: counts.total,        color: '#a5b4fc' },
          { key: 'active',       label: 'Activas',         value: counts.active,       color: '#34d399' },
          { key: 'solo_lectura', label: 'Solo lectura',    value: counts.solo_lectura, color: '#fbbf24' },
          { key: 'demo',         label: 'Demo / Vencidas', value: counts.demo,         color: '#f87171' },
        ].map(s => {
          const active = filterCard === s.key;
          return (
            <button key={s.key} onClick={() => setFilterCard(active ? 'total' : s.key)}
              style={{ background: active ? `${s.color}18` : 'rgba(255,255,255,0.05)', border: `1px solid ${active ? s.color : 'rgba(255,255,255,0.08)'}`, borderRadius: 14, padding: '12px 14px', textAlign: 'center', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: active ? s.color : 'rgba(255,255,255,0.4)', marginTop: 2, fontWeight: active ? 700 : 400 }}>{s.label}</div>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Buscar por email o nombre de cuenta..."
        style={{ width: '100%', padding: '11px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 14, outline: 'none' }}
      />

      {/* Actividad: filtros y copiar emails */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        {/* Los filtros van en una sola línea que se desliza en el teléfono */}
        <div className="chips-scroll" style={{ display: 'flex', gap: 6, flex: 1, minWidth: 0, overflowX: 'auto', paddingBottom: 2 }}>
        {[['todos', 'Todos', 'rgba(255,255,255,0.6)'], ...Object.entries(ACTIVIDAD).map(([k, v]) => [k, `${v.label} ${conteoAct[k] || 0}`, v.color])].map(([k, label, color]) => {
          const on = filtroAct === k;
          return (
            <button key={k} type="button" onClick={() => setFiltroAct(k)}
              style={{ padding: '5px 10px', borderRadius: 20, border: `1px solid ${on ? color : 'rgba(255,255,255,0.1)'}`, background: on ? `${color.startsWith('#') ? color + '22' : 'rgba(255,255,255,0.1)'}` : 'transparent', color: on ? color : 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              {label}
            </button>
          );
        })}
        </div>
        <button type="button" onClick={() => copiarEmails(filtered)} disabled={!filtered.length}
          style={{ flexShrink: 0, padding: '5px 10px', borderRadius: 20, border: '1px solid rgba(165,180,252,0.35)', background: 'rgba(99,102,241,0.12)', color: copiado ? '#34d399' : '#a5b4fc', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
          {copiado ? '✓ Copiados' : `Copiar (${filtered.length})`}
        </button>
      </div>

      {/* User list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(u => (
          <div key={u.user_id} style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${successId === u.email ? 'rgba(52,211,153,0.4)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 16, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 3 }}>
                  {u.plan === 'negocio' ? `${u.cuenta1} & ${u.cuenta2}` : u.cuenta1} · Registro: {fmt(u.fecha_registro)}
                </div>
              </div>
              <Badge status={u.status} />
            </div>

            {(() => {
              const a = actividad[u.user_id];
              const k = clasificar(a);
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 8, flexWrap: 'wrap' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: ACTIVIDAD[k].color, flexShrink: 0 }} />
                  <span style={{ color: ACTIVIDAD[k].color, fontWeight: 700 }}>{ACTIVIDAD[k].label}</span>
                  <span>· {a?.movimientos ? `último movimiento ${hace(a.ultimo_movimiento)} · ${a.movimientos} en total` : 'sin movimientos'}</span>
                  <span>· abrió el app: {a?.ultima_apertura ? hace(a.ultima_apertura) : '—'}</span>
                </div>
              );
            })()}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
              <span>
                {u.status === 'active' && u.fechaVenc ? `Vence: ${fmt(u.fechaVenc)}` :
                 u.status === 'expiring' ? `Vence en ${u.diasRestantes} días` :
                 u.status === 'demo' ? `Demo: ${u.diasRestantes} días restantes` :
                 u.status === 'blocked' && !u.fechaVenc ? 'Demo vencido' :
                 u.status === 'blocked' ? `Licencia vencida` : ''}
              </span>
              {u.email !== ADMIN_EMAIL && (
                <button
                  onClick={() => setModal({ user: u, fechaVenc: u.fechaVenc || new Date(Date.now() + 365*24*60*60*1000).toISOString().slice(0,10), activo: u.lic?.activo ?? true, soloLectura: u.lic?.solo_lectura ?? false })}
                  style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: 8, padding: '6px 14px', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Gestionar
                </button>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: 13, padding: '30px 0' }}>Sin resultados</div>
        )}
      </div>

      {/* Modal gestionar licencia */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#0f1f35', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 22, padding: 24, width: '100%', maxWidth: 360 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 4 }}>Gestionar licencia</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 20, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{modal.user.email}</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Fecha de vencimiento</label>
                <input
                  type="date"
                  value={modal.fechaVenc}
                  onChange={e => setModal(m => ({ ...m, fechaVenc: e.target.value }))}
                  style={{ width: '100%', marginTop: 6, padding: '11px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>Estado</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[
                    { id: 'activa', label: 'Activa', color: '#34d399' },
                    { id: 'solo_lectura', label: 'Solo lectura', color: '#fbbf24' },
                    { id: 'revocada', label: 'Revocar licencia', color: '#f87171' },
                  ].map(opt => {
                    const selected =
                      opt.id === 'activa' ? (modal.activo && !modal.soloLectura) :
                      opt.id === 'solo_lectura' ? modal.soloLectura :
                      (!modal.activo && !modal.soloLectura);
                    return (
                      <button key={opt.id} onClick={() => {
                        if (opt.id === 'activa') setModal(m => ({ ...m, activo: true, soloLectura: false }));
                        else if (opt.id === 'solo_lectura') setModal(m => ({ ...m, activo: true, soloLectura: true }));
                        else setModal(m => ({ ...m, activo: false, soloLectura: false }));
                      }}
                        style={{ flex: 1, padding: '10px 6px', borderRadius: 12, border: `1px solid ${selected ? opt.color : 'rgba(255,255,255,0.1)'}`, background: selected ? `${opt.color}20` : 'transparent', color: selected ? opt.color : 'rgba(255,255,255,0.4)', fontFamily: 'inherit', cursor: 'pointer', fontSize: 11, fontWeight: 700, lineHeight: 1.3 }}>
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setModal(null)} style={{ flex: 1, padding: '13px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.4)', fontFamily: 'inherit', cursor: 'pointer', fontSize: 13 }}>
                Cancelar
              </button>
              <button onClick={handleSaveLic} disabled={saving}
                style={{ flex: 2, padding: '13px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontFamily: 'inherit', cursor: 'pointer', fontWeight: 700, fontSize: 13, opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Guardando...' : 'Guardar licencia'}
              </button>
            </div>
            <button onClick={handleDeleteUser} disabled={saving}
              style={{ width: '100%', marginTop: 10, padding: '11px', borderRadius: 12, border: '1px solid rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.08)', color: '#f87171', fontFamily: 'inherit', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              Eliminar usuario
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
