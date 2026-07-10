-- Migration 0042 : Ajout de la colonne deleted_at manquante pour le mode hors-ligne
-- Permet de gérer le Soft Delete depuis l'outbox (au lieu d'un hard delete),
-- ce qui permet aux autres appareils de synchroniser la suppression.

BEGIN;

ALTER TABLE public.produits 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.ventes 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.vente_items 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.ardoises 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.ardoise_paiements 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Recharger le schéma pour PostgREST
NOTIFY pgrst, 'reload schema';

COMMIT;
