-- Migration 0044 : Ajout de la politique UPDATE pour ventes et vente_items
-- Requis pour le fonctionnement du soft-delete offline (qui utilise UPDATE au lieu de DELETE)

BEGIN;

-- 1. VENTES : Politique UPDATE avec WITH CHECK
DROP POLICY IF EXISTS "caissier, gerant and super_admin can update sales" ON public.ventes;
CREATE POLICY "caissier, gerant and super_admin can update sales"
    ON public.ventes FOR UPDATE
    USING (
        (public.get_my_role() IN ('caissier', 'gerant') AND boutique_id = public.get_my_boutique_id()) OR 
        public.get_my_role() = 'super_admin'
    )
    WITH CHECK (
        (public.get_my_role() IN ('caissier', 'gerant') AND boutique_id = public.get_my_boutique_id()) OR 
        public.get_my_role() = 'super_admin'
    );

-- 2. VENTE_ITEMS : Politique UPDATE avec WITH CHECK
DROP POLICY IF EXISTS "caissier, gerant and super_admin can update sale items" ON public.vente_items;
CREATE POLICY "caissier, gerant and super_admin can update sale items"
    ON public.vente_items FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.ventes 
            WHERE ventes.id = vente_items.vente_id 
            AND (
                (public.get_my_role() IN ('caissier', 'gerant') AND ventes.boutique_id = public.get_my_boutique_id()) 
                OR public.get_my_role() = 'super_admin'
            )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.ventes 
            WHERE ventes.id = vente_items.vente_id 
            AND (
                (public.get_my_role() IN ('caissier', 'gerant') AND ventes.boutique_id = public.get_my_boutique_id()) 
                OR public.get_my_role() = 'super_admin'
            )
        )
    );

-- Recharger le schéma pour PostgREST
NOTIFY pgrst, 'reload schema';

COMMIT;
