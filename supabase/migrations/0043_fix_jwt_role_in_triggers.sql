-- Migration 0043 : Fix role fetch in security triggers
-- Les fonctions prevent_privilege_escalation et assign_staff utilisaient 
-- auth.jwt()->>'role' au lieu de public.get_my_role(), ce qui échouait
-- avec "role=authenticated" car le hook JWT custom n'est pas utilisé.

BEGIN;

-- 1. Corriger prevent_privilege_escalation
CREATE OR REPLACE FUNCTION public.prevent_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_uid uuid := auth.uid();
  actor_role text := public.get_my_role();
  actor_boutique uuid := public.get_my_boutique_id();
BEGIN
  -- Rien de sensible n'a changé : on laisse passer.
  IF NEW.role IS NOT DISTINCT FROM OLD.role
     AND NEW.boutique_id IS NOT DISTINCT FROM OLD.boutique_id THEN
    RETURN NEW;
  END IF;

  -- Contexte backend (service_role, postgres, seed, hook) : pas de auth.uid().
  IF actor_uid IS NULL THEN
    RETURN NEW;
  END IF;

  -- Super_admin : autorisé à tout.
  IF actor_role = 'super_admin' THEN
    RETURN NEW;
  END IF;

  -- Gérant : peut gérer le personnel d'un AUTRE profil de SA boutique,
  -- sans créer de super_admin ni l'envoyer dans une autre boutique.
  IF actor_role = 'gerant'
     AND OLD.id <> actor_uid
     AND NEW.role IN ('caissier', 'gerant')
     AND NEW.boutique_id IS NOT DISTINCT FROM actor_boutique THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'Modification de role/boutique_id non autorisee (utilisateur=%, role=%)',
    actor_uid, COALESCE(actor_role, 'aucun')
    USING errcode = '42501'; -- insufficient_privilege
END;
$$;

-- 2. Corriger assign_staff
DROP FUNCTION IF EXISTS public.assign_staff(uuid, text, uuid);

CREATE OR REPLACE FUNCTION public.assign_staff(
  target_user   uuid,
  new_role      text,
  new_boutique  uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_role     text := public.get_my_role();
  caller_boutique uuid := public.get_my_boutique_id();
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

  UPDATE public.profils
  SET role = new_role,
      boutique_id = new_boutique
  WHERE id = target_user;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Utilisateur introuvable: %', target_user
      USING errcode = 'P0002';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_staff(uuid, text, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
