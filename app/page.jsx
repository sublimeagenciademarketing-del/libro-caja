'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

const fmt = (n) => '₲ ' + Math.round(Math.abs(n)).toLocaleString('es-PY');

function getUserConfig(email) {
  if (email === 'karendanielasanchezjabs@gmail.com') {
    return { c1: 'tienda', c2: 'personal', l1: 'Tienda', l2: 'Personal', single: false };
  }
  if (email === 'khelendaihanaj@gmail.com') {
    return { c1: 'personal', c2: null, l1: 'Personal', l2: null, single: true };
  }
  return { c1: 'sublime', c2: 'personal', l1: 'Sublime', l2: 'Personal', single: false };
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];


function DonutSmall({ a, b, idSuffix, colorA, colorB, colorA2, colorB2, size = 90 }) {
  const total = Math.abs(a) + Math.abs(b);
  const cx = size / 2, cy = size / 2;
  const r = size * 0.38, sw = size * 0.12;
  const circ = 2 * Math.PI * r;
  if (total === 0) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={sw} />
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.25)" fontSize={size * 0.1} fontFamily="Inter,sans-serif">—</text>
      </svg>
    );
  }
  const aRatio = Math.abs(a) / total;
  const aDash = aRatio * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={sw} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={`url(#grad-a-${idSuffix})`} strokeWidth={sw}
        strokeDasharray={`${aDash} ${circ - aDash}`} strokeLinecap="round" />
      {Math.abs(b) > 0 && (
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={`url(#grad-b-${idSuffix})`} strokeWidth={sw}
          strokeDasharray={`${circ - aDash} ${aDash}`} strokeDashoffset={-aDash} strokeLinecap="round" />
      )}
      <defs>
        <linearGradient id={`grad-a-${idSuffix}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={colorA} /><stop offset="100%" stopColor={colorA2 || colorA} />
        </linearGradient>
        <linearGradient id={`grad-b-${idSuffix}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={colorB} /><stop offset="100%" stopColor={colorB2 || colorB} />
        </linearGradient>
      </defs>
    </svg>
  );
}

function DonutDuo({ total1, total2, cfg, transactions, projection }) {
  const now = new Date();
  const m = now.getMonth() + 1;
  const mesStr = `${now.getFullYear()}-${String(m).padStart(2, '0')}`;
  const del_mes = transactions.filter(t => t.fecha && t.fecha.startsWith(mesStr));

  const ing1 = del_mes.filter(t => t.tipo === 'ingreso' && t.cuenta === cfg.c1).reduce((s, t) => s + t.monto, 0);
  const gas1 = del_mes.filter(t => t.tipo === 'gasto' && t.cuenta === cfg.c1).reduce((s, t) => s + t.monto, 0);
  const ing2 = del_mes.filter(t => t.tipo === 'ingreso' && t.cuenta === cfg.c2).reduce((s, t) => s + t.monto, 0);
  const gas2 = del_mes.filter(t => t.tipo === 'gasto' && t.cuenta === cfg.c2).reduce((s, t) => s + t.monto, 0);
  const ingTotal = del_mes.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + t.monto, 0);
  const gasTotal = del_mes.filter(t => t.tipo === 'gasto').reduce((s, t) => s + t.monto, 0);
  const bal1 = ing1 - gas1, bal2 = ing2 - gas2;
  const balanceActual = ingTotal - gasTotal;
  const mesNombre = MESES[m - 1];

  function calcProjCuenta(c, balActual) {
    if (!projection) return null;
    const inc = projection.cobros.filter(r => r.cuenta === c).reduce((s, r) => s + r.monto, 0);
    const exp = projection.deudas.filter(r => r.cuenta === c).reduce((s, r) => s + r.monto, 0)
      + projection.cuotas.filter(r => r.installment_purchases?.cuenta === c).reduce((s, r) => s + r.monto, 0)
      + projection.gastos.filter(r => r.cuenta === c).reduce((s, r) => s + r.monto, 0);
    return balActual + inc - exp;
  }
  const proj1 = calcProjCuenta(cfg.c1, bal1);
  const proj2 = cfg.single ? null : calcProjCuenta(cfg.c2, bal2);
  const projTotal = projection ? balanceActual
    + projection.cobros.reduce((s, r) => s + r.monto, 0)
    - projection.deudas.reduce((s, r) => s + r.monto, 0)
    - projection.cuotas.reduce((s, r) => s + r.monto, 0)
    - projection.gastos.reduce((s, r) => s + r.monto, 0) : null;
  const projPos = projTotal !== null && projTotal >= 0;

  if (cfg.single) {
    return (
      <div className="donut-duo">
        <div className="donut-col">
          <div className="donut-label-top">Total</div>
          <DonutSmall a={Math.abs(total1)} b={0} idSuffix="acc-s"
            colorA="#4facfe" colorA2="#00f2fe" colorB="#a78bfa" colorB2="#f472b6" />
          <div className="donut-legs">
            <span style={{ color: '#4facfe' }}>{cfg.l1}</span>
          </div>
        </div>
        <div className="donut-col">
          <div className="donut-label-top">Este mes</div>
          <DonutSmall a={ingTotal} b={gasTotal} idSuffix="mes-s"
            colorA="#4ade80" colorA2="#22d3ee" colorB="#f87171" colorB2="#fb923c" />
          <div className="donut-legs">
            <span style={{ color: '#4ade80' }}>Ing</span>
            <span style={{ color: '#f87171' }}>Gas</span>
          </div>
        </div>
        <div className={`donut-mes-bal${balanceActual >= 0 ? ' pos' : ' neg'}`}>
          {mesNombre}: {balanceActual >= 0 ? '+' : '−'}{fmt(Math.abs(balanceActual))}
        </div>
        {projTotal !== null && (
          <div className={`donut-proyeccion${projPos ? ' pos' : ' neg'}`}>
            Proyección {mesNombre}: {projPos ? '+' : '−'}{fmt(Math.abs(projTotal))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="donut-duo">
      <div className="donut-col">
        <div className="donut-label-top">Total</div>
        <DonutSmall a={Math.abs(total1)} b={Math.abs(total2)} idSuffix="acc"
          colorA="#4facfe" colorA2="#00f2fe" colorB="#a78bfa" colorB2="#f472b6" />
        <div className="donut-legs">
          <span style={{ color: '#4facfe' }}>{cfg.l1}</span>
          <span style={{ color: '#a78bfa' }}>{cfg.l2}</span>
        </div>
      </div>
      <div className="donut-col">
        <div className="donut-label-top">{cfg.l1}</div>
        <DonutSmall a={ing1} b={gas1} idSuffix="mes1"
          colorA="#4ade80" colorA2="#22d3ee" colorB="#f87171" colorB2="#fb923c" />
        <div className="donut-legs">
          <span style={{ color: '#4ade80' }}>Ing</span>
          <span style={{ color: '#f87171' }}>Gas</span>
        </div>
      </div>
      <div className="donut-col">
        <div className="donut-label-top">{cfg.l2}</div>
        <DonutSmall a={ing2} b={gas2} idSuffix="mes2"
          colorA="#4ade80" colorA2="#22d3ee" colorB="#f87171" colorB2="#fb923c" />
        <div className="donut-legs">
          <span style={{ color: '#4ade80' }}>Ing</span>
          <span style={{ color: '#f87171' }}>Gas</span>
        </div>
      </div>
      {proj1 !== null && (
        <div className="donut-cuentas-bal">
          <span className={proj1 >= 0 ? 'pos' : 'neg'}>
            {cfg.l1} proyección: {proj1 >= 0 ? '+' : '−'}{fmt(Math.abs(proj1))}
          </span>
          {proj2 !== null && (
            <span className={proj2 >= 0 ? 'pos' : 'neg'}>
              {cfg.l2} proyección: {proj2 >= 0 ? '+' : '−'}{fmt(Math.abs(proj2))}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [session, setSession] = useState(undefined);
  const [transactions, setTransactions] = useState([]);
  const [filter, setFilter] = useState('todos');
  const [cfg, setCfg] = useState({ c1: 'sublime', c2: 'personal', l1: 'Sublime', l2: 'Personal' });
  const [isAdmin, setIsAdmin] = useState(false);
  const [projection, setProjection] = useState(null);

  const [monto, setMonto] = useState('');
  const [montoDisplay, setMontoDisplay] = useState('');
  const [fecha, setFecha] = useState('');
  const [categoria, setCategoria] = useState('');
  const [tipo, setTipo] = useState('ingreso');
  const [cuenta, setCuenta] = useState('sublime');

  function handleMontoChange(e) {
    const raw = e.target.value.replace(/\D/g, '');
    setMonto(raw);
    setMontoDisplay(raw ? raw.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '');
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) router.push('/login');
      else {
        setSession(data.session);
        const c = getUserConfig(data.session.user.email);
        setCfg(c);
        setCuenta(c.c1);
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', data.session.user.id)
          .single();
        setIsAdmin(profile?.role === 'admin');
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!s) router.push('/login');
      else {
        setSession(s);
        const c = getUserConfig(s.user.email);
        setCfg(c);
        setCuenta(c.c1);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [router]);

  const loadProjection = useCallback(async (userId) => {
    const now = new Date();
    const y = now.getFullYear(), m = String(now.getMonth() + 1).padStart(2, '0');
    const mesStart = `${y}-${m}-01`, mesEnd = `${y}-${m}-31`;
    const [r1, r2, r3, r4] = await Promise.all([
      supabase.from('receivables').select('monto, cuenta').eq('user_id', userId).eq('pagado', false).gte('fecha_vencimiento', mesStart).lte('fecha_vencimiento', mesEnd),
      supabase.from('debts').select('monto, cuenta').eq('user_id', userId).eq('pagado', false).gte('fecha_vencimiento', mesStart).lte('fecha_vencimiento', mesEnd),
      supabase.from('installments').select('monto, installment_purchases!inner(user_id, cuenta)').eq('pagado', false).gte('fecha_vencimiento', mesStart).lte('fecha_vencimiento', mesEnd).eq('installment_purchases.user_id', userId),
      supabase.from('recurring_expenses').select('monto, cuenta').eq('user_id', userId).eq('pagado', false),
    ]);
    setProjection({
      cobros: r1.data || [],
      deudas: r2.data || [],
      cuotas: (r3.data || []).filter(r => r.installment_purchases),
      gastos: r4.data || [],
    });
  }, []);

  const loadTransactions = useCallback(async (userId) => {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('fecha', { ascending: false })
      .order('id', { ascending: false });
    if (!error && data) setTransactions(data);
  }, []);

  useEffect(() => {
    if (session) {
      loadTransactions(session.user.id);
      loadProjection(session.user.id);
    }
  }, [session, loadTransactions, loadProjection]);

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
    if (!error) { setMonto(''); setMontoDisplay(''); setCategoria(''); loadTransactions(session.user.id); }
  }

  async function handleDelete(id) {
    if (!window.confirm('¿Eliminar este movimiento?')) return;
    await supabase.from('transactions').delete().eq('id', id);
    loadTransactions(session.user.id);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  const filtered = filter === 'todos' ? transactions : transactions.filter((t) => t.cuenta === filter);

  const sumFor = (c) =>
    transactions.filter((t) => t.cuenta === c)
      .reduce((acc, t) => acc + (t.tipo === 'ingreso' ? t.monto : -t.monto), 0);

  const total1 = sumFor(cfg.c1);
  const total2 = cfg.single ? 0 : sumFor(cfg.c2);
  const totalGeneral = total1 + total2;

  const txIcon = () => '👤';

  return (
    <div className="wrap">
      <div className="top-bar">
        <div>
          <h1>Libro de caja</h1>
          <p>{cfg.single ? cfg.l1 : `${cfg.l1} & ${cfg.l2}`}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {isAdmin && (
            <button className="mas-btn" onClick={() => router.push('/mas')}>☰ Más</button>
          )}
          <button className="logout-btn" onClick={handleLogout}>Salir</button>
        </div>
      </div>

      <div className="hero-balance">
        <div className="hero-label">Balance total</div>
        <div className={`hero-number${totalGeneral < 0 ? ' neg' : ''}`}>
          {totalGeneral < 0 ? '−' : ''}{fmt(totalGeneral)}
        </div>
      </div>

      <DonutDuo total1={total1} total2={total2} cfg={cfg} transactions={transactions} projection={projection} />

      <div className="totals" style={cfg.single ? { gridTemplateColumns: '1fr' } : {}}>
        <div className="cell sublime">
          <div className="label">{cfg.l1}</div>
          <div className={`amount${total1 < 0 ? ' neg' : ''}`}>
            {total1 < 0 ? '−' : '+'}{fmt(total1)}
          </div>
        </div>
        {!cfg.single && (
          <div className="cell personal">
            <div className="label">{cfg.l2}</div>
            <div className={`amount${total2 < 0 ? ' neg' : ''}`}>
              {total2 < 0 ? '−' : '+'}{fmt(total2)}
            </div>
          </div>
        )}
      </div>

      <form className="entry" onSubmit={handleAdd}>
        <div className="entry-title">Nuevo movimiento</div>
        <div className="row">
          <div className="field" style={{ flex: 1.4 }}>
            <label>Monto (₲)</label>
            <input type="text" inputMode="numeric" className="num"
              value={montoDisplay} onChange={handleMontoChange}
              placeholder="0" required />
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
          {!cfg.single && (
            <div className="field">
              <label>Cuenta</label>
              <div className="toggle">
                <button type="button" className={cuenta === cfg.c1 ? 'active sublime' : ''} onClick={() => setCuenta(cfg.c1)}>{cfg.l1}</button>
                <button type="button" className={cuenta === cfg.c2 ? 'active personal' : ''} onClick={() => setCuenta(cfg.c2)}>{cfg.l2}</button>
              </div>
            </div>
          )}
        </div>
        <div className="row">
          <div className="field">
            <label>Categoría / descripción</label>
            <input type="text" value={categoria} onChange={(e) => setCategoria(e.target.value)}
              placeholder="Ej: venta, gasto tienda, nafta..." required />
          </div>
        </div>
        <button className="add-btn" type="submit">+ Agregar movimiento</button>
      </form>

      {!cfg.single && (
        <div className="filters">
          <button className={filter === 'todos' ? 'active' : ''} onClick={() => setFilter('todos')}>Todos</button>
          <button className={filter === cfg.c1 ? 'active' : ''} onClick={() => setFilter(cfg.c1)}>{cfg.l1}</button>
          <button className={filter === cfg.c2 ? 'active' : ''} onClick={() => setFilter(cfg.c2)}>{cfg.l2}</button>
        </div>
      )}

      <p className="list-title">Movimientos</p>

      {filtered.length === 0 ? (
        <div className="empty">Todavía no hay movimientos cargados.</div>
      ) : (
        <ul className="ledger">
          {filtered.map((t) => (
            <li key={t.id}>
              <div className={`tx-icon ${t.cuenta === cfg.c1 ? 'sublime' : 'personal'}`}>{txIcon(t)}</div>
              <div className="meta">
                <div className="cat">{t.categoria}</div>
                <div className="sub">{t.fecha} · {t.cuenta === cfg.c1 ? cfg.l1 : cfg.l2}</div>
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
