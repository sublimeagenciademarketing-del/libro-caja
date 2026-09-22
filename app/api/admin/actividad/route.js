import { clienteAdmin, usuarioDesde, ADMIN_EMAIL } from '../../../../lib/push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Actividad de cada usuario para el panel admin: cuántos movimientos cargó,
// cuándo fue el último y cuándo abrió el app por última vez. Solo fechas y
// cantidades; nunca el contenido de los movimientos.
export async function GET(request) {
  try {
    const admin = clienteAdmin();
    const user = await usuarioDesde(request, admin);
    if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 });
    if (user.email !== ADMIN_EMAIL) return Response.json({ error: 'Solo el admin' }, { status: 403 });

    const { data: configs, error } = await admin.from('user_config').select('user_id, ultima_apertura');
    if (error) throw new Error(error.message);

    const actividad = {};
    await Promise.all((configs || []).map(async (uc) => {
      // Por created_at (cuándo lo cargó), no por fecha (la que el usuario escribió:
      // puede ser futura o vieja y no dice nada sobre si está usando el app).
      const { data, count } = await admin.from('transactions')
        .select('created_at', { count: 'exact' }).eq('user_id', uc.user_id)
        .order('created_at', { ascending: false }).limit(1);
      actividad[uc.user_id] = {
        movimientos: count || 0,
        ultimo_movimiento: data?.[0]?.created_at || null,
        ultima_apertura: uc.ultima_apertura || null,
      };
    }));

    return Response.json({ ok: true, actividad });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
