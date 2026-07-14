-- Migration 0047 : Index composites manquants + RPC agrégées pour dashboard et statut d'abonnement
-- Objectif : éliminer les scans complets côté client (dashboard calculé en JS, useSubscription
-- en select *) en poussant les agrégations et la vérification d'abonnement côté serveur, sur
-- des colonnes indexées.

BEGIN;

-- 1. INDEX COMPOSITES MANQUANTS ------------------------------------------------
-- (boutique_id, updated_at) : nécessaire pour la pagination par curseur (keyset) sur les listes.
CREATE INDEX IF NOT EXISTS idx_produits_boutique_updated ON public.produits (boutique_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_ventes_boutique_updated ON public.ventes (boutique_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_ardoises_boutique_updated ON public.ardoises (boutique_id, updated_at);

-- (boutique_id, statut) : filtre le plus courant sur les ardoises (ouvertes vs soldées).
CREATE INDEX IF NOT EXISTS idx_ardoises_boutique_statut ON public.ardoises (boutique_id, statut);

-- 2. STATUT D'ABONNEMENT D'UNE BOUTIQUE, EN UNE SEULE LECTURE INDEXÉE ---------
-- Contrairement à is_subscription_active() (booléen simple, lié à l'utilisateur courant),
-- celle-ci renvoie {actif, plan, date_fin} pour LA BOUTIQUE (via l'abonnement de son gérant),
-- pour être mise en cache côté front dès la connexion et évite de la recalculer à chaque écran.
CREATE OR REPLACE FUNCTION public.get_boutique_subscription_status(p_boutique_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_boutique_id uuid;
  v_result jsonb;
BEGIN
  SELECT role, boutique_id INTO v_role, v_boutique_id FROM profils WHERE id = auth.uid();

  IF v_role IS DISTINCT FROM 'super_admin' AND (v_boutique_id IS NULL OR v_boutique_id <> p_boutique_id) THEN
    RAISE EXCEPTION 'Accès refusé à cette boutique';
  END IF;

  SELECT jsonb_build_object(
    'actif', COALESCE(s.status = 'active' AND s.expires_at > now(), false),
    'plan', s.plan,
    'date_fin', s.expires_at
  )
  INTO v_result
  FROM boutiques b
  LEFT JOIN LATERAL (
    SELECT plan, status, expires_at
    FROM subscriptions
    WHERE user_id = b.gerant_id
    ORDER BY expires_at DESC NULLS LAST
    LIMIT 1
  ) s ON true
  WHERE b.id = p_boutique_id;

  RETURN COALESCE(v_result, jsonb_build_object('actif', false, 'plan', null, 'date_fin', null));
END;
$$;

-- 3. STATS DASHBOARD AGRÉGÉES CÔTÉ SERVEUR ------------------------------------
-- Remplace le calcul client (fetch de toutes les ventes + tous les vente_items + boucle N+1
-- pour le nom des top produits) par des SUM/COUNT/GROUP BY sur des colonnes indexées.
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_boutique_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_boutique_id uuid;
  v_result jsonb;
  v_start_today timestamptz := date_trunc('day', now());
  v_7d_ago timestamptz := now() - interval '7 days';
  v_30d_ago timestamptz := now() - interval '30 days';
BEGIN
  SELECT role, boutique_id INTO v_role, v_boutique_id FROM profils WHERE id = auth.uid();

  IF v_role IS DISTINCT FROM 'super_admin' AND (v_boutique_id IS NULL OR v_boutique_id <> p_boutique_id) THEN
    RAISE EXCEPTION 'Accès refusé à cette boutique';
  END IF;

  SELECT jsonb_build_object(
    'ca_today', COALESCE((
      SELECT SUM(total) FROM ventes
      WHERE boutique_id = p_boutique_id AND deleted_at IS NULL AND created_at >= v_start_today
    ), 0),
    'ca_week', COALESCE((
      SELECT SUM(total) FROM ventes
      WHERE boutique_id = p_boutique_id AND deleted_at IS NULL AND created_at >= v_7d_ago
    ), 0),
    'ca_month', COALESCE((
      SELECT SUM(total) FROM ventes
      WHERE boutique_id = p_boutique_id AND deleted_at IS NULL AND created_at >= v_30d_ago
    ), 0),
    'sales_count_today', COALESCE((
      SELECT COUNT(*) FROM ventes
      WHERE boutique_id = p_boutique_id AND deleted_at IS NULL AND created_at >= v_start_today
    ), 0),
    'open_ardoises_count', COALESCE((
      SELECT COUNT(*) FROM ardoises
      WHERE boutique_id = p_boutique_id AND deleted_at IS NULL AND statut = 'en_cours'
    ), 0),
    'out_of_stock_count', COALESCE((
      SELECT COUNT(*) FROM produits
      WHERE boutique_id = p_boutique_id AND deleted_at IS NULL AND archive = false AND quantite = 0
    ), 0),
    'daily_sales_history', (
      SELECT COALESCE(jsonb_agg(COALESCE(s.day_total, 0) ORDER BY d.day), '[]'::jsonb)
      FROM generate_series(v_start_today - interval '6 days', v_start_today, interval '1 day') AS d(day)
      LEFT JOIN (
        SELECT date_trunc('day', created_at) AS day, SUM(total) AS day_total
        FROM ventes
        WHERE boutique_id = p_boutique_id AND deleted_at IS NULL AND created_at >= v_start_today - interval '6 days'
        GROUP BY date_trunc('day', created_at)
      ) s ON s.day = d.day
    ),
    'top_products', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('nom', p.nom, 'qty', t.qty) ORDER BY t.qty DESC), '[]'::jsonb)
      FROM (
        SELECT vi.produit_id, SUM(vi.quantite) AS qty
        FROM vente_items vi
        JOIN ventes v ON v.id = vi.vente_id
        WHERE v.boutique_id = p_boutique_id AND v.deleted_at IS NULL
        GROUP BY vi.produit_id
        ORDER BY SUM(vi.quantite) DESC
        LIMIT 5
      ) t
      JOIN produits p ON p.id = t.produit_id
    )
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
