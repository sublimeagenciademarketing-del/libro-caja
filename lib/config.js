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
export const PILOTO_VISTA_MONEDAS = null;
export const puedeVistaMonedas = (email) => !PILOTO_VISTA_MONEDAS || PILOTO_VISTA_MONEDAS.includes(email);

// Novedades del 21/09: probadas en piloto (admin + zony) y abiertas a todos el
// mismo día. Para volver a cerrar una, poner la lista de emails en lugar de null.
const PILOTO = null; // antes: [ADMIN_EMAIL, 'luiszonycarlos18@gmail.com']
const enPiloto = (lista, email) => !lista || lista.includes(email);
export const PILOTO_CONVERTIDOR = PILOTO;          // calculadora de cambio
export const PILOTO_VER_MAS = PILOTO;              // listas largas con "Ver más"
export const PILOTO_RESUMEN = PILOTO;              // resumen ampliado
export const PILOTO_MONEDAS_MODULOS = PILOTO;      // monedas en gastos fijos, cuotas, cobros, deudas, metas + proyección por moneda
export const puedeConvertir = (email) => enPiloto(PILOTO_CONVERTIDOR, email);
export const puedeVerMas = (email) => enPiloto(PILOTO_VER_MAS, email);
export const puedeResumenAmpliado = (email) => enPiloto(PILOTO_RESUMEN, email);
export const puedeMonedasModulos = (email) => enPiloto(PILOTO_MONEDAS_MODULOS, email);
