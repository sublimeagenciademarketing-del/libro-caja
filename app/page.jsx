'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

const fmt = (n) => '₲ ' + Math.round(Math.abs(n)).toLocaleString('es-PY');

function DonutChart({ sublime, personal }) {
  const total = Math.abs(sublime) + Math.abs(personal);
  if (total === 0) {
    return (
      <div className="donut-wrap">
        <svg width="160" height="160" viewBox="0 0 160 160">
          <circle cx="80" cy="80" r="60" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="18" />
          <text x="80" y="76" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="12" fontFamily="Inter,sans-serif">Sin datos</text>
        </svg>
      </div>
    );
  }
  const r = 60;
  const circ = 2 * Math.PI * r;
  const sRatio = Math.abs(sublime) / total;
  const sDash = sRatio * circ;
  const pDash = (1 - sRatio) * circ;

  return (
    <div className="donut-wrap">
      <svg width="160" height="160" viewBox="0 0 160 160" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="80" cy="80" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="18" />
        <circle
          cx="80" cy="80" r={r} fill="none"
          stroke="url(#blueGrad)" strokeWidth="18"
          strokeDasharray={`${sDash} ${circ - sDash}`}
          strokeLinecap="round"
        />
        <circle
          cx="80" cy="80" r={r} fill="none"
          stroke="url(#purpleGrad)" strokeWidth="18"
          strokeDasharray={`${pDash} ${circ - pDash}`}
          strokeDashoffset={-sDash}
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="blueGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#4facfe" />
            <stop offset="100%" stopColor="#00f2fe" />
          </linearGradient>
          <linearGradient id="purpleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#f472b6" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [session, setSession] = useState(undefined);
  const [transactions, setTransactions] = useState([]);
  const [filter, setFilter] = useState('todos');

  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState('');
  const [categoria, setCategoria] = useState('');
  const [tipo, setTipo] = useState('ingreso');
  const [cuenta, setCuenta] = useState('sublime');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.push('/login');
      else setSession(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!s) router.push('/login');
      setSession(s);
    });
    return () => listener.subscription.unsubscribe();
  }, [router]);

  const loadTransactions = useCallback(async () => {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('fecha', { ascending: false })
      .order('id', { ascending: false });
    if (!error && data) setTransactions(data);
  }, []);

  useEffect(() => {
    if (session) loadTransactions();
  }, [session, loadTransactions]);

  useEffect(() => {
    setFecha(new Date().toISOString().slice(0, 10));
  }, []);

  if (session === undefined) return null;

  async function handleAdd(e) {
    e.preventDefault();
    const montoNum = parseFloat(monto);
    if (!montoNum || montoNum <= 0 || !fecha || !categoria.trim()) return;
    const { error } = await supabase.from('transactions').insert({
      monto: montoNum, fecha, categoria: categoria.trim(), tipo, cuenta,
      user_id: session.user.id,
    });
    if (!error) { setMonto(''); setCategoria(''); loadTransactions(); }
  }

  async function handleDelete(id) {
    await supabase.from('transactions').delete().eq('id', id);
    loadTransactions();
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  const filtered = filter === 'todos' ? transactions : transactions.filter((t) => t.cuenta === filter);

  const sumFor = (c) =>
    transactions.filter((t) => t.cuenta === c)
      .reduce((acc, t) => acc + (t.tipo === 'ingreso' ? t.monto : -t.monto), 0);

  const totalSublime = sumFor('sublime');
  const totalPersonal = sumFor('personal');
  const totalGeneral = totalSublime + totalPersonal;

  const txIcon = (t) => {
    if (t.cuenta === 'sublime') return '💼';
    return '👤';
  };

  return (
    <div className="wrap">
      <div className="top-bar">
        <div>
          <h1>Libro de caja</h1>
          <p>Sublime &amp; Personal</p>
        </div>
        <button className="logout-btn" onClick={handleLogout}>Salir</button>
      </div>

      <div className="hero-balance">
        <div className="hero-label">Balance total</div>
        <div className={`hero-number${totalGeneral < 0 ? ' neg' : ''}`}>
          {totalGeneral < 0 ? '−' : ''}{fmt(totalGeneral)}
        </div>
      </div>

      <DonutChart sublime={totalSublime} personal={totalPersonal} />

      <div className="totals">
        <div className="cell sublime">
          <div className="label">Sublime</div>
          <div className={`amount${totalSublime < 0 ? ' neg' : ''}`}>
            {totalSublime < 0 ? '−' : '+'}{fmt(totalSublime)}
          </div>
        </div>
        <div className="cell personal">
          <div className="label">Personal</div>
          <div className={`amount${totalPersonal < 0 ? ' neg' : ''}`}>
            {totalPersonal < 0 ? '−' : '+'}{fmt(totalPersonal)}
          </div>
        </div>
      </div>

      <form className="entry" onSubmit={handleAdd}>
        <div className="entry-title">Nuevo movimiento</div>
        <div className="row">
          <div className="field" style={{ flex: 1.4 }}>
            <label>Monto (₲)</label>
            <input
              type="number" inputMode="numeric" className="num"
              value={monto} onChange={(e) => setMonto(e.target.value)}
              placeholder="0" required
            />
          </div>
          <div className="field">
            <label>Fecha</label>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
          </div>
        </div>
        <div className="row">
          <div className="field">
            <label>Tipo</label>
            <div className="toggle">
              <button type="button" className={tipo === 'ingreso' ? 'active ingreso' : ''} onClick={() => setTipo('ingreso')}>Ingreso</button>
              <button type="button" className={tipo === 'gasto' ? 'active gasto' : ''} onClick={() => setTipo('gasto')}>Gasto</button>
            </div>
          </div>
          <div className="field">
            <label>Cuenta</label>
            <div className="toggle">
              <button type="button" className={cuenta === 'sublime' ? 'active sublime' : ''} onClick={() => setCuenta('sublime')}>Sublime</button>
              <button type="button" className={cuenta === 'personal' ? 'active personal' : ''} onClick={() => setCuenta('personal')}>Personal</button>
            </div>
          </div>
        </div>
        <div className="row">
          <div className="field">
            <label>Categoría / descripción</label>
            <input
              type="text" value={categoria} onChange={(e) => setCategoria(e.target.value)}
              placeholder="Ej: pago cliente, alquiler, nafta..." required
            />
          </div>
        </div>
        <button className="add-btn" type="submit">+ Agregar movimiento</button>
      </form>

      <div className="filters">
        <button className={filter === 'todos' ? 'active' : ''} onClick={() => setFilter('todos')}>Todos</button>
        <button className={filter === 'sublime' ? 'active' : ''} onClick={() => setFilter('sublime')}>Sublime</button>
        <button className={filter === 'personal' ? 'active' : ''} onClick={() => setFilter('personal')}>Personal</button>
      </div>

      <p className="list-title">Movimientos</p>

      {filtered.length === 0 ? (
        <div className="empty">Todavía no hay movimientos cargados.</div>
      ) : (
        <ul className="ledger">
          {filtered.map((t) => (
            <li key={t.id}>
              <div className={`tx-icon ${t.cuenta}`}>{txIcon(t)}</div>
              <div className="meta">
                <div className="cat">{t.categoria}</div>
                <div className="sub">{t.fecha} · {t.cuenta === 'sublime' ? 'Sublime' : 'Personal'}</div>
              </div>
              <div className={`amt${t.tipo === 'ingreso' ? ' pos' : ' neg'}`}>
                {t.tipo === 'ingreso' ? '+' : '−'} {fmt(t.monto)}
              </div>
              <button className="del" onClick={() => handleDelete(t.id)} title="Eliminar">✕</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
