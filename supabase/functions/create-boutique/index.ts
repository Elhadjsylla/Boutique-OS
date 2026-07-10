import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CreateBoutiqueSchema = z.object({
  nom: z.string().min(1, 'Nom de boutique requis'),
  adresse: z.string().optional().nullable(),
  gerant_email: z.string().email('Email invalide').optional().nullable(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Authorization requise' }, 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Vérifier que l'appelant est super_admin
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

    const payload = await req.json();
    const parseResult = CreateBoutiqueSchema.safeParse(payload);
    if (!parseResult.success) {
      return json({ error: parseResult.error.errors[0].message }, 400);
    }

    const { nom, adresse, gerant_email } = parseResult.data;

    // Créer la boutique
    const { data: boutique, error: boutiqueError } = await supabase
      .from('boutiques')
      .insert({ nom: nom.trim(), adresse: adresse?.trim() ?? null })
      .select()
      .single();

    if (boutiqueError) throw boutiqueError;

    // Inviter le gérant si un email est fourni
    let invitation = null;
    if (gerant_email?.trim()) {
      const { data: inv, error: invError } = await supabase
        .from('invitations')
        .insert({
          email:       gerant_email.trim(),
          role:        'gerant',
          boutique_id: boutique.id,
          invited_by:  user.id,
        })
        .select()
        .single();

      if (!invError) {
        await supabase.auth.admin.inviteUserByEmail(gerant_email.trim(), {
          data: {
            role:          'gerant',
            boutique_id:   boutique.id,
            invitation_id: inv.id,
          },
        });
        invitation = inv.id;
      }
    }

    return json({
      success:       true,
      boutique_id:   boutique.id,
      nom:           boutique.nom,
      invitation_id: invitation,
    });

  } catch (err) {
    console.error('create-boutique error:', err);
    return json({ error: 'Une erreur interne est survenue' }, 500);
  }
});

function json(data: object, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
  });
}
