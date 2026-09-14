import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAIL = 'sublimeagenciademarketing@gmail.com';

export async function POST(request) {
  try {
    const { userId, requesterEmail } = await request.json();

    if (requesterEmail !== ADMIN_EMAIL) {
      return Response.json({ error: 'No autorizado' }, { status: 403 });
    }

    if (!userId) {
      return Response.json({ error: 'userId requerido' }, { status: 400 });
    }

    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/^﻿/, '').trim();
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      serviceKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: uc } = await supabaseAdmin
      .from('user_config').select('email').eq('user_id', userId).single();

    // Borrar todos los datos del usuario antes de eliminar de Auth
    await Promise.all([
      supabaseAdmin.from('card_expenses').delete().eq('user_id', userId),
      supabaseAdmin.from('installments').delete().eq('user_id', userId),
    ]);
    await Promise.all([
      supabaseAdmin.from('transactions').delete().eq('user_id', userId),
      supabaseAdmin.from('recurring_expenses').delete().eq('user_id', userId),
      supabaseAdmin.from('receivables').delete().eq('user_id', userId),
      supabaseAdmin.from('debts').delete().eq('user_id', userId),
      supabaseAdmin.from('savings_goals').delete().eq('user_id', userId),
      supabaseAdmin.from('installment_purchases').delete().eq('user_id', userId),
      supabaseAdmin.from('credit_cards').delete().eq('user_id', userId),
      supabaseAdmin.from('user_profiles').delete().eq('id', userId),
      supabaseAdmin.from('user_config').delete().eq('user_id', userId),
      uc?.email
        ? supabaseAdmin.from('licencias').delete().eq('email', uc.email)
        : Promise.resolve(),
    ]);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) return Response.json({ error: error.message }, { status: 500 });

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
