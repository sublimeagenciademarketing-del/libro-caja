'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [plan, setPlan] = useState(null);
  const [cuenta1, setCuenta1] = useState('');
  const [cuenta2, setCuenta2] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.push('/login');
    });
  }, [router]);

  async function handleFinish() {
    if (!cuenta1.trim()) return;
    if (plan === 'negocio' && !cuenta2.trim()) return;
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/login'); return; }
    await supabase.from('user_config').upsert({
      user_id: session.user.id,
      email: session.user.email,
      plan,
      cuenta1: cuenta1.trim(),
      cuenta2: plan === 'negocio' ? cuenta2.trim() : null,
      fecha_registro: new Date().toISOString(),
    });
    // Aviso al admin de que hay un usuario nuevo (no bloquea si falla).
    fetch('/api/push/nuevo-registro', { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` } }).catch(() => {});
    router.push('/');
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#0f172a' }}>
      <img src="/icon-192.png" alt="MiCaja" style={{ width: 60, height: 60, borderRadius: 16, boxShadow: '0 8px 24px rgba(99,102,241,0.4)', marginBottom: 8 }} />
      <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 800, margin: 0 }}>MiCaja</h1>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 4, marginBottom: 32 }}>Configurá tu cuenta</p>

      {step === 1 && (
        <div style={{ width: '100%', maxWidth: 360 }}>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, textAlign: 'center', marginBottom: 20 }}>¿Cómo querés usar MiCaja?</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button onClick={() => { setPlan('personal'); setStep(2); }} style={planBtn(plan === 'personal')}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>Personal</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>Controlá tus ingresos y gastos personales en un solo lugar</div>
            </button>
            <button onClick={() => { setPlan('negocio'); setStep(2); }} style={planBtn(plan === 'negocio')}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#0ea5e9,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>Negocio + Personal</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>Manejá tu negocio y tus finanzas personales en un solo lugar, organizados por categoría</div>
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div style={{ width: '100%', maxWidth: 360 }}>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, textAlign: 'center', marginBottom: 20 }}>
            {plan === 'personal' ? '¿Cómo querés llamar tu cuenta?' : '¿Cómo se llaman tus cuentas?'}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                {plan === 'personal' ? 'Nombre de tu cuenta' : 'Cuenta 1 (negocio)'}
              </label>
              <input
                type="text"
                value={cuenta1}
                onChange={e => setCuenta1(e.target.value)}
                maxLength={20}
                placeholder={plan === 'personal' ? 'Ej: Personal' : 'Ej: Mi Tienda'}
                style={inputStyle}
                autoFocus
              />
            </div>
            {plan === 'negocio' && (
              <div>
                <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Cuenta 2 (personal)</label>
                <input
                  type="text"
                  value={cuenta2}
                  onChange={e => setCuenta2(e.target.value)}
                  maxLength={20}
                  placeholder="Ej: Personal"
                  style={inputStyle}
                />
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button onClick={() => setStep(1)} style={{ flex: 1, padding: '13px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                ← Volver
              </button>
              <button
                onClick={handleFinish}
                disabled={loading || !cuenta1.trim() || (plan === 'negocio' && !cuenta2.trim())}
                style={{ flex: 2, padding: '13px', borderRadius: 14, border: 'none', background: cuenta1.trim() ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: loading ? 0.7 : 1 }}
              >
                {loading ? 'Guardando...' : 'Empezar →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const planBtn = (selected) => ({
  width: '100%',
  padding: '18px 20px',
  borderRadius: 16,
  border: selected ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.1)',
  background: selected ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)',
  cursor: 'pointer',
  textAlign: 'left',
  fontFamily: 'inherit',
  transition: 'all 0.2s',
});

const inputStyle = {
  width: '100%',
  marginTop: 6,
  padding: '12px 14px',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.06)',
  color: '#fff',
  fontSize: 15,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  outline: 'none',
};
