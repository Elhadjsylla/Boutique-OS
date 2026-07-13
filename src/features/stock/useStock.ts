import { useCallback } from 'react';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { supabaseService } from '../../services/supabaseService';

export const produitSchema = z.object({
  nom: z.string().min(1, "Le nom du produit est obligatoire."),
  prix: z.number().positive("Le prix doit être supérieur à 0."),
  quantite: z.number().int("La quantité doit être un nombre entier.").nonnegative("La quantité ne peut pas être négative."),
  seuilAlerte: z.number().int("Le seuil d'alerte doit être un nombre entier.").nonnegative("Le seuil d'alerte ne peut pas être négatif."),
  imageUrl: z.string().optional(),
});

export function useStock(onSuccess: (msg: string) => void, onError: (msg: string) => void) {

  const createProduit = useCallback(async (boutiqueId: string, nom: string, prix: number, quantite: number, seuilAlerte: number, imageUrl?: string) => {
    try {
      produitSchema.parse({ nom, prix, quantite, seuilAlerte, imageUrl });
      const produitId = crypto.randomUUID();
      const produitData = {
        id: produitId,
        boutique_id: boutiqueId,
        nom: nom.trim(),
        prix,
        quantite,
        seuil_alerte: seuilAlerte,
        archive: 0,
        image_url: imageUrl?.trim() || undefined,
      };
      await supabaseService.upsertProduit(produitData);
      onSuccess("Produit créé avec succès.");
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        onError(err.issues[0]?.message || "Erreur de validation");
      } else {
        console.error(err);
        onError(err?.message || "Une erreur est survenue lors de la création.");
      }
    }
  }, [onSuccess, onError]);

  const updateProduit = useCallback(async (produitId: string, nom: string, prix: number, quantite: number, seuilAlerte: number, imageUrl?: string) => {
    try {
      produitSchema.parse({ nom, prix, quantite, seuilAlerte, imageUrl });
      
      const { data: current, error: fetchError } = await supabase
        .from('produits')
        .select('*')
        .eq('id', produitId)
        .maybeSingle();

      if (fetchError || !current) {
        onError("Produit introuvable.");
        return;
      }

      const produitData = {
        id: produitId,
        boutique_id: current.boutique_id,
        nom: nom.trim(),
        prix,
        quantite,
        seuil_alerte: seuilAlerte,
        archive: current.archive ?? 0,
        image_url: imageUrl?.trim() || undefined,
      };

      await supabaseService.upsertProduit(produitData);
      onSuccess("Produit mis à jour avec succès.");
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        onError(err.issues[0]?.message || "Erreur de validation");
      } else {
        console.error(err);
        onError(err?.message || "Une erreur est survenue lors de la mise à jour.");
      }
    }
  }, [onSuccess, onError]);

  const archiveProduit = useCallback(async (produitId: string) => {
    try {
      const { data: current, error: fetchError } = await supabase
        .from('produits')
        .select('*')
        .eq('id', produitId)
        .maybeSingle();

      if (fetchError || !current) {
        onError("Produit introuvable.");
        return;
      }

      const produitData = {
        ...current,
        archive: 1,
      };

      await supabaseService.upsertProduit(produitData);
      onSuccess("Produit archivé avec succès.");
    } catch (err: any) {
      console.error(err);
      onError(err?.message || "Une erreur est survenue lors de l'archivage.");
    }
  }, [onSuccess, onError]);

  const retirerStock = useCallback(async (produitId: string, quantiteARetirer: number): Promise<boolean> => {
    try {
      if (quantiteARetirer <= 0) {
        onError("La quantité à retirer doit être supérieure à 0.");
        return false;
      }

      const { data: produit, error: fetchError } = await supabase
        .from('produits')
        .select('*')
        .eq('id', produitId)
        .maybeSingle();

      if (fetchError || !produit) {
        onError("Produit introuvable.");
        return false;
      }

      if (quantiteARetirer > produit.quantite) {
        onError(`Stock insuffisant — seulement ${produit.quantite} unité(s) disponible(s).`);
        return false;
      }

      const newQty = produit.quantite - quantiteARetirer;
      const produitData = {
        ...produit,
        quantite: newQty,
      };

      await supabaseService.upsertProduit(produitData);
      onSuccess(`${quantiteARetirer} unité(s) retirée(s) du stock.`);
      return true;
    } catch (err: any) {
      console.error(err);
      onError(err?.message || "Une erreur est survenue lors du retrait.");
      return false;
    }
  }, [onSuccess, onError]);

  const deleteProduit = useCallback(async (produitId: string) => {
    try {
      await supabaseService.deleteProduit(produitId);
      onSuccess("Produit supprimé définitivement.");
    } catch (err: any) {
      console.error(err);
      onError(err?.message || "Une erreur est survenue lors de la suppression.");
    }
  }, [onSuccess, onError]);

  return { createProduit, updateProduit, archiveProduit, retirerStock, deleteProduit };
}
