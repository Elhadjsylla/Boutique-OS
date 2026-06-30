import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const UNITECH_API       = "https://api.unitech.sn/api.php";
const UNITECH_WAVE_KEY  = Deno.env.get("UNITECH_WAVE_API_KEY")!;
const UNITECH_OM_KEY    = Deno.env.get("UNITECH_OM_API_KEY")!;
const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PLANS = {
  starter: { amount: 2900,  label: "Sama Boutik Starter" },
  pro:     { amount: 5900,  label: "Sama Boutik Pro" },
  annual:  { amount: 52900, label: "Sama Boutik Annuel" },
};

const CreatePaymentSchema = z.object({
  plan: z.string(),
  payment_method: z.string(),
  customer_number: z.string().optional().nullable(),
});

serve(async (req) => {
  try {
    const payload = await req.json();
    const parseResult = CreatePaymentSchema.safeParse(payload);
    if (!parseResult.success) {
      return json({ error: "Données invalides" }, 400);
    }
    const { plan, payment_method, customer_number } = parseResult.data;

    const authHeader = req.headers.get("Authorization")!;
    if (!authHeader) return json({ error: "Authorization requise" }, 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: { user } } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (!user) return json({ error: "Non autorisé" }, 401);

    const selectedPlan = PLANS[plan as keyof typeof PLANS];
    if (!selectedPlan) return json({ error: "Plan invalide" }, 400);

    const { data: subscription } = await supabase
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

    let unitechRes;
    const baseUrl = Deno.env.get("APP_URL") ?? "https://boutikos.app";

    if (payment_method === "wave") {
      unitechRes = await callUnitech("create_wave_payment", UNITECH_WAVE_KEY, {
        amount: selectedPlan.amount,
        customer_number,
        description: selectedPlan.label,
        callback_success: `${baseUrl}/payment/success?sub=${subscription.id}`,
        callback_cancel: `${baseUrl}/payment/cancel?sub=${subscription.id}`,
      });
    } else {
      unitechRes = await callUnitech("create_orange_qr", UNITECH_OM_KEY, {
        amount: selectedPlan.amount,
        reference: `samaboutik_${subscription.id}`,
        description: selectedPlan.label,
        callback_success: `${baseUrl}/payment/success?sub=${subscription.id}`,
        callback_cancel: `${baseUrl}/payment/cancel?sub=${subscription.id}`,
      });
    }

    if (!unitechRes.success) {
      return json({ error: "Erreur UnitechPay", detail: unitechRes }, 500);
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
      qr_code:      unitechRes.data.qr_code      ?? null,
      deep_links:   unitechRes.data.deep_links   ?? null,
    });

  } catch (err) {
    console.error('create-payment error:', err);
    return json({ error: "Une erreur interne est survenue" }, 500);
  }
});

async function callUnitech(action: string, apiKey: string, body: object) {
  const res = await fetch(`${UNITECH_API}?action=${action}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

function json(data: object, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
