-- Migration 0045 : Active Supabase Realtime sur les tables métier à forte fraîcheur
-- Objectif : propager en direct les changements de stock, ventes et crédits clients
-- (produits, ventes, vente_items, ardoises, ardoise_paiements) sans devoir re-fetch manuellement.
-- RLS reste appliqué : Realtime ne diffuse que ce que la policy SELECT de l'utilisateur autorise déjà.

BEGIN;

DO $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['produits', 'ventes', 'vente_items', 'ardoises', 'ardoise_paiements']
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename = t
        ) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
        END IF;
    END LOOP;
END $$;

COMMIT;
