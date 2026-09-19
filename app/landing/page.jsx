'use client';

import { useEffect, useRef, useState } from 'react';
import { DIAS_PRUEBA } from '../../lib/config';

const WA_NUMBER = '595986313704';
const WA_TEXT = encodeURIComponent('Hola, ya probé MiCaja y quiero activar mi cuenta. Mi email registrado es: ');
const WA_HREF = `https://wa.me/${WA_NUMBER}?text=${WA_TEXT}`;

const EASE = 'cubic-bezier(.22,.8,.3,1)';

function useReduced() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

function useInView(options) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) { setInView(true); return; }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setInView(true); io.disconnect(); }
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px', ...options });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, inView];
}

function Reveal({ children, delay = 0, y = 26, style }) {
  const [ref, inView] = useInView();
  const reduced = useReduced();
  const on = inView || reduced;
  return (
    <div
      ref={ref}
      style={{
        ...style,
        opacity: on ? 1 : 0,
        transform: on ? 'none' : `translateY(${y}px)`,
        transition: reduced ? 'none' : `opacity .7s ${EASE} ${delay}ms, transform .7s ${EASE} ${delay}ms`,
        willChange: 'opacity, transform',
      }}
    >
      {children}
    </div>
  );
}

function Counter({ to, active, duration = 1500, prefix = '', sign = '' }) {
  const [v, setV] = useState(0);
  const reduced = useReduced();
  useEffect(() => {
    if (!active) return;
    if (reduced) { setV(to); return; }
    let raf, start;
    const step = (t) => {
      if (start === undefined) start = t;
      const p = Math.min((t - start) / duration, 1);
      setV(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, active, duration, reduced]);
  return <>{sign}{prefix}{v.toLocaleString('es-PY')}</>;
}

const AppleIcon = ({ size = 15, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
    <path d="M17.05 12.54c-.03-2.7 2.2-4 2.3-4.06-1.25-1.83-3.2-2.08-3.9-2.11-1.66-.17-3.24.98-4.08.98-.84 0-2.14-.96-3.52-.93-1.81.03-3.48 1.05-4.41 2.67-1.88 3.26-.48 8.08 1.35 10.72.9 1.29 1.97 2.74 3.38 2.69 1.35-.06 1.86-.87 3.5-.87 1.63 0 2.1.87 3.53.84 1.46-.02 2.38-1.31 3.27-2.61 1.03-1.5 1.46-2.95 1.48-3.02-.03-.02-2.84-1.09-2.87-4.3M14.4 4.58c.74-.9 1.24-2.15 1.11-3.4-1.07.05-2.37.72-3.14 1.61-.69.8-1.29 2.07-1.13 3.29 1.2.09 2.42-.61 3.16-1.5" />
  </svg>
);

const AndroidIcon = ({ size = 15, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
    <path d="M17.6 9.48l1.84-3.18a.38.38 0 0 0-.14-.52.38.38 0 0 0-.52.14l-1.86 3.22a11.4 11.4 0 0 0-9.84 0L5.22 5.92a.38.38 0 0 0-.52-.14.38.38 0 0 0-.14.52L6.4 9.48A10.8 10.8 0 0 0 1 18h22a10.8 10.8 0 0 0-5.4-8.52M7 15.25a1.05 1.05 0 1 1 1.05-1.05A1.05 1.05 0 0 1 7 15.25m10 0a1.05 1.05 0 1 1 1.05-1.05A1.05 1.05 0 0 1 17 15.25" />
  </svg>
);

const WhatsAppIcon = ({ size = 16, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const FEATURES = [
  {
    grad: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
    title: 'Ingresos y gastos',
    desc: 'Registrá cada movimiento al instante y mirá el total de tu caja.',
    svg: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v13M7 10l5 5 5-5"/><path d="M20 20H4"/></svg>,
  },
  {
    grad: 'linear-gradient(135deg,#f59e0b,#ef4444)',
    title: 'Gastos fijos',
    desc: 'Alquiler, internet, servicios: semanales, quincenales o mensuales.',
    svg: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/></svg>,
  },
  {
    grad: 'linear-gradient(135deg,#0ea5e9,#06b6d4)',
    title: 'Cuotas',
    desc: 'Cargá una compra en cuotas y seguí cuánto te falta pagar.',
    svg: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>,
  },
  {
    grad: 'linear-gradient(135deg,#f59e0b,#f97316)',
    title: 'Tarjetas',
    desc: 'Controlá el consumo de cada tarjeta y cuándo vence el pago.',
    svg: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/></svg>,
  },
  {
    grad: 'linear-gradient(135deg,#10b981,#059669)',
    title: 'Cobros',
    desc: 'Anotá lo que te deben, una vez o todos los meses, y marcá cuándo te pagaron.',
    svg: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>,
  },
  {
    grad: 'linear-gradient(135deg,#ec4899,#8b5cf6)',
    title: 'Deudas',
    desc: 'Seguí lo que debés y cuánto ya pagaste de cada una.',
    svg: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  },
  {
    grad: 'linear-gradient(135deg,#ef4444,#f97316)',
    title: 'Metas de ahorro',
    desc: 'Poné un objetivo y mirá cuánto te falta para llegar.',
    svg: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="#fff"/></svg>,
  },
  {
    grad: 'linear-gradient(135deg,#10b981,#0ea5e9)',
    title: 'Recordatorios y proyección',
    desc: 'Un aviso en tu teléfono cuando algo está por vencer, y cuánto vas a tener a fin de mes.',
    svg: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  },
];

FEATURES.push(
  {
    grad: 'linear-gradient(135deg,#0ea5e9,#6366f1)',
    title: 'Dólares y reales',
    desc: 'Anotá lo que tenés en otra moneda, aparte de tus guaraníes, sin mezclar.',
    svg: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  },
  {
    grad: 'linear-gradient(135deg,#8b5cf6,#ec4899)',
    title: 'Una o dos cuentas',
    desc: 'Solo personal, o tu negocio y lo personal separados en el mismo app.',
    svg: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.5c3 0 6 2 6 5.5"/></svg>,
  },
);

// Confianza: qué guardamos y qué no. Todo lo dicho acá es cierto hoy.
const SEGURIDAD = [
  {
    title: 'Sin tarjetas ni datos bancarios',
    desc: 'MiCaja no tiene ningún lugar donde cargar un número de tarjeta, una cuenta bancaria o una clave de banco. No se piden para probar, ni para pagar, ni dentro del app. Solo anotás montos y descripciones que vos elegís.',
  },
  {
    title: 'Tu cuenta es solo tuya',
    desc: 'Cada usuario ve únicamente sus datos: la base tiene reglas que impiden que uno vea los de otro. Tu contraseña se guarda cifrada y la conexión es siempre segura (HTTPS).',
  },
  {
    title: 'Plataformas serias',
    desc: 'MiCaja corre sobre Supabase y Vercel, la misma infraestructura que usan miles de empresas en el mundo. Como no guardamos tarjetas ni claves bancarias, no hay nada que un ladrón pueda usar.',
  },
  {
    title: 'Te vas cuando quieras',
    desc: 'Si un día no querés seguir, escribinos y borramos tu cuenta con todo lo que cargaste. Sin permanencia ni letra chica.',
  },
];

const TESTIMONIOS = [
  { nombre: 'Andrea', rol: 'Tienda de ropa', texto: 'Era justo lo que estaba buscando: simple y fácil de usar. En dos minutos ya tenía cargados mis gastos fijos y sabía cuánto me quedaba del mes.' },
  { nombre: 'Marcos', rol: 'Trabaja por cuenta propia', texto: 'Me gustó cómo se ve y que me avise antes de que venza algo. Pedí un par de cosas, como los recordatorios, y las agregaron.' },
  { nombre: 'Lorena', rol: 'Cobra en dólares', texto: 'Necesitaba anotar aparte lo que cobro en dólares y lo hicieron. Lo mejor es poder hablar directo con la persona que hace el app.' },
];

const PREGUNTAS = [
  { q: '¿Es gratis?', a: `Sí, ${DIAS_PRUEBA} días con todas las funciones y sin tarjeta. Después, si te sirve, cuesta ₲ 80.000 por año, un solo pago.` },
  { q: '¿Qué datos me piden?', a: 'Solo un email y una contraseña para entrar. Ni tarjeta, ni cuenta bancaria, ni documento. Dentro del app anotás lo que vos quieras: montos y descripciones.' },
  { q: '¿Alguien más puede ver mis números?', a: 'No. Cada usuario ve solo lo suyo. La base de datos tiene reglas que impiden ver datos de otra persona.' },
  { q: '¿Se puede hackear?', a: 'Ningún sistema serio promete un 100 %, y desconfiá del que lo haga. MiCaja usa la misma infraestructura que miles de apps en el mundo, con la conexión cifrada y los datos separados por usuario. Y como no guardamos tarjetas ni claves bancarias, no hay nada que un ladrón pueda usar.' },
  { q: '¿Funciona en iPhone y Android?', a: 'Sí, en los dos. Se instala en la pantalla de inicio como cualquier app y también funciona desde el navegador.' },
  { q: '¿Y si cambio de celular?', a: 'Entrás con tu email y tu contraseña desde el nuevo y está todo. Nada se guarda solo en el teléfono.' },
  { q: '¿Necesita internet?', a: 'Sí. Así tus datos quedan siempre guardados y los ves igual desde cualquier celular.' },
  { q: '¿Cómo pago y cómo cancelo?', a: 'Cuando terminan los días de prueba, nos escribís por WhatsApp y lo activamos con una transferencia. Si un año no renovás, no pasa nada: tus datos quedan guardados en modo solo lectura.' },
];

// Pregunta desplegable (una abierta a la vez).
function Pregunta({ q, a, abierta, onToggle }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${abierta ? 'rgba(165,180,252,0.35)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 14, overflow: 'hidden' }}>
      <button type="button" onClick={onToggle} aria-expanded={abierta}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 16px', background: 'none', border: 'none', color: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, textAlign: 'left', cursor: 'pointer' }}>
        <span>{q}</span>
        <span aria-hidden="true" style={{ color: '#a5b4fc', fontSize: 18, lineHeight: 1, transform: abierta ? 'rotate(45deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }}>+</span>
      </button>
      {abierta && (
        <div style={{ padding: '0 16px 14px', fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.65 }}>{a}</div>
      )}
    </div>
  );
}

function Preguntas() {
  const [abierta, setAbierta] = useState(null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {PREGUNTAS.map((p, i) => (
        <Pregunta key={p.q} q={p.q} a={p.a} abierta={abierta === i} onToggle={() => setAbierta(abierta === i ? null : i)} />
      ))}
    </div>
  );
}

const PLAN_ITEMS = [
  'Acceso completo a todas las funciones',
  `${DIAS_PRUEBA} días de prueba gratuita`,
  'Actualizaciones incluidas',
  'Soporte directo por WhatsApp',
];

export default function LandingPage() {
  const [mockRef, mockIn] = useInView({ threshold: 0.35 });
  const reduced = useReduced();

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', fontFamily: 'Inter, system-ui, sans-serif', color: '#fff', overflowX: 'hidden', position: 'relative' }}>
      <style>{`
        @keyframes mc-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-9px) } }
        @keyframes mc-blob { 0%,100% { transform: translate(0,0) scale(1) } 33% { transform: translate(22px,-26px) scale(1.09) } 66% { transform: translate(-18px,16px) scale(.94) } }
        @keyframes mc-shine { 0% { transform: translateX(-130%) } 55%,100% { transform: translateX(240%) } }
        @keyframes mc-ring { 0% { box-shadow: 0 0 0 0 rgba(99,102,241,.45) } 70% { box-shadow: 0 0 0 14px rgba(99,102,241,0) } 100% { box-shadow: 0 0 0 0 rgba(99,102,241,0) } }
        .mc-card { transition: transform .35s ${EASE}, border-color .35s ${EASE}, background .35s ${EASE}; }
        .mc-card:hover { transform: translateY(-4px); border-color: rgba(139,92,246,.45); background: rgba(255,255,255,.07); }
        .mc-btn { transition: transform .25s ${EASE}, box-shadow .25s ${EASE}, background .25s ${EASE}; }
        .mc-btn:hover { transform: translateY(-2px); box-shadow: 0 10px 30px rgba(99,102,241,.55); }
        .mc-btn:active { transform: translateY(0); }
        .mc-ghost { transition: color .25s ${EASE}, border-color .25s ${EASE}, background .25s ${EASE}; }
        .mc-ghost:hover { color: #fff; border-color: rgba(255,255,255,.3); background: rgba(255,255,255,.12); }
        .mc-wa { transition: transform .25s ${EASE}, background .25s ${EASE}; }
        .mc-wa:hover { transform: translateY(-2px); background: rgba(37,211,102,.18); }
        @media (prefers-reduced-motion: reduce) {
          .mc-card, .mc-btn, .mc-ghost, .mc-wa { transition: none !important; }
          [data-anim] { animation: none !important; }
        }
      `}</style>

      {/* Fondo animado */}
      <div aria-hidden="true" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        <div data-anim style={{ position: 'absolute', top: -120, left: -90, width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,.32), transparent 68%)', filter: 'blur(38px)', animation: reduced ? 'none' : 'mc-blob 19s ease-in-out infinite' }} />
        <div data-anim style={{ position: 'absolute', top: 380, right: -110, width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,.24), transparent 68%)', filter: 'blur(42px)', animation: reduced ? 'none' : 'mc-blob 24s ease-in-out infinite reverse' }} />
        <div data-anim style={{ position: 'absolute', bottom: 120, left: -70, width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,.16), transparent 68%)', filter: 'blur(44px)', animation: reduced ? 'none' : 'mc-blob 28s ease-in-out infinite' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* HEADER */}
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', maxWidth: 600, margin: '0 auto', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <img src="/icon-192.png" alt="MiCaja" style={{ width: 38, height: 38, borderRadius: 11, boxShadow: '0 4px 14px rgba(99,102,241,0.4)', flexShrink: 0 }} />
            <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em' }}>MiCaja</span>
          </div>
          <a href="/login" className="mc-ghost" style={{ padding: '9px 20px', borderRadius: 10, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontWeight: 600, fontSize: 13, textDecoration: 'none', flexShrink: 0 }}>
            Ingresar
          </a>
        </header>

        {/* HERO */}
        <section style={{ textAlign: 'center', padding: '44px 24px 40px', maxWidth: 540, margin: '0 auto' }}>
          <Reveal y={14}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 20, padding: '5px 14px', marginBottom: 24, fontSize: 12, color: '#a5b4fc', fontWeight: 600 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              Diseñado para Paraguay · Precio en guaraníes
            </div>
          </Reveal>

          <Reveal delay={90}>
            <h1 style={{ fontSize: 38, fontWeight: 900, lineHeight: 1.1, margin: '0 0 16px', letterSpacing: '-0.03em' }}>
              Controlá tu dinero.<br />
              <span style={{ background: 'linear-gradient(135deg,#6366f1,#a78bfa)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent' }}>Siempre.</span>
            </h1>
          </Reveal>

          <Reveal delay={170}>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, margin: '0 0 22px' }}>
              MiCaja registra tus ingresos, gastos, cuotas, cobros y deudas, te avisa en el teléfono antes de que algo venza y te muestra cómo termina tu mes. Todo desde tu celular.
            </p>
          </Reveal>

          {/* Compatibilidad iOS / Android */}
          <Reveal delay={220}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 999, padding: '7px 16px', marginBottom: 30 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>
                <AppleIcon size={14} color="rgba(255,255,255,0.8)" /> iPhone
              </span>
              <span style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.15)' }} />
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>
                <AndroidIcon size={14} color="#3ddc84" /> Android
              </span>
            </div>
          </Reveal>

          <Reveal delay={270}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
              <a href="/login?registro=1" className="mc-btn"
                style={{ position: 'relative', overflow: 'hidden', display: 'inline-flex', alignItems: 'center', gap: 10, padding: '15px 36px', borderRadius: 14, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontWeight: 800, fontSize: 16, textDecoration: 'none', boxShadow: '0 4px 20px rgba(99,102,241,0.45)' }}>
                <span style={{ position: 'relative', zIndex: 1 }}>Probar gratis →</span>
                <span data-anim aria-hidden="true" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '45%', background: 'linear-gradient(100deg, transparent, rgba(255,255,255,.28), transparent)', animation: reduced ? 'none' : 'mc-shine 3.4s ease-in-out infinite' }} />
              </a>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{DIAS_PRUEBA} días gratis · Sin tarjeta de crédito</div>
              <a href="/login" className="mc-ghost" style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', textDecoration: 'none', marginTop: 4, padding: '6px 14px', borderRadius: 10, border: '1px solid transparent' }}>Ya tengo cuenta → Ingresar</a>
              <a href={WA_HREF} target="_blank" rel="noreferrer" className="mc-wa"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 10, background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.25)', color: '#25d366', fontWeight: 600, fontSize: 13, textDecoration: 'none', marginTop: 4 }}>
                <WhatsAppIcon size={14} color="#25d366" />
                ¿Tenés dudas? Escribinos
              </a>
            </div>
          </Reveal>
        </section>

        {/* MOCKUP */}
        <section ref={mockRef} style={{ padding: '0 20px 52px', maxWidth: 400, margin: '0 auto' }}>
          <div
            data-anim
            style={{
              background: 'linear-gradient(160deg,#1e2d45,#0f1a2e)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 22,
              padding: '22px 20px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              opacity: mockIn || reduced ? 1 : 0,
              transform: mockIn || reduced ? 'none' : 'translateY(28px) scale(.97)',
              transition: reduced ? 'none' : `opacity .8s ${EASE}, transform .8s ${EASE}`,
              animation: reduced || !mockIn ? 'none' : 'mc-float 7s ease-in-out infinite 1s',
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: 18 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Balance total</div>
              <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
                <Counter to={8750000} active={mockIn} prefix="₲ " />
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 3 }}>Acumulado de todos los meses</div>
            </div>

            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'center' }}>Este mes</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1, background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 12, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Ingresos</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: '#34d399', fontVariantNumeric: 'tabular-nums' }}><Counter to={3500000} active={mockIn} prefix="₲ " sign="+" /></span>
                </div>
                <div style={{ flex: 1, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 12, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Gastos</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: '#f87171', fontVariantNumeric: 'tabular-nums' }}><Counter to={1200000} active={mockIn} prefix="₲ " sign="−" /></span>
                </div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '11px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>En caja · este mes</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#34d399', fontVariantNumeric: 'tabular-nums' }}><Counter to={2300000} active={mockIn} prefix="₲ " sign="+" /></span>
              </div>
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'center', marginBottom: 8 }}>Proyección del mes</div>
            <div style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 14, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Por cobrar</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#34d399', fontVariantNumeric: 'tabular-nums' }}><Counter to={800000} active={mockIn} prefix="₲ " sign="+" /></span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Por pagar</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#f87171', fontVariantNumeric: 'tabular-nums' }}><Counter to={350000} active={mockIn} prefix="₲ " sign="−" /></span>
              </div>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Resultado esperado</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#34d399', fontVariantNumeric: 'tabular-nums' }}><Counter to={2750000} active={mockIn} prefix="₲ " sign="+" /></span>
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.22)', marginTop: 12 }}>Ejemplo ilustrativo</div>
        </section>

        {/* FEATURES */}
        <section style={{ padding: '0 20px 56px', maxWidth: 560, margin: '0 auto' }}>
          <Reveal>
            <h2 style={{ fontSize: 22, fontWeight: 800, textAlign: 'center', marginBottom: 8, letterSpacing: '-0.02em' }}>Todo lo que necesitás</h2>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center', margin: '0 0 24px' }}>Todo lo que hace falta para tener tus números claros.</p>
          </Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 70} y={20}>
                <div className="mc-card" style={{ height: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: '18px 16px' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: f.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                    {f.svg}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 5 }}>{f.title}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>{f.desc}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* INSTALACIÓN iOS / ANDROID */}
        <section style={{ padding: '0 20px 56px', maxWidth: 560, margin: '0 auto' }}>
          <Reveal>
            <h2 style={{ fontSize: 22, fontWeight: 800, textAlign: 'center', marginBottom: 8, letterSpacing: '-0.02em' }}>Se instala en tu celular</h2>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center', margin: '0 0 22px' }}>Sin tiendas de aplicaciones. Queda como una app más en tu pantalla de inicio.</p>
          </Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
            <Reveal delay={60}>
              <div className="mc-card" style={{ height: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: '18px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#4b5563,#1f2937)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <AppleIcon size={17} />
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>iPhone · Safari</span>
                </div>
                {['Abrí MiCaja en Safari', 'Tocá el botón Compartir ⬆', 'Elegí "Agregar a pantalla de inicio"'].map((t, i) => (
                  <div key={t} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 7 }}>
                    <span style={{ minWidth: 18, height: 18, borderRadius: 6, background: 'rgba(165,180,252,0.15)', color: '#a5b4fc', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>{t}</span>
                  </div>
                ))}
              </div>
            </Reveal>
            <Reveal delay={130}>
              <div className="mc-card" style={{ height: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: '18px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#3ddc84,#12b76a)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <AndroidIcon size={17} />
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>Android · Chrome</span>
                </div>
                {['Abrí MiCaja en Chrome', 'Tocá el botón "Instalar"', 'Confirmá y listo'].map((t, i) => (
                  <div key={t} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 7 }}>
                    <span style={{ minWidth: 18, height: 18, borderRadius: 6, background: 'rgba(61,220,132,0.15)', color: '#3ddc84', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>{t}</span>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* SEGURIDAD */}
        <section style={{ padding: '0 20px 56px', maxWidth: 560, margin: '0 auto' }}>
          <Reveal>
            <h2 style={{ fontSize: 22, fontWeight: 800, textAlign: 'center', marginBottom: 8, letterSpacing: '-0.02em' }}>Tus datos, seguros</h2>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center', margin: '0 0 24px' }}>Lo que guardamos, lo que no, y por qué podés quedarte tranquilo.</p>
          </Reveal>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {SEGURIDAD.map((s, i) => (
              <Reveal key={s.title} delay={i * 70} y={18}>
                <div className="mc-card" style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '14px 16px' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6z"/><path d="M9 12l2 2 4-4"/></svg>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{s.title}</div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>{s.desc}</div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* QUIÉN ESTÁ DETRÁS */}
        <section style={{ padding: '0 20px 56px', maxWidth: 560, margin: '0 auto' }}>
          <Reveal>
            <div className="mc-card" style={{ background: 'linear-gradient(160deg,rgba(99,102,241,0.14),rgba(139,92,246,0.06))', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 22, padding: '24px 22px', textAlign: 'center' }}>
              <img src="/luis.png" alt="Luis Carlos, creador de MiCaja" width={112} height={112}
                style={{ width: 112, height: 112, borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(165,180,252,0.5)', boxShadow: '0 10px 30px rgba(99,102,241,0.35)', marginBottom: 14, background: '#1e293b' }} />
              <div style={{ fontSize: 12, fontWeight: 700, color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Quién está detrás</div>
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>Hola, soy Luis Carlos González</div>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, margin: 0 }}>
                Soy de Santa Rita, tengo 29 años y hace cuatro años trabajo en marketing con mi agencia, Sublime.
                MiCaja nació en casa: la hice para ordenar las cuentas de mi esposa y las mías, y hoy la uso todos los días también para mi empresa.
                Cada mejora sale de lo que me piden los usuarios, y el soporte lo doy yo mismo por WhatsApp. Si tenés una duda, me escribís y te respondo.
              </p>
            </div>
          </Reveal>
        </section>

        {/* TESTIMONIOS */}
        <section style={{ padding: '0 20px 56px', maxWidth: 560, margin: '0 auto' }}>
          <Reveal>
            <h2 style={{ fontSize: 22, fontWeight: 800, textAlign: 'center', marginBottom: 8, letterSpacing: '-0.02em' }}>Lo que dicen</h2>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center', margin: '0 0 24px' }}>Comentarios de quienes ya lo usan.</p>
          </Reveal>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {TESTIMONIOS.map((t, i) => (
              <Reveal key={t.nombre} delay={i * 80} y={18}>
                <div className="mc-card" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '16px 18px' }}>
                  <div style={{ color: '#fbbf24', fontSize: 13, letterSpacing: 2, marginBottom: 8 }}>★★★★★</div>
                  <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 1.65, margin: '0 0 10px' }}>“{t.texto}”</p>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}><b style={{ color: '#a5b4fc' }}>{t.nombre}</b> · {t.rol}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* PREGUNTAS FRECUENTES */}
        <section style={{ padding: '0 20px 56px', maxWidth: 560, margin: '0 auto' }}>
          <Reveal>
            <h2 style={{ fontSize: 22, fontWeight: 800, textAlign: 'center', marginBottom: 8, letterSpacing: '-0.02em' }}>Preguntas frecuentes</h2>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center', margin: '0 0 24px' }}>Tocá una pregunta para ver la respuesta.</p>
          </Reveal>
          <Reveal delay={80}>
            <Preguntas />
          </Reveal>
        </section>

        {/* PRICING */}
        <section style={{ padding: '0 20px 56px', maxWidth: 400, margin: '0 auto' }}>
          <Reveal>
            <div data-anim style={{ background: 'linear-gradient(160deg,rgba(99,102,241,0.2),rgba(139,92,246,0.1))', border: '1px solid rgba(99,102,241,0.35)', borderRadius: 24, padding: '32px 28px', textAlign: 'center', animation: reduced ? 'none' : 'mc-ring 3.6s ease-out infinite 1.2s' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Precio</div>
              <div style={{ fontSize: 44, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1 }}>₲ 80.000</div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginTop: 6, marginBottom: 28 }}>por año · un solo pago</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28, textAlign: 'left' }}>
                {PLAN_ITEMS.map((item) => (
                  <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 20, height: 20, borderRadius: 6, background: 'rgba(52,211,153,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>{item}</span>
                  </div>
                ))}
              </div>
              {/* Cómo funciona: primero se prueba gratis, la activación viene después */}
              <div style={{ textAlign: 'left', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '14px 16px', marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Cómo funciona</div>
                {[
                  <>Creás tu cuenta y usás MiCaja <b style={{ color: '#fff' }}>{DIAS_PRUEBA} días gratis</b>, con todo, sin tarjeta.</>,
                  <>Si te sirve, nos escribís por WhatsApp y <b style={{ color: '#fff' }}>activamos tu cuenta</b> por ₲ 80.000 al año.</>,
                  <>Tus datos quedan tal cual: <b style={{ color: '#fff' }}>no cargás nada de nuevo</b>.</>,
                ].map((t, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: i < 2 ? 8 : 0 }}>
                    <span style={{ minWidth: 20, height: 20, borderRadius: 7, background: 'rgba(165,180,252,0.18)', color: '#a5b4fc', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>{t}</span>
                  </div>
                ))}
              </div>
              <a href="/login?registro=1" className="mc-btn"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '15px 24px', borderRadius: 14, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontWeight: 800, fontSize: 15, textDecoration: 'none', marginBottom: 10 }}>
                Empezar los {DIAS_PRUEBA} días gratis →
              </a>
              <a href={WA_HREF} target="_blank" rel="noreferrer" className="mc-ghost"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 20px', borderRadius: 12, background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.25)', color: '#25d366', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
                <WhatsAppIcon size={15} color="#25d366" />
                ¿Ya probaste? Activá tu cuenta por WhatsApp
              </a>
            </div>
          </Reveal>
        </section>

        {/* FOOTER */}
        <footer style={{ textAlign: 'center', padding: '0 20px 40px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ paddingTop: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
            <img src="/icon-192.png" alt="MiCaja" style={{ width: 28, height: 28, borderRadius: 8 }} />
            <span style={{ fontWeight: 800, fontSize: 15 }}>MiCaja</span>
          </div>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', margin: '0 0 14px' }}>Tu caja, tus finanzas · Paraguay</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
            <a href="/login" style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>Ingresar</a>
            <a href="/login?registro=1" style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>Crear cuenta</a>
            <a href={WA_HREF} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>WhatsApp</a>
          </div>
        </footer>

      </div>
    </div>
  );
}
