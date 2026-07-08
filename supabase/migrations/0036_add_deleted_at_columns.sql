-- Migration 0036 : Ajout de la colonne deleted_at manquante
-- Les fonctions RPC du dashboard admin attendaient une colonne deleted_at 
-- sur les tables boutiques et profils (pour le soft-delete), mais elle n'avait pas été créée.

BEGIN;

ALTER TABLE public.boutiques 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.profils 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Recharger le schéma pour PostgREST
NOTIFY pgrst, 'reload schema';

COMMIT;
