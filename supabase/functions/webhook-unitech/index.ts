import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const UNITECH_KEY = Deno.env.get("UNITECH_WEBHOOK_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PLAN_DURATIONS: Record<string, number> = {
  starter: 30,
  pro: 30,
  annual: 365,
};

serve(async (req) => {
  const rawBody = await req.text();

  const signature = req.headers.get("x-unitechpay-signature") ?? "";
  const valid = await verifySignature(rawBody, signature, UNITECH_KEY);
  if (!valid) {
    return new Response("Signature invalide", { status: 401 });
  }

  const payload = JSON.parse(rawBody);
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  await supabase.from("payment_logs").insert({
    event: payload.event,
    unitech_reference: payload.reference,
    amount: payload.amount,
    status: payload.status,
    raw_payload: payload,
  });

  if (payload.event === "payment_completed") {
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("unitech_reference", payload.reference)
      .single();

    if (!subscription) {
      return new Response("Subscription introuvable", { status: 404 });
    }

    const now = new Date();
    const days = PLAN_DURATIONS[subscription.plan] ?? 30;
    const expires = new Date(now);
    expires.setDate(expires.getDate() + days);

    await supabase
      .from("subscriptions")
      .update({
        status: "active",
        net_amount: payload.net_amount,
        starts_at: now.toISOString(),
        expires_at: expires.toISOString(),
      })
      .eq("id", subscription.id);

    await supabase
      .from("payment_logs")
      .update({ subscription_id: subscription.id })
      .eq("unitech_reference", payload.reference);
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
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload)
  );
  const expected = Array.from(new Uint8Array(signed))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  return expected === signature;
}
