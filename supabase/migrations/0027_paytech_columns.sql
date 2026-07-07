-- Migration PayTech : ajout colonnes paytech_token
-- Les colonnes unitech_* sont conservées pour compatibilité avec les subscriptions existantes.
-- Elles seront supprimées dans une migration future après validation PayTech en prod.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS paytech_token TEXT;

ALTER TABLE public.payment_logs
  ADD COLUMN IF NOT EXISTS paytech_token TEXT;

CREATE INDEX IF NOT EXISTS subscriptions_paytech_token_idx
  ON public.subscriptions (paytech_token)
  WHERE paytech_token IS NOT NULL;
