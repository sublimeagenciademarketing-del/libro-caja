import './globals.css';
import { DIAS_PRUEBA } from '../lib/config';

const SITE_URL = 'https://libro-caja-app-phi.vercel.app';
const TITULO = 'MiCaja — Controlá tu dinero';
const DESCRIPCION = `Registrá ingresos, gastos, cuotas, tarjetas y deudas desde tu celular. ${DIAS_PRUEBA} días gratis, sin tarjeta. Hecho para Paraguay.`;

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITULO,
  description: DESCRIPCION,
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'MiCaja' },
  icons: {
    icon: '/icon-192.png',
    apple: '/icon-180.png',
  },
  openGraph: {
    type: 'website',
    locale: 'es_PY',
    url: SITE_URL,
    siteName: 'MiCaja',
    title: TITULO,
    description: DESCRIPCION,
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'MiCaja — Controlá tu dinero' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITULO,
    description: DESCRIPCION,
    images: ['/og.png'],
  },
};

export const viewport = {
  themeColor: '#0d1b2a',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
