import { clienteAdmin, usuarioDesde, enviarPush, ADMIN_EMAIL } from '../../../../lib/push';

export const runtime = 'nodejs';

// Lo llama el app cuando alguien termina de registrarse: avisa al admin.
export async function POST(request) {
  try {
    const admin = clienteAdmin();
    const user = await usuarioDesde(request, admin);
    if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 });

    // Solo vale para un registro reciente del propio usuario (evita usos indebidos).
    const { data: uc } = await admin.from('user_config').select('email, fecha_registro').eq('user_id', user.id).single();
    const hace = uc?.fecha_registro ? Date.now() - new Date(uc.fecha_registro).getTime() : Infinity;
    if (!uc || hace > 15 * 60 * 1000) return Response.json({ ok: true, omitido: 'registro no reciente' });
    if (uc.email === ADMIN_EMAIL) return Response.json({ ok: true, omitido: 'es el admin' });

    const { data: adminUc } = await admin.from('user_config').select('user_id, admin_last_visit').eq('email', ADMIN_EMAIL).single();
    if (!adminUc) return Response.json({ ok: true, omitido: 'sin admin' });

    // Mismo número que muestra el botón admin: registros desde la última visita al panel.
    const { count } = await admin.from('user_config').select('user_id', { count: 'exact', head: true })
      .neq('email', ADMIN_EMAIL).gt('fecha_registro', adminUc.admin_last_visit || '2000-01-01T00:00:00Z');

    const resultado = await enviarPush(admin, adminUc.user_id, {
      title: 'Nuevo usuario en MiCaja',
      body: `${uc.email} acaba de registrarse`,
      badge: Math.max(1, count || 0),
      url: '/admin',
      tag: 'nuevo-registro',
    });
    return Response.json({ ok: true, ...resultado });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
