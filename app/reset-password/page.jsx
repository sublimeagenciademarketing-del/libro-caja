'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        // token válido, el usuario puede cambiar su contraseña
      } else if (!session) {
        router.push('/login');
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [router]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return; }
    setLoading(true); setError('');
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { setError('No se pudo actualizar la contraseña.'); return; }
    setSuccess('¡Contraseña actualizada! Redirigiendo...');
    setTimeout(() => router.push('/'), 2000);
  }

  return (
    <div className="login-wrap">
      <div className="login-logo">
        <div style={{ width: 64, height: 64, borderRadius: 18, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(99,102,241,0.4)' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="15" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>
        </div>
      </div>
      <h1>MiCaja</h1>
      <p className="sub">Creá tu nueva contraseña.</p>
      <div className="login-form">
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Nueva contraseña</label>
            <div style={{ position: 'relative' }}>
              <input
                type={show ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="Mínimo 6 caracteres"
                style={{ paddingRight: 44 }}
              />
              <button type="button" onClick={() => setShow(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'rgba(255,255,255,0.4)', padding: 0 }}>
                {show ? '🙈' : '👁️'}
              </button>
            </div>
          </div>
          {error && <p className="error">{error}</p>}
          {success && <p style={{ color: '#34d399', fontSize: 13, marginTop: 8 }}>{success}</p>}
          <button className="primary-btn" type="submit" disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar contraseña →'}
          </button>
        </form>
      </div>
    </div>
  );
}
