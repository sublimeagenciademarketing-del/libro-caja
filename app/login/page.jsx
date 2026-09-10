'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

export default function LoginPage() {
  const [tab, setTab] = useState('login'); // 'login' | 'register' | 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e) {
    e.preventDefault();
    setError(''); setSuccess('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setError('Email o contraseña incorrectos.'); return; }
    router.push('/');
  }

  async function handleRegister(e) {
    e.preventDefault();
    setError(''); setSuccess('');
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return; }
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) { setError('No se pudo crear la cuenta. Intentá con otro email.'); return; }
    setSuccess('¡Cuenta creada! Revisá tu email para confirmar, luego ingresá.');
    setTab('login');
  }

  async function handleForgot(e) {
    e.preventDefault();
    setError(''); setSuccess('');
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) { setError('No se pudo enviar el email.'); return; }
    setSuccess('Te enviamos un email para restablecer tu contraseña.');
  }

  return (
    <div className="login-wrap">
      <div className="login-logo">
        <div style={{ width: 64, height: 64, borderRadius: 18, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(99,102,241,0.4)' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="15" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>
        </div>
      </div>
      <h1>MiCaja</h1>
      <p className="sub">Tu caja, tus finanzas.</p>

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 4 }}>
        <button onClick={() => { setTab('login'); setError(''); setSuccess(''); }} style={tabBtn(tab === 'login')}>Iniciar sesión</button>
        <button onClick={() => { setTab('register'); setError(''); setSuccess(''); }} style={tabBtn(tab === 'register')}>Registrarse</button>
      </div>

      <div className="login-form">
        {tab === 'login' && (
          <form onSubmit={handleLogin}>
            <div className="field">
              <label>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="tu@email.com" />
            </div>
            <div className="field">
              <label>Contraseña</label>
              <div style={{ position: 'relative' }}>
                <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" style={{ paddingRight: 44 }} />
                <button type="button" onClick={() => setShowPass(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'rgba(255,255,255,0.4)', padding: 0 }}>{showPass ? '🙈' : '👁️'}</button>
              </div>
            </div>
            {error && <p className="error">{error}</p>}
            {success && <p style={{ color: '#34d399', fontSize: 13, marginTop: 8 }}>{success}</p>}
            <button className="primary-btn" type="submit" disabled={loading}>{loading ? 'Entrando...' : 'Entrar →'}</button>
            <button type="button" onClick={() => { setTab('forgot'); setError(''); setSuccess(''); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 12, cursor: 'pointer', marginTop: 10, fontFamily: 'inherit', padding: 0 }}>
              ¿Olvidaste tu contraseña?
            </button>
          </form>
        )}

        {tab === 'register' && (
          <form onSubmit={handleRegister}>
            <div className="field">
              <label>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="tu@email.com" />
            </div>
            <div className="field">
              <label>Contraseña</label>
              <div style={{ position: 'relative' }}>
                <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required placeholder="Mínimo 6 caracteres" style={{ paddingRight: 44 }} />
                <button type="button" onClick={() => setShowPass(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'rgba(255,255,255,0.4)', padding: 0 }}>{showPass ? '🙈' : '👁️'}</button>
              </div>
            </div>
            {error && <p className="error">{error}</p>}
            {success && <p style={{ color: '#34d399', fontSize: 13, marginTop: 8 }}>{success}</p>}
            <button className="primary-btn" type="submit" disabled={loading}>{loading ? 'Creando cuenta...' : 'Crear cuenta →'}</button>
          </form>
        )}

        {tab === 'forgot' && (
          <form onSubmit={handleForgot}>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 16 }}>Ingresá tu email y te enviamos un enlace para restablecer tu contraseña.</p>
            <div className="field">
              <label>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="tu@email.com" />
            </div>
            {error && <p className="error">{error}</p>}
            {success && <p style={{ color: '#34d399', fontSize: 13, marginTop: 8 }}>{success}</p>}
            <button className="primary-btn" type="submit" disabled={loading}>{loading ? 'Enviando...' : 'Enviar enlace →'}</button>
            <button type="button" onClick={() => { setTab('login'); setError(''); setSuccess(''); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 12, cursor: 'pointer', marginTop: 10, fontFamily: 'inherit', padding: 0 }}>
              ← Volver al inicio de sesión
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const tabBtn = (active) => ({
  flex: 1, padding: '8px', borderRadius: 9, border: 'none',
  background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
  color: active ? '#fff' : 'rgba(255,255,255,0.4)',
  fontSize: 13, fontWeight: active ? 700 : 400,
  cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
});
