'use client';
import { useEffect, useRef, useState } from 'react';
import { CAPITULOS, urlCapitulo } from '../lib/tutorial';

// Tutorial "Cómo se usa MiCaja": los 16 capítulos uno atrás del otro.
//
// Se maneja como las historias del teléfono, que es lo que la gente ya sabe
// usar: tocás a la derecha y pasás al siguiente, tocás a la izquierda y volvés
// al anterior, tocás en el medio y se pausa. Arriba, una barrita por capítulo
// muestra dónde estás. Y está la lista con los nombres, para ir directo al que
// interesa.
//
// `puedeSalir` decide si hay salida: la primera vez (cuando se abre solo) no
// hay X, pero sí un "Seguir después" discreto, para que nadie quede encerrado
// si entró apurado a anotar un gasto. Entrando desde Perfil hay X normal.

export default function Tutorial({ alSalir, alTerminar, puedeSalir = false }) {
  const [i, setI] = useState(0);
  const [lista, setLista] = useState(false);
  const [pausado, setPausado] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const videoRef = useRef(null);

  // Cada vez que cambia el capítulo, el video arranca de cero.
  useEffect(() => {
    setCargando(true);
    setError(false);
    setPausado(false);
    const v = videoRef.current;
    if (v) { v.load(); v.play().catch(() => {}); }
  }, [i]);

  const ultimo = i >= CAPITULOS.length - 1;

  function siguiente() {
    if (ultimo) { alTerminar?.(); return; }
    setI(n => n + 1);
  }
  function anterior() {
    if (i === 0) { const v = videoRef.current; if (v) v.currentTime = 0; return; }
    setI(n => n - 1);
  }
  function pausaOSigue() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play().catch(() => {}); setPausado(false); }
    else { v.pause(); setPausado(true); }
  }

  // Teclado, para quien lo mire en la computadora.
  useEffect(() => {
    function tecla(e) {
      if (e.key === 'ArrowRight') siguiente();
      else if (e.key === 'ArrowLeft') anterior();
      else if (e.key === ' ') { e.preventDefault(); pausaOSigue(); }
    }
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  });

  const zona = { position: 'absolute', top: 0, bottom: 0, width: '33%', zIndex: 3, cursor: 'pointer', background: 'transparent', border: 'none', padding: 0 };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: '#05070f', display: 'flex', flexDirection: 'column' }}>

      {/* Barritas de avance: una por capítulo, como en las historias. */}
      <div style={{ display: 'flex', gap: 3, padding: '10px 12px 6px', flexShrink: 0 }}>
        {CAPITULOS.map((_, n) => (
          <div key={n} style={{ flex: 1, height: 3, borderRadius: 2, background: n < i ? '#a5b4fc' : n === i ? 'rgba(165,180,252,0.55)' : 'rgba(255,255,255,0.18)' }} />
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 14px 10px', flexShrink: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Capítulo {i + 1} de {CAPITULOS.length}
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {CAPITULOS[i].titulo}
          </div>
        </div>
        <button type="button" onClick={() => setLista(v => !v)}
          style={{ flexShrink: 0, padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          {lista ? 'Cerrar lista' : 'Capítulos'}
        </button>
        {puedeSalir && (
          <button type="button" onClick={alSalir} aria-label="Cerrar"
            style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 10, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.75)', fontSize: 16, cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1 }}>✕</button>
        )}
      </div>

      {/* El video, con las tres zonas de toque encima. */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0, background: '#000' }}>
        <video
          ref={videoRef}
          src={urlCapitulo(i)}
          playsInline
          autoPlay
          preload="auto"
          onEnded={siguiente}
          onCanPlay={() => setCargando(false)}
          onWaiting={() => setCargando(true)}
          onPlaying={() => setCargando(false)}
          onError={() => { setCargando(false); setError(true); }}
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        />

        <button type="button" aria-label="Capítulo anterior" onClick={anterior} style={{ ...zona, left: 0 }} />
        <button type="button" aria-label="Pausar" onClick={pausaOSigue} style={{ ...zona, left: '33%', width: '34%' }} />
        <button type="button" aria-label="Capítulo siguiente" onClick={siguiente} style={{ ...zona, right: 0 }} />

        {cargando && !error && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 13, pointerEvents: 'none' }}>Cargando…</div>
        )}
        {pausado && !cargando && !error && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ width: 60, height: 60, borderRadius: 30, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#fff' }}>▶</div>
          </div>
        )}
        {error && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, textAlign: 'center', zIndex: 4 }}>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', lineHeight: 1.6 }}>No se pudo cargar este video.<br />Puede ser la conexión.</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => { setError(false); setCargando(true); videoRef.current?.load(); }}
                style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(165,180,252,0.5)', background: 'rgba(99,102,241,0.25)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Reintentar</button>
              <button type="button" onClick={siguiente}
                style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Saltar</button>
            </div>
          </div>
        )}

        {/* Lista de capítulos, para ir directo a uno. */}
        {lista && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 5, background: 'rgba(5,7,15,0.96)', overflowY: 'auto', padding: '10px 12px 20px' }}>
            {CAPITULOS.map((c, n) => (
              <button type="button" key={c.archivo} onClick={() => { setI(n); setLista(false); }}
                style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 12px', marginBottom: 6, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
                  border: `1px solid ${n === i ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.1)'}`,
                  background: n === i ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: n < i ? '#34d399' : n === i ? '#a5b4fc' : 'rgba(255,255,255,0.35)', minWidth: 22 }}>
                  {n < i ? '✓' : String(n + 1).padStart(2, '0')}
                </span>
                <span style={{ fontSize: 13, fontWeight: n === i ? 800 : 600, color: n === i ? '#fff' : 'rgba(255,255,255,0.7)' }}>{c.titulo}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Pie: avanzar, terminar, o dejarlo para después. */}
      <div style={{ flexShrink: 0, padding: '12px 14px calc(14px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button type="button" onClick={siguiente}
          style={{ width: '100%', padding: '13px 16px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(99,102,241,0.35)' }}>
          {ultimo ? 'Listo, ya sé usar MiCaja' : 'Siguiente capítulo →'}
        </button>
        {!puedeSalir && !ultimo && (
          <button type="button" onClick={alSalir}
            style={{ width: '100%', background: 'none', border: 'none', color: 'rgba(255,255,255,0.45)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', padding: '4px 0', textDecoration: 'underline' }}>
            Seguir después
          </button>
        )}
      </div>
    </div>
  );
}
