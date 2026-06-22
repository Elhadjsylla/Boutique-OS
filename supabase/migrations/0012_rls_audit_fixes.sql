-- ============================================================
-- FIX 1 : Décrémentation de stock automatique (SECURITY DEFINER)
-- Le caissier n'a pas besoin de UPDATE sur produits directement
-- ============================================================
CREATE OR REPLACE FUNCTION public.decrement_stock_on_sale()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE produits
  SET quantite = GREATEST(0, quantite - NEW.quantite)
  WHERE id = NEW.produit_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_decrement_stock
AFTER INSERT ON vente_items
FOR EACH ROW EXECUTE FUNCTION public.decrement_stock_on_sale();

-- ============================================================
-- FIX 2 : Caissier peut lire et créer des ardoises
-- ============================================================
CREATE POLICY "caissier_select_ardoises"
ON ardoises FOR SELECT
USING (
  boutique_id = (auth.jwt() ->> 'boutique_id')::uuid
  AND COALESCE(auth.jwt() ->> 'role', '') = 'caissier'
);

CREATE POLICY "caissier_insert_ardoises"
ON ardoises FOR INSERT
WITH CHECK (
  boutique_id = (auth.jwt() ->> 'boutique_id')::uuid
  AND COALESCE(auth.jwt() ->> 'role', '') = 'caissier'
);

-- ============================================================
-- FIX 3 : Caissier peut lire et enregistrer des paiements d'ardoise
-- ============================================================
CREATE POLICY "caissier_select_ardoise_paiements"
ON ardoise_paiements FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM ardoises
    WHERE ardoises.id = ardoise_paiements.ardoise_id
      AND ardoises.boutique_id = (auth.jwt() ->> 'boutique_id')::uuid
  )
  AND COALESCE(auth.jwt() ->> 'role', '') = 'caissier'
);

CREATE POLICY "caissier_insert_ardoise_paiements"
ON ardoise_paiements FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM ardoises
    WHERE ardoises.id = ardoise_paiements.ardoise_id
      AND ardoises.boutique_id = (auth.jwt() ->> 'boutique_id')::uuid
  )
  AND COALESCE(auth.jwt() ->> 'role', '') = 'caissier'
);

-- ============================================================
-- FIX 4 : Gérant peut annuler une vente (DELETE)
-- ============================================================
CREATE POLICY "gerant_delete_ventes"
ON ventes FOR DELETE
USING (
  boutique_id = (auth.jwt() ->> 'boutique_id')::uuid
  AND COALESCE(auth.jwt() ->> 'role', '') = 'gerant'
);

CREATE POLICY "gerant_delete_vente_items"
ON vente_items FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM ventes
    WHERE ventes.id = vente_items.vente_id
      AND ventes.boutique_id = (auth.jwt() ->> 'boutique_id')::uuid
  )
  AND COALESCE(auth.jwt() ->> 'role', '') = 'gerant'
);
