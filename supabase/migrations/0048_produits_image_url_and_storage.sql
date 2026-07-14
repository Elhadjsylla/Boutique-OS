-- Migration 0048 : Colonne image_url sur produits + bucket Storage "produits"
-- Objectif : la colonne image_url n'existait pas en base alors que le frontend (ImagePicker,
-- Stock.tsx, supabaseService.ts) l'utilise depuis le début — tout insert/update avec image_url
-- échouait silencieusement côté PostgREST (colonne inconnue). On ajoute aussi le bucket Storage
-- pour permettre, à terme, de stocker de vraies images uploadées plutôt que des data URLs base64
-- directement dans la colonne.
--
-- Convention de chemin attendue dans le bucket : {boutique_id}/{nom_fichier}

BEGIN;

-- 1. COLONNE image_url ---------------------------------------------------------
ALTER TABLE public.produits ADD COLUMN IF NOT EXISTS image_url text;

-- 2. BUCKET STORAGE "produits" (lecture publique) -------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('produits', 'produits', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- 3. POLICIES RLS SUR storage.objects POUR CE BUCKET ----------------------------
-- Lecture publique (le bucket est public, cette policy le rend explicite pour l'API authentifiée aussi)
DROP POLICY IF EXISTS "Public read access for produits images" ON storage.objects;
CREATE POLICY "Public read access for produits images"
ON storage.objects FOR SELECT
USING (bucket_id = 'produits');

-- Upload : réservé aux membres de la boutique correspondant au 1er segment du chemin
DROP POLICY IF EXISTS "Boutique members can upload produit images" ON storage.objects;
CREATE POLICY "Boutique members can upload produit images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'produits'
  AND (
    (storage.foldername(name))[1] = public.get_my_boutique_id()::text
    OR public.get_my_role() = 'super_admin'
  )
);

-- Update : même contrôle
DROP POLICY IF EXISTS "Boutique members can update produit images" ON storage.objects;
CREATE POLICY "Boutique members can update produit images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'produits'
  AND (
    (storage.foldername(name))[1] = public.get_my_boutique_id()::text
    OR public.get_my_role() = 'super_admin'
  )
)
WITH CHECK (
  bucket_id = 'produits'
  AND (
    (storage.foldername(name))[1] = public.get_my_boutique_id()::text
    OR public.get_my_role() = 'super_admin'
  )
);

-- Delete : même contrôle
DROP POLICY IF EXISTS "Boutique members can delete produit images" ON storage.objects;
CREATE POLICY "Boutique members can delete produit images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'produits'
  AND (
    (storage.foldername(name))[1] = public.get_my_boutique_id()::text
    OR public.get_my_role() = 'super_admin'
  )
);

NOTIFY pgrst, 'reload schema';

COMMIT;
