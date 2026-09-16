import { clienteAdmin, usuarioDesde, enviarPush, ADMIN_EMAIL } from '../../../../lib/push';

export const runtime = 'nodejs';

// Manda un aviso de prueba a los dispositivos del admin (solo el admin puede pedirlo).
export async function POST(request) {
  try {
    const admin = clienteAdmin();
    const user = await usuarioDesde(request, admin);
    if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 });
    if (user.email !== ADMIN_EMAIL) return Response.json({ error: 'Solo el admin' }, { status: 403 });

    const resultado = await enviarPush(admin, user.id, {
      title: 'Prueba de MiCaja',
      body: 'Si ves esto, los avisos en el teléfono funcionan.',
      badge: 1,
      url: '/',
      tag: 'prueba',
    });
    return Response.json({ ok: true, ...resultado });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
