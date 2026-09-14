import './globals.css';

export const metadata = {
  title: 'MiCaja — Controlá tu dinero',
  description: 'Registrá ingresos, gastos, cuotas y deudas desde tu celular.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'MiCaja' },
  icons: {
    icon: '/icon-192.png',
    apple: '/icon-180.png',
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
