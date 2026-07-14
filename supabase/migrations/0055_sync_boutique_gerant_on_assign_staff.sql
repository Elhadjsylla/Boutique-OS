-- Migration 0055 : synchronise boutiques.gerant_id avec assign_staff
--
-- Bug : quand un Super Admin affilie un utilisateur à une boutique avec le rôle
-- Gérant depuis "Gestion utilisateurs", assign_staff n'écrivait que dans
-- profils.role / profils.boutique_id. boutiques.gerant_id — lu par
-- sys_boutique_details pour afficher le gérant sur la fiche boutique, et par
-- get_boutique_subscription_status pour retrouver l'abonnement de la boutique —
-- n'était jamais mis à jour : deux sources de vérité non synchronisées.
--
-- Source de vérité retenue : boutiques.gerant_id reste la référence pour "qui
-- gère/possède cette boutique" (déjà central au système d'abonnement, ex. le
-- cas légitime d'un super_admin propriétaire de sa propre boutique — voir
-- boutique "Elhadj" où gerant_id pointe vers un compte role='super_admin').
-- profils.role='gerant' + boutique_id reste la source de vérité pour "quel
-- rôle/quelle boutique pour cet utilisateur" côté personnel. assign_staff tient
-- maintenant les deux synchronisées atomiquement à chaque appel :
--   - en quittant une boutique dont il était gerant_id désigné, l'utilisateur
--     libère ce poste (gerant_id -> NULL) ;
--   - en devenant gérant d'une boutique déjà pourvue par quelqu'un d'autre,
--     l'appel est bloqué avec un message explicite (décision produit : pas de
--     remplacement automatique silencieux d'un compte tiers) ;
--   - en perdant le rôle gérant sur sa boutique actuelle (ex: gérant -> caissier
--     sans changer de boutique), il est retiré de gerant_id s'il y figurait.
--
-- Diagnostic préalable (voir requête ci-dessous, exécutée en lecture avant ce
-- fix) : aucune incohérence de ce type n'existe encore en base — le bug n'avait
-- pas encore corrompu de données réelles, donc pas de script de réconciliation
-- nécessaire au-delà de ce correctif.

BEGIN;

CREATE OR REPLACE FUNCTION public.assign_staff(target_user uuid, new_role text, new_boutique uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  caller_role          text := public.get_my_role();
  caller_boutique      uuid := public.get_my_boutique_id();
  v_old_boutique       uuid;
  v_conflicting_gerant uuid;
BEGIN
  IF new_role NOT IN ('caissier', 'gerant', 'super_admin') THEN
    RAISE EXCEPTION 'Role invalide: %', new_role USING errcode = '22023';
  END IF;

  IF caller_role = 'super_admin' THEN
    NULL; -- autorisé sur n'importe quel utilisateur / rôle / boutique

  ELSIF caller_role = 'gerant' THEN
    IF new_role = 'super_admin' THEN
      RAISE EXCEPTION 'Un gerant ne peut pas creer de super_admin'
        USING errcode = '42501';
    END IF;
    IF new_boutique IS DISTINCT FROM caller_boutique THEN
      RAISE EXCEPTION 'Un gerant ne peut affecter que sa propre boutique'
        USING errcode = '42501';
    END IF;

  ELSE
    RAISE EXCEPTION 'Acces refuse' USING errcode = '42501';
  END IF;

  SELECT boutique_id INTO v_old_boutique FROM public.profils WHERE id = target_user;

  IF new_role = 'gerant' AND new_boutique IS NOT NULL THEN
    SELECT gerant_id INTO v_conflicting_gerant FROM public.boutiques WHERE id = new_boutique;
    IF v_conflicting_gerant IS NOT NULL AND v_conflicting_gerant IS DISTINCT FROM target_user THEN
      RAISE EXCEPTION 'Cette boutique a déjà un gérant assigné (%). Retirez-le avant d''en assigner un nouveau.', v_conflicting_gerant
        USING errcode = '23505';
    END IF;
  END IF;

  UPDATE public.profils
  SET role = new_role,
      boutique_id = new_boutique
  WHERE id = target_user;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Utilisateur introuvable: %', target_user
      USING errcode = 'P0002';
  END IF;

  -- Quitte une boutique dont il était le gérant désigné : libère le poste.
  IF v_old_boutique IS NOT NULL AND v_old_boutique IS DISTINCT FROM new_boutique THEN
    UPDATE public.boutiques SET gerant_id = NULL, updated_at = now()
    WHERE id = v_old_boutique AND gerant_id = target_user;
  END IF;

  IF new_role = 'gerant' AND new_boutique IS NOT NULL THEN
    UPDATE public.boutiques SET gerant_id = target_user, updated_at = now()
    WHERE id = new_boutique;
  ELSIF new_boutique IS NOT NULL THEN
    -- Reste sur la même boutique mais n'est plus gérant (ex: gérant -> caissier) :
    -- se retire de gerant_id s'il y figurait encore.
    UPDATE public.boutiques SET gerant_id = NULL, updated_at = now()
    WHERE id = new_boutique AND gerant_id = target_user;
  END IF;
END;
$function$;

NOTIFY pgrst, 'reload schema';

COMMIT;
