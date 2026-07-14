-- Migration 0051 : corrige les GRANT de 0050_subscription_revocation
--
-- `REVOKE ... FROM anon` seul ne suffit pas : Postgres accorde EXECUTE à PUBLIC
-- par défaut à la création d'une fonction, et `anon`/`authenticated` héritent de
-- ce droit via PUBLIC même après un REVOKE ciblé sur leur rôle propre. Vérifié
-- via has_function_privilege('anon', 'public.revoke_subscription(uuid,text,text)',
-- 'EXECUTE') qui retournait encore true après 0050. Le check applicatif
-- (_assert_super_admin) bloquait déjà anon au runtime, donc pas de faille
-- exploitée, mais le verrou de grant doit refléter l'intention réelle.

BEGIN;

REVOKE EXECUTE ON FUNCTION public.revoke_subscription(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reactivate_subscription(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_subscription(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reactivate_subscription(uuid) TO authenticated;

COMMIT;
