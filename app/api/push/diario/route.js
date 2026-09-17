import { clienteAdmin, enviarPush, ADMIN_EMAIL } from '../../../../lib/push';
import { cargarAvisos, calcularAvisos, claveAviso, hoyEnParaguay, textoAvisos } from '../../../../lib/avisos';
import { estadoLicencia, recibeRecordatorios } from '../../../../lib/licencia';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const maxDuration = 60;

// Recordatorios diarios. Lo dispara el cron de Vercel una vez por día (8:00 de
// Paraguay) con Authorization: Bearer CRON_SECRET. Calcula la campanita de cada
// usuario con dispositivos anotados y manda solo las novedades: lo que entró en
// "por vencer" y lo que pasó a "vencido". Cada aviso sale una sola vez.
//
// Parámetros para probar a mano:
//   ?solo=email@x.com  → procesa únicamente ese usuario
//   ?simular=1         → calcula y responde qué mandaría, sin mandar ni anotar
export async function GET(request) {
  const secreto = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization') || '';
  if (!secreto || auth !== `Bearer ${secreto}`) return Response.json({ error: 'No autorizado' }, { status: 401 });

  const url = new URL(request.url);
  const solo = url.searchParams.get('solo');
  const simular = url.searchParams.get('simular') === '1';

  try {
    const admin = clienteAdmin();
    const hoy = hoyEnParaguay();

    // Solo usuarios con al menos un dispositivo anotado.
    const { data: subs, error: errSubs } = await admin.from('push_subscriptions').select('user_id');
    if (errSubs) throw new Error('push_subscriptions: ' + errSubs.message);
    const userIds = [...new Set((subs || []).map(s => s.user_id))];
    if (!userIds.length) return Response.json({ ok: true, hoy, usuarios: 0, resumen: [] });

    const { data: configs, error: errConf } = await admin.from('user_config')
      .select('user_id, email, fecha_registro, admin_last_visit').in('user_id', userIds);
    if (errConf) throw new Error('user_config: ' + errConf.message);
    const emails = (configs || []).map(c => c.email).filter(Boolean);
    const { data: lics } = await admin.from('licencias')
      .select('email, activo, solo_lectura, fecha_vencimiento').in('email', emails);
    const licPorEmail = Object.fromEntries((lics || []).map(l => [l.email, l]));

    const resumen = [];
    for (const uc of configs || []) {
      if (solo && uc.email !== solo) continue;

      const licencia = estadoLicencia(uc, licPorEmail[uc.email], hoy);
      if (!recibeRecordatorios(licencia)) { resumen.push({ email: uc.email, omitido: licencia.status }); continue; }

      const { overdue, upcoming } = calcularAvisos(await cargarAvisos(admin, uc.user_id), hoy);
      const claveDe = (n, estado) => `${estado}|${claveAviso(n)}`;
      const claves = [...overdue.map(n => claveDe(n, 'vencido')), ...upcoming.map(n => claveDe(n, 'proximo'))];
      if (!claves.length) { resumen.push({ email: uc.email, novedades: 0 }); continue; }

      const { data: ya } = await admin.from('avisos_enviados').select('clave').eq('user_id', uc.user_id).in('clave', claves);
      const yaAvisado = new Set((ya || []).map(r => r.clave));
      const vencidos = overdue.filter(n => !yaAvisado.has(claveDe(n, 'vencido')));
      const proximos = upcoming.filter(n => !yaAvisado.has(claveDe(n, 'proximo')));
      if (!vencidos.length && !proximos.length) { resumen.push({ email: uc.email, novedades: 0 }); continue; }

      // Número del ícono: las novedades de hoy (y, para el admin, los registros nuevos).
      let badge = vencidos.length + proximos.length;
      if (uc.email === ADMIN_EMAIL) {
        const { count } = await admin.from('user_config').select('user_id', { count: 'exact', head: true })
          .neq('email', ADMIN_EMAIL).gt('registrado_en', uc.admin_last_visit || '2000-01-01T00:00:00Z');
        badge += count || 0;
      }

      const envios = [];
      if (vencidos.length) envios.push({ title: vencidos.length === 1 ? 'Se venció' : `Se vencieron ${vencidos.length}`, body: textoAvisos(vencidos), tag: 'vencido' });
      if (proximos.length) envios.push({ title: proximos.length === 1 ? 'Por vencer' : `Por vencer: ${proximos.length}`, body: textoAvisos(proximos), tag: 'por-vencer' });

      if (simular) { resumen.push({ email: uc.email, licencia: licencia.status, badge, envios }); continue; }

      let enviados = 0, dispositivos = 0;
      for (const e of envios) {
        const r = await enviarPush(admin, uc.user_id, { ...e, badge, url: '/?campana=1' });
        enviados += r.enviados; dispositivos = r.dispositivos;
      }
      // Se anota solo si algún dispositivo lo recibió; si no, se reintenta otro día.
      if (enviados > 0) {
        const nuevas = [...vencidos.map(n => claveDe(n, 'vencido')), ...proximos.map(n => claveDe(n, 'proximo'))];
        await admin.from('avisos_enviados').upsert(nuevas.map(clave => ({ user_id: uc.user_id, clave })), { onConflict: 'user_id,clave', ignoreDuplicates: true });
      }
      resumen.push({ email: uc.email, vencidos: vencidos.length, proximos: proximos.length, enviados, dispositivos });
    }

    // Limpieza: lo avisado hace más de 90 días ya no puede volver a aparecer.
    if (!simular) {
      const limite = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      await admin.from('avisos_enviados').delete().lt('enviado_en', limite);
    }

    return Response.json({ ok: true, hoy, dispositivos: (subs || []).length, usuarios: resumen.length, resumen });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
