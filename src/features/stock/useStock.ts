import { useCallback } from 'react';
import { z } from 'zod';
import { db, queueMutation } from '../../db/dexie';

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
      const timestamp = new Date().toISOString();

      const produitData = {
        id: produitId,
        boutique_id: boutiqueId,
        nom: nom.trim(),
        prix,
        quantite,
        seuil_alerte: seuilAlerte,
        archive: 0,
        updated_at: timestamp,
        image_url: imageUrl?.trim() || undefined,
      };

      await db.transaction('rw', [db.produits, db.outbox], async () => {
        await db.produits.add(produitData);
        await queueMutation('produits', 'INSERT', produitId, produitData);
      });

      onSuccess("Produit créé avec succès.");
    } catch (err) {
      if (err instanceof z.ZodError) {
        onError(err.issues[0]?.message || "Erreur de validation");
      } else {
        console.error(err);
        onError("Une erreur est survenue lors de la création.");
      }
    }
  }, [onSuccess, onError]);

  const updateProduit = useCallback(async (produitId: string, nom: string, prix: number, quantite: number, seuilAlerte: number, imageUrl?: string) => {
    try {
      produitSchema.parse({ nom, prix, quantite, seuilAlerte, imageUrl });

      const current = await db.produits.get(produitId);
      if (!current) {
        onError("Produit introuvable.");
        return;
      }

      const timestamp = new Date().toISOString();

      const produitData = {
        ...current,
        nom: nom.trim(),
        prix,
        quantite,
        seuil_alerte: seuilAlerte,
        updated_at: timestamp,
        image_url: imageUrl?.trim() || undefined,
      };

      await db.transaction('rw', [db.produits, db.outbox], async () => {
        await db.produits.put(produitData);
        await queueMutation('produits', 'UPDATE', produitId, produitData);
      });

      onSuccess("Produit mis à jour avec succès.");
    } catch (err) {
      if (err instanceof z.ZodError) {
        onError(err.issues[0]?.message || "Erreur de validation");
      } else {
        console.error(err);
        onError("Une erreur est survenue lors de la mise à jour.");
      }
    }
  }, [onSuccess, onError]);

  const archiveProduit = useCallback(async (produitId: string) => {
    try {
      const current = await db.produits.get(produitId);
      if (!current) {
        onError("Produit introuvable.");
        return;
      }

      const timestamp = new Date().toISOString();

      const produitData = {
        ...current,
        archive: 1,
        updated_at: timestamp,
      };

      await db.transaction('rw', [db.produits, db.outbox], async () => {
        await db.produits.put(produitData);
        await queueMutation('produits', 'UPDATE', produitId, produitData);
      });

      onSuccess("Produit archivé avec succès.");
    } catch (err) {
      console.error(err);
      onError("Une erreur est survenue lors de l'archivage.");
    }
  }, [onSuccess, onError]);

  return {
    createProduit,
    updateProduit,
    archiveProduit,
  };
}
