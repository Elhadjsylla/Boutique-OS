-- ============================================================
-- TRIGGER : updated_at automatique sur toutes les tables
-- Critique pour le sync offline : sans ça, les changements
-- faits côté serveur (ex: décrémentation de stock via trigger)
-- ne sont jamais détectés par le delta pull des clients.
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_updated_at ON produits;
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON produits
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON ventes;
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON ventes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON vente_items;
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON vente_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON ardoises;
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON ardoises
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON ardoise_paiements;
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON ardoise_paiements
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
