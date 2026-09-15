// Genera public/og.png (1200x630): la imagen que muestran WhatsApp,
// Facebook e Instagram al compartir el link. Correr: node scripts/make-og.js
const sharp = require('sharp');
const path = require('path');
const { DIAS_PRUEBA } = (() => {
  const src = require('fs').readFileSync(path.join(__dirname, '..', 'lib', 'config.js'), 'utf8');
  return { DIAS_PRUEBA: Number(src.match(/DIAS_PRUEBA = (\d+)/)[1]) };
})();

const W = 1200, H = 630;
const out = path.join(__dirname, '..', 'public', 'og.png');

async function main() {
  const fondo = Buffer.from(`
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0f172a"/>
          <stop offset="100%" stop-color="#0d2137"/>
        </linearGradient>
        <radialGradient id="glow" cx="0.2" cy="0.3" r="0.6">
          <stop offset="0%" stop-color="#6366f1" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="#6366f1" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="badge" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#1a4fd6"/>
          <stop offset="100%" stop-color="#0d2137"/>
        </linearGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#bg)"/>
      <rect width="${W}" height="${H}" fill="url(#glow)"/>
      <rect x="90" y="175" width="280" height="280" rx="62" fill="url(#badge)"/>
      <text x="440" y="270" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="96" font-weight="800" fill="#ffffff" letter-spacing="-3">MiCaja</text>
      <text x="444" y="345" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="44" font-weight="600" fill="#a5b4fc">Controlá tu dinero. Siempre.</text>
      <rect x="444" y="395" width="470" height="62" rx="31" fill="#6366f1"/>
      <text x="679" y="437" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="28" font-weight="700" fill="#ffffff">${DIAS_PRUEBA} días gratis · Sin tarjeta</text>
      <text x="444" y="520" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="26" fill="rgba(255,255,255,0.5)">Ingresos, gastos, cuotas, tarjetas y deudas · Paraguay</text>
    </svg>
  `);

  const logo = await sharp(path.join(__dirname, '..', 'public', 'logo.png'))
    .resize(182, 182, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp(fondo)
    .composite([{ input: logo, top: 175 + 49, left: 90 + 49 }])
    .png()
    .toFile(out);

  console.log('Creado public/og.png', `${W}x${H}`, `(${DIAS_PRUEBA} días)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
