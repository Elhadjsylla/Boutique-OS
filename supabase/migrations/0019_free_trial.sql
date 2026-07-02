
-- 1. Extend enum with trial statuses
ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'trial';
ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'trial_cancelled';

-- 2. Add trial columns to subscriptions
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS is_trial BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancellation_deadline TIMESTAMPTZ;

-- 3. Update is_subscription_active() to handle trial
CREATE OR REPLACE FUNCTION is_subscription_active()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id   UUID := auth.uid();
  v_role      TEXT;
  v_boutique_id UUID;
  v_suspended BOOLEAN;
BEGIN
  SELECT role, boutique_id INTO v_role, v_boutique_id
  FROM profils WHERE id = v_user_id;

  IF v_role = 'super_admin' THEN RETURN true; END IF;

  IF v_boutique_id IS NOT NULL THEN
    SELECT suspended INTO v_suspended FROM boutiques WHERE id = v_boutique_id;
    IF COALESCE(v_suspended, false) THEN RETURN false; END IF;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM subscriptions
    WHERE user_id = v_user_id
      AND expires_at > NOW()
      AND (
        status = 'active'
        OR (status = 'trial' AND is_trial = true)
      )
  );
END;
$$;

-- 4. RPC: start_free_trial — creates a 30-day trial, cancellable for 7 days
CREATE OR REPLACE FUNCTION start_free_trial(p_plan TEXT DEFAULT 'starter')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_sub_id  UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM subscriptions WHERE user_id = v_user_id) THEN
    RETURN jsonb_build_object('error', 'Un abonnement ou essai existe déjà');
  END IF;

  IF p_plan NOT IN ('starter', 'pro', 'annual') THEN
    RETURN jsonb_build_object('error', 'Plan invalide');
  END IF;

  INSERT INTO subscriptions (
    user_id, plan, status, payment_method, amount,
    starts_at, expires_at, is_trial, cancellation_deadline
  ) VALUES (
    v_user_id,
    p_plan::plan_type,
    'trial',
    'admin',
    0,
    NOW(),
    NOW() + INTERVAL '30 days',
    true,
    NOW() + INTERVAL '7 days'
  ) RETURNING id INTO v_sub_id;

  RETURN jsonb_build_object(
    'success',               true,
    'subscription_id',       v_sub_id,
    'trial_ends_at',         NOW() + INTERVAL '30 days',
    'cancellation_deadline', NOW() + INTERVAL '7 days'
  );
END;
$$;

-- 5. RPC: cancel_free_trial — only works within the 7-day window
CREATE OR REPLACE FUNCTION cancel_free_trial()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_sub     RECORD;
BEGIN
  SELECT * INTO v_sub
  FROM subscriptions
  WHERE user_id = v_user_id AND status = 'trial' AND is_trial = true
  ORDER BY created_at DESC LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Aucun essai actif');
  END IF;

  IF NOW() > v_sub.cancellation_deadline THEN
    RETURN jsonb_build_object(
      'error',    'Délai d''annulation dépassé (7 premiers jours uniquement)',
      'deadline', v_sub.cancellation_deadline
    );
  END IF;

  UPDATE subscriptions
  SET status = 'trial_cancelled', expires_at = NOW(), updated_at = NOW()
  WHERE id = v_sub.id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 6. RPC: get_trial_status — returns full trial info for the current user
CREATE OR REPLACE FUNCTION get_trial_status()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_sub     RECORD;
BEGIN
  SELECT * INTO v_sub
  FROM subscriptions
  WHERE user_id = v_user_id AND is_trial = true
  ORDER BY created_at DESC LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('has_trial', false);
  END IF;

  RETURN jsonb_build_object(
    'has_trial',             true,
    'status',                v_sub.status::TEXT,
    'plan',                  v_sub.plan::TEXT,
    'trial_ends_at',         v_sub.expires_at,
    'cancellation_deadline', v_sub.cancellation_deadline,
    'can_cancel',            (v_sub.status = 'trial' AND NOW() <= v_sub.cancellation_deadline),
    'is_committed',          (v_sub.status = 'trial' AND NOW() > v_sub.cancellation_deadline AND v_sub.expires_at > NOW()),
    'is_expired',            (v_sub.expires_at <= NOW()),
    'days_left',             GREATEST(0, EXTRACT(DAY FROM (v_sub.expires_at - NOW()))::INT),
    'cancel_days_left',      GREATEST(0, EXTRACT(DAY FROM (v_sub.cancellation_deadline - NOW()))::INT)
  );
END;
$$;
