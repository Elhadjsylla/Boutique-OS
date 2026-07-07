import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";

const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const InviteUserSchema = z.object({
  email: z.string().email('Email requis et doit être valide'),
  role: z.enum(['caissier', 'gerant']).optional().default('caissier'),
  boutique_id: z.string().optional(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Authorization requise' }, 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Vérifier l'utilisateur appelant
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) return json({ error: 'Token invalide' }, 401);

    // Vérifier le rôle de l'appelant
    const { data: callerProfil } = await supabase
      .from('profils')
      .select('role, boutique_id')
      .eq('id', user.id)
      .single();

    const ALLOWED_ROLES = ['gerant', 'admin', 'super_admin'];
    if (!callerProfil || !ALLOWED_ROLES.includes(callerProfil.role)) {
      return json({ error: 'Permission refusée — seul un gérant ou admin peut inviter' }, 403);
    }

    // 10 invitations max par heure par utilisateur
    const { allowed } = await checkRateLimit(`invite-user:${user.id}`, 10, 3600);
    if (!allowed) return json({ error: 'Trop de requêtes, réessayez dans une heure' }, 429);

    const payload = await req.json();
    const parseResult = InviteUserSchema.safeParse(payload);
    if (!parseResult.success) {
      return json({ error: parseResult.error.errors[0].message }, 400);
    }
    const { email, role, boutique_id } = parseResult.data;

    // La boutique cible : celle passée en param ou celle du gérant
    const targetBoutiqueId = boutique_id ?? callerProfil.boutique_id;
    if (!targetBoutiqueId) return json({ error: 'Boutique introuvable' }, 400);

    // Un gérant ne peut inviter que dans sa propre boutique
    if (callerProfil.role === 'gerant' && callerProfil.boutique_id !== targetBoutiqueId) {
      return json({ error: 'Permission refusée pour cette boutique' }, 403);
    }

    // Créer l'invitation en DB
    const { data: invitation, error: invError } = await supabase
      .from('invitations')
      .insert({ email, role, boutique_id: targetBoutiqueId, invited_by: user.id })
      .select()
      .single();

    if (invError) {
      return json({ error: invError.message }, 400);
    }

    // Envoyer l'email d'invitation via Supabase Auth
    const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
      data: {
        role,
        boutique_id: targetBoutiqueId,
        invitation_id: invitation.id,
      },
    });

    if (inviteError) {
      // Annuler l'invitation en DB si l'email échoue
      await supabase.from('invitations').delete().eq('id', invitation.id);
      return json({
        error: inviteError.message || "Erreur lors de l'envoi de l'invitation",
        raw_error: { message: inviteError.message, status: (inviteError as any).status, code: (inviteError as any).code },
      }, 400);
    }

    // Audit log
    await supabase.from('admin_audit_log').insert({
      admin_id: user.id,
      action: 'invite_user',
      target_type: 'invitation',
      target_id: invitation.id,
      details: { email, role, boutique_id: targetBoutiqueId },
    });

    return json({ success: true, invitation_id: invitation.id });

  } catch (err) {
    console.error('invite-user error:', err);
    return json({ error: 'Une erreur interne est survenue' }, 500);
  }
});

function json(data: object, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
