-- ============================================================
-- TRIGGER : alerte stock bas
-- Se déclenche quand quantite passe sous ou égal à seuil_alerte
-- Notifie gérant + super_admin de la boutique
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_stock_alert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Déclencher uniquement quand on passe le seuil (pas à chaque update)
  IF NEW.quantite <= NEW.seuil_alerte AND OLD.quantite > OLD.seuil_alerte THEN
    INSERT INTO notifications (user_id, type, title, message)
    SELECT
      p.id,
      'stock_alert',
      'Alerte stock bas',
      'Le stock de "' || NEW.nom || '" est bas : '
        || NEW.quantite || ' unité(s) restante(s) (seuil : ' || NEW.seuil_alerte || ').'
    FROM profils p
    WHERE p.boutique_id = NEW.boutique_id
      AND p.role IN ('gerant', 'super_admin');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_stock_alert
AFTER UPDATE OF quantite ON produits
FOR EACH ROW EXECUTE FUNCTION public.check_stock_alert();
