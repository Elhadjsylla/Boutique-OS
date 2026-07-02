import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY    = Deno.env.get("RESEND_API_KEY")!;
const CRON_SECRET       = Deno.env.get("CRON_SECRET")!;
const FROM_EMAIL        = "Sama Boutik <onboarding@resend.dev>";

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  pro:     "Pro",
  annual:  "Annuel",
};

serve(async (req) => {
  // Sécuriser : seul le cron peut appeler cette fonction
  const secret = req.headers.get("x-cron-secret");
  if (secret !== CRON_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  let sent = 0;

  try {
    // Récupérer les abonnements expirant dans 1 ou 7 jours
    const { data: expiring } = await supabase
      .from("subscriptions")
      .select("id, user_id, plan, expires_at")
      .eq("status", "active")
      .or(
        `expires_at.gte.${new Date(Date.now() + 6 * 864e5).toISOString()},expires_at.lte.${new Date(Date.now() + 8 * 864e5).toISOString()}`
      );

    for (const sub of expiring ?? []) {
      const { data: userData } = await supabase.auth.admin.getUserById(sub.user_id);
      if (!userData?.user?.email) continue;

      const email     = userData.user.email;
      const planLabel = PLAN_LABELS[sub.plan] ?? sub.plan;
      const expiresAt = new Date(sub.expires_at);
      const daysLeft  = Math.ceil((expiresAt.getTime() - Date.now()) / 864e5);
      const isUrgent  = daysLeft <= 1;

      const subject = isUrgent
        ? `⚠️ Dernier jour — votre abonnement Sama Boutik expire aujourd'hui`
        : `🔔 Votre abonnement Sama Boutik expire dans ${daysLeft} jours`;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto;">
          <h2 style="color: #1A3C5E;">Sama Boutik</h2>
          <p>Bonjour,</p>
          <p>Votre abonnement <strong>${planLabel}</strong> ${
            isUrgent ? "expire <strong>aujourd'hui</strong>" : `expire dans <strong>${daysLeft} jours</strong>`
          } (le ${expiresAt.toLocaleDateString('fr-FR')}).</p>
          <p>Pour continuer à utiliser Sama Boutik sans interruption, renouvelez votre abonnement dès maintenant.</p>
          <a href="${Deno.env.get('APP_URL') ?? 'https://boutikos.app'}/abonnement"
             style="display:inline-block;background:#27AE60;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:16px;">
            Renouveler mon abonnement
          </a>
          <p style="color:#888;font-size:12px;margin-top:32px;">Sama Boutik — Votre caisse intelligente</p>
        </div>
      `;

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from: FROM_EMAIL, to: [email], subject, html }),
      });

      if (res.ok) {
        await supabase.from("notifications").insert({
          user_id: sub.user_id,
          type:    isUrgent ? "subscription_expiring_1day" : "subscription_expiring_7days",
          title:   isUrgent ? "Dernier jour !" : "Abonnement bientôt expiré",
          message: isUrgent
            ? `Votre abonnement ${planLabel} expire aujourd'hui.`
            : `Votre abonnement ${planLabel} expire dans ${daysLeft} jours.`,
        });
        sent++;
      } else {
        console.error("Resend error for", email, await res.text());
      }
    }

    return new Response(JSON.stringify({ success: true, sent }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("notify-expiring error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
