-- ==========================================
-- BOUTIKOS — ENFORCE CASHIER LIMITS BY PLAN
-- ==========================================

-- get_caissier_limit returns 1 for starter, 3 for pro, and NULL (meaning unlimited) for annual
CREATE OR REPLACE FUNCTION public.get_caissier_limit(p_boutique_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_owner_id UUID;
  v_plan TEXT;
BEGIN
  -- Get the owner of the boutique
  SELECT gerant_id INTO v_owner_id FROM public.boutiques WHERE id = p_boutique_id;
  
  -- If boutique has no owner, check if there is an owner in profils (or default to starter)
  IF v_owner_id IS NULL THEN
    SELECT id INTO v_owner_id FROM public.profils WHERE boutique_id = p_boutique_id AND role = 'gerant' LIMIT 1;
  END IF;

  -- Get their active subscription plan
  SELECT plan::text INTO v_plan FROM public.subscriptions 
  WHERE user_id = v_owner_id AND status = 'active' AND expires_at > NOW()
  LIMIT 1;

  IF v_plan = 'starter' THEN
    RETURN 1;
  ELSIF v_plan = 'pro' THEN
    RETURN 3;
  ELSIF v_plan = 'annual' THEN
    RETURN NULL; -- Unlimited
  ELSE
    -- If no active subscription is found, default to starter limit
    RETURN 1;
  END IF;
END;
$$;

-- can_invite_caissier checks if the count of cashiers is less than the limit
CREATE OR REPLACE FUNCTION public.can_invite_caissier(p_boutique_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_limit INTEGER;
  v_count INTEGER;
BEGIN
  v_limit := public.get_caissier_limit(p_boutique_id);
  
  -- Unlimited if limit is NULL
  IF v_limit IS NULL THEN
    RETURN TRUE;
  END IF;

  -- Count the current cashiers in this boutique
  SELECT COUNT(*) INTO v_count FROM public.profils WHERE boutique_id = p_boutique_id AND role = 'caissier';
  
  -- Add pending invitations
  SELECT v_count + COUNT(*) INTO v_count FROM public.invitations 
  WHERE boutique_id = p_boutique_id AND status = 'pending' AND expires_at > NOW();

  RETURN v_count < v_limit;
END;
$$;

-- Trigger to check limit before inserting a new invitation
CREATE OR REPLACE FUNCTION public.check_invitation_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.can_invite_caissier(NEW.boutique_id) THEN
    RAISE EXCEPTION 'La limite de caissiers pour votre abonnement actuel a été atteinte.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_invitation_limit ON public.invitations;
CREATE TRIGGER trg_check_invitation_limit
BEFORE INSERT ON public.invitations
FOR EACH ROW
EXECUTE FUNCTION public.check_invitation_limit();
