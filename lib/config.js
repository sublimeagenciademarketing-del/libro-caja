// Días de prueba gratuita desde el registro. Lo leen el app, Más, el panel
// admin y la landing: cambiarlo acá cambia todo junto.
export const DIAS_PRUEBA = 45;

// Cuenta administradora: ve el panel, recibe el aviso de registros nuevos y
// nunca pierde la licencia.
export const ADMIN_EMAIL = 'sublimeagenciademarketing@gmail.com';

// Monedas extra (US$ y R$) en modo piloto: solo estas cuentas ven la opción
// en Perfil. Para abrirla a todos, dejar la lista vacía (null).
export const PILOTO_MONEDAS = ['sublimeagenciademarketing@gmail.com', 'luiszonycarlos18@gmail.com'];
export const puedeUsarMonedas = (email) => !PILOTO_MONEDAS || PILOTO_MONEDAS.includes(email);
