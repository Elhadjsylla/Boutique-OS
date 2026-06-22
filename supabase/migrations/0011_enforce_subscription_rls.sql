-- ================================
-- FONCTION CENTRALE
-- Vérifie si l'user a un abonnement actif non expiré
-- ================================
CREATE OR REPLACE FUNCTION public.is_subscription_active(uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = uid
      AND status = 'active'
      AND expires_at > NOW()
  );
$$;

-- ================================
-- POLITIQUES RESTRICTIVES
-- S'appliquent en AND avec les politiques existantes
-- Bloquent lecture ET écriture si abo expiré/absent
-- ================================

CREATE POLICY "require_active_subscription"
ON produits AS RESTRICTIVE FOR ALL
USING (public.is_subscription_active())
WITH CHECK (public.is_subscription_active());

CREATE POLICY "require_active_subscription"
ON ventes AS RESTRICTIVE FOR ALL
USING (public.is_subscription_active())
WITH CHECK (public.is_subscription_active());

CREATE POLICY "require_active_subscription"
ON vente_items AS RESTRICTIVE FOR ALL
USING (public.is_subscription_active())
WITH CHECK (public.is_subscription_active());

CREATE POLICY "require_active_subscription"
ON ardoises AS RESTRICTIVE FOR ALL
USING (public.is_subscription_active())
WITH CHECK (public.is_subscription_active());

CREATE POLICY "require_active_subscription"
ON ardoise_paiements AS RESTRICTIVE FOR ALL
USING (public.is_subscription_active())
WITH CHECK (public.is_subscription_active());
