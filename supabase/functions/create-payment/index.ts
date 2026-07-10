import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";

const UNITECH_API       = "https://api.unitech.sn/api.php";
const UNITECH_WAVE_KEY  = Deno.env.get("UNITECH_WAVE_API_KEY")!;
const UNITECH_OM_KEY    = Deno.env.get("UNITECH_OM_API_KEY")!;
const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PLANS = {
  starter: { amount: 2900,  label: "Sama Boutik Starter" },
  pro:     { amount: 5900,  label: "Sama Boutik Pro" },
  annual:  { amount: 52900, label: "Sama Boutik Annuel" },
} as const;

// Numéros Sénégal : optionnellement préfixés +221 ou 221, puis 9 chiffres
const SENEGAL_PHONE_RE = /^(\+221|221)?[0-9]{9}$/;

const CreatePaymentSchema = z.object({
  plan: z.enum(['starter', 'pro', 'annual']),
  payment_method: z.enum(['wave', 'orange_money']),
  customer_number: z.string()
    .regex(SENEGAL_PHONE_RE, 'Numéro invalide — format Sénégal requis (ex: 77XXXXXXX)')
    .optional()
    .nullable(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Authorization requise" }, 401);

    const payload = await req.json();
    const parseResult = CreatePaymentSchema.safeParse(payload);
    if (!parseResult.success) {
      return json({ error: parseResult.error.errors[0].message }, 400);
    }
    const { plan, payment_method, customer_number } = parseResult.data;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: { user } } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (!user) return json({ error: "Non autorisé" }, 401);

    // 5 tentatives de paiement max par tranche de 10 minutes
    const { allowed } = await checkRateLimit(`create-payment:${user.id}`, 5, 600);
    if (!allowed) return json({ error: "Trop de requêtes, réessayez dans quelques minutes" }, 429);

    const selectedPlan = PLANS[plan];
    if (selectedPlan.amount <= 0) return json({ error: "Montant invalide" }, 400);

    // Créer la subscription en pending
    const { data: subscription, error: subInsertErr } = await supabase
      .from("subscriptions")
      .insert({
        user_id: user.id,
        plan,
        status: "pending",
        payment_method,
        amount: selectedPlan.amount,
      })
      .select()
      .single();

    if (subInsertErr || !subscription) {
      return json({ error: "Impossible de créer la souscription" }, 500);
    }

    const baseUrl = Deno.env.get("APP_URL") ?? "https://boutikos.app";
    let unitechRes;

    if (payment_method === "wave") {
      unitechRes = await callUnitech("create_wave_payment", UNITECH_WAVE_KEY, {
        amount: selectedPlan.amount,
        customer_number,
        description: selectedPlan.label,
        callback_success: `${baseUrl}/payment/success?sub=${subscription.id}`,
        callback_cancel: `${baseUrl}/payment/cancel?sub=${subscription.id}`,
      });
    } else {
      unitechRes = await callUnitech("create_orange_maxit", UNITECH_OM_KEY, {
        amount: selectedPlan.amount,
        customer_number,
        description: selectedPlan.label,
        callback_success: `${baseUrl}/payment/success?sub=${subscription.id}`,
        callback_cancel: `${baseUrl}/payment/cancel?sub=${subscription.id}`,
      });
    }

    if (!unitechRes?.success) {
      // Annuler la subscription pending si UnitechPay échoue
      await supabase.from("subscriptions").delete().eq("id", subscription.id);
      console.error('create-payment: Unitech error', JSON.stringify(unitechRes));
      return json({ error: "Erreur de paiement, veuillez réessayer" }, 502);
    }

    await supabase
      .from("subscriptions")
      .update({
        unitech_reference: unitechRes.data.reference,
        unitech_transaction_id: unitechRes.data.transaction_id,
      })
      .eq("id", subscription.id);

    return json({
      success: true,
      subscription_id: subscription.id,
      payment_url:  unitechRes.data.payment_url  ?? null,
      deep_links:   unitechRes.data.deep_links   ?? null,
    });

  } catch (err) {
    console.error('create-payment error:', err);
    return json({ error: "Une erreur interne est survenue" }, 500);
  }
});

async function callUnitech(action: string, apiKey: string, body: object) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(`${UNITECH_API}?action=${action}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return res.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

function json(data: object, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
