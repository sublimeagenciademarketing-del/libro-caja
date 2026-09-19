// Días de prueba gratuita desde el registro. Lo leen el app, Más, el panel
// admin y la landing: cambiarlo acá cambia todo junto.
export const DIAS_PRUEBA = 45;

// Cuenta administradora: ve el panel, recibe el aviso de registros nuevos y
// nunca pierde la licencia.
export const ADMIN_EMAIL = 'sublimeagenciademarketing@gmail.com';

// Monedas extra (US$ y R$): con una lista de emails queda en modo piloto
// (solo esas cuentas ven la opción en Perfil); con null está abierta a todos.
export const PILOTO_MONEDAS = null;
export const puedeUsarMonedas = (email) => !PILOTO_MONEDAS || PILOTO_MONEDAS.includes(email);

// Vista por moneda en el inicio (balance deslizable ₲/US$/R$) en modo piloto:
// solo estas cuentas la ven. null = todos.
export const PILOTO_VISTA_MONEDAS = ['sublimeagenciademarketing@gmail.com', 'luiszonycarlos18@gmail.com'];
export const puedeVistaMonedas = (email) => !PILOTO_VISTA_MONEDAS || PILOTO_VISTA_MONEDAS.includes(email);
