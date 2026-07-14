-- Migration 0057 : corrige trois bugs RLS empilés qui bloquaient TOUTE
-- écriture réelle sur produits/ventes/vente_items/ardoises/ardoise_paiements
--
-- Signalement initial : "new row violates row-level security policy for
-- table produits" en ajoutant un produit. L'investigation a mis au jour un
-- problème bien plus large — vérifié en base réelle : la table ventes
-- contient 0 ligne, ever. Aucune vente n'a jamais pu être enregistrée depuis
-- la création de l'app.
--
-- BUG 1 — auth.jwt() ->> 'role' toujours faux
-- custom_access_token_hook (déjà en place) ne met JAMAIS ce claim top-level à
-- autre chose que 'authenticated' — intentionnel (commentaire dans le hook :
-- "PostgREST fait SET LOCAL ROLE 'authenticated' qui existe"), le rôle
-- applicatif est injecté dans user_metadata.role à la place. Toute policy
-- comparant auth.jwt() ->> 'role' à 'gerant'/'caissier'/'super_admin' est donc
-- TOUJOURS fausse, pour tout le monde, tout le temps. Une migration
-- antérieure (fix_rls_use_user_metadata_role_and_add_assign_staff, 2026-06-30)
-- avait déjà diagnostiqué exactement ce problème et créé get_my_role() pour
-- le corriger — mais ne l'a appliqué qu'à profils/boutiques/subscriptions.
-- Fix : auth.jwt() ->> 'role' → get_my_role(), auth.jwt() ->> 'boutique_id'
-- → get_my_boutique_id() (les deux lisent profils via auth.uid(), fiables,
-- déjà utilisés ailleurs dans ce schéma).
--
-- BUG 2 — les policies block_suspended_* sont PERMISSIVE au lieu de
-- RESTRICTIVE. Plusieurs policies PERMISSIVE pour la même commande sont
-- combinées en OR par Postgres : block_suspended_produits ("boutique pas
-- suspendue OU super_admin" — vrai pour quasiment tout le monde) suffisait
-- À ELLE SEULE à autoriser l'écriture, contournant complètement la
-- vérification boutique_id = ma boutique de la policy "Insert products" à
-- côté. Repéré en testant BUG 1 : une fois l'écriture débloquée, un gérant
-- pouvait insérer un produit dans la boutique d'un AUTRE marchand. Sans
-- BUG 1 corrigé ce trou était inatteignable (tout était bloqué de toute
-- façon) — les deux bugs se masquaient l'un l'autre. Fix : AS RESTRICTIVE.
--
-- BUG 3 — is_subscription_active(uid) vérifie l'abonnement du COMPTE
-- APPELANT (WHERE user_id = uid) au lieu de celui de la boutique. Un
-- caissier n'a jamais sa propre ligne subscriptions (c'est le gérant qui
-- paie) — require_active_subscription bloquait donc TOUT caissier, même
-- dans une boutique parfaitement à jour. C'est la cause directe des 0 lignes
-- dans ventes. Deux surcharges existaient (is_subscription_active() et
-- is_subscription_active(uid uuid DEFAULT auth.uid())) ; seule la seconde
-- est référencée par les policies (vérifié via DROP ... qui liste les
-- dépendances), la première était du code mort jamais appelé — supprimée.
-- Fix : résout l'abonnement via boutiques.gerant_id (même logique que
-- get_boutique_subscription_status), pas via le compte appelant.
--
-- Les trois bugs coexistaient et se masquaient mutuellement : BUG 1 rendait
-- tout inatteignable, ce qui rendait BUG 2 invisible ; BUG 3 aurait de toute
-- façon bloqué les caissiers même une fois BUG 1 corrigé. Les trois sont
-- corrigés et vérifiés ensemble ci-dessous.

BEGIN;

-- ── produits ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "block_suspended_produits" ON public.produits;
CREATE POLICY "block_suspended_produits" ON public.produits
  FOR ALL USING (
    NOT EXISTS (SELECT 1 FROM public.boutiques WHERE boutiques.id = produits.boutique_id AND boutiques.suspended = true)
    OR public.get_my_role() = 'super_admin'
  );

DROP POLICY IF EXISTS "Select products" ON public.produits;
CREATE POLICY "Select products" ON public.produits
  FOR SELECT USING (
    boutique_id = public.get_my_boutique_id()
    OR public.get_my_role() = 'super_admin'
  );

DROP POLICY IF EXISTS "Insert products" ON public.produits;
CREATE POLICY "Insert products" ON public.produits
  FOR INSERT WITH CHECK (
    (public.get_my_role() = 'gerant' AND boutique_id = public.get_my_boutique_id())
    OR public.get_my_role() = 'super_admin'
  );

DROP POLICY IF EXISTS "Update products" ON public.produits;
CREATE POLICY "Update products" ON public.produits
  FOR UPDATE USING (
    (public.get_my_role() = 'gerant' AND boutique_id = public.get_my_boutique_id())
    OR public.get_my_role() = 'super_admin'
  );

DROP POLICY IF EXISTS "Delete products" ON public.produits;
CREATE POLICY "Delete products" ON public.produits
  FOR DELETE USING (
    (public.get_my_role() = 'gerant' AND boutique_id = public.get_my_boutique_id())
    OR public.get_my_role() = 'super_admin'
  );

-- ── ventes ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "block_suspended_ventes" ON public.ventes;
CREATE POLICY "block_suspended_ventes" ON public.ventes
  FOR ALL USING (
    NOT EXISTS (SELECT 1 FROM public.boutiques WHERE boutiques.id = ventes.boutique_id AND boutiques.suspended = true)
    OR public.get_my_role() = 'super_admin'
  );

DROP POLICY IF EXISTS "Select sales" ON public.ventes;
CREATE POLICY "Select sales" ON public.ventes
  FOR SELECT USING (
    (boutique_id = public.get_my_boutique_id() AND public.get_my_role() IN ('caissier', 'gerant'))
    OR public.get_my_role() = 'super_admin'
  );

DROP POLICY IF EXISTS "Insert sales" ON public.ventes;
CREATE POLICY "Insert sales" ON public.ventes
  FOR INSERT WITH CHECK (
    (public.get_my_role() IN ('caissier', 'gerant') AND boutique_id = public.get_my_boutique_id())
    OR public.get_my_role() = 'super_admin'
  );

DROP POLICY IF EXISTS "gerant_delete_ventes" ON public.ventes;
CREATE POLICY "gerant_delete_ventes" ON public.ventes
  FOR DELETE USING (
    boutique_id = public.get_my_boutique_id() AND public.get_my_role() = 'gerant'
  );

-- ── vente_items ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "block_suspended_vente_items" ON public.vente_items;
CREATE POLICY "block_suspended_vente_items" ON public.vente_items
  FOR ALL USING (
    NOT EXISTS (
      SELECT 1 FROM public.ventes JOIN public.boutiques ON boutiques.id = ventes.boutique_id
      WHERE ventes.id = vente_items.vente_id AND boutiques.suspended = true
    )
    OR public.get_my_role() = 'super_admin'
  );

DROP POLICY IF EXISTS "Select sale items" ON public.vente_items;
CREATE POLICY "Select sale items" ON public.vente_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.ventes
      WHERE ventes.id = vente_items.vente_id
        AND (ventes.boutique_id = public.get_my_boutique_id() OR public.get_my_role() = 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Insert sale items" ON public.vente_items;
CREATE POLICY "Insert sale items" ON public.vente_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ventes
      WHERE ventes.id = vente_items.vente_id
        AND (
          (public.get_my_role() IN ('caissier', 'gerant') AND ventes.boutique_id = public.get_my_boutique_id())
          OR public.get_my_role() = 'super_admin'
        )
    )
  );

DROP POLICY IF EXISTS "gerant_delete_vente_items" ON public.vente_items;
CREATE POLICY "gerant_delete_vente_items" ON public.vente_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.ventes
      WHERE ventes.id = vente_items.vente_id AND ventes.boutique_id = public.get_my_boutique_id()
    )
    AND public.get_my_role() = 'gerant'
  );

-- ── ardoises ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "block_suspended_ardoises" ON public.ardoises;
CREATE POLICY "block_suspended_ardoises" ON public.ardoises
  FOR ALL USING (
    NOT EXISTS (SELECT 1 FROM public.boutiques WHERE boutiques.id = ardoises.boutique_id AND boutiques.suspended = true)
    OR public.get_my_role() = 'super_admin'
  );

DROP POLICY IF EXISTS "Select ardoises" ON public.ardoises;
CREATE POLICY "Select ardoises" ON public.ardoises
  FOR SELECT USING (
    (public.get_my_role() = 'gerant' AND boutique_id = public.get_my_boutique_id())
    OR public.get_my_role() = 'super_admin'
  );

DROP POLICY IF EXISTS "caissier_select_ardoises" ON public.ardoises;
CREATE POLICY "caissier_select_ardoises" ON public.ardoises
  FOR SELECT USING (
    boutique_id = public.get_my_boutique_id() AND public.get_my_role() = 'caissier'
  );

DROP POLICY IF EXISTS "Insert ardoises" ON public.ardoises;
CREATE POLICY "Insert ardoises" ON public.ardoises
  FOR INSERT WITH CHECK (
    (public.get_my_role() = 'gerant' AND boutique_id = public.get_my_boutique_id())
    OR public.get_my_role() = 'super_admin'
  );

DROP POLICY IF EXISTS "caissier_insert_ardoises" ON public.ardoises;
CREATE POLICY "caissier_insert_ardoises" ON public.ardoises
  FOR INSERT WITH CHECK (
    boutique_id = public.get_my_boutique_id() AND public.get_my_role() = 'caissier'
  );

DROP POLICY IF EXISTS "Update ardoises" ON public.ardoises;
CREATE POLICY "Update ardoises" ON public.ardoises
  FOR UPDATE USING (
    (public.get_my_role() = 'gerant' AND boutique_id = public.get_my_boutique_id())
    OR public.get_my_role() = 'super_admin'
  );

DROP POLICY IF EXISTS "Delete ardoises" ON public.ardoises;
CREATE POLICY "Delete ardoises" ON public.ardoises
  FOR DELETE USING (
    (public.get_my_role() = 'gerant' AND boutique_id = public.get_my_boutique_id())
    OR public.get_my_role() = 'super_admin'
  );

-- ── ardoise_paiements ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "block_suspended_ardoise_paiements" ON public.ardoise_paiements;
CREATE POLICY "block_suspended_ardoise_paiements" ON public.ardoise_paiements
  FOR ALL USING (
    NOT EXISTS (
      SELECT 1 FROM public.ardoises JOIN public.boutiques ON boutiques.id = ardoises.boutique_id
      WHERE ardoises.id = ardoise_paiements.ardoise_id AND boutiques.suspended = true
    )
    OR public.get_my_role() = 'super_admin'
  );

DROP POLICY IF EXISTS "Select ardoise payments" ON public.ardoise_paiements;
CREATE POLICY "Select ardoise payments" ON public.ardoise_paiements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.ardoises
      WHERE ardoises.id = ardoise_paiements.ardoise_id
        AND (
          (public.get_my_role() = 'gerant' AND ardoises.boutique_id = public.get_my_boutique_id())
          OR public.get_my_role() = 'super_admin'
        )
    )
  );

DROP POLICY IF EXISTS "caissier_select_ardoise_paiements" ON public.ardoise_paiements;
CREATE POLICY "caissier_select_ardoise_paiements" ON public.ardoise_paiements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.ardoises
      WHERE ardoises.id = ardoise_paiements.ardoise_id AND ardoises.boutique_id = public.get_my_boutique_id()
    )
    AND public.get_my_role() = 'caissier'
  );

DROP POLICY IF EXISTS "Insert ardoise payments" ON public.ardoise_paiements;
CREATE POLICY "Insert ardoise payments" ON public.ardoise_paiements
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ardoises
      WHERE ardoises.id = ardoise_paiements.ardoise_id
        AND (
          (public.get_my_role() = 'gerant' AND ardoises.boutique_id = public.get_my_boutique_id())
          OR public.get_my_role() = 'super_admin'
        )
    )
  );

DROP POLICY IF EXISTS "caissier_insert_ardoise_paiements" ON public.ardoise_paiements;
CREATE POLICY "caissier_insert_ardoise_paiements" ON public.ardoise_paiements
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ardoises
      WHERE ardoises.id = ardoise_paiements.ardoise_id AND ardoises.boutique_id = public.get_my_boutique_id()
    )
    AND public.get_my_role() = 'caissier'
  );

DROP POLICY IF EXISTS "Update ardoise payments" ON public.ardoise_paiements;
CREATE POLICY "Update ardoise payments" ON public.ardoise_paiements
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.ardoises
      WHERE ardoises.id = ardoise_paiements.ardoise_id
        AND (
          (public.get_my_role() = 'gerant' AND ardoises.boutique_id = public.get_my_boutique_id())
          OR public.get_my_role() = 'super_admin'
        )
    )
  );

DROP POLICY IF EXISTS "Delete ardoise payments" ON public.ardoise_paiements;
CREATE POLICY "Delete ardoise payments" ON public.ardoise_paiements
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.ardoises
      WHERE ardoises.id = ardoise_paiements.ardoise_id
        AND (
          (public.get_my_role() = 'gerant' AND ardoises.boutique_id = public.get_my_boutique_id())
          OR public.get_my_role() = 'super_admin'
        )
    )
  );

-- ── BUG 2 : block_suspended_* en RESTRICTIVE (pas PERMISSIVE) ──────────────
DROP POLICY IF EXISTS "block_suspended_produits" ON public.produits;
CREATE POLICY "block_suspended_produits" ON public.produits
  AS RESTRICTIVE FOR ALL USING (
    NOT EXISTS (SELECT 1 FROM public.boutiques WHERE boutiques.id = produits.boutique_id AND boutiques.suspended = true)
    OR public.get_my_role() = 'super_admin'
  );

DROP POLICY IF EXISTS "block_suspended_ventes" ON public.ventes;
CREATE POLICY "block_suspended_ventes" ON public.ventes
  AS RESTRICTIVE FOR ALL USING (
    NOT EXISTS (SELECT 1 FROM public.boutiques WHERE boutiques.id = ventes.boutique_id AND boutiques.suspended = true)
    OR public.get_my_role() = 'super_admin'
  );

DROP POLICY IF EXISTS "block_suspended_vente_items" ON public.vente_items;
CREATE POLICY "block_suspended_vente_items" ON public.vente_items
  AS RESTRICTIVE FOR ALL USING (
    NOT EXISTS (
      SELECT 1 FROM public.ventes JOIN public.boutiques ON boutiques.id = ventes.boutique_id
      WHERE ventes.id = vente_items.vente_id AND boutiques.suspended = true
    )
    OR public.get_my_role() = 'super_admin'
  );

DROP POLICY IF EXISTS "block_suspended_ardoises" ON public.ardoises;
CREATE POLICY "block_suspended_ardoises" ON public.ardoises
  AS RESTRICTIVE FOR ALL USING (
    NOT EXISTS (SELECT 1 FROM public.boutiques WHERE boutiques.id = ardoises.boutique_id AND boutiques.suspended = true)
    OR public.get_my_role() = 'super_admin'
  );

DROP POLICY IF EXISTS "block_suspended_ardoise_paiements" ON public.ardoise_paiements;
CREATE POLICY "block_suspended_ardoise_paiements" ON public.ardoise_paiements
  AS RESTRICTIVE FOR ALL USING (
    NOT EXISTS (
      SELECT 1 FROM public.ardoises JOIN public.boutiques ON boutiques.id = ardoises.boutique_id
      WHERE ardoises.id = ardoise_paiements.ardoise_id AND boutiques.suspended = true
    )
    OR public.get_my_role() = 'super_admin'
  );

-- ── BUG 3 : is_subscription_active(uid) doit lire l'abonnement du gérant de
--     la boutique, pas celui du compte appelant ──────────────────────────
CREATE OR REPLACE FUNCTION public.is_subscription_active(uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role        TEXT;
  v_boutique_id UUID;
  v_gerant_id   UUID;
  v_suspended   BOOLEAN;
BEGIN
  SELECT role, boutique_id INTO v_role, v_boutique_id
  FROM profils WHERE id = uid;

  IF v_role = 'super_admin' THEN RETURN true; END IF;
  IF v_boutique_id IS NULL THEN RETURN false; END IF;

  SELECT suspended, gerant_id INTO v_suspended, v_gerant_id
  FROM boutiques WHERE id = v_boutique_id;

  IF COALESCE(v_suspended, false) THEN RETURN false; END IF;
  IF v_gerant_id IS NULL THEN RETURN false; END IF;

  RETURN EXISTS (
    SELECT 1 FROM subscriptions
    WHERE user_id = v_gerant_id
      AND expires_at > NOW()
      AND (status = 'active' OR (status = 'trial' AND is_trial = true))
  );
END;
$function$;

-- Surcharge zéro-argument : jamais appelée nulle part (vérifié), même bug de
-- conception si elle l'était un jour. Sa seule existence rendait un appel nu
-- is_subscription_active() ambigu entre les deux surcharges — supprimée.
DROP FUNCTION IF EXISTS public.is_subscription_active();

NOTIFY pgrst, 'reload schema';

COMMIT;
