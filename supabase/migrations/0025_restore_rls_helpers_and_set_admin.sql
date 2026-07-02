-- Migration 0025: Restauration des helpers RLS et attribution du rôle super_admin pour les adresses admin connues

-- 1. Recréation sécurisée de get_my_role()
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role FROM public.profils WHERE id = auth.uid();
  RETURN user_role;
END;
$$;

-- 2. Recréation sécurisée de get_my_boutique_id()
CREATE OR REPLACE FUNCTION public.get_my_boutique_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  user_boutique_id uuid;
BEGIN
  SELECT boutique_id INTO user_boutique_id FROM public.profils WHERE id = auth.uid();
  RETURN user_boutique_id;
END;
$$;

-- 3. Mise à jour du rôle de l'adresse email administrateur principale en super_admin
UPDATE public.profils
SET role = 'super_admin'
WHERE id IN (
  SELECT id FROM auth.users 
  WHERE email IN ('cedricbenoitdieme@gmail.com', 'admin@samaboutik.dev')
);
