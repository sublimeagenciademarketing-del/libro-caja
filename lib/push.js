// Envío de avisos push desde el servidor (solo se usa en rutas /api).
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

export { ADMIN_EMAIL } from './config.js';

export function clienteAdmin() {
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/^﻿/, '').trim();
  // cache: 'no-store' evita que Next.js guarde en caché las consultas de una ruta GET (el cron) y responda con datos viejos.
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: (url, opciones) => fetch(url, { ...opciones, cache: 'no-store' }) },
  });
}

// Identifica al usuario que llama a partir de su token de sesión (Authorization: Bearer …).
export async function usuarioDesde(request, admin) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  return error ? null : data.user;
}

// Manda el aviso a todos los dispositivos suscriptos de un usuario y limpia los vencidos.
export async function enviarPush(admin, userId, payload) {
  webpush.setVapidDetails(process.env.VAPID_SUBJECT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  const { data: subs } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', userId);
  let enviados = 0, fallidos = 0;
  for (const s of subs || []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 60 * 60 * 24 });
      enviados++;
    } catch (e) {
      fallidos++;
      // 404/410: el teléfono revocó la suscripción; se borra para no reintentar.
      if (e.statusCode === 404 || e.statusCode === 410) await admin.from('push_subscriptions').delete().eq('id', s.id);
    }
  }
  return { enviados, fallidos, dispositivos: (subs || []).length };
}
