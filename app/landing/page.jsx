'use client';

const WA_NUMBER = '595986313704';
const waLink = encodeURIComponent('Hola, quiero contratar MiCaja. ¿Me podés dar más información?');

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', fontFamily: 'Inter, system-ui, sans-serif', color: '#fff', overflowX: 'hidden' }}>

      {/* HEADER */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', maxWidth: 600, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/icon-192.png" alt="MiCaja" style={{ width: 38, height: 38, borderRadius: 11, boxShadow: '0 4px 14px rgba(99,102,241,0.4)' }} />
          <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em' }}>MiCaja</span>
        </div>
        <a href="/login" style={{ padding: '9px 20px', borderRadius: 10, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontWeight: 600, fontSize: 13, textDecoration: 'none', transition: 'all 0.2s' }}>
          Ingresar
        </a>
      </header>

      {/* HERO */}
      <section style={{ textAlign: 'center', padding: '48px 24px 40px', maxWidth: 540, margin: '0 auto' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 20, padding: '5px 14px', marginBottom: 24, fontSize: 12, color: '#a5b4fc', fontWeight: 600 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          Diseñado para Paraguay · Precio en guaraníes
        </div>

        <h1 style={{ fontSize: 38, fontWeight: 900, lineHeight: 1.1, margin: '0 0 16px', letterSpacing: '-0.03em' }}>
          Controlá tu dinero.<br />
          <span style={{ background: 'linear-gradient(135deg,#6366f1,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Siempre.</span>
        </h1>

        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, margin: '0 0 36px' }}>
          MiCaja es la app que te ayuda a registrar ingresos, gastos, cuotas y deudas — todo en un solo lugar, desde tu celular.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
          <a href="/login"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '15px 36px', borderRadius: 14, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontWeight: 800, fontSize: 16, textDecoration: 'none', boxShadow: '0 4px 20px rgba(99,102,241,0.45)' }}>
            Probar gratis →
          </a>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>7 días gratis · Sin tarjeta de crédito</div>
          <a href="/login" style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', textDecoration: 'none', marginTop: 4 }}>Ya tengo cuenta → Ingresar</a>
          <a href={`https://wa.me/${WA_NUMBER}?text=${waLink}`} target="_blank" rel="noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 10, background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.25)', color: '#25d366', fontWeight: 600, fontSize: 13, textDecoration: 'none', marginTop: 4 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#25d366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            ¿Tenés dudas? Escribinos
          </a>
        </div>
      </section>

      {/* MOCKUP CARD */}
      <section style={{ padding: '0 20px 48px', maxWidth: 400, margin: '0 auto' }}>
        <div style={{ background: 'linear-gradient(160deg,#1e2d45,#0f1a2e)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 22, padding: '22px 20px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Balance total</div>
          <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 20 }}>₲ 2.845.334</div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
            {[
              { label: 'Ingresos del mes', val: '+₲ 2.702.000', color: '#34d399' },
              { label: 'Gastos del mes', val: '−₲ 445.000', color: '#f87171' },
            ].map(c => (
              <div key={c.label} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '12px 14px' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>{c.label}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: c.color }}>{c.val}</div>
              </div>
            ))}
          </div>
          <div style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 14, padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(165,180,252,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 17V13M12 17V9M16 17V12"/></svg>
              <span style={{ fontSize: 11, color: 'rgba(165,180,252,0.7)', fontWeight: 700 }}>Proyección del mes</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Por cobrar</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#34d399' }}>+₲ 500.000</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Por pagar</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#f87171' }}>−₲ 200.000</span>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ padding: '0 20px 56px', maxWidth: 560, margin: '0 auto' }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, textAlign: 'center', marginBottom: 24, letterSpacing: '-0.02em' }}>Todo lo que necesitás</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { grad: 'linear-gradient(135deg,#6366f1,#8b5cf6)', svg: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v13M7 10l5 5 5-5"/><path d="M20 20H4"/></svg>, title: 'Ingresos y gastos', desc: 'Registrá cada movimiento al instante desde tu celular.' },
            { grad: 'linear-gradient(135deg,#0ea5e9,#6366f1)', svg: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 17V13M12 17V9M16 17V12"/></svg>, title: 'Proyección mensual', desc: 'Sabé cuánto vas a cobrar y pagar antes de que llegue.' },
            { grad: 'linear-gradient(135deg,#f59e0b,#ef4444)', svg: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>, title: 'Cuotas y tarjetas', desc: 'Controlá tus compras en cuotas y gastos de tarjeta.' },
            { grad: 'linear-gradient(135deg,#10b981,#0ea5e9)', svg: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>, title: 'Alertas y vencimientos', desc: 'Recibí avisos de cobros y deudas que se acercan.' },
            { grad: 'linear-gradient(135deg,#8b5cf6,#ec4899)', svg: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>, title: 'Personal o negocio', desc: 'Manejá tus finanzas personales y del negocio separadas.' },
            { grad: 'linear-gradient(135deg,#f43f5e,#f59e0b)', svg: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 6v8M9 11l3 3 3-3"/></svg>, title: 'App en tu celular', desc: 'Instalala en tu pantalla de inicio y accedé sin navegador.' },
          ].map((f, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: '18px 16px' }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: f.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                {f.svg}
              </div>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 5 }}>{f.title}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section style={{ padding: '0 20px 56px', maxWidth: 400, margin: '0 auto' }}>
        <div style={{ background: 'linear-gradient(160deg,rgba(99,102,241,0.2),rgba(139,92,246,0.1))', border: '1px solid rgba(99,102,241,0.35)', borderRadius: 24, padding: '32px 28px', textAlign: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Precio</div>
          <div style={{ fontSize: 44, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1 }}>₲ 80.000</div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginTop: 6, marginBottom: 28 }}>por año · un solo pago</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28, textAlign: 'left' }}>
            {[
              'Acceso completo a todas las funciones',
              '7 días de prueba gratuita',
              'Actualizaciones incluidas',
              'Soporte directo por WhatsApp',
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 20, height: 20, borderRadius: 6, background: 'rgba(52,211,153,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>{item}</span>
              </div>
            ))}
          </div>
          <a href={`https://wa.me/${WA_NUMBER}?text=${waLink}`} target="_blank" rel="noreferrer"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '15px 24px', borderRadius: 14, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontWeight: 800, fontSize: 15, textDecoration: 'none', boxShadow: '0 4px 20px rgba(99,102,241,0.45)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Contactar por WhatsApp
          </a>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ textAlign: 'center', padding: '0 20px 40px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ paddingTop: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
          <img src="/icon-192.png" alt="MiCaja" style={{ width: 28, height: 28, borderRadius: 8 }} />
          <span style={{ fontWeight: 800, fontSize: 15 }}>MiCaja</span>
        </div>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', margin: 0 }}>Tu caja, tus finanzas · Paraguay</p>
      </footer>

    </div>
  );
}
