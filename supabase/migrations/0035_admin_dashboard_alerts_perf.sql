-- Migration 0035 : Alertes automatiques, Realtime, Index perf, Vue matérialisée
-- Sections I, J, K du Dashboard Super Admin

BEGIN;

-- ══════════════════════════════════════════════════════════════
-- I28. get_alerts(non_lues_only)
-- Retourne les alertes admin actives
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_alerts(p_non_lues_only BOOLEAN DEFAULT true)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
BEGIN
  PERFORM public._assert_super_admin();

  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',        a.id,
          'type',      a.type,
          'message',   a.message,
          'severite',  a.severite,
          'cible_id',  a.cible_id,
          'created_at', a.created_at,
          'lue',       a.lue
        )
        ORDER BY
          CASE a.severite WHEN 'urgent' THEN 0 WHEN 'attention' THEN 1 ELSE 2 END,
          a.created_at DESC
      )
      FROM alerts a
      WHERE (NOT p_non_lues_only OR a.lue = false)
    ),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_alerts(BOOLEAN) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- mark_alert_read(alert_id)
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.mark_alert_read(p_alert_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._assert_super_admin();
  UPDATE alerts SET lue = true WHERE id = p_alert_id;
  RETURN jsonb_build_object('success', FOUND);
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_alert_read(UUID) TO authenticated;

-- mark_all_alerts_read()
CREATE OR REPLACE FUNCTION public.mark_all_alerts_read()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._assert_super_admin();
  UPDATE alerts SET lue = true WHERE lue = false;
  RETURN jsonb_build_object('success', true, 'updated', (SELECT COUNT(*) FROM alerts WHERE lue = true));
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_all_alerts_read() TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- I27. detect_and_insert_alerts()
-- Fonction planifiée (cron) qui détecte et insère les alertes.
-- Idempotente : n'insère pas de doublon pour la même cible/type/journée.
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.detect_and_insert_alerts()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
BEGIN

  -- ── Alerte 1 : Comptes en attente depuis +48h ─────────────
  INSERT INTO alerts (type, message, severite, cible_id)
  SELECT
    'compte_pending_48h',
    'Compte en attente de validation depuis plus de 48h : '
      || COALESCE(p.nom || ' ' || COALESCE(p.prenom,''), u.email),
    'attention',
    p.id
  FROM profils p
  JOIN auth.users u ON u.id = p.id
  WHERE p.status = 'pending'
    AND p.created_at < NOW() - INTERVAL '48 hours'
    AND NOT EXISTS (
      SELECT 1 FROM alerts a
      WHERE a.type = 'compte_pending_48h'
        AND a.cible_id = p.id
        AND a.created_at::date = v_today
    );

  -- ── Alerte 2 : Signalement haute priorité non traité +12h ──
  INSERT INTO alerts (type, message, severite, cible_id)
  SELECT
    'signalement_haute_priorite_non_traite',
    'Signalement haute priorité sans réponse depuis +12h : « ' || LEFT(s.sujet, 60) || ' »',
    'urgent',
    s.id
  FROM signalements s
  WHERE s.priorite = 'haute'
    AND s.statut = 'nouveau'
    AND s.created_at < NOW() - INTERVAL '12 hours'
    AND NOT EXISTS (
      SELECT 1 FROM alerts a
      WHERE a.type = 'signalement_haute_priorite_non_traite'
        AND a.cible_id = s.id
        AND a.created_at::date = v_today
    );

  -- ── Alerte 3 : Pic de churn anormal (>15% sur 7j) ──────────
  DECLARE
    v_churn_7j   NUMERIC;
    v_churn_prev NUMERIC;
  BEGIN
    SELECT
      CASE WHEN actifs_debut = 0 THEN 0
           ELSE ROUND(churned_7j::NUMERIC / actifs_debut * 100, 2) END
    INTO v_churn_7j
    FROM (
      SELECT
        (SELECT COUNT(DISTINCT user_id) FROM subscriptions
         WHERE status = 'active' AND starts_at < NOW() - INTERVAL '7 days'
           AND expires_at >= NOW() - INTERVAL '7 days'
           AND payment_method::TEXT != 'admin' AND plan::TEXT != 'free') as actifs_debut,
        (SELECT COUNT(DISTINCT user_id) FROM subscriptions
         WHERE status IN ('cancelled','trial_cancelled')
           AND cancelled_at >= NOW() - INTERVAL '7 days'
           AND payment_method::TEXT != 'admin' AND plan::TEXT != 'free') as churned_7j
    ) t;

    SELECT
      CASE WHEN actifs_debut = 0 THEN 0
           ELSE ROUND(churned_prev::NUMERIC / actifs_debut * 100, 2) END
    INTO v_churn_prev
    FROM (
      SELECT
        (SELECT COUNT(DISTINCT user_id) FROM subscriptions
         WHERE status = 'active' AND starts_at < NOW() - INTERVAL '14 days'
           AND expires_at >= NOW() - INTERVAL '14 days'
           AND payment_method::TEXT != 'admin' AND plan::TEXT != 'free') as actifs_debut,
        (SELECT COUNT(DISTINCT user_id) FROM subscriptions
         WHERE status IN ('cancelled','trial_cancelled')
           AND cancelled_at >= NOW() - INTERVAL '14 days'
           AND cancelled_at < NOW() - INTERVAL '7 days'
           AND payment_method::TEXT != 'admin' AND plan::TEXT != 'free') as churned_prev
    ) t;

    -- Alerte si churn >15% ET 50% supérieur à la semaine précédente
    IF v_churn_7j > 15
       AND (v_churn_prev = 0 OR v_churn_7j > v_churn_prev * 1.5)
       AND NOT EXISTS (
         SELECT 1 FROM alerts
         WHERE type = 'churn_anormal' AND created_at::date = v_today
       )
    THEN
      INSERT INTO alerts (type, message, severite)
      VALUES (
        'churn_anormal',
        'Pic de churn anormal : ' || v_churn_7j || '% cette semaine (vs ' || v_churn_prev || '% la semaine dernière)',
        'urgent'
      );
    END IF;
  END;

  -- ── Alerte 4 : Échecs de paiement répétés (3+ sur 24h) ─────
  INSERT INTO alerts (type, message, severite, cible_id)
  SELECT
    'echecs_paiement_repetes',
    'Échecs de paiement répétés pour : ' || COALESCE(p.nom || ' ' || COALESCE(p.prenom,''), u.email)
      || ' (' || echec_count || ' échecs en 24h)',
    'attention',
    pl.user_id
  FROM (
    SELECT s.user_id, COUNT(*) as echec_count
    FROM payment_logs pl2
    JOIN subscriptions s ON s.id = pl2.subscription_id
    WHERE pl2.status IN ('failed','error','refused')
      AND pl2.received_at >= NOW() - INTERVAL '24 hours'
    GROUP BY s.user_id
    HAVING COUNT(*) >= 3
  ) pl
  JOIN auth.users u ON u.id = pl.user_id
  LEFT JOIN profils p ON p.id = pl.user_id
  WHERE NOT EXISTS (
    SELECT 1 FROM alerts a
    WHERE a.type = 'echecs_paiement_repetes'
      AND a.cible_id = pl.user_id
      AND a.created_at::date = v_today
  );

END;
$$;

-- Planification : toutes les heures
SELECT cron.schedule(
  'detect-admin-alerts',
  '0 * * * *',
  'SELECT public.detect_and_insert_alerts()'
);

-- ══════════════════════════════════════════════════════════════
-- J29-30. SUPABASE REALTIME
-- Activer la réplication en temps réel sur les tables clés
-- ══════════════════════════════════════════════════════════════

-- La publication supabase_realtime existe par défaut dans tout projet Supabase.
-- On y ajoute nos tables sans recréer la publication.

DO $$
BEGIN
  -- signalements (nouveau signalement visible live côté admin)
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'signalements'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.signalements;
  END IF;

  -- signalement_reponses (réponse admin visible live côté user et vice versa)
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'signalement_reponses'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.signalement_reponses;
  END IF;

  -- alerts (alertes admin en temps réel)
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'alerts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
  END IF;

  -- profils (file de validation — filtre status='pending' côté client)
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'profils'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profils;
  END IF;

  -- notifications (badge non-lu en temps réel)
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END;
$$;

-- ══════════════════════════════════════════════════════════════
-- K32. INDEX DE PERFORMANCE
-- ══════════════════════════════════════════════════════════════

-- Profils : recherche par statut et date d'inscription
CREATE INDEX IF NOT EXISTS idx_profils_status
  ON public.profils(status);

CREATE INDEX IF NOT EXISTS idx_profils_created_at
  ON public.profils(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_profils_role_status
  ON public.profils(role, status);

-- Subscriptions : requêtes revenue/churn par date et user
CREATE INDEX IF NOT EXISTS idx_subscriptions_created_at
  ON public.subscriptions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_subscriptions_status_expires
  ON public.subscriptions(status, expires_at)
  WHERE status IN ('active','trial');

CREATE INDEX IF NOT EXISTS idx_subscriptions_cancelled_at
  ON public.subscriptions(cancelled_at DESC)
  WHERE cancelled_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_plan
  ON public.subscriptions(user_id, plan);

-- Ventes : time-series analytics
CREATE INDEX IF NOT EXISTS idx_ventes_created_at
  ON public.ventes(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ventes_boutique_created
  ON public.ventes(boutique_id, created_at DESC);

-- Signalements : tri par priorité/statut/date
CREATE INDEX IF NOT EXISTS idx_signalements_statut_priorite
  ON public.signalements(statut, priorite, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_signalements_user_id
  ON public.signalements(user_id);

CREATE INDEX IF NOT EXISTS idx_signalements_created_at
  ON public.signalements(created_at DESC);

-- Signalement_reponses : filtrage par signalement
CREATE INDEX IF NOT EXISTS idx_sig_reponses_signalement
  ON public.signalement_reponses(signalement_id, created_at ASC);

-- Alerts : alertes non lues
CREATE INDEX IF NOT EXISTS idx_alerts_lue_severite
  ON public.alerts(lue, severite, created_at DESC)
  WHERE lue = false;

-- Boutiques : géolocalisation
CREATE INDEX IF NOT EXISTS idx_boutiques_quartier
  ON public.boutiques(quartier)
  WHERE quartier IS NOT NULL;

-- Audit log : index conditionnel (table créée par 0018, peut être absente)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'admin_audit_log') THEN
    CREATE INDEX IF NOT EXISTS idx_audit_log_action
      ON public.admin_audit_log(action, created_at DESC);
  END IF;
END;
$$;

-- ══════════════════════════════════════════════════════════════
-- K33. VUE MATÉRIALISÉE — Agrégats plateforme (rafraîchie 1×/h)
-- Optimise les requêtes "all-time" et MRR sans recalcul complet
-- ══════════════════════════════════════════════════════════════

CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_platform_stats AS
SELECT
  -- Clé unique fixe (requis pour REFRESH CONCURRENTLY)
  1                                                                                           AS id,
  -- Utilisateurs
  (SELECT COUNT(*) FROM public.profils WHERE role != 'super_admin')                          AS total_users,
  (SELECT COUNT(*) FROM public.profils WHERE role = 'gerant')                                AS total_gerants,
  (SELECT COUNT(*) FROM public.profils WHERE role = 'caissier')                              AS total_caissiers,
  (SELECT COUNT(*) FROM public.profils WHERE status = 'pending')                             AS pending_validation,

  -- Boutiques
  (SELECT COUNT(*) FROM public.boutiques)                                                    AS total_boutiques,
  (SELECT COUNT(*) FROM public.boutiques WHERE suspended = false)                            AS boutiques_actives,

  -- Revenue all-time (hors admin/free)
  (SELECT COALESCE(SUM(net_amount), 0) FROM public.subscriptions
   WHERE payment_method::TEXT != 'admin' AND plan::TEXT NOT IN ('free','trial'))             AS revenu_total,

  -- Nombre de transactions payantes all-time
  (SELECT COUNT(*) FROM public.subscriptions
   WHERE payment_method::TEXT != 'admin' AND plan::TEXT NOT IN ('free','trial')
     AND status NOT IN ('pending'))                                                           AS nb_transactions_total,

  -- MRR courant
  (SELECT COALESCE(SUM(
     CASE WHEN plan::TEXT = 'annual' THEN net_amount::NUMERIC / 12 ELSE net_amount::NUMERIC END
   ), 0)
   FROM public.subscriptions
   WHERE status = 'active' AND expires_at > NOW()
     AND payment_method::TEXT != 'admin'
     AND plan::TEXT NOT IN ('free','trial'))                                                  AS mrr,

  -- Paying users
  (SELECT COUNT(DISTINCT user_id) FROM public.subscriptions
   WHERE status = 'active' AND expires_at > NOW()
     AND payment_method::TEXT != 'admin' AND plan::TEXT NOT IN ('free','trial'))             AS paying_users,

  -- Ventes plateforme
  (SELECT COUNT(*) FROM public.ventes)                                                       AS nb_ventes_total,
  (SELECT COALESCE(SUM(total), 0) FROM public.ventes)                                       AS ca_ventes_total,

  -- Timestamp du dernier refresh
  NOW()                                                                                       AS refreshed_at;

-- Index unique sur id (requis pour REFRESH MATERIALIZED VIEW CONCURRENTLY)
CREATE UNIQUE INDEX IF NOT EXISTS mv_platform_stats_unique
  ON public.mv_platform_stats(id);

-- RPC pour exposer la vue
CREATE OR REPLACE FUNCTION public.get_platform_stats_cached()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
BEGIN
  PERFORM public._assert_super_admin();
  RETURN (SELECT row_to_json(mv.*)::JSONB FROM public.mv_platform_stats mv LIMIT 1);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_platform_stats_cached() TO authenticated;

-- Cron : rafraîchir la vue toutes les heures
SELECT cron.schedule(
  'refresh-mv-platform-stats',
  '30 * * * *',
  'REFRESH MATERIALIZED VIEW public.mv_platform_stats'
);

COMMIT;
