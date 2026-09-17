// Avisos push del lado del teléfono: permiso, alta y baja de este dispositivo.
// (El envío vive en lib/push.js, del lado del servidor.)
import { supabase } from './supabaseClient';

const esIOS = () => typeof navigator !== 'undefined' && /iPhone|iPad/i.test(navigator.userAgent);
const instalado = () => typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches;

// Qué puede hacer este dispositivo:
//  'sin_instalar' → iPhone desde Safari: primero hay que agregar el app a inicio
//  'no_soportado' → el navegador no tiene push
//  'bloqueado'    → el usuario negó el permiso; se cambia desde Ajustes
//  'activado'     → con permiso y anotado para recibir
//  'desactivado'  → con permiso (o sin pedir todavía) pero no anotado
export async function estadoPush() {
  if (typeof window === 'undefined') return 'no_soportado';
  if (esIOS() && !instalado()) return 'sin_instalar';
  if (typeof Notification === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return 'no_soportado';
  if (Notification.permission === 'denied') return 'bloqueado';
  if (Notification.permission !== 'granted') return 'desactivado';
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return sub ? 'activado' : 'desactivado';
  } catch { return 'desactivado'; }
}

// Pide permiso (requiere un toque del usuario) y anota el dispositivo.
// Devuelve el estado resultante.
export async function activarPush(userId) {
  if (typeof Notification === 'undefined') return estadoPush();
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') return estadoPush();
  await suscribirPush(userId);
  return estadoPush();
}

// Anota este dispositivo para recibir avisos aunque el app esté cerrado.
// Solo si el usuario ya dio permiso; la suscripción se guarda por dispositivo.
export async function suscribirPush(userId) {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    const clave = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!clave) return;
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const raw = atob(clave.replace(/-/g, '+').replace(/_/g, '/').padEnd(clave.length + (4 - clave.length % 4) % 4, '='));
      const bytes = Uint8Array.from(raw, ch => ch.charCodeAt(0));
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
    }
    const j = sub.toJSON();
    await supabase.from('push_subscriptions').upsert(
      { user_id: userId, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, user_agent: navigator.userAgent },
      { onConflict: 'endpoint' },
    );
  } catch {}
}

// Da de baja este dispositivo: deja de recibir avisos (la campanita sigue igual).
export async function desuscribirPush() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
    await sub.unsubscribe();
  } catch {}
}
