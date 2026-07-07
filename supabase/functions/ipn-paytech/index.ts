import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PAYTECH_API_KEY      = Deno.env.get("PAYTECH_API_KEY")!;
const PAYTECH_API_SECRET   = Deno.env.get("PAYTECH_API_SECRET")!;
const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PLAN_DURATIONS: Record<string, number> = {
  starter: 30,
  pro:     30,
  annual:  365,
};

// PayTech → notre enum payment_method
const METHOD_MAP: Record<string, string> = {
  wave:         "wave",
  orange_money: "orange_money",
  orange:       "orange_money",
};

async function sha256hex(input: string): Promise<string> {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input)
  );
  return Array.from(new Uint8Array(bytes))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  // PayTech peut poster en form-urlencoded ou JSON selon la config
  let params: Record<string, string>;
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    params = await req.json();
  } else {
    const text = await req.text();
    params = Object.fromEntries(new URLSearchParams(text));
  }

  // ─── VÉRIFICATION SÉCURITÉ ───────────────────────────────────────────────
  // Comparer sha256(nos clés) avec ce que PayTech envoie.
  // Sans cette vérification n'importe qui peut simuler un paiement réussi.
  const [expectedKeyHash, expectedSecretHash] = await Promise.all([
    sha256hex(PAYTECH_API_KEY),
    sha256hex(PAYTECH_API_SECRET),
  ]);

  if (
    expectedKeyHash    !== params.api_key_sha256 ||
    expectedSecretHash !== params.api_secret_sha256
  ) {
    console.warn("ipn-paytech: vérification sha256 échouée", {
      receivedKey:    params.api_key_sha256,
      receivedSecret: params.api_secret_sha256,
    });
    return new Response("IPN KO NOT FROM PAYTECH", { status: 401 });
  }
  // ─────────────────────────────────────────────────────────────────────────

  // ref_command = subscription.id (passé lors du request-payment)
  const subscriptionId = params.ref_command;
  if (!subscriptionId) {
    console.error("ipn-paytech: ref_command manquant");
    return new Response("ref_command manquant", { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Logger le paiement en premier (idempotence — on peut recevoir plusieurs IPN)
  await supabase.from("payment_logs").insert({
    event:           "payment_completed",
    paytech_token:   params.token ?? null,
    amount:          parseInt(params.item_price, 10) || 0,
    status:          "success",
    raw_payload:     params,
    subscription_id: subscriptionId,
  });

  // Récupérer la subscription — doit être en pending
  const { data: sub, error: fetchErr } = await supabase
    .from("subscriptions")
    .select("id, user_id, plan, payment_method")
    .eq("id", subscriptionId)
    .eq("status", "pending")
    .single();

  if (fetchErr || !sub) {
    // Peut arriver si l'IPN est reçu deux fois — on ignore silencieusement
    console.warn("ipn-paytech: subscription introuvable ou déjà traitée", subscriptionId);
    return new Response("OK", { status: 200 });
  }

  const now      = new Date();
  const days     = PLAN_DURATIONS[sub.plan] ?? 30;
  const mappedMethod = METHOD_MAP[params.payment_method] ?? null;

  // Renouvellement anticipé : prolonger depuis expires_at actuel si déjà actif
  const { data: activeSub } = await supabase
    .from("subscriptions")
    .select("id, expires_at")
    .eq("user_id", sub.user_id)
    .eq("status", "active")
    .neq("payment_method", "admin")
    .gt("expires_at", now.toISOString())
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const baseDate  = activeSub ? new Date(activeSub.expires_at) : now;
  const expiresAt = new Date(baseDate);
  expiresAt.setDate(expiresAt.getDate() + days);

  // Activer la subscription
  const updatePayload: Record<string, unknown> = {
    status:     "active",
    starts_at:  now.toISOString(),
    expires_at: expiresAt.toISOString(),
  };
  if (mappedMethod) updatePayload.payment_method = mappedMethod;

  const { error: updateErr } = await supabase
    .from("subscriptions")
    .update(updatePayload)
    .eq("id", sub.id);

  if (updateErr) {
    console.error("ipn-paytech: erreur activation subscription", updateErr);
    return new Response("Erreur activation", { status: 500 });
  }

  // Expirer l'ancien abonnement actif si renouvellement anticipé
  if (activeSub) {
    await supabase
      .from("subscriptions")
      .update({ status: "expired" })
      .eq("id", activeSub.id);
  }

  console.log("ipn-paytech: subscription activée", sub.id, "plan:", sub.plan, "expires:", expiresAt.toISOString());
  return new Response("OK", { status: 200 });
});
