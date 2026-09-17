// Estado de la licencia de un usuario, con la misma regla que la pantalla
// principal. El servidor la usa para saber quién recibe recordatorios.
import { DIAS_PRUEBA, ADMIN_EMAIL } from './config.js';
import { hoyISO, deISO } from './recurrencia.js';

const diasEntre = (a, b) => Math.round((deISO(a) - deISO(b)) / 86400000);

// uc: fila de user_config (email, fecha_registro). lic: fila de licencias o null.
// Devuelve { status: 'active' | 'expiring' | 'demo' | 'solo_lectura', dias, motivo }.
export function estadoLicencia(uc, lic, hoy = hoyISO()) {
  if (uc?.email === ADMIN_EMAIL) return { status: 'active', dias: null };
  if (lic?.activo && lic.solo_lectura) return { status: 'solo_lectura', dias: 0, motivo: 'admin' };
  if (lic?.activo && lic.fecha_vencimiento) {
    const dias = diasEntre(String(lic.fecha_vencimiento).slice(0, 10), hoy);
    if (dias < 0) return { status: 'solo_lectura', dias: 0, motivo: 'licencia' };
    if (dias <= 14) return { status: 'expiring', dias };
    return { status: 'active', dias };
  }
  const registro = uc?.fecha_registro ? String(uc.fecha_registro).slice(0, 10) : hoy;
  const dias = DIAS_PRUEBA - diasEntre(hoy, registro);
  if (dias <= 0) return { status: 'solo_lectura', dias: 0, motivo: 'prueba' };
  return { status: 'demo', dias };
}

// Solo reciben recordatorios los usuarios activos o en período de prueba.
export const recibeRecordatorios = (estado) => estado.status !== 'solo_lectura';
