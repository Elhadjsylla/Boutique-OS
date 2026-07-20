import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const DeleteUserSchema = z.object({
  user_id: z.string().uuid(),
  reason: z.string().optional(),
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

    // Vérifier l'appelant
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) return json({ error: 'Token invalide' }, 401);

    const { data: callerProfil } = await supabase
      .from('profils')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!callerProfil || callerProfil.role !== 'super_admin') {
      return json({ error: 'Permission refusée — seul un Super Admin peut supprimer un compte' }, 403);
    }

    // 20 suppressions max par heure par admin (même ordre de grandeur que invite-user)
    const { allowed } = await checkRateLimit(`delete-user-account:${user.id}`, 20, 3600);
    if (!allowed) return json({ error: 'Trop de requêtes, réessayez plus tard' }, 429);

    const payload = await req.json();
    const parseResult = DeleteUserSchema.safeParse(payload);
    if (!parseResult.success) {
      return json({ error: parseResult.error.errors[0].message }, 400);
    }
    const { user_id, reason } = parseResult.data;

    if (user_id === user.id) {
      return json({ error: 'Vous ne pouvez pas supprimer votre propre compte' }, 400);
    }

    const { data: targetProfil } = await supabase
      .from('profils')
      .select('role, status')
      .eq('id', user_id)
      .single();

    if (!targetProfil) return json({ error: 'Utilisateur introuvable' }, 404);
    if (targetProfil.role === 'super_admin') {
      return json({ error: 'Impossible de supprimer un compte Super Admin' }, 403);
    }
    if (targetProfil.status === 'deleted') {
      return json({ error: 'Ce compte est déjà supprimé' }, 400);
    }

    // Anonymise l'email et bloque définitivement la connexion Auth. Le mot de
    // passe est randomisé en plus du ban_duration, en défense en profondeur.
    const anonymizedEmail = `deleted-${user_id}@samaboutik.invalid`;
    const { error: authUpdateError } = await supabase.auth.admin.updateUserById(user_id, {
      email: anonymizedEmail,
      password: crypto.randomUUID(),
      ban_duration: '876000h',
      user_metadata: {},
    });

    if (authUpdateError) {
      console.error('delete-user-account: auth update error', authUpdateError);
      return json({ error: "Erreur lors de l'anonymisation du compte" }, 500);
    }

    // Anonymise le profil mais NE TOUCHE JAMAIS aux ventes/vente_items/ardoises :
    // seule la ligne profils est modifiée, l'historique financier reste intact
    // (ventes.caissier_id / boutiques.gerant_id continuent de référencer cet id).
    const previousStatus = targetProfil.status;
    const nowIso = new Date().toISOString();
    const { error: profilUpdateError } = await supabase
      .from('profils')
      .update({
        nom: null,
        prenom: null,
        phone_number: null,
        status: 'deleted',
        deleted_at: nowIso,
        status_reason: reason ?? null,
        status_changed_at: nowIso,
        status_changed_by: user.id,
      })
      .eq('id', user_id);

    if (profilUpdateError) {
      console.error('delete-user-account: profil update error', profilUpdateError);
      return json({ error: "Erreur lors de l'anonymisation du profil" }, 500);
    }

    await supabase.from('sys_audit_log').insert({
      actor_id: user.id,
      action: 'user.deleted',
      target_type: 'user',
      target_id: user_id,
      details: { reason: reason ?? null, previous_status: previousStatus },
    });

    return json({ success: true, user_id });
  } catch (err) {
    console.error('delete-user-account error:', err);
    return json({ error: 'Une erreur interne est survenue' }, 500);
  }
});
