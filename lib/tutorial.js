// Los 16 capítulos del tutorial "Cómo se usa MiCaja", en el orden en que se
// reproducen. Los videos no viven en el repositorio: están en Cloudflare R2,
// que no cobra por el tráfico de salida. Si algún día se mudan, se cambia
// solo BASE y nada más.
export const VIDEOS_BASE = 'https://pub-5ee5354a2d284d8981101a94bed35d09.r2.dev';

export const CAPITULOS = [
  { archivo: '00-presentacion.mp4',       titulo: 'Cómo se usa MiCaja' },
  { archivo: '01b-instalar.mp4',          titulo: 'Ponerlo en la pantalla de inicio' },
  { archivo: '02-primer-movimiento.mp4',  titulo: 'El primer movimiento' },
  { archivo: '03-pantalla-principal.mp4', titulo: 'La pantalla principal' },
  { archivo: '04-proyeccion.mp4',         titulo: 'La proyección del mes' },
  { archivo: '05-gastos-fijos.mp4',       titulo: 'Gastos fijos' },
  { archivo: '06-cuotas.mp4',             titulo: 'Cuotas' },
  { archivo: '07-tarjetas.mp4',           titulo: 'Tarjetas de crédito' },
  { archivo: '08-cobros.mp4',             titulo: 'Cobros' },
  { archivo: '09-deudas.mp4',             titulo: 'Deudas' },
  { archivo: '10-metas.mp4',              titulo: 'Metas de ahorro' },
  { archivo: '11-resumen-anual.mp4',      titulo: 'Resumen del año' },
  { archivo: '12-dolares-reales.mp4',     titulo: 'Dólares y reales' },
  { archivo: '13-dos-cuentas.mp4',        titulo: 'Dos cuentas' },
  { archivo: '14-recordatorios.mp4',      titulo: 'Recordatorios' },
  { archivo: '15-perfil-licencia.mp4',    titulo: 'Perfil y licencia' },
];

export const urlCapitulo = (i) => `${VIDEOS_BASE}/${CAPITULOS[i].archivo}`;
