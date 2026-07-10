-- Migration 0041 : Ajout d'un rate limit sur la RPC reveal_user_details
-- Objectif : Limiter le nombre d'appels à reveal_user_details par admin pour éviter l'exfiltration massive.

BEGIN;

CREATE OR REPLACE FUNCTION public.reveal_user_details(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result JSONB;
  v_recent_requests INT;
BEGIN
  PERFORM _assert_super_admin();

  -- Rate Limiting : max 20 requêtes par minute par admin
  SELECT count(*) INTO v_recent_requests
  FROM user_reveal_logs
  WHERE admin_id = auth.uid()
    AND created_at > now() - interval '1 minute';

  IF v_recent_requests >= 20 THEN
    RAISE EXCEPTION 'Trop de requêtes : vous avez dépassé la limite autorisée de révélations par minute.';
  END IF;

  SELECT jsonb_build_object(
    'id',           p.id,
    'nom',          COALESCE(p.nom, ''),
    'prenom',       COALESCE(p.prenom, ''),
    'email',        u.email,
    'phone_number', COALESCE(p.phone_number, '')
  )
  INTO v_result
  FROM profils p
  JOIN auth.users u ON u.id = p.id
  WHERE p.id = p_user_id;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Utilisateur introuvable : %', p_user_id;
  END IF;

  -- Log de l'accès aux données sensibles (SECURITY DEFINER bypass RLS)
  INSERT INTO user_reveal_logs (admin_id, target_user_id, revealed_fields)
  VALUES (auth.uid(), p_user_id, ARRAY['nom', 'prenom', 'email', 'phone_number']);

  -- Trace aussi dans sys_audit_log pour cohérence avec les autres actions admin
  INSERT INTO sys_audit_log (actor_id, action, target_type, target_id, details)
  VALUES (
    auth.uid(),
    'user.details_revealed',
    'user',
    p_user_id,
    jsonb_build_object('fields', ARRAY['nom', 'prenom', 'email', 'phone_number'])
  );

  RETURN v_result;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
