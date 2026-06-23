import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const { email, role = 'caissier', boutique_id } = await req.json() as {
      email: string;
      role?: string;
      boutique_id?: string;
    };

    if (!email) return json({ error: 'Email requis' }, 400);
    if (!['caissier', 'gerant'].includes(role)) return json({ error: 'Rôle invalide' }, 400);

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
      throw inviteError;
    }

    return json({ success: true, invitation_id: invitation.id });

  } catch (err) {
    console.error('invite-user error:', err);
    return json({ error: String(err) }, 500);
  }
});

function json(data: object, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
