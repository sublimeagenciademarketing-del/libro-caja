'use client';

// Convertidor de monedas: una calculadora chica para pasar un monto de una
// moneda a otra con la cotización que escribe la persona (no hay cotización
// automática: cada banco y casa de cambio tiene la suya). Solo aparece con
// monedas extra activadas. La última cotización de cada par se recuerda en
// el teléfono. Tocar el resultado lo copia para pegarlo donde haga falta.

import { useEffect, useRef, useState } from 'react';
import { MONEDAS, fmtMoneda, leerMonto } from '../lib/monedas';

const NOMBRE = { PYG: 'Guaraníes', USD: 'Dólares', BRL: 'Reales' };
const simbolo = (m) => (m === 'PYG' ? '₲' : MONEDAS[m]?.simbolo || m);

// La cotización siempre se expresa como "1 moneda fuerte = X moneda débil":
// 1 US$ = ₲ 7.300, 1 R$ = ₲ 1.350, 1 US$ = R$ 5,40.
const FUERZA = { USD: 0, BRL: 1, PYG: 2 };
const par = (a, b) => (FUERZA[a] < FUERZA[b] ? [a, b] : [b, a]);

// Texto sin símbolo, listo para pegar en un campo de monto ("7.300.000" o "1.234,50").
const textoParaCopiar = (n, moneda) => fmtMoneda(n, moneda).replace(/^\S+\s/, '');

export function BotonConvertir({ onClick, style, title = 'Convertir monedas' }) {
  return (
    <button type="button" onClick={onClick} title={title} aria-label={title}
      style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, ...style }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h14M14 3l4 4-4 4"/><path d="M20 17H6M10 13l-4 4 4 4"/></svg>
    </button>
  );
}

export default function Convertidor({ userId, monedas, onCerrar }) {
  const opciones = ['PYG', ...(monedas || []).filter(m => MONEDAS[m])];
  const claveCot = `cotizaciones_${userId}`;
  const [de, setDe] = useState(opciones[1] || 'PYG');
  const [a, setA] = useState('PYG');
  const [montoTxt, setMontoTxt] = useState('');
  const [cotTxt, setCotTxt] = useState('');
  const [copiado, setCopiado] = useState(false);
  const montoRef = useRef(null);

  const [fuerte, debil] = par(de, a);
  const clavePar = `${fuerte}_${debil}`;

  // Cotización recordada para este par.
  useEffect(() => {
    try {
      const guardadas = JSON.parse(localStorage.getItem(claveCot) || '{}');
      setCotTxt(guardadas[clavePar] ? leerMonto(String(guardadas[clavePar]).replace('.', ','), debil).display : '');
    } catch { setCotTxt(''); }
  }, [claveCot, clavePar, debil]);

  useEffect(() => { montoRef.current?.focus(); }, []);

  const monto = Number(leerMonto(montoTxt, de).valor) || 0;
  const cot = Number(leerMonto(cotTxt, debil).valor) || 0;
  const resultado = cot > 0 && monto > 0 ? (de === fuerte ? monto * cot : monto / cot) : null;

  function elegirDe(m) { setDe(m); if (m === a) setA(de); setCopiado(false); }
  function elegirA(m) { setA(m); if (m === de) setDe(a); setCopiado(false); }
  function invertir() { setDe(a); setA(de); setCopiado(false); }

  function cambiarCot(e) {
    const { valor, display } = leerMonto(e.target.value, debil);
    setCotTxt(display);
    setCopiado(false);
    try {
      const guardadas = JSON.parse(localStorage.getItem(claveCot) || '{}');
      if (Number(valor) > 0) guardadas[clavePar] = Number(valor); else delete guardadas[clavePar];
      localStorage.setItem(claveCot, JSON.stringify(guardadas));
    } catch {}
  }

  async function copiar() {
    if (resultado === null) return;
    const texto = textoParaCopiar(resultado, a);
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(texto);
      else {
        const ta = document.createElement('textarea');
        ta.value = texto; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
      }
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {}
  }

  const pills = (valor, onElegir) => (
    <div style={{ display: 'flex', gap: 6 }}>
      {opciones.map(m => (
        <button key={m} type="button" onClick={() => onElegir(m)}
          style={{ flex: 1, padding: '9px 0', borderRadius: 10, fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            border: `1px solid ${valor === m ? 'rgba(165,180,252,0.6)' : 'rgba(255,255,255,0.12)'}`,
            background: valor === m ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
            color: valor === m ? '#a5b4fc' : 'rgba(255,255,255,0.55)' }}>
          {simbolo(m)}
        </button>
      ))}
    </div>
  );

  const etiqueta = { fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 };
  const campo = { width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '11px 14px', color: '#fff', fontSize: 16, fontWeight: 700, fontFamily: 'inherit', outline: 'none' };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '56px 12px 12px', overflowY: 'auto' }} onClick={onCerrar}>
      <div role="dialog" aria-label="Convertir monedas" onClick={e => e.stopPropagation()}
        style={{ width: 'min(100%, 360px)', background: '#0f1f35', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20, padding: 20, boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#0ea5e9,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h14M14 3l4 4-4 4"/><path d="M20 17H6M10 13l-4 4 4 4"/></svg>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Convertir</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>{NOMBRE[de]} → {NOMBRE[a]}</div>
            </div>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: 'rgba(255,255,255,0.5)', width: 28, height: 28, borderRadius: 8, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={etiqueta}>De</div>
            {pills(de, elegirDe)}
          </div>
          <button type="button" onClick={invertir} aria-label="Invertir" title="Invertir"
            style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⇄</button>
          <div style={{ flex: 1 }}>
            <div style={etiqueta}>A</div>
            {pills(a, elegirA)}
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={etiqueta}>Monto en {simbolo(de)}</div>
          <input ref={montoRef} type="text" inputMode={de === 'PYG' ? 'numeric' : 'decimal'} value={montoTxt} placeholder={de === 'PYG' ? '0' : '0,00'}
            onChange={e => { setMontoTxt(leerMonto(e.target.value, de).display); setCopiado(false); }} style={campo} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={etiqueta}>Cotización</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: 600, whiteSpace: 'nowrap' }}>1 {simbolo(fuerte)} =</span>
            <input type="text" inputMode={debil === 'PYG' ? 'numeric' : 'decimal'} value={cotTxt} placeholder={debil === 'PYG' ? 'Ej.: 7.300' : 'Ej.: 5,40'}
              onChange={cambiarCot} style={{ ...campo, fontSize: 15 }} />
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>{simbolo(debil)}</span>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 6, lineHeight: 1.5 }}>Escribí la cotización del día. Se guarda en este teléfono para la próxima vez.</div>
        </div>

        <button type="button" onClick={copiar} disabled={resultado === null}
          style={{ width: '100%', textAlign: 'left', background: resultado === null ? 'rgba(255,255,255,0.03)' : 'rgba(99,102,241,0.12)', border: `1px solid ${resultado === null ? 'rgba(255,255,255,0.08)' : 'rgba(99,102,241,0.35)'}`, borderRadius: 14, padding: '12px 14px', cursor: resultado === null ? 'default' : 'pointer', fontFamily: 'inherit' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Resultado en {simbolo(a)}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: copiado ? '#34d399' : 'rgba(165,180,252,0.8)' }}>{copiado ? 'Copiado ✓' : resultado === null ? '' : 'Tocá para copiar'}</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#fff', marginTop: 4, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
            {resultado === null ? '—' : fmtMoneda(resultado, a)}
          </div>
          {resultado === null && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>Cargá el monto y la cotización.</div>
          )}
        </button>
      </div>
    </div>
  );
}
