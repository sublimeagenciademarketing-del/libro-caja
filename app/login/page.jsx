'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { DIAS_PRUEBA } from '../../lib/config';
import Cartel, { btnPrimario, btnSecundario, btnLink, textoCartel, Destacado } from '../../components/Cartel';

// Dominios de correo frecuentes en Paraguay y errores típicos al escribirlos.
// Si el email se parece a uno conocido pero no coincide, se pregunta antes de
// crear la cuenta ("¿Quisiste decir …@gmail.com?").
const DOMINIOS = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'icloud.com', 'live.com', 'hotmail.es', 'outlook.es', 'yahoo.com.ar', 'protonmail.com'];
const TYPOS = {
  'gmail.con': 'gmail.com', 'gmail.co': 'gmail.com', 'gmail.cm': 'gmail.com', 'gmail.om': 'gmail.com', 'gmail.comm': 'gmail.com',
  'gmai.com': 'gmail.com', 'gmial.com': 'gmail.com', 'gamil.com': 'gmail.com', 'gnail.com': 'gmail.com', 'gmaill.com': 'gmail.com', 'gemail.com': 'gmail.com',
  'hotmail.con': 'hotmail.com', 'hotmail.co': 'hotmail.com', 'hotmial.com': 'hotmail.com', 'hotmal.com': 'hotmail.com', 'homail.com': 'hotmail.com', 'hotmai.com': 'hotmail.com',
  'outlook.con': 'outlook.com', 'outlok.com': 'outlook.com', 'outloo.com': 'outlook.com',
  'yahoo.con': 'yahoo.com', 'yaho.com': 'yahoo.com', 'yahooo.com': 'yahoo.com',
  'icloud.con': 'icloud.com', 'iclou.com': 'icloud.com',
};
function distancia(a, b) {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return d[m][n];
}
// Devuelve el email corregido si parece mal escrito; null si está bien o no se parece a nada conocido.
export function sugerirEmail(email) {
  const [usuario, dominio] = (email || '').split('@');
  if (!usuario || !dominio || dominio.includes('@')) return null;
  if (DOMINIOS.includes(dominio)) return null;
  if (TYPOS[dominio]) return `${usuario}@${TYPOS[dominio]}`;
  const parecido = DOMINIOS.find(d => distancia(dominio, d) <= 2);
  return parecido ? `${usuario}@${parecido}` : null;
}
const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

// ¿Este email ya tiene cuenta? 'no_existe' | 'sin_confirmar' | 'confirmado' | null (si la consulta falla).
async function estadoEmail(email) {
  try {
    const { data, error } = await supabase.rpc('estado_email', { p_email: email });
    return error ? null : data;
  } catch { return null; }
}

export default function LoginPage() {
  const [tab, setTab] = useState('login'); // 'login' | 'register' | 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [passMal, setPassMal] = useState(false);   // contraseña incorrecta: se destaca "Recuperar contraseña"
  const [aviso, setAviso] = useState(null);        // cartel grande: { tipo, email, sugerido }
  const [emailRevisado, setEmailRevisado] = useState(''); // el usuario confirmó que su email "raro" está bien
  const [reenvio, setReenvio] = useState('');      // estado del botón "Reenviar email"
  const router = useRouter();

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get('registro') === '1') setTab('register');
    // Solo en desarrollo: ver los carteles sin crear cuentas.
    if (process.env.NODE_ENV === 'development' && q.get('demo')) setAviso({ tipo: q.get('demo'), email: 'prueba@gmail.com', sugerido: 'prueba@gmail.com' });
  }, []);

  const limpiar = () => { setError(''); setSuccess(''); setPassMal(false); };
  const irA = (t) => { setTab(t); limpiar(); setAviso(null); };
  const emailLimpio = () => email.trim().toLowerCase();

  async function handleLogin(e) {
    e.preventDefault();
    limpiar();
    const em = emailLimpio();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: em, password });
    if (!error) { router.push('/'); return; }
    // No entró: se averigua por qué, para decirlo claro.
    const estado = await estadoEmail(em);
    setLoading(false);
    if (estado === 'no_existe') { setAviso({ tipo: 'sin_cuenta', email: em }); return; }
    if (estado === 'sin_confirmar') { setAviso({ tipo: 'sin_confirmar', email: em }); return; }
    if (estado === 'confirmado') { setError('La contraseña no es correcta.'); setPassMal(true); return; }
    setError('Email o contraseña incorrectos.');
  }

  async function handleRegister(e, emailConfirmado) {
    if (e) e.preventDefault();
    limpiar();
    const em = (emailConfirmado || emailLimpio());
    if (!emailValido(em)) { setError('Escribí un email válido, por ejemplo nombre@gmail.com.'); return; }
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return; }
    // ¿Parece mal escrito? Se pregunta una vez antes de crear la cuenta.
    const sugerido = sugerirEmail(em);
    if (sugerido && emailRevisado !== em && !emailConfirmado) { setAviso({ tipo: 'sugerencia', email: em, sugerido }); return; }
    setLoading(true);
    const estado = await estadoEmail(em);
    if (estado === 'confirmado') { setLoading(false); setAviso({ tipo: 'ya_existe', email: em }); return; }
    if (estado === 'sin_confirmar') { setLoading(false); setAviso({ tipo: 'sin_confirmar', email: em }); return; }
    const { error } = await supabase.auth.signUp({ email: em, password });
    setLoading(false);
    if (error) { setError('No se pudo crear la cuenta. Revisá el email e intentá de nuevo.'); return; }
    setEmail(em);
    setTab('login');
    setAviso({ tipo: 'confirmar_registro', email: em });
  }

  async function handleForgot(e) {
    e.preventDefault();
    limpiar();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(emailLimpio(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) { setError('No se pudo enviar el email.'); return; }
    setAviso({ tipo: 'recuperar_enviado', email: emailLimpio() });
  }

  // Vuelve a mandar el correo de confirmación (Supabase permite uno por minuto).
  async function reenviarConfirmacion(em) {
    setReenvio('enviando');
    const { error } = await supabase.auth.resend({ type: 'signup', email: em });
    if (error) { setReenvio(/rate|seconds|limit/i.test(error.message) ? 'esperar' : 'error'); return; }
    setReenvio('enviado');
  }

  const cerrarAviso = () => { setAviso(null); setReenvio(''); };

  return (
    <div className="login-wrap">
      <div className="login-logo">
        <img src="/icon-192.png" alt="MiCaja" style={{ width: 64, height: 64, borderRadius: 18, boxShadow: '0 8px 24px rgba(99,102,241,0.4)' }} />
      </div>
      <h1>MiCaja</h1>
      <p className="sub">Tu caja, tus finanzas.</p>

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 4 }}>
        <button onClick={() => irA('login')} style={tabBtn(tab === 'login')}>Iniciar sesión</button>
        <button onClick={() => irA('register')} style={tabBtn(tab === 'register')}>Registrarse</button>
      </div>

      <div className="login-form">
        {tab === 'login' && (
          <form onSubmit={handleLogin}>
            <div className="field">
              <label>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="tu@email.com" autoComplete="email" />
            </div>
            <div className="field">
              <label>Contraseña</label>
              <div style={{ position: 'relative' }}>
                <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" style={{ paddingRight: 44 }} autoComplete="current-password" />
                <button type="button" onClick={() => setShowPass(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'rgba(255,255,255,0.4)', padding: 0 }}>{showPass ? '🙈' : '👁️'}</button>
              </div>
            </div>
            {error && <p className="error">{error}</p>}
            {success && <p style={{ color: '#34d399', fontSize: 13, marginTop: 8 }}>{success}</p>}
            <button className="primary-btn" type="submit" disabled={loading}>{loading ? 'Entrando...' : 'Entrar →'}</button>
            {passMal ? (
              <button type="button" onClick={() => irA('forgot')} style={{ width: '100%', marginTop: 10, padding: '11px 14px', borderRadius: 12, border: '1px solid rgba(251,191,36,0.4)', background: 'rgba(251,191,36,0.1)', color: '#fbbf24', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                ¿No la recordás? Recuperar contraseña →
              </button>
            ) : (
              <button type="button" onClick={() => irA('forgot')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 12, cursor: 'pointer', marginTop: 10, fontFamily: 'inherit', padding: 0 }}>
                ¿Olvidaste tu contraseña?
              </button>
            )}
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 14, lineHeight: 1.5 }}>
              ¿Es tu primera vez? <button type="button" onClick={() => irA('register')} style={{ background: 'none', border: 'none', color: '#a5b4fc', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>Registrate acá</button>
            </p>
          </form>
        )}

        {tab === 'register' && (
          <form onSubmit={handleRegister}>
            <div className="field">
              <label>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="tu@email.com" autoComplete="email" />
            </div>
            <div className="field">
              <label>Contraseña</label>
              <div style={{ position: 'relative' }}>
                <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required placeholder="Mínimo 6 caracteres" style={{ paddingRight: 44 }} autoComplete="new-password" />
                <button type="button" onClick={() => setShowPass(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'rgba(255,255,255,0.4)', padding: 0 }}>{showPass ? '🙈' : '👁️'}</button>
              </div>
            </div>
            {error && <p className="error">{error}</p>}
            {success && <p style={{ color: '#34d399', fontSize: 13, marginTop: 8 }}>{success}</p>}
            <button className="primary-btn" type="submit" disabled={loading}>{loading ? 'Creando cuenta...' : 'Crear cuenta →'}</button>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 12, lineHeight: 1.5 }}>
              Después de crearla vas a recibir un email para confirmarla. Escribí bien tu correo: ahí te llega el enlace.
            </p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 8, lineHeight: 1.5 }}>
              ¿Ya tenés cuenta? <button type="button" onClick={() => irA('login')} style={{ background: 'none', border: 'none', color: '#a5b4fc', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>Iniciá sesión</button>
            </p>
          </form>
        )}

        {tab === 'forgot' && (
          <form onSubmit={handleForgot}>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 16 }}>Ingresá tu email y te enviamos un enlace para restablecer tu contraseña.</p>
            <div className="field">
              <label>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="tu@email.com" autoComplete="email" />
            </div>
            {error && <p className="error">{error}</p>}
            {success && <p style={{ color: '#34d399', fontSize: 13, marginTop: 8 }}>{success}</p>}
            <button className="primary-btn" type="submit" disabled={loading}>{loading ? 'Enviando...' : 'Enviar enlace →'}</button>
            <button type="button" onClick={() => irA('login')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 12, cursor: 'pointer', marginTop: 10, fontFamily: 'inherit', padding: 0 }}>
              ← Volver al inicio de sesión
            </button>
          </form>
        )}
      </div>

      {aviso && (
        <Aviso aviso={aviso} reenvio={reenvio} diasPrueba={DIAS_PRUEBA}
          onCerrar={cerrarAviso}
          onReenviar={() => reenviarConfirmacion(aviso.email)}
          onRegistrarme={() => { setEmail(aviso.email); irA('register'); }}
          onEntrar={() => { setEmail(aviso.email); setPassword(''); irA('login'); }}
          onRecuperar={() => { setEmail(aviso.email); irA('forgot'); }}
          onCorregirEmail={() => { irA('register'); }}
          onUsarSugerido={() => { setEmail(aviso.sugerido); setAviso(null); handleRegister(null, aviso.sugerido); }}
          onDejarComoEsta={() => { setEmailRevisado(aviso.email); setAviso(null); handleRegister(null, aviso.email); }}
        />
      )}
    </div>
  );
}

// Cartel grande que tapa la pantalla: se usa cuando el mensaje chico no alcanza
// (la persona no tiene cuenta, no confirmó el email, o acaba de registrarse).
function Aviso({ aviso, reenvio, diasPrueba, onCerrar, onReenviar, onRegistrarme, onEntrar, onRecuperar, onCorregirEmail, onUsarSugerido, onDejarComoEsta }) {
  const { tipo, email, sugerido } = aviso;
  const Email = () => <Destacado>{email}</Destacado>;
  const texto = textoCartel;
  const textoReenvio = { enviando: 'Enviando…', enviado: '✓ Email reenviado. Mirá tu bandeja de entrada y Spam.', esperar: 'Esperá un minuto antes de reenviar.', error: 'No se pudo reenviar. Probá de nuevo en un rato.' }[reenvio];
  const botonReenviar = (
    <>
      <button type="button" onClick={onReenviar} disabled={reenvio === 'enviando' || reenvio === 'enviado'} style={{ ...btnSecundario, opacity: reenvio === 'enviado' ? 0.7 : 1 }}>
        {reenvio === 'enviado' ? '✓ Reenviado' : 'Reenviar email'}
      </button>
      {textoReenvio && <div style={{ fontSize: 12, color: reenvio === 'enviado' ? '#34d399' : '#fbbf24', textAlign: 'center' }}>{textoReenvio}</div>}
    </>
  );

  const contenido = {
    sin_cuenta: {
      icono: '👋', titulo: 'Todavía no tenés cuenta',
      cuerpo: <p style={texto}>El email <Email /> no está registrado en MiCaja. Para empezar, creá tu cuenta: es gratis por {diasPrueba} días y no pide tarjeta.</p>,
      botones: <><button type="button" onClick={onRegistrarme} style={btnPrimario}>Registrarme con este email →</button><button type="button" onClick={onCerrar} style={btnLink}>Usé otro email, quiero corregirlo</button></>,
    },
    sin_confirmar: {
      icono: '✉️', titulo: 'Falta confirmar tu email',
      cuerpo: <p style={texto}>Tu cuenta con <Email /> está creada, pero todavía no confirmaste el email. Buscá el correo de MiCaja (mirá también en <b style={{ color: '#fff' }}>Spam</b> o <b style={{ color: '#fff' }}>Promociones</b>) y tocá el botón de confirmar. Recién después vas a poder entrar.</p>,
      botones: <>{botonReenviar}<button type="button" onClick={onEntrar} style={btnPrimario}>Ya confirmé → Entrar</button><button type="button" onClick={onCorregirEmail} style={btnLink}>Escribí mal mi email, quiero registrarme de nuevo</button></>,
    },
    confirmar_registro: {
      icono: '📬', titulo: '¡Falta un paso!',
      cuerpo: <p style={texto}>Te enviamos un correo a <Email /> Abrilo y tocá el botón para <b style={{ color: '#fff' }}>confirmar tu cuenta</b>. Hasta que no lo hagas, no vas a poder entrar.<br /><span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>¿No te llega? Puede tardar un par de minutos. Mirá en Spam o Promociones.</span></p>,
      botones: <>{botonReenviar}<button type="button" onClick={onEntrar} style={btnPrimario}>Ya confirmé → Entrar</button><button type="button" onClick={onCorregirEmail} style={btnLink}>Escribí mal mi email, quiero corregirlo</button></>,
    },
    ya_existe: {
      icono: '🔑', titulo: 'Este email ya tiene cuenta',
      cuerpo: <p style={texto}>Ya existe una cuenta con <Email /> Entrá con tu contraseña; si no la recordás, podés recuperarla.</p>,
      botones: <><button type="button" onClick={onEntrar} style={btnPrimario}>Iniciar sesión →</button><button type="button" onClick={onRecuperar} style={btnSecundario}>Recuperar contraseña</button></>,
    },
    recuperar_enviado: {
      icono: '📬', titulo: 'Revisá tu email',
      cuerpo: <p style={texto}>Te enviamos un correo a <Email /> Abrilo y tocá el enlace para crear una contraseña nueva.<br /><span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>¿No te llega? Puede tardar un par de minutos. Mirá en Spam o Promociones.</span></p>,
      botones: <button type="button" onClick={onEntrar} style={btnPrimario}>Entendido</button>,
    },
    sugerencia: {
      icono: '🤔', titulo: '¿Está bien escrito?',
      cuerpo: <p style={texto}>Escribiste <Email /> ¿Quisiste decir <b style={{ color: '#fff', wordBreak: 'break-all' }}>{sugerido}</b>? Si el email está mal, el correo de confirmación no te va a llegar.</p>,
      botones: <><button type="button" onClick={onUsarSugerido} style={btnPrimario}>Sí, usar {sugerido?.split('@')[1]} →</button><button type="button" onClick={onDejarComoEsta} style={btnSecundario}>No, está bien así</button></>,
    },
  }[tipo];
  if (!contenido) return null;

  return (
    <Cartel icono={contenido.icono} titulo={contenido.titulo} botones={contenido.botones} onCerrar={onCerrar}>
      {contenido.cuerpo}
    </Cartel>
  );
}

const tabBtn = (active) => ({
  flex: 1, padding: '8px', borderRadius: 9, border: 'none',
  background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
  color: active ? '#fff' : 'rgba(255,255,255,0.4)',
  fontSize: 13, fontWeight: active ? 700 : 400,
  cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
});
