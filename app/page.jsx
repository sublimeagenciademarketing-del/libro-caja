'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';
import { DIAS_PRUEBA, ADMIN_EMAIL } from '../lib/config';
import { hoyISO, proximoDe, esRecurrente, ocurrenciasEnMes } from '../lib/recurrencia';
import { cargarAvisos, calcularAvisos } from '../lib/avisos';
import { suscribirPush, activarPush, estadoPush } from '../lib/push-cliente';
import { MONEDAS, esGuarani, fmtMoneda, resumenMonedas, textoAcumulados, leerMonto } from '../lib/monedas';

const fmt = (n) => '₲ ' + Math.round(Math.abs(n)).toLocaleString('es-PY');
const fmtFecha = (s) => { if (!s) return ''; const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };

const TIPO_ICON = { cobro: '📥', deuda: '📤', cuota: '🗓️', gasto: '🔄', tarjeta: '💳' };
const TIPO_LABEL = { cobro: 'Cobro', deuda: 'Deuda', cuota: 'Cuota', gasto: 'Gasto fijo', tarjeta: 'Tarjeta' };

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

const COLS_COBRO = 'monto, cuenta, estado, frecuencia, fecha_esperada, proximo_vencimiento, cobrado_fecha, activo';
const COLS_GASTO = 'monto, cuenta, activo, pagado_mes, pagado_fecha, frecuencia, dia_vencimiento, proximo_vencimiento';

// Convierte ítems recurrentes en una entrada por ocurrencia dentro del mes,
// así todo lo que suma proyecciones sigue trabajando con {monto, cuenta}.
function expandirGastos(gastos, { y, m0, hoy, esMesActual }) {
  return gastos.flatMap(g => ocurrenciasEnMes(g, y, m0, hoy, { incluirAtrasadas: esMesActual }).map(() => ({ monto: g.monto || 0, cuenta: g.cuenta })));
}
function expandirCobros(cobros, { y, m0, mesStart, mesEnd, hoy, esMesActual }) {
  return cobros.filter(c => c.activo !== false).flatMap(c => {
    if (!esRecurrente(c)) {
      const vence = c.estado !== 'cobrado' && c.fecha_esperada && c.fecha_esperada >= mesStart && c.fecha_esperada <= mesEnd;
      return vence ? [{ monto: c.monto || 0, cuenta: c.cuenta }] : [];
    }
    return ocurrenciasEnMes(c, y, m0, hoy, { incluirAtrasadas: esMesActual }).map(() => ({ monto: c.monto || 0, cuenta: c.cuenta }));
  });
}

function DonutDuo({ total1, total2, cfg, transactions, todas, projection, rawData }) {
  const now = new Date();
  const m = now.getMonth() + 1;
  const mesStr = `${now.getFullYear()}-${String(m).padStart(2, '0')}`;
  // Monedas extra del mes (solo si hay algo cargado): se muestran aparte, chiquito.
  const extraMes = Object.entries(resumenMonedas(todas || [], mesStr)).filter(([, v]) => v.tieneMes);
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

  const projScrollRef = useRef(null);
  const [projShowHint, setProjShowHint] = useState(true);

  function calcFuturoCuenta(c, mo) {
    if (!rawData) return { inc: 0, exp: 0, result: 0 };
    const { mesStart, mesEnd, i, y, m0 } = mo;
    const hoy = hoyISO();
    const inc = expandirCobros(rawData.cobros.filter(r => deCuenta(r.cuenta, c)), { y, m0, mesStart, mesEnd, hoy, esMesActual: i === 0 }).reduce((s, r) => s + r.monto, 0);
    const mesGastos = expandirGastos(rawData.gastos.filter(g => deCuenta(g.cuenta, c)), { y, m0, hoy, esMesActual: i === 0 });
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
          {extraMes.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 14, fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 600, marginTop: -2 }}>
              {extraMes.map(([mo, v]) => (
                <span key={mo}>{MONEDAS[mo].simbolo} <span style={{ color: '#4ade80' }}>+{fmtMoneda(v.ing, mo).replace(/^\S+ /, '')}</span> / <span style={{ color: '#f87171' }}>−{fmtMoneda(v.gas, mo).replace(/^\S+ /, '')}</span></span>
              ))}
            </div>
          )}
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


const WA_NUMBER = '595986313704';

function buildCfgFromDB(uc) {
  const c1 = uc.cuenta1.toLowerCase();
  const c2 = uc.cuenta2 ? uc.cuenta2.toLowerCase() : null;
  return { c1, c2, l1: uc.cuenta1, l2: uc.cuenta2 || null, single: !uc.cuenta2, monedas: Array.isArray(uc.monedas) ? uc.monedas.filter(m => MONEDAS[m]) : [] };
}

const mismaCuenta = (a, b) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();
const claveNotif = (n) => `${n.tipo}|${n.label}|${n.fecha}`;

// Invitación a activar los recordatorios: aparece una sola vez, cuando el
// teléfono todavía no decidió el permiso, y desaparece al activar o al cerrarla.
function InvitacionRecordatorios({ userId, onCambio }) {
  const [visible, setVisible] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const clave = `invitacion_recordatorios_${userId}`;

  useEffect(() => {
    let vivo = true;
    (async () => {
      try { if (localStorage.getItem(clave) === '1') return; } catch {}
      if (typeof Notification === 'undefined' || Notification.permission !== 'default') return;
      const estado = await estadoPush();
      if (vivo && estado === 'desactivado') setVisible(true);
    })();
    return () => { vivo = false; };
  }, [clave]);

  function cerrar() {
    try { localStorage.setItem(clave, '1'); } catch {}
    setVisible(false);
  }
  async function activar() {
    setOcupado(true);
    await activarPush(userId);
    setOcupado(false);
    onCambio?.();
    cerrar();
  }

  if (!visible) return null;
  return (
    <div style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.30)', borderRadius: 16, padding: '12px 14px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#f59e0b,#f97316)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Activá los recordatorios</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2, lineHeight: 1.4 }}>Te avisamos en el teléfono cuando un pago o cobro está por vencer.</div>
      </div>
      <button type="button" onClick={activar} disabled={ocupado} style={{ padding: '8px 12px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#f59e0b,#f97316)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, opacity: ocupado ? 0.7 : 1 }}>Activar</button>
      <button type="button" onClick={cerrar} aria-label="Cerrar" style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 18, cursor: 'pointer', padding: '0 2px', lineHeight: 1, flexShrink: 0 }}>✕</button>
    </div>
  );
}

// Novedad de monedas extra: se muestra una sola vez y desaparece al ir a Perfil
// o al cerrarla, aunque no active ninguna moneda.
function NovedadMonedas({ userId, cfg, onIr }) {
  const clave = `novedad_monedas_${userId}`;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try { setVisible(localStorage.getItem(clave) !== '1' && !(cfg.monedas || []).length); } catch {}
  }, [clave, cfg.monedas]);

  function cerrar() {
    try { localStorage.setItem(clave, '1'); } catch {}
    setVisible(false);
  }

  if (!visible) return null;
  return (
    <div style={{ background: 'rgba(14,165,233,0.10)', border: '1px solid rgba(14,165,233,0.30)', borderRadius: 16, padding: '12px 14px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#0ea5e9,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 11, fontWeight: 800, color: '#fff' }}>US$</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Nuevo: dólares y reales</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2, lineHeight: 1.4 }}>Anotá movimientos en US$ o R$, aparte de tus guaraníes. Se activa en Perfil.</div>
      </div>
      <button type="button" onClick={() => { cerrar(); onIr?.(); }} style={{ padding: '8px 12px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#0ea5e9,#6366f1)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>Ver</button>
      <button type="button" onClick={cerrar} aria-label="Cerrar" style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 18, cursor: 'pointer', padding: '0 2px', lineHeight: 1, flexShrink: 0 }}>✕</button>
    </div>
  );
}

function PrimerosPasos({ pasos }) {
  const hechos = pasos.filter(p => p.hecho).length;
  return (
    <div style={{ background: 'rgba(99,102,241,0.10)', border: '1px solid rgba(99,102,241,0.30)', borderRadius: 16, padding: '14px 16px', marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>Primeros pasos</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#a5b4fc' }}>{hechos}/{pasos.length}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {pasos.map((p) => (
          <button key={p.titulo} type="button" onClick={p.hecho ? undefined : p.onClick} disabled={p.hecho}
            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: p.hecho ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)', color: '#fff', cursor: p.hecho ? 'default' : 'pointer', fontFamily: 'inherit', opacity: p.hecho ? 0.55 : 1 }}>
            <span style={{ width: 22, height: 22, borderRadius: 999, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: p.hecho ? '#34d399' : 'transparent', border: p.hecho ? 'none' : '2px solid rgba(255,255,255,0.3)' }}>
              {p.hecho && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 700, textDecoration: p.hecho ? 'line-through' : 'none' }}>{p.titulo}</span>
              <span style={{ display: 'block', fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>{p.detalle}</span>
            </span>
            {!p.hecho && <span style={{ color: '#a5b4fc', fontSize: 16, flexShrink: 0 }}>›</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

// Registros nuevos para el admin: usuarios (no admin) registrados después de la
// última visita al panel. registrado_en tiene fecha y hora; fecha_registro (solo
// fecha) queda de respaldo por si alguna fila vieja no la tuviera.
function contarRegistrosNuevos(configs, adminLastVisit) {
  const desde = new Date(adminLastVisit || '2000-01-01T00:00:00Z').getTime();
  return (configs || []).filter(c => {
    if (c.email === ADMIN_EMAIL) return false;
    const cuando = c.registrado_en || c.fecha_registro;
    return !!cuando && new Date(cuando).getTime() > desde;
  }).length;
}

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
  const [licStatus, setLicStatus] = useState('loading'); // loading | demo | active | expiring | solo_lectura
  const [diasRestantes, setDiasRestantes] = useState(null);
  const [motivoLectura, setMotivoLectura] = useState(null); // prueba | licencia | admin
  const [primerosPasos, setPrimerosPasos] = useState(null);
  const [fechaRegistro, setFechaRegistro] = useState(null);
  const formRef = useRef(null);
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

  // Pedir permiso requiere un toque del usuario. Con permiso, este teléfono
  // queda anotado para los recordatorios (y en iPhone, para el número del ícono).
  async function pedirPermisoAvisos() {
    if (typeof Notification === 'undefined') return;
    if (session?.user?.id) await activarPush(session.user.id);
    setNotifPerm(Notification.permission);
  }

  useEffect(() => {
    try { setNotifVistas(new Set(JSON.parse(localStorage.getItem('notif_vistas') || '[]'))); } catch {}
    // Al tocar un recordatorio push, el app abre con la campanita desplegada.
    // El pedido se guarda en sessionStorage por si el app se recarga al actualizarse.
    try {
      if (new URLSearchParams(window.location.search).get('campana') === '1') {
        sessionStorage.setItem('abrir_campana', '1');
        window.history.replaceState(null, '', '/');
      }
      if (sessionStorage.getItem('abrir_campana') === '1') {
        sessionStorage.removeItem('abrir_campana');
        setShowNotif(true);
      }
    } catch {}
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
  const [moneda, setMoneda] = useState('PYG');
  const [fecha, setFecha] = useState('');
  const [categoria, setCategoria] = useState('');
  const [tipo, setTipo] = useState('ingreso');
  const [cuenta, setCuenta] = useState('sublime');

  function handleMontoChange(e) {
    const { valor, display } = leerMonto(e.target.value, moneda);
    setMonto(valor);
    setMontoDisplay(display);
  }
  function cambiarMoneda(m) {
    if (m === moneda) return;
    setMoneda(m); setMonto(''); setMontoDisplay('');
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
    // Última apertura, para el panel admin: se anota una vez por día.
    if (!uc.ultima_apertura || String(uc.ultima_apertura).slice(0, 10) < new Date().toISOString().slice(0, 10)) {
      supabase.from('user_config').update({ ultima_apertura: new Date().toISOString() }).eq('user_id', userId).then(() => {});
    }
    const c = buildCfgFromDB(uc);
    setFechaRegistro(uc.fecha_registro || null);
    setCfg(c);
    setCuenta(c.c1);

    // Admin always active
    if (email === ADMIN_EMAIL) { setLicStatus('active'); }
    else {
      // Check license
      const { data: lic } = await supabase.from('licencias').select('*').eq('email', email).single();
      const today = new Date(); today.setHours(0,0,0,0);
      const todayStr = hoyISO();
      if (lic && lic.activo && lic.solo_lectura) {
        setLicStatus('solo_lectura'); setMotivoLectura('admin');
      } else if (lic && lic.activo) {
        const vence = new Date(lic.fecha_vencimiento); vence.setHours(0,0,0,0);
        const dias = Math.ceil((vence - today) / 86400000);
        if (dias < 0) { setLicStatus('solo_lectura'); setMotivoLectura('licencia'); setDiasRestantes(0); }
        else if (dias <= 14) { setLicStatus('expiring'); setDiasRestantes(dias); }
        else { setLicStatus('active'); }
      } else {
        // Demo: DIAS_PRUEBA desde fecha_registro
        const regDate = new Date(uc.fecha_registro || todayStr); regDate.setHours(0,0,0,0);
        const diasDemo = DIAS_PRUEBA - Math.ceil((today - regDate) / 86400000);
        if (diasDemo <= 0) { setLicStatus('solo_lectura'); setMotivoLectura('prueba'); setDiasRestantes(0); }
        else { setLicStatus('demo'); setDiasRestantes(diasDemo); }
      }
    }

    const isAdminUser = email === ADMIN_EMAIL;
    setIsAdmin(isAdminUser);

    if (isAdminUser) {
      const { data: configs } = await supabase.from('user_config').select('email, fecha_registro, registrado_en');
      setAdminBadge(contarRegistrosNuevos(configs, uc.admin_last_visit));
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
    // Con el app a la vista el ícono va limpio; al salir, con el número. Si los
    // datos se refrescan estando afuera, se reescribe el número, no se borra.
    const sincronizar = () => { if (document.hidden) setBadge(); else clearBadge(); };
    sincronizar();
    document.addEventListener('visibilitychange', sincronizar);
    window.addEventListener('pagehide', setBadge);
    return () => {
      document.removeEventListener('visibilitychange', sincronizar);
      window.removeEventListener('pagehide', setBadge);
    };
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
        supabase.from('user_config').select('email, fecha_registro, registrado_en'),
      ]);
      setAdminBadge(contarRegistrosNuevos(configs, adminUc?.admin_last_visit));
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
      supabase.from('receivables').select(COLS_COBRO).eq('user_id', userId),
      supabase.from('debts').select('monto_total, monto_pagado, cuenta, estado').eq('user_id', userId).gte('fecha_limite', mesStart).lte('fecha_limite', mesEnd),
      supabase.from('installments').select('monto, estado, installment_purchases!inner(user_id, cuenta)').eq('estado', 'pendiente').gte('fecha_vencimiento', mesStart).lte('fecha_vencimiento', mesEnd).eq('installment_purchases.user_id', userId),
      supabase.from('recurring_expenses').select(COLS_GASTO).eq('user_id', userId).eq('activo', true),
      supabase.from('card_expenses').select('monto, cuenta, estado').eq('user_id', userId).neq('estado', 'pagado').gte('fecha_compra', mesStart).lte('fecha_compra', mesEnd),
    ]);
    const hoy = hoyISO();
    setProjection({
      cobros: expandirCobros(r1.data || [], { y, m0: mo, mesStart, mesEnd, hoy, esMesActual: true }),
      deudas: (r2.data || []).filter(r => r.estado !== 'pagado'),
      cuotas: (r3.data || []).filter(r => r.installment_purchases),
      gastos: expandirGastos(r4.data || [], { y, m0: mo, hoy, esMesActual: true }),
      tarjetas: r5.data || [],
    });
  }, []);

  const loadFutureProjections = useCallback(async (userId) => {
    const now = new Date();
    const nowStr = hoyISO();
    const futureEnd = new Date(now.getFullYear(), now.getMonth() + 13, 0);
    const futureEndStr = `${futureEnd.getFullYear()}-${String(futureEnd.getMonth() + 1).padStart(2, '0')}-${String(futureEnd.getDate()).padStart(2, '0')}`;
    const [r1, r2, r3, r4, r5] = await Promise.all([
      supabase.from('receivables').select(COLS_COBRO).eq('user_id', userId),
      supabase.from('debts').select('monto_total, monto_pagado, cuenta, estado, fecha_limite').eq('user_id', userId).gte('fecha_limite', nowStr).lte('fecha_limite', futureEndStr),
      supabase.from('installments').select('monto, estado, fecha_vencimiento, installment_purchases!inner(user_id, cuenta)').eq('estado', 'pendiente').gte('fecha_vencimiento', nowStr).lte('fecha_vencimiento', futureEndStr).eq('installment_purchases.user_id', userId),
      supabase.from('recurring_expenses').select(COLS_GASTO).eq('user_id', userId).eq('activo', true),
      supabase.from('card_expenses').select('monto, cuenta, estado, fecha:fecha_compra').eq('user_id', userId).neq('estado', 'pagado').gte('fecha_compra', nowStr).lte('fecha_compra', futureEndStr),
    ]);
    const cobros = (r1.data || []).filter(r => r.activo !== false && (esRecurrente(r) || (r.estado !== 'cobrado' && r.fecha_esperada >= nowStr && r.fecha_esperada <= futureEndStr)));
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
      months.push({ i, y, m0: mo, mesStr, nombre: MESES[mo], año: y, añoDistinto: y !== thisYear, mesStart: `${y}-${m}-01`, mesEnd: `${y}-${m}-${String(lastDay).padStart(2, '0')}` });
    }
    setFutureRawData({ cobros, deudas, cuotas, gastos, tarjetas, months });
  }, []);

  // La campanita se calcula en lib/avisos.js, igual que los recordatorios push.
  const loadNotifications = useCallback(async (userId) => {
    setNotifs(calcularAvisos(await cargarAvisos(supabase, userId), hoyISO()));
  }, []);

  const cargarPrimerosPasos = useCallback(async (userId) => {
    const contar = (tabla) => supabase.from(tabla).select('id', { count: 'exact', head: true }).eq('user_id', userId);
    const [fijos, cobros, tarjetas, deudas] = await Promise.all([contar('recurring_expenses'), contar('receivables'), contar('credit_cards'), contar('debts')]);
    setPrimerosPasos({ fijos: fijos.count || 0, extras: (cobros.count || 0) + (tarjetas.count || 0) + (deudas.count || 0) });
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
      cargarPrimerosPasos(session.user.id);
      suscribirPush(session.user.id);
    }
  }, [session, loadTransactions, loadProjection, loadFutureProjections, loadNotifications, cargarPrimerosPasos]);

  useEffect(() => {
    setFecha(hoyISO());
  }, []);

  if (session === undefined || licStatus === 'loading') return null;

  const waMsg = (tipo) => {
    const base = encodeURIComponent(tipo === 'renovar'
      ? `Hola, quiero renovar mi licencia de MiCaja. Mi email es: ${session?.user?.email}`
      : `Hola, quiero activar mi licencia de MiCaja. Mi email registrado es: ${session?.user?.email}`);
    return `https://wa.me/${WA_NUMBER}?text=${base}`;
  };

  async function handleAdd(e) {
    e.preventDefault();
    const montoNum = parseFloat(monto);
    if (!montoNum || montoNum <= 0 || !fecha || !categoria.trim()) return;
    const { error } = await supabase.from('transactions').insert({
      monto: montoNum, fecha, categoria: categoria.trim(), tipo, cuenta,
      user_id: session.user.id,
      moneda: (cfg.monedas || []).includes(moneda) ? moneda : 'PYG',
    });
    if (!error) { setMonto(''); setMontoDisplay(''); setCategoria(''); loadTransactions(session.user.id); }
  }

  async function handleDelete(id) {
    const t = transactions.find(x => x.id === id);
    const aviso = t && isAutoTx(t)
      ? 'Este movimiento lo generó un pago o cobro desde Más. Borrarlo acá no cambia esa tarjeta: si querés deshacer el pago, usá "Revertir" allá. ¿Borrar igual?'
      : '¿Eliminar este movimiento?';
    if (!window.confirm(aviso)) return;
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
  // Los totales en ₲ solo suman movimientos en guaraníes; las monedas extra
  // son bolsillos aparte y se muestran en una línea chica.
  const txGs = transactions.filter(esGuarani);
  const monedasActivas = cfg.monedas || [];
  const extraTotal = resumenMonedas(transactions);
  const sumFor = (c) =>
    txGs.filter((t) => cfg.single || mismaCuenta(t.cuenta, c))
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

      {/* Guía de primer día: solo el primer mes, mientras falte algún paso, y nunca
          después de haberla completado una vez (aunque luego se borren datos). */}
      {(() => {
        if (!primerosPasos || licStatus === 'solo_lectura' || !session?.user?.id) return null;
        const clave = `primeros_pasos_listo_${session.user.id}`;
        let yaCompletada = false;
        try { yaCompletada = localStorage.getItem(clave) === '1'; } catch {}
        const todoHecho = transactions.length > 0 && primerosPasos.fijos > 0 && primerosPasos.extras > 0;
        if (todoHecho && !yaCompletada) { try { localStorage.setItem(clave, '1'); } catch {} }
        const diasDesdeRegistro = fechaRegistro ? (Date.now() - new Date(fechaRegistro).getTime()) / 86400000 : 999;
        if (yaCompletada || todoHecho || transactions.length >= 5 || diasDesdeRegistro > 30) return null;
        return (
        <PrimerosPasos pasos={[
          { hecho: transactions.length > 0, titulo: 'Anotá tu primer movimiento', detalle: 'Un ingreso o un gasto de hoy', onClick: () => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) },
          { hecho: primerosPasos.fijos > 0, titulo: 'Cargá tus gastos fijos', detalle: 'Alquiler, internet, celular…', onClick: () => router.push('/mas?tab=gastos') },
          { hecho: primerosPasos.extras > 0, titulo: 'Agregá lo que te deben, tu tarjeta o una deuda', detalle: 'Así la proyección muestra el mes completo', onClick: () => router.push('/mas?tab=cobros') },
        ]} />
        );
      })()}

      {session?.user?.id && licStatus !== 'solo_lectura' && (
        <InvitacionRecordatorios userId={session.user.id} onCambio={() => { if (typeof Notification !== 'undefined') setNotifPerm(Notification.permission); }} />
      )}
      {session?.user?.id && licStatus !== 'solo_lectura' && (
        <NovedadMonedas userId={session.user.id} cfg={cfg} onIr={() => router.push('/mas?tab=perfil')} />
      )}

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

            {notifPerm === 'default' && (!isIOS || isStandalone) && typeof window !== 'undefined' && 'PushManager' in window && (
              <button onClick={pedirPermisoAvisos} style={{ width: '100%', marginBottom: 12, padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(99,102,241,0.35)', background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', lineHeight: 1.4 }}>
                Recibir recordatorios de tus pagos y cobros en el teléfono →
                <div style={{ fontSize: 11, fontWeight: 400, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>Te avisamos cuando un gasto fijo, cuota, tarjeta o cobro está por vencer o se venció. El teléfono pide permiso una sola vez.</div>
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
        {Object.keys(extraTotal).length > 0 && (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 600, marginTop: 6, letterSpacing: '0.02em' }}>
            {textoAcumulados(extraTotal)}
          </div>
        )}
      </div>

      <DonutDuo total1={total1} total2={total2} cfg={cfg} transactions={txGs} todas={transactions} projection={projection} rawData={futureRawData} />

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
          {motivoLectura === 'licencia'
            ? <>Tu licencia <b style={{ color: '#fbbf24' }}>venció</b>. Tus datos están guardados; renová para seguir cargando.</>
            : motivoLectura === 'prueba'
            ? <>Terminaron tus {DIAS_PRUEBA} días de prueba. Tus datos están guardados; activá para seguir cargando.</>
            : <>Tu cuenta está en modo <b style={{ color: '#fbbf24' }}>solo lectura</b>. Contactanos para reactivar.</>}
          <a href={waMsg(motivoLectura === 'licencia' ? 'renovar' : 'activar')} target="_blank" rel="noreferrer" style={{ display: 'block', marginTop: 6, color: '#fbbf24', fontWeight: 700, textDecoration: 'none' }}>
            {motivoLectura === 'licencia' ? 'Renovar por WhatsApp →' : 'Activar por WhatsApp →'}
          </a>
        </div>
      )}
      <form className="entry" ref={formRef} onSubmit={handleAdd} style={{ display: licStatus === 'solo_lectura' ? 'none' : undefined }}>
        <div className="entry-title">Nuevo movimiento</div>
        <div className="row">
          <div className="field" style={{ flex: 1.4 }}>
            <label style={monedasActivas.length ? { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 } : undefined}>
              <span>Monto ({moneda === 'PYG' ? '₲' : MONEDAS[moneda].simbolo})</span>
              {monedasActivas.length > 0 && (
                <span className="moneda-pills">
                  {['PYG', ...monedasActivas].map(m => (
                    <button type="button" key={m} className={moneda === m ? 'on' : ''} onClick={() => cambiarMoneda(m)}>{m === 'PYG' ? '₲' : MONEDAS[m].simbolo}</button>
                  ))}
                </span>
              )}
            </label>
            <input type="text" inputMode={moneda === 'PYG' ? 'numeric' : 'decimal'} className="num"
              value={montoDisplay} onChange={handleMontoChange}
              placeholder={moneda === 'PYG' ? '0' : '0,00'} required />
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
              <div className={`amt${t.tipo === 'ingreso' ? ' pos' : ' neg'}${esGuarani(t) ? '' : ' extra'}`}>
                {t.tipo === 'ingreso' ? '+' : '−'} {fmtMoneda(t.monto, t.moneda)}
              </div>
              <button className="del" onClick={() => handleDelete(t.id)} title={isAutoTx(t) ? 'Generado desde Más · borrar de todos modos' : 'Eliminar'} style={isAutoTx(t) ? { opacity: 0.55 } : undefined}>✕</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
