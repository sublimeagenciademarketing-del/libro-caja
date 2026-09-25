'use client';

// Cartel grande que tapa la pantalla, para los avisos que la gente tiene que
// leer sí o sí (ingreso, registro, contraseña). Un ícono, un título, un texto
// y uno o dos botones claros.

export const btnPrimario = { width: '100%', padding: '13px 16px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(99,102,241,0.35)' };
export const btnSecundario = { width: '100%', padding: '11px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
export const btnLink = { background: 'none', border: 'none', color: 'rgba(255,255,255,0.45)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', padding: '6px 0 0', textDecoration: 'underline' };
export const textoCartel = { fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6, margin: 0 };
// Un dato destacado dentro del texto (el email, por ejemplo).
export const Destacado = ({ children }) => <span style={{ display: 'block', fontSize: 17, fontWeight: 800, color: '#fff', margin: '8px 0 12px', wordBreak: 'break-all' }}>{children}</span>;

export default function Cartel({ icono, titulo, children, botones, onCerrar }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(2,6,23,0.8)', display: 'flex', justifyContent: 'center', padding: 16, overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }} onClick={onCerrar}>
      {/* margin auto en vez de alignItems: center. Centra el cartel cuando entra,
          y cuando es más alto que la pantalla deja deslizarlo entero en vez de
          cortarlo arriba y abajo. */}
      <div role="dialog" aria-label={titulo} onClick={e => e.stopPropagation()}
        style={{ width: 'min(100%, 380px)', margin: 'auto', flexShrink: 0, background: '#0f1f35', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 22, padding: '26px 22px 20px', boxShadow: '0 12px 48px rgba(0,0,0,0.6)', textAlign: 'center' }}>
        <div style={{ fontSize: 40, lineHeight: 1, marginBottom: 12 }}>{icono}</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 10, letterSpacing: '-0.01em' }}>{titulo}</div>
        {children}
        {botones && <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 18 }}>{botones}</div>}
      </div>
    </div>
  );
}
