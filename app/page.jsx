'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';
import { DIAS_PRUEBA } from '../lib/config';

const fmt = (n) => '₲ ' + Math.round(Math.abs(n)).toLocaleString('es-PY');
const fmtFecha = (s) => { if (!s) return ''; const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };

const TIPO_ICON = { cobro: '📥', deuda: '📤', cuota: '🗓️', gasto: '🔄' };
const TIPO_LABEL = { cobro: 'Cobro', deuda: 'Deuda', cuota: 'Cuota', gasto: 'Gasto fijo' };

function NotifItem({ n, cfg }) {
  const cuentaLabel = n.cuenta === cfg?.c1 ? cfg?.l1 : (n.cuenta === cfg?.c2 ? cfg?.l2 : n.cuenta);
  const esIngreso = n.tipo === 'cobro';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, marginBottom: 6 }}>
      <span style={{ fontSize: 20, flexShrink: 0 }}>{TIPO_ICON[n.tipo]}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.label}</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{TIPO_LABEL[n.tipo]} · {fmtFecha(n.fecha)} · {cuentaLabel}</div>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: esIngreso ? '#34d399' : '#f87171', whiteSpace: 'nowrap', flexShrink: 0 }}>
        {esIngreso ? '+' : '−'}{fmt(n.monto)}
      </div>
    </div>
  );
}

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

function DonutDuo({ total1, total2, cfg, transactions, projection, rawData }) {
  const now = new Date();
  const m = now.getMonth() + 1;
  const mesStr = `${now.getFullYear()}-${String(m).padStart(2, '0')}`;
  const del_mes = transactions.filter(t => t.fecha && t.fecha.startsWith(mesStr));

  // Con una sola cuenta todo pertenece a esa cuenta, aunque el registro
  // guarde un nombre viejo de antes de renombrarla.
  const deCuenta = (valor, c) => cfg.single || mismaCuenta(valor, c);

  const ing1 = del_mes.filter(t => t.tipo === 'ingreso' && deCuenta(t.cuenta, cfg.c1)).reduce((s, t) => s + t.monto, 0);
  const gas1 = del_mes.filter(t => t.tipo === 'gasto' && deCuenta(t.cuenta, cfg.c1)).reduce((s, t) => s + t.monto, 0);
  const ing2 = del_mes.filter(t => t.tipo === 'ingreso' && mismaCuenta(t.cuenta, cfg.c2)).reduce((s, t) => s + t.monto, 0);
  const gas2 = del_mes.filter(t => t.tipo === 'gasto' && mismaCuenta(t.cuenta, cfg.c2)).reduce((s, t) => s + t.monto, 0);
  const ingTotal = del_mes.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + t.monto, 0);
  const gasTotal = del_mes.filter(t => t.tipo === 'gasto').reduce((s, t) => s + t.monto, 0);
  const bal1 = ing1 - gas1, bal2 = ing2 - gas2;
  const balanceActual = ingTotal - gasTotal;
  const mesNombre = MESES[m - 1];

  function calcProjCuenta(c, balActual) {
    if (!projection) return null;
    const inc = projection.cobros.filter(r => deCuenta(r.cuenta, c)).reduce((s, r) => s + (r.monto || 0), 0);
    const exp = projection.deudas.filter(r => deCuenta(r.cuenta, c)).reduce((s, r) => s + ((r.monto_total || 0) - (r.monto_pagado || 0)), 0)
      + projection.cuotas.filter(r => deCuenta(r.installment_purchases?.cuenta, c)).reduce((s, r) => s + (r.monto || 0), 0)
      + projection.gastos.filter(r => deCuenta(r.cuenta, c)).reduce((s, r) => s + (r.monto || 0), 0)
      + (projection.tarjetas || []).filter(r => deCuenta(r.cuenta, c)).reduce((s, r) => s + (r.monto || 0), 0);
    return { inc, exp, result: balActual + inc - exp };
  }
  const proj1 = calcProjCuenta(cfg.c1, bal1);
  const proj2 = cfg.single ? null : calcProjCuenta(cfg.c2, bal2);
  const projTotal = projection ? balanceActual
    + projection.cobros.reduce((s, r) => s + (r.monto || 0), 0)
    - projection.deudas.reduce((s, r) => s + ((r.monto_total || 0) - (r.monto_pagado || 0)), 0)
    - projection.cuotas.reduce((s, r) => s + (r.monto || 0), 0)
    - projection.gastos.reduce((s, r) => s + (r.monto || 0), 0)
    - (projection.tarjetas || []).reduce((s, r) => s + (r.monto || 0), 0) : null;
  const projPos = projTotal !== null && projTotal >= 0;

  const projScrollRef = useRef(null);
  const [projShowHint, setProjShowHint] = useState(true);

  function calcFuturoCuenta(c, mo) {
    if (!rawData) return { inc: 0, exp: 0, result: 0 };
    const { mesStr, mesStart, mesEnd, i } = mo;
    const inc = rawData.cobros.filter(r => deCuenta(r.cuenta, c) && r.fecha_esperada >= mesStart && r.fecha_esperada <= mesEnd).reduce((s, r) => s + (r.monto || 0), 0);
    const now2 = new Date();
    const mesGastos = rawData.gastos.filter(g => {
      if (!deCuenta(g.cuenta, c)) return false;
      if (i === 0) {
        if (g.frecuencia === 'semanal') {
          if (!g.pagado_fecha) return true;
          return Math.floor((now2 - new Date(g.pagado_fecha + 'T12:00:00')) / 86400000) >= 7;
        }
        if (g.frecuencia === 'quincenal') {
          if (!g.pagado_fecha) return true;
          return Math.floor((now2 - new Date(g.pagado_fecha + 'T12:00:00')) / 86400000) >= 15;
        }
        return g.pagado_mes !== mesStr;
      }
      return true;
    });
    const exp = rawData.deudas.filter(r => deCuenta(r.cuenta, c) && r.fecha_limite >= mesStart && r.fecha_limite <= mesEnd).reduce((s, r) => s + ((r.monto_total || 0) - (r.monto_pagado || 0)), 0)
      + rawData.cuotas.filter(r => deCuenta(r.installment_purchases?.cuenta, c) && r.fecha_vencimiento >= mesStart && r.fecha_vencimiento <= mesEnd).reduce((s, r) => s + (r.monto || 0), 0)
      + mesGastos.reduce((s, r) => s + (r.monto || 0), 0)
      + rawData.tarjetas.filter(r => deCuenta(r.cuenta, c) && r.fecha >= mesStart && r.fecha <= mesEnd).reduce((s, r) => s + (r.monto || 0), 0);
    return { inc, exp, result: inc - exp };
  }

  if (cfg.single) {
    return (
      <div className="donut-duo">
        <div className="donut-col" style={{ margin: '0 auto' }}>
          <DonutSmall a={ingTotal} b={gasTotal} idSuffix="mes-s" size={110}
            colorA="#4ade80" colorB="#f87171" />
          <div className="donut-legs">
            <span style={{ color: '#4ade80' }}>Ingresos</span>
            <span style={{ color: '#f87171' }}>Gastos</span>
          </div>
        </div>
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'center' }}>Este mes</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 12, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Ingresos</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#4ade80' }}>+{fmt(ingTotal)}</span>
            </div>
            <div style={{ flex: 1, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 12, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Gastos</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#f87171' }}>−{fmt(gasTotal)}</span>
            </div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>En caja · {mesNombre}</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: balanceActual >= 0 ? '#34d399' : '#f87171' }}>
              {balanceActual >= 0 ? '+' : '−'}{fmt(Math.abs(balanceActual))}
            </span>
          </div>
        </div>
        {(proj1 !== null || rawData) && (
          <div style={{ width: '100%', margin: '4px 0 8px' }}>
            <div
              ref={projScrollRef}
              onScroll={() => { if (projScrollRef.current?.scrollLeft > 10) setProjShowHint(false); }}
              style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {(rawData?.months || [{ i: 0, mesStr, nombre: mesNombre, añoDistinto: false }]).map((mo, idx) => {
                const p = idx === 0 && proj1 ? proj1 : calcFuturoCuenta(cfg.c1, mo);
                return (
                  <div key={mo.mesStr || idx} style={{ width: '100%', flexShrink: 0, scrollSnapAlign: 'start' }}>
                    <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'center', marginBottom: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        Proyección {mo.nombre}{mo.añoDistinto ? ` ${mo.año}` : ''}
                        {idx === 0 && projShowHint && rawData && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 400, animation: 'pulse 1.5s infinite' }}>deslizá →</span>}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Por cobrar</span>
                        <span style={{ fontSize: 12, color: '#34d399', fontWeight: 700 }}>+{fmt(p.inc)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Por pagar</span>
                        <span style={{ fontSize: 12, color: '#f87171', fontWeight: 700 }}>−{fmt(p.exp)}</span>
                      </div>
                      <div style={{ height: 1, background: 'rgba(255,255,255,0.08)' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>Resultado esperado</span>
                        <span style={{ fontSize: 13, color: p.result >= 0 ? '#34d399' : '#f87171', fontWeight: 800 }}>{p.result >= 0 ? '+' : '−'}{fmt(Math.abs(p.result))}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
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
          colorA="#4ade80" colorB="#f87171" />
        <div className="donut-legs">
          <span style={{ color: '#4ade80' }}>Ingresos</span>
          <span style={{ color: '#f87171' }}>Gastos</span>
        </div>
      </div>
      <div className="donut-col">
        <div className="donut-label-top">{cfg.l2}</div>
        <DonutSmall a={ing2} b={gas2} idSuffix="mes2"
          colorA="#4ade80" colorB="#f87171" />
        <div className="donut-legs">
          <span style={{ color: '#4ade80' }}>Ingresos</span>
          <span style={{ color: '#f87171' }}>Gastos</span>
        </div>
      </div>
      <div style={{ width: '100%', margin: '4px 0 8px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6, textAlign: 'center' }}>Este mes</div>
        <div style={{ display: 'flex', gap: 8 }}>
        {[{ label: cfg.l1, ing: ing1, gas: gas1 }, { label: cfg.l2, ing: ing2, gas: gas2 }].map(({ label, ing, gas }) => (
          <div key={label} style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{label}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Ingresos</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#4ade80' }}>+{fmt(ing)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Gastos</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#f87171' }}>−{fmt(gas)}</span>
            </div>
          </div>
        ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {[{ label: cfg.l1, bal: bal1 }, { label: cfg.l2, bal: bal2 }].map(({ label, bal }) => (
            <div key={label} style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>En caja · {mesNombre}</span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{label}</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: bal >= 0 ? '#34d399' : '#f87171' }}>
                {bal >= 0 ? '+' : '−'}{fmt(Math.abs(bal))}
              </span>
            </div>
          ))}
        </div>
      </div>
      {(proj1 !== null || rawData) && (
        <div style={{ width: '100%', margin: '4px 0 8px' }}>
          <div
            ref={projScrollRef}
            onScroll={() => { if (projScrollRef.current?.scrollLeft > 10) setProjShowHint(false); }}
            style={{ display: 'flex', width: '100%', overflowX: 'auto', scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {(rawData?.months || [{ i: 0, mesStr, nombre: mesNombre, añoDistinto: false }]).map((mo, idx) => {
              const p1 = idx === 0 && proj1 ? proj1 : calcFuturoCuenta(cfg.c1, mo);
              const p2 = cfg.single ? null : (idx === 0 && proj2 ? proj2 : calcFuturoCuenta(cfg.c2, mo));
              return (
                <div key={mo.mesStr || idx} style={{ width: '100%', flexShrink: 0, scrollSnapAlign: 'start' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'center', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    Proyección {mo.nombre}{mo.añoDistinto ? ` ${mo.año}` : ''}
                    {idx === 0 && projShowHint && rawData && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 400, animation: 'pulse 1.5s infinite' }}>deslizá →</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {[{ label: cfg.l1, p: p1 }, ...(p2 !== null ? [{ label: cfg.l2, p: p2 }] : [])].map(({ label, p }) => (
                      <div key={label} style={{ flex: 1, minWidth: 0, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Por cobrar</span>
                          <span style={{ fontSize: 11, color: '#34d399', fontWeight: 700, textAlign: 'right' }}>+{fmt(p.inc)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Por pagar</span>
                          <span style={{ fontSize: 11, color: '#f87171', fontWeight: 700, textAlign: 'right' }}>−{fmt(p.exp)}</span>
                        </div>
                        <div style={{ height: 1, background: 'rgba(255,255,255,0.08)' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>Resultado esperado</span>
                          <span style={{ fontSize: 12, color: p.result >= 0 ? '#34d399' : '#f87171', fontWeight: 800, textAlign: 'right', whiteSpace: 'nowrap', flexShrink: 0 }}>{p.result >= 0 ? '+' : '−'}{fmt(Math.abs(p.result))}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}


const ADMIN_EMAIL = 'sublimeagenciademarketing@gmail.com';
const WA_NUMBER = '595986313704';

function buildCfgFromDB(uc) {
  const c1 = uc.cuenta1.toLowerCase();
  const c2 = uc.cuenta2 ? uc.cuenta2.toLowerCase() : null;
  return { c1, c2, l1: uc.cuenta1, l2: uc.cuenta2 || null, single: !uc.cuenta2 };
}

const mismaCuenta = (a, b) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();
const claveNotif = (n) => `${n.tipo}|${n.label}|${n.fecha}`;

function shortLabel(v, max = 18) {
  if (!v) return '';
  const s = String(v).includes('@') ? String(v).split('@')[0] : String(v);
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

export default function Home() {
  const router = useRouter();
  const [session, setSession] = useState(undefined);
  const [transactions, setTransactions] = useState([]);
  const [filter, setFilter] = useState('todos');
  const [mesFiltro, setMesFiltro] = useState(new Date().getMonth());
  const [cfg, setCfg] = useState({ c1: 'sublime', c2: 'personal', l1: 'Sublime', l2: 'Personal' });
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminBadge, setAdminBadge] = useState(0);
  const [projection, setProjection] = useState(null);
  const [futureRawData, setFutureRawData] = useState(null);
  const [notifs, setNotifs] = useState(null);
  const [showNotif, setShowNotif] = useState(false);
  const [licStatus, setLicStatus] = useState('loading'); // loading | demo | active | expiring | blocked
  const [diasRestantes, setDiasRestantes] = useState(null);
  const [showInstall, setShowInstall] = useState(false);
  const [notifPerm, setNotifPerm] = useState('unsupported');
  // Avisos de la campanita que el usuario ya abrió y vio (por dispositivo).
  // La campanita muestra siempre todo lo pendiente; el ícono del teléfono
  // solo lo que todavía no se vio.
  const [notifVistas, setNotifVistas] = useState(() => new Set());
  const installPromptRef = useRef(null);
  const isStandalone = typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches;
  const isMobile = typeof window !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  const isIOS = typeof window !== 'undefined' && /iPhone|iPad/i.test(navigator.userAgent);
  const showInstallBtn = isMobile && !isStandalone;

  useEffect(() => {
    if (typeof Notification !== 'undefined') setNotifPerm(Notification.permission);
  }, []);

  // iPhone solo muestra el número en el ícono si el app tiene permiso de
  // notificaciones; pedirlo requiere un toque del usuario.
  async function pedirPermisoIcono() {
    if (typeof Notification === 'undefined') return;
    setNotifPerm(await Notification.requestPermission());
  }

  useEffect(() => {
    try { setNotifVistas(new Set(JSON.parse(localStorage.getItem('notif_vistas') || '[]'))); } catch {}
  }, []);

  useEffect(() => {
    if (!notifs) return;
    const actuales = [...notifs.overdue, ...notifs.upcoming].map(claveNotif);
    const next = new Set([...notifVistas].filter(k => actuales.includes(k)));
    if (showNotif) actuales.forEach(k => next.add(k));
    if (next.size === notifVistas.size && [...next].every(k => notifVistas.has(k))) return;
    setNotifVistas(next);
    try { localStorage.setItem('notif_vistas', JSON.stringify([...next])); } catch {}
  }, [notifs, showNotif, notifVistas]);

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

  async function initUser(s) {
    setSession(s);
    const email = s.user.email;
    const userId = s.user.id;

    // Load or seed user_config
    const KNOWN_EMAILS = ['sublimeagenciademarketing@gmail.com', 'karendanielasanchezjabs@gmail.com', 'khelendaihanaj@gmail.com'];
    let { data: uc } = await supabase.from('user_config').select('*').eq('user_id', userId).single();
    if (!uc) {
      if (KNOWN_EMAILS.includes(email)) {
        const hardcoded = getUserConfig(email);
        const seedData = { user_id: userId, email, plan: hardcoded.single ? 'personal' : 'negocio', cuenta1: hardcoded.l1, cuenta2: hardcoded.l2 || null };
        await supabase.from('user_config').upsert(seedData);
        uc = seedData;
      } else {
        router.push('/onboarding');
        return;
      }
    }
    const c = buildCfgFromDB(uc);
    setCfg(c);
    setCuenta(c.c1);

    // Admin always active
    if (email === ADMIN_EMAIL) { setLicStatus('active'); }
    else {
      // Check license
      const { data: lic } = await supabase.from('licencias').select('*').eq('email', email).single();
      const today = new Date(); today.setHours(0,0,0,0);
      const todayStr = today.toISOString().slice(0,10);
      if (lic && lic.activo && lic.solo_lectura) {
        setLicStatus('solo_lectura');
      } else if (lic && lic.activo) {
        const vence = new Date(lic.fecha_vencimiento); vence.setHours(0,0,0,0);
        const dias = Math.ceil((vence - today) / 86400000);
        if (dias < 0) { setLicStatus('blocked'); setDiasRestantes(0); }
        else if (dias <= 14) { setLicStatus('expiring'); setDiasRestantes(dias); }
        else { setLicStatus('active'); }
      } else {
        // Demo: DIAS_PRUEBA desde fecha_registro
        const regDate = new Date(uc.fecha_registro || todayStr); regDate.setHours(0,0,0,0);
        const diasDemo = DIAS_PRUEBA - Math.ceil((today - regDate) / 86400000);
        if (diasDemo <= 0) { setLicStatus('solo_lectura'); setDiasRestantes(0); }
        else { setLicStatus('demo'); setDiasRestantes(diasDemo); }
      }
    }

    const isAdminUser = email === ADMIN_EMAIL;
    setIsAdmin(isAdminUser);

    if (isAdminUser) {
      const { data: configs } = await supabase.from('user_config').select('email');
      const totalUsers = (configs || []).filter(c => c.email !== ADMIN_EMAIL).length;
      const lastSeen = parseInt(localStorage.getItem('admin_seen_users_count') || '0', 10);
      setAdminBadge(Math.max(0, totalUsers - lastSeen));
    }
  }

  useEffect(() => {
    let onSwMessage;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(r => r.update()).catch(() => {});
      onSwMessage = (e) => {
        if (e.data?.type !== 'SW_UPDATED') return;
        if (sessionStorage.getItem('sw_version') === e.data.version) return;
        sessionStorage.setItem('sw_version', e.data.version);
        window.location.reload();
      };
      navigator.serviceWorker.addEventListener('message', onSwMessage);
    }
    const handler = (e) => { e.preventDefault(); installPromptRef.current = e; };
    window.addEventListener('beforeinstallprompt', handler);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      if (onSwMessage) navigator.serviceWorker.removeEventListener('message', onSwMessage);
    };
  }, []);

  useEffect(() => {
    if (typeof navigator === 'undefined' || typeof document === 'undefined') return;
    const noVistas = notifs ? [...notifs.overdue, ...notifs.upcoming].filter(n => !notifVistas.has(claveNotif(n))).length : 0;
    const count = noVistas + adminBadge;
    const setBadge = () => {
      if (!('setAppBadge' in navigator)) return;
      if (count > 0) navigator.setAppBadge(count).catch(() => {});
      else navigator.clearAppBadge?.().catch(() => {});
    };
    const clearBadge = () => {
      if ('clearAppBadge' in navigator) navigator.clearAppBadge().catch(() => {});
    };
    const onVisibility = () => {
      if (document.hidden) setBadge();
      else clearBadge();
    };
    clearBadge();
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [notifs, adminBadge, notifVistas]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) router.replace('/landing');
      else await initUser(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'SIGNED_OUT') router.push('/login');
    });
    return () => listener.subscription.unsubscribe();
  }, [router]);

  useEffect(() => {
    async function onVisible() {
      if (document.visibilityState !== 'visible') return;
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      const userId = data.session.user.id;
      loadNotifications(userId);
      loadProjection(userId);
      if (data.session.user.email !== ADMIN_EMAIL) return;
      const [{ data: adminUc }, { data: configs }] = await Promise.all([
        supabase.from('user_config').select('admin_last_visit').eq('user_id', userId).single(),
        supabase.from('user_config').select('email, fecha_registro'),
      ]);
      const lastVisit = adminUc?.admin_last_visit || '2000-01-01T00:00:00Z';
      const newCount = (configs || []).filter(c =>
        c.email !== ADMIN_EMAIL && c.fecha_registro && c.fecha_registro > lastVisit
      ).length;
      setAdminBadge(newCount);
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const loadProjection = useCallback(async (userId) => {
    const now = new Date();
    const y = now.getFullYear(), mo = now.getMonth();
    const m = String(mo + 1).padStart(2, '0');
    const lastDay = new Date(y, mo + 1, 0).getDate();
    const mesStart = `${y}-${m}-01`, mesEnd = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
    const [r1, r2, r3, r4, r5] = await Promise.all([
      supabase.from('receivables').select('monto, cuenta, estado').eq('user_id', userId).gte('fecha_esperada', mesStart).lte('fecha_esperada', mesEnd),
      supabase.from('debts').select('monto_total, monto_pagado, cuenta, estado').eq('user_id', userId).gte('fecha_limite', mesStart).lte('fecha_limite', mesEnd),
      supabase.from('installments').select('monto, estado, installment_purchases!inner(user_id, cuenta)').eq('estado', 'pendiente').gte('fecha_vencimiento', mesStart).lte('fecha_vencimiento', mesEnd).eq('installment_purchases.user_id', userId),
      supabase.from('recurring_expenses').select('monto, cuenta, activo, pagado_mes, frecuencia, pagado_fecha').eq('user_id', userId).eq('activo', true),
      supabase.from('card_expenses').select('monto, cuenta, estado').eq('user_id', userId).neq('estado', 'pagado').gte('fecha_compra', mesStart).lte('fecha_compra', mesEnd),
    ]);
    const mesStr = `${y}-${m}`;
    const filterGasto = (g) => {
      if (g.frecuencia === 'semanal') {
        if (!g.pagado_fecha) return true;
        return Math.floor((now - new Date(g.pagado_fecha + 'T12:00:00')) / 86400000) >= 7;
      }
      if (g.frecuencia === 'quincenal') {
        if (!g.pagado_fecha) return true;
        return Math.floor((now - new Date(g.pagado_fecha + 'T12:00:00')) / 86400000) >= 15;
      }
      return g.pagado_mes !== mesStr;
    };
    setProjection({
      cobros: (r1.data || []).filter(r => r.estado !== 'cobrado'),
      deudas: (r2.data || []).filter(r => r.estado !== 'pagado'),
      cuotas: (r3.data || []).filter(r => r.installment_purchases),
      gastos: (r4.data || []).filter(filterGasto),
      tarjetas: r5.data || [],
    });
  }, []);

  const loadFutureProjections = useCallback(async (userId) => {
    const now = new Date();
    const nowStr = now.toISOString().slice(0, 10);
    const futureEnd = new Date(now.getFullYear(), now.getMonth() + 13, 0);
    const futureEndStr = futureEnd.toISOString().slice(0, 10);
    const [r1, r2, r3, r4, r5] = await Promise.all([
      supabase.from('receivables').select('monto, cuenta, estado, fecha_esperada').eq('user_id', userId).gte('fecha_esperada', nowStr).lte('fecha_esperada', futureEndStr),
      supabase.from('debts').select('monto_total, monto_pagado, cuenta, estado, fecha_limite').eq('user_id', userId).gte('fecha_limite', nowStr).lte('fecha_limite', futureEndStr),
      supabase.from('installments').select('monto, estado, fecha_vencimiento, installment_purchases!inner(user_id, cuenta)').eq('estado', 'pendiente').gte('fecha_vencimiento', nowStr).lte('fecha_vencimiento', futureEndStr).eq('installment_purchases.user_id', userId),
      supabase.from('recurring_expenses').select('monto, cuenta, activo, pagado_mes, frecuencia, pagado_fecha').eq('user_id', userId).eq('activo', true),
      supabase.from('card_expenses').select('monto, cuenta, estado, fecha:fecha_compra').eq('user_id', userId).neq('estado', 'pagado').gte('fecha_compra', nowStr).lte('fecha_compra', futureEndStr),
    ]);
    const cobros = (r1.data || []).filter(r => r.estado !== 'cobrado');
    const deudas = (r2.data || []).filter(r => r.estado !== 'pagado');
    const cuotas = (r3.data || []).filter(r => r.installment_purchases);
    const gastos = r4.data || [];
    const tarjetas = r5.data || [];
    const thisYear = now.getFullYear();
    const months = [];
    for (let i = 0; i <= 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const y = d.getFullYear(), mo = d.getMonth();
      const m = String(mo + 1).padStart(2, '0');
      const mesStr = `${y}-${m}`;
      const lastDay = new Date(y, mo + 1, 0).getDate();
      months.push({ i, mesStr, nombre: MESES[mo], año: y, añoDistinto: y !== thisYear, mesStart: `${y}-${m}-01`, mesEnd: `${y}-${m}-${String(lastDay).padStart(2, '0')}` });
    }
    setFutureRawData({ cobros, deudas, cuotas, gastos, tarjetas, months });
  }, []);

  const loadNotifications = useCallback(async (userId, userCfg) => {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const in7 = new Date(today); in7.setDate(in7.getDate() + 7);
    const in7Str = in7.toISOString().slice(0, 10);
    const currentMes = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
    const lastDay = new Date(today.getFullYear(), today.getMonth()+1, 0).getDate();

    const [r1, r2, r3, r4, r5] = await Promise.all([
      supabase.from('receivables').select('cliente, monto, fecha_esperada, cuenta, estado').eq('user_id', userId),
      supabase.from('debts').select('acreedor, monto_total, monto_pagado, fecha_limite, cuenta, estado').eq('user_id', userId),
      supabase.from('installments').select('monto, fecha_vencimiento, estado, installment_purchases!inner(descripcion, user_id, cuenta)').eq('estado', 'pendiente').eq('installment_purchases.user_id', userId),
      supabase.from('recurring_expenses').select('descripcion, monto, dia_vencimiento, cuenta, pagado_mes, frecuencia, pagado_fecha').eq('user_id', userId).eq('activo', true),
      supabase.from('card_expenses').select('descripcion, monto, fecha:fecha_compra, cuenta, estado').eq('user_id', userId).neq('estado', 'pagado'),
    ]);

    const overdue = [], upcoming = [];

    (r1.data || []).filter(r => r.estado !== 'cobrado' && r.fecha_esperada).forEach(r => {
      const item = { tipo: 'cobro', label: r.cliente, monto: r.monto, fecha: r.fecha_esperada, cuenta: r.cuenta };
      if (r.fecha_esperada < todayStr) overdue.push(item);
      else if (r.fecha_esperada <= in7Str) upcoming.push(item);
    });

    (r2.data || []).filter(r => r.estado !== 'pagado' && r.fecha_limite).forEach(r => {
      const item = { tipo: 'deuda', label: r.acreedor, monto: (r.monto_total || 0) - (r.monto_pagado || 0), fecha: r.fecha_limite, cuenta: r.cuenta };
      if (r.fecha_limite < todayStr) overdue.push(item);
      else if (r.fecha_limite <= in7Str) upcoming.push(item);
    });

    (r3.data || []).filter(r => r.installment_purchases).forEach(r => {
      const item = { tipo: 'cuota', label: r.installment_purchases.descripcion, monto: r.monto, fecha: r.fecha_vencimiento, cuenta: r.installment_purchases.cuenta };
      if (r.fecha_vencimiento < todayStr) overdue.push(item);
      else if (r.fecha_vencimiento <= in7Str) upcoming.push(item);
    });

    (r4.data || []).forEach(g => {
      const diasDesde = g.pagado_fecha ? Math.floor((today - new Date(g.pagado_fecha + 'T12:00:00')) / 86400000) : 999;
      const pendiente = g.frecuencia === 'semanal' ? diasDesde >= 7
        : g.frecuencia === 'quincenal' ? diasDesde >= 15
        : g.pagado_mes !== currentMes;
      if (!pendiente) return;
      const dueDay = Math.min(g.dia_vencimiento || 1, lastDay);
      const dueDate = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(dueDay).padStart(2,'0')}`;
      const item = { tipo: 'gasto', label: g.descripcion, monto: g.monto, fecha: dueDate, cuenta: g.cuenta };
      if (dueDate < todayStr) overdue.push(item);
      else if (dueDate <= in7Str) upcoming.push(item);
    });

    (r5.data || []).forEach(t => {
      const item = { tipo: 'cuota', label: t.descripcion || 'Tarjeta', monto: t.monto, fecha: t.fecha, cuenta: t.cuenta };
      if (t.fecha < todayStr) overdue.push(item);
      else if (t.fecha <= in7Str) upcoming.push(item);
    });

    overdue.sort((a, b) => a.fecha < b.fecha ? -1 : 1);
    upcoming.sort((a, b) => a.fecha < b.fecha ? -1 : 1);
    setNotifs({ overdue, upcoming });
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
      loadFutureProjections(session.user.id);
      loadNotifications(session.user.id);
    }
  }, [session, loadTransactions, loadProjection, loadFutureProjections, loadNotifications]);

  useEffect(() => {
    setFecha(new Date().toISOString().slice(0, 10));
  }, []);

  if (session === undefined || licStatus === 'loading') return null;

  const waMsg = (tipo) => {
    const base = encodeURIComponent(tipo === 'renovar'
      ? `Hola, quiero renovar mi licencia de MiCaja. Mi email es: ${session?.user?.email}`
      : `Hola, quiero activar mi licencia de MiCaja. Mi email registrado es: ${session?.user?.email}`);
    return `https://wa.me/${WA_NUMBER}?text=${base}`;
  };

  if (licStatus === 'blocked') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#0f172a', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
        <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 800, margin: 0 }}>Acceso bloqueado</h2>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, marginTop: 8, marginBottom: 28, maxWidth: 280 }}>
          Tu período de prueba o licencia ha vencido. Contactanos para renovar y seguir usando MiCaja.
        </p>
        <a href={waMsg('renovar')} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 28px', borderRadius: 14, background: '#25d366', color: '#fff', fontWeight: 700, fontSize: 15, textDecoration: 'none', fontFamily: 'inherit' }}>
          📲 Contactar por WhatsApp
        </a>
        <button onClick={handleLogout} style={{ marginTop: 20, background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
          Cerrar sesión
        </button>
      </div>
    );
  }

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

  const anioActual = new Date().getFullYear();
  const mesFiltroStr = `${anioActual}-${String(mesFiltro + 1).padStart(2, '0')}`;
  const filtered = transactions
    .filter(t => t.fecha && t.fecha.startsWith(mesFiltroStr))
    .filter(t => filter === 'todos' || mismaCuenta(t.cuenta, filter));

  // Con una sola cuenta, todo movimiento le pertenece: contarlos por nombre
  // dejaba fuera los guardados antes de renombrar la cuenta.
  const sumFor = (c) =>
    transactions.filter((t) => cfg.single || mismaCuenta(t.cuenta, c))
      .reduce((acc, t) => acc + (t.tipo === 'ingreso' ? t.monto : -t.monto), 0);

  const total1 = sumFor(cfg.c1);
  const total2 = cfg.single ? 0 : sumFor(cfg.c2);
  const totalGeneral = total1 + total2;

  const txIcon = (t) => t.tipo === 'ingreso'
    ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v13M7 10l5 5 5-5"/><path d="M20 20H4"/></svg>
    : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22V9M7 14l5-5 5 5"/><path d="M20 4H4"/></svg>;
  const isAutoTx = (t) => /^(Gasto fijo:|Cobro:|Pago deuda:|Tarjeta:|\S.* — Cuota \d+\/\d+)/.test(t.categoria || '');

  return (
    <div className="wrap">
      {licStatus === 'demo' && (
        <div style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 12, padding: '10px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><path d="M5 3h14M5 21h14M17 3v4a5 5 0 0 1-10 0V3M7 21v-4a5 5 0 0 1 10 0v4"/></svg> Prueba gratuita · <b style={{ color: '#a5b4fc' }}>{diasRestantes} día{diasRestantes !== 1 ? 's' : ''} restante{diasRestantes !== 1 ? 's' : ''}</b></span>
          <a href={waMsg('activar')} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#a5b4fc', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>Activar →</a>
        </div>
      )}
      {licStatus === 'expiring' && (
        <div style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 12, padding: '10px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>⚠️ Licencia vence en <b style={{ color: '#fbbf24' }}>{diasRestantes} día{diasRestantes !== 1 ? 's' : ''}</b></span>
          <a href={waMsg('renovar')} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#fbbf24', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>Renovar →</a>
        </div>
      )}
      <div className="top-bar">
        <div>
          <h1>MiCaja</h1>
          <p title={cfg.single ? cfg.l1 : `${cfg.l1} & ${cfg.l2}`}>
            {cfg.single ? shortLabel(cfg.l1, 20) : `${shortLabel(cfg.l1, 12)} & ${shortLabel(cfg.l2, 12)}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="mas-btn" onClick={() => router.push('/mas')}>☰ Más</button>
          {isAdmin && (
            <button onClick={() => router.push('/admin')} style={{ position: 'relative', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Panel Admin">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              {adminBadge > 0 && (
                <span style={{ position: 'absolute', top: -5, right: -5, background: '#ef4444', color: '#fff', borderRadius: 999, fontSize: 10, fontWeight: 700, minWidth: 17, height: 17, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', lineHeight: 1 }}>
                  {adminBadge}
                </span>
              )}
            </button>
          )}
          <button
            onClick={() => setShowNotif(v => !v)}
            style={{ position: 'relative', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 18 }}
            title="Notificaciones"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            {notifs && (notifs.overdue.length + notifs.upcoming.length) > 0 && (
              <span style={{ position: 'absolute', top: -5, right: -5, background: '#ef4444', color: '#fff', borderRadius: 999, fontSize: 10, fontWeight: 700, minWidth: 17, height: 17, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', lineHeight: 1 }}>
                {notifs.overdue.length + notifs.upcoming.length}
              </span>
            )}
          </button>
          {showInstallBtn && (
            <button onClick={async () => {
              if (installPromptRef.current) {
                installPromptRef.current.prompt();
                const { outcome } = await installPromptRef.current.userChoice;
                if (outcome === 'accepted') installPromptRef.current = null;
              } else if (isIOS) {
                setShowInstall(v => !v);
              }
            }} style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: 10, height: 38, display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', cursor: 'pointer', boxShadow: '0 2px 12px rgba(99,102,241,0.35)' }} title="Instalar en pantalla de inicio">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 6v8M9 11l3 3 3-3"/></svg>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>Instalar</span>
            </button>
          )}
          <button className="logout-btn" onClick={handleLogout}>Salir</button>
        </div>
      </div>

      {showInstall && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.65)' }} onClick={() => setShowInstall(false)}>
          <div style={{ position: 'absolute', top: 64, right: 12, width: 'min(92vw, 340px)', background: '#0f1f35', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20, padding: 20, boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 6v8M9 11l3 3 3-3"/></svg>
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Instalar MiCaja</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>Seguí estos pasos en Safari</div>
                </div>
              </div>
              <button onClick={() => setShowInstall(false)} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: 'rgba(255,255,255,0.5)', width: 28, height: 28, borderRadius: 8, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '10px 14px', margin: '14px 0 10px', fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
              Instalándola en tu pantalla de inicio, podés abrirla igual que cualquier app — sin buscarla en el navegador cada vez.
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                <div style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(165,180,252,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>🍎</div>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#a5b4fc' }}>iPhone / iPad (Safari)</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {[
                  { n: 1, text: 'Abrí esta página en', bold: 'Safari' },
                  { n: 2, text: 'Tocá el ícono', bold: '⬆ Compartir', sub: '(cuadrado con flecha, en la barra de abajo)' },
                  { n: 3, text: 'Elegí', bold: '"Agregar a pantalla de inicio"' },
                  { n: 4, text: 'Tocá', bold: '"Agregar"', sub: '(arriba a la derecha)' },
                ].map(s => (
                  <div key={s.n} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ minWidth: 20, height: 20, borderRadius: 6, background: 'rgba(165,180,252,0.15)', color: '#a5b4fc', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{s.n}</span>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>{s.text} <b style={{ color: '#fff' }}>{s.bold}</b>{s.sub ? <span style={{ color: 'rgba(255,255,255,0.35)' }}> {s.sub}</span> : ''}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

      {showNotif && notifs && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000 }} onClick={() => setShowNotif(false)}>
          <div
            style={{ position: 'absolute', top: 64, right: 12, width: 'min(92vw, 360px)', maxHeight: '80vh', overflowY: 'auto', background: '#0f2035', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 20, padding: 16, boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>🔔 Notificaciones</span>
              <button onClick={() => setShowNotif(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 20, cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}>✕</button>
            </div>

            {isIOS && isStandalone && notifPerm === 'default' && (
              <button onClick={pedirPermisoIcono} style={{ width: '100%', marginBottom: 12, padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(99,102,241,0.35)', background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', lineHeight: 1.4 }}>
                Mostrar el número de avisos en el ícono del app →
                <div style={{ fontSize: 11, fontWeight: 400, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>iPhone te pide permiso una sola vez.</div>
              </button>
            )}

            {notifs.overdue.length === 0 && notifs.upcoming.length === 0 && (
              <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.35)', fontSize: 13, padding: '20px 0' }}>Sin notificaciones</div>
            )}

            {notifs.overdue.length > 0 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ flex: 1, height: 1, background: 'rgba(239,68,68,0.35)' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>Vencidos</span>
                  <div style={{ flex: 1, height: 1, background: 'rgba(239,68,68,0.35)' }} />
                </div>
                {notifs.overdue.map((n, i) => <NotifItem key={`o${i}`} n={n} cfg={cfg} />)}
              </>
            )}

            {notifs.upcoming.length > 0 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: `${notifs.overdue.length > 0 ? 12 : 0}px 0 8px` }}>
                  <div style={{ flex: 1, height: 1, background: 'rgba(234,179,8,0.35)' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>Próximos 7 días</span>
                  <div style={{ flex: 1, height: 1, background: 'rgba(234,179,8,0.35)' }} />
                </div>
                {notifs.upcoming.map((n, i) => <NotifItem key={`u${i}`} n={n} cfg={cfg} />)}
              </>
            )}
          </div>
        </div>
      )}

      <div className="hero-balance">
        <div className="hero-label">Balance total</div>
        <div className={`hero-number${totalGeneral < 0 ? ' neg' : ''}`}>
          {totalGeneral < 0 ? '−' : ''}{fmt(totalGeneral)}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
          {cfg.single ? 'Acumulado de todos los meses' : `Acumulado de todos los meses · ${cfg.l1} y ${cfg.l2}`}
        </div>
      </div>

      <DonutDuo total1={total1} total2={total2} cfg={cfg} transactions={transactions} projection={projection} rawData={futureRawData} />

      {!cfg.single && <div className="totals">
        <div style={{ gridColumn: '1/-1', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4, textAlign: 'center' }}>En caja · total acumulado</div>
        <div className="cell sublime">
          <div className="label">{cfg.l1}</div>
          <div className={`amount${total1 < 0 ? ' neg' : ''}`}>
            {total1 < 0 ? '−' : '+'}{fmt(total1)}
          </div>
        </div>
          <div className="cell personal">
            <div className="label">{cfg.l2}</div>
            <div className={`amount${total2 < 0 ? ' neg' : ''}`}>
              {total2 < 0 ? '−' : '+'}{fmt(total2)}
            </div>
          </div>
      </div>}

      {licStatus === 'solo_lectura' && (
        <div style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 12, padding: '10px 16px', marginBottom: 12, fontSize: 13, color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>
          Tu cuenta está en modo <b style={{ color: '#fbbf24' }}>solo lectura</b>. Contactanos para reactivar.
        </div>
      )}
      <form className="entry" onSubmit={handleAdd} style={{ display: licStatus === 'solo_lectura' ? 'none' : undefined }}>
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
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 10, scrollbarWidth: 'none' }}>
        {['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'].map((mes, i) => (
          <button key={i} onClick={() => setMesFiltro(i)} style={{
            flexShrink: 0, padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
            background: mesFiltro === i ? 'rgba(99,179,237,0.25)' : 'rgba(255,255,255,0.07)',
            color: mesFiltro === i ? '#90cdf4' : 'rgba(255,255,255,0.4)',
            outline: mesFiltro === i ? '1px solid rgba(99,179,237,0.4)' : '1px solid transparent',
          }}>{mes}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty">Todavía no hay movimientos cargados.</div>
      ) : (
        <ul className="ledger">
          {filtered.map((t) => (
            <li key={t.id}>
              <div className={`tx-icon ${t.cuenta === cfg.c1 ? 'sublime' : 'personal'}`}>{txIcon(t)}</div>
              <div className="meta">
                <div className="cat">{t.categoria}</div>
                <div className="sub">{fmtFecha(t.fecha)} · {t.cuenta === cfg.c1 ? cfg.l1 : cfg.l2}</div>
              </div>
              <div className={`amt${t.tipo === 'ingreso' ? ' pos' : ' neg'}`}>
                {t.tipo === 'ingreso' ? '+' : '−'} {fmt(t.monto)}
              </div>
              {isAutoTx(t)
                ? <div className="del" style={{ opacity: 0.2, cursor: 'not-allowed' }} title="Revertir desde el módulo correspondiente">✕</div>
                : <button className="del" onClick={() => handleDelete(t.id)} title="Eliminar">✕</button>
              }
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
