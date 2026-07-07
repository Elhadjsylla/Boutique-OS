import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";

const PAYTECH_API_KEY      = Deno.env.get("PAYTECH_API_KEY")!;
const PAYTECH_API_SECRET   = Deno.env.get("PAYTECH_API_SECRET")!;
const IS_PRODUCTION        = Deno.env.get("PAYTECH_IS_PRODUCTION_MODE") === "true";
const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PAYTECH_REQUEST_URL = "https://paytech.sn/api/payment/request-payment";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Montants serveur — jamais exposés côté client, jamais acceptés du front
const PLANS = {
  starter: { amount: 2900,  label: "Sama Boutik Starter" },
  pro:     { amount: 5900,  label: "Sama Boutik Pro" },
  annual:  { amount: 52900, label: "Sama Boutik Annuel" },
} as const;

const CreatePaymentSchema = z.object({
  plan: z.enum(["starter", "pro", "annual"]),
  // Conservé pour compat front — PayTech affiche le choix sur sa page
  payment_method:  z.enum(["wave", "orange_money"]).optional().default("wave"),
  customer_number: z.string().optional().nullable(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Authorization requise" }, 401);

    const payload     = await req.json();
    const parseResult = CreatePaymentSchema.safeParse(payload);
    if (!parseResult.success) {
      return json({ error: parseResult.error.errors[0].message }, 400);
    }
    const { plan, payment_method } = parseResult.data;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: { user } } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (!user) return json({ error: "Non autorisé" }, 401);

    // 5 tentatives de paiement max par tranche de 10 minutes
    const { allowed } = await checkRateLimit(`create-payment:${user.id}`, 5, 600);
    if (!allowed) return json({ error: "Trop de requêtes, réessayez dans quelques minutes" }, 429);

    const selectedPlan = PLANS[plan];

    // Créer la subscription en pending — montant résolu côté serveur uniquement
    const { data: subscription, error: subInsertErr } = await supabase
      .from("subscriptions")
      .insert({
        user_id:        user.id,
        plan,
        status:         "pending",
        payment_method,
        amount:         selectedPlan.amount,
      })
      .select()
      .single();

    if (subInsertErr || !subscription) {
      console.error("create-payment: erreur insertion subscription", subInsertErr);
      return json({ error: "Impossible de créer la souscription" }, 500);
    }

    const appUrl = Deno.env.get("APP_URL") ?? "https://boutikos.app";
    const ipnUrl = `${SUPABASE_URL}/functions/v1/ipn-paytech`;

    // Mode test : PayTech débite 100 FCFA. Mode prod : montant réel.
    const billedAmount = IS_PRODUCTION ? selectedPlan.amount : 100;

    const paytechRes = await fetch(PAYTECH_REQUEST_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept":       "application/json",
        "API_KEY":      PAYTECH_API_KEY,
        "API_SECRET":   PAYTECH_API_SECRET,
      },
      body: JSON.stringify({
        item_name:    selectedPlan.label,
        item_price:   billedAmount,
        currency:     "XOF",
        ref_command:  subscription.id,
        ipn_url:      ipnUrl,
        success_url:  `${appUrl}/payment/success?sub=${subscription.id}`,
        cancel_url:   `${appUrl}/payment/cancel?sub=${subscription.id}`,
        env:          IS_PRODUCTION ? "prod" : "test",
        custom_field: JSON.stringify({
          subscription_id: subscription.id,
          user_id:         user.id,
          plan,
        }),
      }),
    });

    if (!paytechRes.ok) {
      await supabase.from("subscriptions").delete().eq("id", subscription.id);
      console.error("create-payment: PayTech HTTP error", paytechRes.status);
      return json({ error: "Erreur de paiement, veuillez réessayer" }, 502);
    }

    const paytechData = await paytechRes.json();

    if (!paytechData.success) {
      await supabase.from("subscriptions").delete().eq("id", subscription.id);
      console.error("create-payment: PayTech API error", JSON.stringify(paytechData));
      return json({ error: paytechData.message ?? "Erreur de paiement, veuillez réessayer" }, 502);
    }

    // Stocker le token PayTech pour audit et réconciliation
    await supabase
      .from("subscriptions")
      .update({ paytech_token: paytechData.token })
      .eq("id", subscription.id);

    return json({
      success:         true,
      subscription_id: subscription.id,
      payment_url:     paytechData.redirect_url ?? null,
      token:           paytechData.token ?? null,
    });

  } catch (err) {
    console.error("create-payment error:", err);
    return json({ error: "Une erreur interne est survenue" }, 500);
  }
});

function json(data: object, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
