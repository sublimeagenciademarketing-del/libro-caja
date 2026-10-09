'use client';
import { useRef, useState } from 'react';
import { VIDEOS_BASE } from '../lib/tutorial';

// Video vertical para la página de ventas.
//
// Reglas que seguimos acá:
//  * No arranca solo. La mayoría entra con datos del celular, así que no se
//    descarga ni un byte hasta que la persona toca play (preload="none").
//  * Antes de tocar se ve una portada, nunca un cuadro negro.
//  * Va vertical y sin recortar: el app también se abre vertical en la
//    computadora, así que se ve igual a la realidad.
//  * Los videos traen los subtítulos grabados, así que se entienden sin sonido.

export default function VideoVertical({ archivo, poster, titulo, descripcion }) {
  const [arrancado, setArrancado] = useState(false);
  const videoRef = useRef(null);

  function reproducir() {
    setArrancado(true);
    const v = videoRef.current;
    if (v) { v.play().catch(() => {}); }
  }

  return (
    <div style={{ maxWidth: 300, margin: '0 auto' }}>
      {titulo && (
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>{titulo}</div>
          {descripcion && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4, lineHeight: 1.5 }}>{descripcion}</div>}
        </div>
      )}
      <div style={{ position: 'relative', borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.12)', background: '#05070f', aspectRatio: '9 / 16', boxShadow: '0 12px 40px rgba(0,0,0,0.45)' }}>
        <video
          ref={videoRef}
          src={`${VIDEOS_BASE}/${archivo}`}
          poster={`${VIDEOS_BASE}/${poster}`}
          preload="none"
          playsInline
          controls={arrancado}
          onEnded={() => setArrancado(false)}
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        />
        {!arrancado && (
          <button type="button" onClick={reproducir} aria-label={`Reproducir: ${titulo || archivo}`}
            style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'rgba(5,7,15,0.25)', cursor: 'pointer', padding: 0 }}>
            <span style={{ width: 62, height: 62, borderRadius: 31, background: 'rgba(99,102,241,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 24px rgba(0,0,0,0.5)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#fff"><polygon points="7 4 20 12 7 20 7 4" /></svg>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
