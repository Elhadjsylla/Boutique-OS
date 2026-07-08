-- Migration 0033 : RPCs Analytics Dashboard (Sections B → G)
-- Revenus, MRR/ARR, LTV, Churn, Trafic, Funnel, Boutiques, Géo

BEGIN;

-- ══════════════════════════════════════════════════════════════
-- HELPERS : bornes de période
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public._period_start(p TEXT)
RETURNS TIMESTAMPTZ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE p
    WHEN '24h'  THEN NOW() - INTERVAL '24 hours'
    WHEN '48h'  THEN NOW() - INTERVAL '48 hours'
    WHEN '72h'  THEN NOW() - INTERVAL '72 hours'
    WHEN '7d'   THEN NOW() - INTERVAL '7 days'
    WHEN '14d'  THEN NOW() - INTERVAL '14 days'
    WHEN '1m'   THEN NOW() - INTERVAL '1 month'
    WHEN '3m'   THEN NOW() - INTERVAL '3 months'
    WHEN '6m'   THEN NOW() - INTERVAL '6 months'
    WHEN '12m'  THEN NOW() - INTERVAL '12 months'
    ELSE '1970-01-01 00:00:00+00'::TIMESTAMPTZ
  END;
$$;

-- Début de la période précédente (pour calcul d'évolution)
CREATE OR REPLACE FUNCTION public._period_prev_start(p TEXT)
RETURNS TIMESTAMPTZ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE p
    WHEN '24h'  THEN NOW() - INTERVAL '48 hours'
    WHEN '48h'  THEN NOW() - INTERVAL '96 hours'
    WHEN '72h'  THEN NOW() - INTERVAL '144 hours'
    WHEN '7d'   THEN NOW() - INTERVAL '14 days'
    WHEN '14d'  THEN NOW() - INTERVAL '28 days'
    WHEN '1m'   THEN NOW() - INTERVAL '2 months'
    WHEN '3m'   THEN NOW() - INTERVAL '6 months'
    WHEN '6m'   THEN NOW() - INTERVAL '12 months'
    WHEN '12m'  THEN NOW() - INTERVAL '24 months'
    ELSE NULL
  END;
$$;

-- Fin de la période précédente = début de la période courante
CREATE OR REPLACE FUNCTION public._period_prev_end(p TEXT)
RETURNS TIMESTAMPTZ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public._period_start(p);
$$;

-- ══════════════════════════════════════════════════════════════
-- B4. get_revenue_by_period(period)
-- total_revenu, nb_transactions, par plan, par méthode, % évolution
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_revenue_by_period(p_period TEXT DEFAULT '30d')
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
DECLARE
  v_start      TIMESTAMPTZ := public._period_start(p_period);
  v_prev_start TIMESTAMPTZ := public._period_prev_start(p_period);
  v_prev_end   TIMESTAMPTZ := v_start;
  v_current    NUMERIC;
  v_previous   NUMERIC;
  v_evolution  NUMERIC;
BEGIN
  PERFORM public._assert_super_admin();

  -- Revenu période courante
  SELECT COALESCE(SUM(net_amount), 0) INTO v_current
  FROM subscriptions
  WHERE payment_method::TEXT != 'admin'
    AND plan::TEXT != 'free'
    AND status NOT IN ('pending')
    AND created_at >= v_start;

  -- Revenu période précédente
  IF v_prev_start IS NOT NULL THEN
    SELECT COALESCE(SUM(net_amount), 0) INTO v_previous
    FROM subscriptions
    WHERE payment_method::TEXT != 'admin'
      AND plan::TEXT != 'free'
      AND status NOT IN ('pending')
      AND created_at >= v_prev_start
      AND created_at < v_prev_end;

    v_evolution := CASE
      WHEN v_previous = 0 THEN NULL
      ELSE ROUND((v_current - v_previous) / v_previous * 100, 1)
    END;
  END IF;

  RETURN jsonb_build_object(
    'period',              p_period,
    'total_revenu',        v_current,
    'nb_transactions',     (
      SELECT COUNT(*) FROM subscriptions
      WHERE payment_method::TEXT != 'admin'
        AND plan::TEXT != 'free'
        AND status NOT IN ('pending')
        AND created_at >= v_start
    ),
    'revenu_par_plan',     (
      SELECT jsonb_object_agg(plan::TEXT, COALESCE(total, 0))
      FROM (
        SELECT plan, SUM(net_amount) as total
        FROM subscriptions
        WHERE payment_method::TEXT != 'admin'
          AND plan::TEXT != 'free'
          AND status NOT IN ('pending')
          AND created_at >= v_start
        GROUP BY plan
      ) t
    ),
    'revenu_par_methode',  (
      SELECT jsonb_object_agg(payment_method::TEXT, COALESCE(total, 0))
      FROM (
        SELECT payment_method, SUM(net_amount) as total
        FROM subscriptions
        WHERE payment_method::TEXT != 'admin'
          AND plan::TEXT != 'free'
          AND status NOT IN ('pending')
          AND created_at >= v_start
        GROUP BY payment_method
      ) t
    ),
    'evolution_pct',       v_evolution,
    'revenu_periode_prec', v_previous
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_revenue_by_period(TEXT) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- B5. get_revenue_breakdown(period)
-- Détail transaction par transaction pour drill-down
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_revenue_breakdown(p_period TEXT DEFAULT '30d')
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
BEGIN
  PERFORM public._assert_super_admin();

  RETURN COALESCE(
    (
      SELECT jsonb_agg(row ORDER BY row->>'date' DESC)
      FROM (
        SELECT jsonb_build_object(
          'subscription_id',  s.id,
          'user_id',          s.user_id,
          'nom_boutique',     b.nom,
          'nom_gerant',       COALESCE(p.nom, split_part(u.email,'@',1)),
          'prenom_gerant',    p.prenom,
          'montant',          s.net_amount,
          'plan',             s.plan::TEXT,
          'methode_paiement', s.payment_method::TEXT,
          'date',             s.created_at,
          'statut',           s.status::TEXT
        ) as row
        FROM subscriptions s
        JOIN auth.users u ON u.id = s.user_id
        LEFT JOIN profils p ON p.id = s.user_id
        LEFT JOIN boutiques b ON b.gerant_id = s.user_id
        WHERE s.payment_method::TEXT != 'admin'
          AND s.plan::TEXT != 'free'
          AND s.status NOT IN ('pending')
          AND s.created_at >= public._period_start(p_period)
        ORDER BY s.created_at DESC
      ) t
    ),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_revenue_breakdown(TEXT) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- B6. get_mrr_arr()
-- MRR, ARR et historique MRR sur 6 mois
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_mrr_arr()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
DECLARE
  v_mrr NUMERIC;
BEGIN
  PERFORM public._assert_super_admin();

  -- MRR courant : abonnements actifs normalisés en mensuel
  SELECT COALESCE(SUM(
    CASE
      WHEN plan::TEXT = 'annual'  THEN net_amount::NUMERIC / 12
      ELSE net_amount::NUMERIC          -- starter/pro = mensuel
    END
  ), 0) INTO v_mrr
  FROM subscriptions
  WHERE status = 'active'
    AND expires_at > NOW()
    AND payment_method::TEXT != 'admin'
    AND plan::TEXT NOT IN ('free', 'trial');

  RETURN jsonb_build_object(
    'mrr',     ROUND(v_mrr, 0),
    'arr',     ROUND(v_mrr * 12, 0),
    'historique_6_mois', (
      SELECT jsonb_agg(
        jsonb_build_object('mois', to_char(g, 'YYYY-MM'), 'mrr', ROUND(COALESCE(mrr_val, 0), 0))
        ORDER BY g
      )
      FROM (
        SELECT
          g,
          SUM(
            CASE
              WHEN s.plan::TEXT = 'annual' THEN s.net_amount::NUMERIC / 12
              ELSE s.net_amount::NUMERIC
            END
          ) as mrr_val
        FROM generate_series(
          date_trunc('month', NOW() - INTERVAL '5 months'),
          date_trunc('month', NOW()),
          '1 month'::interval
        ) g
        LEFT JOIN subscriptions s ON
              s.payment_method::TEXT != 'admin'
          AND s.plan::TEXT NOT IN ('free', 'trial')
          AND s.status IN ('active', 'expired')
          AND s.starts_at <= g + INTERVAL '1 month'
          AND s.expires_at > g
        GROUP BY g
      ) hist
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_mrr_arr() TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- B7. get_ltv_by_plan()
-- LTV moyen par plan (starter, pro, annual)
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_ltv_by_plan()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
BEGIN
  PERFORM public._assert_super_admin();

  RETURN COALESCE(
    (
      SELECT jsonb_object_agg(plan, ltv_data)
      FROM (
        SELECT
          plan::TEXT as plan,
          jsonb_build_object(
            'nb_utilisateurs',       COUNT(DISTINCT user_id),
            'revenu_moyen',          ROUND(AVG(user_revenue)::NUMERIC, 0),
            'duree_moyenne_mois',    ROUND(AVG(lifetime_months)::NUMERIC, 1),
            'ltv',                   ROUND((AVG(user_revenue) * AVG(lifetime_months))::NUMERIC, 0)
          ) as ltv_data
        FROM (
          SELECT
            plan,
            user_id,
            SUM(net_amount) as user_revenue,
            GREATEST(
              EXTRACT(EPOCH FROM (MAX(expires_at) - MIN(starts_at))) / (30.0 * 86400),
              1
            ) as lifetime_months
          FROM subscriptions
          WHERE payment_method::TEXT != 'admin'
            AND plan::TEXT NOT IN ('free', 'trial')
            AND net_amount > 0
            AND starts_at IS NOT NULL
          GROUP BY plan, user_id
        ) user_stats
        GROUP BY plan
      ) agg
    ),
    '{}'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_ltv_by_plan() TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- C8. get_churn_rate(period)
-- Taux de churn + évolution vs période précédente
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_churn_rate(p_period TEXT DEFAULT '30d')
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
DECLARE
  v_start       TIMESTAMPTZ := public._period_start(p_period);
  v_prev_start  TIMESTAMPTZ := public._period_prev_start(p_period);
  v_actifs_debut BIGINT;
  v_churned      BIGINT;
  v_churn_rate   NUMERIC;
  v_prev_rate    NUMERIC;
  v_actifs_debut_prev BIGINT;
  v_churned_prev BIGINT;
BEGIN
  PERFORM public._assert_super_admin();

  -- Utilisateurs actifs au début de la période courante
  SELECT COUNT(DISTINCT user_id) INTO v_actifs_debut
  FROM subscriptions
  WHERE status = 'active'
    AND starts_at < v_start
    AND expires_at >= v_start
    AND payment_method::TEXT != 'admin'
    AND plan::TEXT NOT IN ('free');

  -- Utilisateurs qui ont annulé pendant la période courante
  SELECT COUNT(DISTINCT user_id) INTO v_churned
  FROM subscriptions
  WHERE status IN ('cancelled', 'trial_cancelled')
    AND cancelled_at >= v_start
    AND payment_method::TEXT != 'admin'
    AND plan::TEXT NOT IN ('free');

  v_churn_rate := CASE
    WHEN v_actifs_debut = 0 THEN 0
    ELSE ROUND(v_churned::NUMERIC / v_actifs_debut * 100, 2)
  END;

  -- Calcul période précédente
  IF v_prev_start IS NOT NULL THEN
    SELECT COUNT(DISTINCT user_id) INTO v_actifs_debut_prev
    FROM subscriptions
    WHERE status = 'active'
      AND starts_at < v_prev_start
      AND expires_at >= v_prev_start
      AND payment_method::TEXT != 'admin'
      AND plan::TEXT NOT IN ('free');

    SELECT COUNT(DISTINCT user_id) INTO v_churned_prev
    FROM subscriptions
    WHERE status IN ('cancelled', 'trial_cancelled')
      AND cancelled_at >= v_prev_start
      AND cancelled_at < v_start
      AND payment_method::TEXT != 'admin'
      AND plan::TEXT NOT IN ('free');

    v_prev_rate := CASE
      WHEN v_actifs_debut_prev = 0 THEN 0
      ELSE ROUND(v_churned_prev::NUMERIC / v_actifs_debut_prev * 100, 2)
    END;
  END IF;

  RETURN jsonb_build_object(
    'period',                p_period,
    'churn_rate_pct',        v_churn_rate,
    'nb_churned',            v_churned,
    'nb_actifs_debut',       v_actifs_debut,
    'churn_rate_prec_pct',   v_prev_rate,
    'evolution_pts',         CASE WHEN v_prev_rate IS NOT NULL
                               THEN ROUND(v_churn_rate - v_prev_rate, 2)
                               ELSE NULL END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_churn_rate(TEXT) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- C9. get_churned_users_detail(period)
-- Liste drill-down des comptes churned
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_churned_users_detail(p_period TEXT DEFAULT '30d')
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
BEGIN
  PERFORM public._assert_super_admin();

  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'user_id',        s.user_id,
          'nom',            COALESCE(p.nom, split_part(u.email,'@',1)),
          'prenom',         p.prenom,
          'email',          u.email,
          'boutique_nom',   b.nom,
          'plan',           s.plan::TEXT,
          'date_annulation', s.cancelled_at,
          'montant_paye',   s.net_amount
        )
        ORDER BY s.cancelled_at DESC
      )
      FROM subscriptions s
      JOIN auth.users u ON u.id = s.user_id
      LEFT JOIN profils p ON p.id = s.user_id
      LEFT JOIN boutiques b ON b.gerant_id = s.user_id
      WHERE s.status IN ('cancelled', 'trial_cancelled')
        AND s.cancelled_at >= public._period_start(p_period)
        AND s.payment_method::TEXT != 'admin'
        AND s.plan::TEXT NOT IN ('free')
    ),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_churned_users_detail(TEXT) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- D10. get_new_users_by_period(period)
-- Nombre total, répartition par rôle, % évolution
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_new_users_by_period(p_period TEXT DEFAULT '30d')
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
DECLARE
  v_start      TIMESTAMPTZ := public._period_start(p_period);
  v_prev_start TIMESTAMPTZ := public._period_prev_start(p_period);
  v_total      BIGINT;
  v_prev_total BIGINT;
BEGIN
  PERFORM public._assert_super_admin();

  SELECT COUNT(*) INTO v_total
  FROM profils
  WHERE created_at >= v_start
    AND role != 'super_admin';

  IF v_prev_start IS NOT NULL THEN
    SELECT COUNT(*) INTO v_prev_total
    FROM profils
    WHERE created_at >= v_prev_start
      AND created_at < v_start
      AND role != 'super_admin';
  END IF;

  RETURN jsonb_build_object(
    'period',         p_period,
    'total',          v_total,
    'par_role',       (
      SELECT jsonb_object_agg(role, nb)
      FROM (
        SELECT role, COUNT(*) as nb
        FROM profils
        WHERE created_at >= v_start AND role != 'super_admin'
        GROUP BY role
      ) t
    ),
    'par_statut',     (
      SELECT jsonb_object_agg(status, nb)
      FROM (
        SELECT status, COUNT(*) as nb
        FROM profils
        WHERE created_at >= v_start AND role != 'super_admin'
        GROUP BY status
      ) t
    ),
    'total_prec',     v_prev_total,
    'evolution_pct',  CASE
      WHEN v_prev_total IS NULL OR v_prev_total = 0 THEN NULL
      ELSE ROUND((v_total - v_prev_total)::NUMERIC / v_prev_total * 100, 1)
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_new_users_by_period(TEXT) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- D11. get_new_users_detail(period)
-- Détail des nouveaux comptes
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_new_users_detail(p_period TEXT DEFAULT '30d')
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
BEGIN
  PERFORM public._assert_super_admin();

  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'user_id',      p.id,
          'nom',          COALESCE(p.nom, split_part(u.email,'@',1)),
          'prenom',       p.prenom,
          'email',        u.email,
          'phone',        p.phone_number,
          'role',         p.role,
          'status',       p.status,
          'boutique_nom', b.nom,
          'created_at',   p.created_at
        )
        ORDER BY p.created_at DESC
      )
      FROM profils p
      JOIN auth.users u ON u.id = p.id
      LEFT JOIN boutiques b ON b.id = p.boutique_id
      WHERE p.created_at >= public._period_start(p_period)
        AND p.role != 'super_admin'
    ),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_new_users_detail(TEXT) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- E12. get_conversion_funnel()
-- Distribution par plan + transitions upgrades/downgrades
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_conversion_funnel()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
DECLARE
  v_free_total  BIGINT;
  v_converted   BIGINT;
BEGIN
  PERFORM public._assert_super_admin();

  -- Taux de conversion free → payant dans les 30 jours
  SELECT COUNT(DISTINCT f.user_id) INTO v_free_total
  FROM subscriptions f WHERE f.plan::TEXT = 'free';

  SELECT COUNT(DISTINCT f.user_id) INTO v_converted
  FROM subscriptions f
  WHERE f.plan::TEXT = 'free'
    AND EXISTS (
      SELECT 1 FROM subscriptions s2
      WHERE s2.user_id = f.user_id
        AND s2.plan::TEXT NOT IN ('free','trial')
        AND s2.payment_method::TEXT != 'admin'
        AND s2.starts_at <= f.starts_at + INTERVAL '30 days'
    );

  RETURN jsonb_build_object(
    -- Distribution actuelle (plan effectif par user)
    'distribution', (
      SELECT jsonb_agg(jsonb_build_object('plan', plan, 'nb_users', nb) ORDER BY rang)
      FROM (
        SELECT
          eff.plan,
          COUNT(*) as nb,
          CASE eff.plan
            WHEN 'free'    THEN 0
            WHEN 'trial'   THEN 1
            WHEN 'starter' THEN 2
            WHEN 'pro'     THEN 3
            WHEN 'annual'  THEN 4
            ELSE 5
          END as rang
        FROM (
          SELECT DISTINCT ON (user_id)
            plan::TEXT as plan
          FROM subscriptions
          WHERE status IN ('active','trial') AND expires_at > NOW()
          ORDER BY user_id,
            CASE WHEN plan::TEXT = 'free' THEN 1 ELSE 0 END,
            expires_at DESC
        ) eff
        GROUP BY eff.plan
      ) dist
    ),

    -- Transitions entre plans (upgrades ET downgrades)
    'transitions', (
      WITH plan_rank(plan, rang) AS (
        VALUES
          ('free'::TEXT, 0),
          ('trial',      1),
          ('starter',    2),
          ('pro',        3),
          ('annual',     4)
      ),
      ordered_subs AS (
        SELECT
          user_id,
          plan::TEXT as plan,
          ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY starts_at, created_at) as rn
        FROM subscriptions
      ),
      trans AS (
        SELECT
          s1.plan as from_plan,
          s2.plan as to_plan,
          COUNT(*) as nb
        FROM ordered_subs s1
        JOIN ordered_subs s2
          ON s1.user_id = s2.user_id AND s2.rn = s1.rn + 1
          AND s1.plan != s2.plan
        GROUP BY s1.plan, s2.plan
      )
      SELECT jsonb_agg(
        jsonb_build_object(
          'from_plan',  t.from_plan,
          'to_plan',    t.to_plan,
          'total',      t.nb,
          'upgrades',   CASE WHEN COALESCE(pr_to.rang,0) > COALESCE(pr_from.rang,0) THEN t.nb ELSE 0 END,
          'downgrades', CASE WHEN COALESCE(pr_to.rang,0) < COALESCE(pr_from.rang,0) THEN t.nb ELSE 0 END
        )
      )
      FROM trans t
      LEFT JOIN plan_rank pr_from ON pr_from.plan = t.from_plan
      LEFT JOIN plan_rank pr_to   ON pr_to.plan   = t.to_plan
    ),

    -- Taux de conversion free → payant sous 30j
    'conversion_free_30j', jsonb_build_object(
      'total_free',    v_free_total,
      'convertis',     v_converted,
      'taux_pct',      CASE WHEN v_free_total = 0 THEN 0
                         ELSE ROUND(v_converted::NUMERIC / v_free_total * 100, 1)
                       END
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_conversion_funnel() TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- F13. get_active_vs_dormant(seuil_jours)
-- Boutiques actives vs dormantes
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_active_vs_dormant(p_seuil_jours INT DEFAULT 30)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
BEGIN
  PERFORM public._assert_super_admin();

  RETURN (
    WITH boutique_activite AS (
      SELECT
        b.id,
        b.nom,
        b.quartier,
        b.suspended,
        MAX(v.created_at) as derniere_vente,
        COUNT(v.id) as nb_ventes_total
      FROM boutiques b
      LEFT JOIN ventes v ON v.boutique_id = b.id
      GROUP BY b.id, b.nom, b.quartier, b.suspended
    ),
    classified AS (
      SELECT
        id, nom, quartier, suspended,
        derniere_vente, nb_ventes_total,
        CASE
          WHEN suspended THEN 'suspendue'
          WHEN derniere_vente IS NULL
            OR derniere_vente < NOW() - (p_seuil_jours || ' days')::INTERVAL
          THEN 'dormante'
          ELSE 'active'
        END as statut,
        COALESCE(
          EXTRACT(DAY FROM (NOW() - derniere_vente))::INT,
          NULL
        ) as jours_inactif
      FROM boutique_activite
    )
    SELECT jsonb_build_object(
      'seuil_jours',    p_seuil_jours,
      'nb_actives',     COUNT(*) FILTER (WHERE statut = 'active'),
      'nb_dormantes',   COUNT(*) FILTER (WHERE statut = 'dormante'),
      'nb_suspendues',  COUNT(*) FILTER (WHERE statut = 'suspendue'),
      'total',          COUNT(*),
      'detail', jsonb_agg(
        jsonb_build_object(
          'id',            id,
          'nom',           nom,
          'quartier',      quartier,
          'statut',        statut,
          'derniere_vente', derniere_vente,
          'jours_inactif', jours_inactif,
          'nb_ventes_total', nb_ventes_total
        )
        ORDER BY statut, jours_inactif DESC NULLS LAST
      )
    )
    FROM classified
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_vs_dormant(INT) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- F14. get_top_boutiques(period, limit)
-- Classement par revenu (ventes) et volume transactions
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_top_boutiques(
  p_period TEXT DEFAULT '30d',
  p_limit  INT  DEFAULT 10
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
BEGIN
  PERFORM public._assert_super_admin();

  RETURN COALESCE(
    (
      SELECT jsonb_agg(row ORDER BY (row->>'revenu')::NUMERIC DESC)
      FROM (
        SELECT jsonb_build_object(
          'boutique_id',     b.id,
          'nom',             b.nom,
          'quartier',        b.quartier,
          'adresse',         b.adresse,
          'revenu',          COALESCE(SUM(v.total), 0),
          'nb_transactions', COUNT(DISTINCT v.id),
          'plan',            COALESCE(s.plan, 'free'),
          'suspended',       b.suspended
        ) as row
        FROM boutiques b
        LEFT JOIN ventes v
          ON v.boutique_id = b.id
          AND v.created_at >= public._period_start(p_period)
        LEFT JOIN profils gerant
          ON gerant.boutique_id = b.id AND gerant.role = 'gerant'
        LEFT JOIN LATERAL (
          SELECT plan::TEXT as plan
          FROM subscriptions
          WHERE user_id = gerant.id
            AND status IN ('active','trial')
            AND expires_at > NOW()
          ORDER BY
            CASE WHEN plan::TEXT = 'free' THEN 1 ELSE 0 END,
            expires_at DESC
          LIMIT 1
        ) s ON true
        GROUP BY b.id, b.nom, b.quartier, b.adresse, b.suspended, s.plan
        ORDER BY COALESCE(SUM(v.total), 0) DESC
        LIMIT p_limit
      ) t
    ),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_top_boutiques(TEXT, INT) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- G16. get_boutiques_geo()
-- Carte : boutiques avec coordonnées via quartiers_dakar
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_boutiques_geo()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
DECLARE
  v_total     BIGINT;
  v_localisees BIGINT;
BEGIN
  PERFORM public._assert_super_admin();

  SELECT COUNT(*) INTO v_total FROM boutiques;

  SELECT COUNT(*) INTO v_localisees
  FROM boutiques b
  WHERE b.quartier IS NOT NULL
    AND EXISTS (SELECT 1 FROM quartiers_dakar WHERE nom = b.quartier);

  RETURN jsonb_build_object(
    'total_boutiques',     v_total,
    'boutiques_localisees', v_localisees,
    'boutiques', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'boutique_id',  b.id,
            'nom',          b.nom,
            'quartier',     b.quartier,
            'latitude',     q.latitude,
            'longitude',    q.longitude,
            'revenu_total', COALESCE(rev.revenu, 0),
            'nb_ventes',    COALESCE(rev.nb_ventes, 0),
            'statut',       CASE WHEN b.suspended THEN 'suspendue'
                                 WHEN COALESCE(rev.derniere_vente, b.created_at)
                                      < NOW() - INTERVAL '30 days'
                                 THEN 'dormante' ELSE 'active' END
          )
        )
        FROM boutiques b
        JOIN quartiers_dakar q ON q.nom = b.quartier
        LEFT JOIN LATERAL (
          SELECT
            SUM(total) as revenu,
            COUNT(*) as nb_ventes,
            MAX(created_at) as derniere_vente
          FROM ventes WHERE boutique_id = b.id
        ) rev ON true
      ),
      '[]'::jsonb
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_boutiques_geo() TO authenticated;

COMMIT;
