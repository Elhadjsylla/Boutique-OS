-- Migration 0056 : mémorisation des numéros Wave/Orange Money après paiement réussi
--
-- Objectif : éviter la ressaisie du numéro à chaque paiement. Table dédiée plutôt
-- que des colonnes wave_phone_number/orange_money_phone_number sur profils :
-- un marchand peut avoir plusieurs numéros par provider (multi-comptes Wave), et
-- profils sert aussi aux caissiers/gérants sans rapport avec la facturation — la
-- séparer garde ces deux préoccupations distinctes. FK vers auth.users(id), comme
-- subscriptions.user_id (l'identité qui paie), pas profils.id.

BEGIN;

CREATE TABLE IF NOT EXISTS public.payment_methods (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider      text NOT NULL CHECK (provider IN ('wave', 'orange_money')),
  phone_number  text NOT NULL,
  is_default    boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_used_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider, phone_number)
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_user_provider
  ON public.payment_methods (user_id, provider, last_used_at DESC);

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

-- Self-service complet (lecture + gestion de ses propres numéros enregistrés) —
-- aucun accès cross-utilisateur, même en lecture.
CREATE POLICY "user_select_own_payment_methods"
ON public.payment_methods FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "user_insert_own_payment_methods"
ON public.payment_methods FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_update_own_payment_methods"
ON public.payment_methods FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_delete_own_payment_methods"
ON public.payment_methods FOR DELETE
USING (auth.uid() = user_id);

-- Le webhook de paiement écrit via service_role (pas de session utilisateur au
-- moment de la confirmation Unitech, donc pas d'auth.uid() disponible) — même
-- policy que subscriptions/sys_audit_log pour ce cas.
CREATE POLICY "service_role_manage_payment_methods"
ON public.payment_methods FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- mask_phone : même convention que le masquage déjà utilisé dans
-- get_users_list_masked (2 premiers chiffres + **** + 2 derniers, préfixe +221
-- optionnel retiré), factorisé ici pour être réutilisable comme mask_name/mask_email.
CREATE OR REPLACE FUNCTION public.mask_phone(p_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN p_phone IS NULL OR btrim(p_phone) = '' THEN NULL
    ELSE
      SUBSTRING(REGEXP_REPLACE(p_phone, '^\+?221', ''), 1, 2)
      || '****'
      || RIGHT(p_phone, 2)
  END
$$;

-- save_or_update_payment_method : appelée uniquement depuis le webhook (service_role)
-- juste après confirmation d'un paiement Wave/Orange Money réussi. Prend un user_id
-- arbitraire en paramètre (le webhook n'a pas de session/auth.uid()), donc DOIT
-- rester interdite à authenticated/anon — sinon n'importe quel utilisateur pourrait
-- l'appeler avec le user_id d'un tiers et polluer ses numéros enregistrés.
CREATE OR REPLACE FUNCTION public.save_or_update_payment_method(
  p_user_id      uuid,
  p_provider     text,
  p_phone_number text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF p_provider NOT IN ('wave', 'orange_money') THEN
    RAISE EXCEPTION 'provider invalide: %', p_provider USING errcode = '22023';
  END IF;
  IF p_phone_number IS NULL OR btrim(p_phone_number) = '' THEN
    RAISE EXCEPTION 'phone_number requis' USING errcode = '22023';
  END IF;

  -- Un seul numéro "par défaut" (le plus récemment utilisé) par provider.
  UPDATE public.payment_methods
  SET is_default = false
  WHERE user_id = p_user_id AND provider = p_provider;

  INSERT INTO public.payment_methods (user_id, provider, phone_number, is_default, last_used_at)
  VALUES (p_user_id, p_provider, btrim(p_phone_number), true, now())
  ON CONFLICT (user_id, provider, phone_number)
  DO UPDATE SET is_default = true, last_used_at = now();
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.save_or_update_payment_method(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_or_update_payment_method(uuid, text, text) TO service_role;

-- get_default_payment_method : lit pour l'utilisateur APPELANT uniquement (pas de
-- paramètre user_id acceptant une valeur arbitraire — dévie volontairement de la
-- signature suggérée get_default_payment_method(user_id) pour respecter la
-- contrainte sécurité du brief : "ne jamais exposer les numéros d'un autre
-- utilisateur", y compris via une faille de paramètre côté RPC publique).
CREATE OR REPLACE FUNCTION public.get_default_payment_method()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT COALESCE(
    jsonb_object_agg(
      provider,
      jsonb_build_object('phone_number', phone_number, 'last_used_at', last_used_at)
    ),
    '{}'::jsonb
  )
  FROM (
    -- is_default avant last_used_at : save_or_update_payment_method le maintient
    -- explicitement, alors que last_used_at peut se retrouver à égalité stricte
    -- entre deux appels dans la même transaction (now() y est figé au début de
    -- la transaction, pas à l'exécution de chaque instruction).
    SELECT DISTINCT ON (provider) provider, phone_number, last_used_at
    FROM public.payment_methods
    WHERE user_id = auth.uid()
    ORDER BY provider, is_default DESC, last_used_at DESC
  ) latest;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_default_payment_method() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_default_payment_method() TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
