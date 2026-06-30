-- Fix RLS: supprimer les politiques trop permissives ou incorrectes
--
-- 1. lecture_publique_profils: qual=true → tous les utilisateurs authentifiés
--    lisaient TOUS les profils (cross-boutique). La policy "Select profiles"
--    existante couvre déjà les cas légitimes : propre profil, même boutique,
--    super_admin.
DROP POLICY IF EXISTS "lecture_publique_profils" ON public.profils;

-- 2. super_admin_read_audit: utilisait auth.jwt() ->> 'role' (non fiable depuis
--    la migration du rôle GoTrue). Remplacée par "super_admin_read_audit_log"
--    qui lit depuis profils.role.
DROP POLICY IF EXISTS "super_admin_read_audit" ON public.admin_audit_log;

-- 3. super_admin_read_all_payment_logs: même problème. Remplacée par une
--    version utilisant get_my_role().
DROP POLICY IF EXISTS "super_admin_read_all_payment_logs" ON public.payment_logs;
CREATE POLICY "super_admin_read_all_payment_logs"
  ON public.payment_logs
  FOR SELECT
  USING (get_my_role() = 'super_admin');
