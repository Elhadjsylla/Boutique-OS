import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ResetPasswordSchema = z.object({
  user_id: z.string().uuid('user_id doit être un UUID valide'),
});

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  function json(data: object, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Authorization requise' }, 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // ── Vérifier que l'appelant est super_admin ──
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) return json({ error: 'Token invalide' }, 401);

    const { data: profil } = await supabase
      .from('profils')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profil?.role !== 'super_admin') {
      return json({ error: 'Réservé aux super_admins' }, 403);
    }

    // 10 resets max par heure par super_admin
    const { allowed } = await checkRateLimit(`reset-password:${user.id}`, 10, 3600);
    if (!allowed) return json({ error: 'Trop de requêtes, réessayez dans une heure' }, 429);

    // ── Récupérer le user cible ──
    const payload = await req.json();
    const parseResult = ResetPasswordSchema.safeParse(payload);
    if (!parseResult.success) {
      return json({ error: parseResult.error.errors[0].message }, 400);
    }
    const { user_id } = parseResult.data;

    const { data: targetUser, error: userError } = await supabase.auth.admin.getUserById(user_id);
    if (userError || !targetUser?.user?.email) {
      return json({ error: 'Utilisateur introuvable' }, 404);
    }

    // ── Générer le lien de recovery ──
    const { error: linkError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: targetUser.user.email,
    });

    if (linkError) throw linkError;

    // ── Logger l'action ──
    await supabase.from('admin_audit_log').insert({
      actor_id:    user.id,
      action:      'user.password_reset',
      target_type: 'user',
      target_id:   user_id,
      details:     { email: targetUser.user.email },
    });

    return json({
      success: true,
      message: `Email de réinitialisation envoyé à ${targetUser.user.email}`,
    });

  } catch (err) {
    console.error('reset-password error:', err);
    return json({ error: 'Une erreur interne est survenue' }, 500);
  }
});
