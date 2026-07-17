-- Ajoute la colonne dédiée pour le message personnalisé affiché en bas des
-- tickets de caisse. Le champ "Nom commercial de la boutique" utilise déjà
-- la colonne existante boutiques.nom -- aucune colonne manquante de ce côté.
ALTER TABLE public.boutiques
  ADD COLUMN IF NOT EXISTS message_ticket TEXT;

COMMENT ON COLUMN public.boutiques.message_ticket IS
  'Message personnalisé affiché en bas des tickets de caisse imprimés/générés pour cette boutique.';
