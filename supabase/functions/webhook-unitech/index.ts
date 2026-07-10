import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const UNITECH_KEY      = Deno.env.get("UNITECH_WEBHOOK_SECRET")!;
const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PLAN_DURATIONS: Record<string, number> = {
  starter: 30,
  pro:     30,
  annual:  365,
};

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  
  const rawBody = await req.text();

  const signature = req.headers.get("x-unitechpay-signature") ?? "";
  const valid = await verifySignature(rawBody, signature, UNITECH_KEY);
  if (!valid) {
    return new Response("Signature invalide", { status: 401 });
  }

  const payload = JSON.parse(rawBody);
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Masquage des données sensibles avant log
  const safePayload = { ...payload };
  if (safePayload.customer_number) safePayload.customer_number = "***";
  if (safePayload.customer_phone) safePayload.customer_phone = "***";
  if (safePayload.phone_number) safePayload.phone_number = "***";
  if (safePayload.telephone) safePayload.telephone = "***";

  // Log brut du webhook — toujours, quelle que soit l'issue
  await supabase.from("payment_logs").insert({
    event:             payload.event,
    unitech_reference: payload.reference,
    amount:            payload.amount,
    status:            payload.status,
    raw_payload:       safePayload,
  });

  const now = new Date();

  // ── Paiement confirmé ────────────────────────────────────────
  if (payload.event === "payment_completed") {
    const { data: newSub } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("unitech_reference", payload.reference)
      .single();

    if (!newSub) {
      return new Response("Subscription introuvable", { status: 404 });
    }

    // Idempotence : webhook reçu 2× pour la même ref → ne rien faire
    if (newSub.status === "active") {
      return new Response("OK", { status: 200 });
    }

    const days = PLAN_DURATIONS[newSub.plan] ?? 30;

    // Renouvellement anticipé → prolonger depuis expires_at actuel
    const { data: activeSub } = await supabase
      .from("subscriptions")
      .select("id, expires_at")
      .eq("user_id", newSub.user_id)
      .eq("status", "active")
      .neq("payment_method", "admin")
      .gt("expires_at", now.toISOString())
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const baseDate = activeSub ? new Date(activeSub.expires_at) : now;
    const expiresAt = new Date(baseDate);
    expiresAt.setDate(expiresAt.getDate() + days);

    await supabase
      .from("subscriptions")
      .update({
        status:       "active",
        net_amount:   payload.net_amount,
        starts_at:    now.toISOString(),
        expires_at:   expiresAt.toISOString(),
        confirmed_at: now.toISOString(),
      })
      .eq("id", newSub.id);

    if (activeSub) {
      await supabase
        .from("subscriptions")
        .update({ status: "expired" })
        .eq("id", activeSub.id);
    }

    await supabase
      .from("payment_logs")
      .update({ subscription_id: newSub.id })
      .eq("unitech_reference", payload.reference);
  }

  // ── Paiement échoué / annulé ─────────────────────────────────
  if (payload.event === "payment_failed" || payload.event === "payment_cancelled") {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("id, status")
      .eq("unitech_reference", payload.reference)
      .maybeSingle();

    if (sub && sub.status === "pending") {
      await supabase
        .from("subscriptions")
        .update({
          status:       "failed",
          confirmed_at: now.toISOString(),
        })
        .eq("id", sub.id);
    }
  }

  return new Response("OK", { status: 200 });
});

async function verifySignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const expected = Array.from(new Uint8Array(signed))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  return timingSafeEqual(expected, signature);
}

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}
