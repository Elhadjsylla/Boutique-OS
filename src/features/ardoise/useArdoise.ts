import { useCallback } from 'react';
import { z } from 'zod';
import { db, queueMutation } from '../../db/dexie';

// Validation schemas using Zod
export const createArdoiseSchema = z.object({
  clientNom: z.string().min(1, "Le nom du client est obligatoire."),
  montantInitial: z.number().positive("Le montant doit être supérieur à 0."),
  description: z.string().optional(),
});

export const paymentSchema = z.object({
  montant: z.number().positive("Le montant du paiement doit être supérieur à 0."),
});

export function useArdoise(onSuccess: (msg: string) => void, onError: (msg: string) => void) {
  
  const createArdoise = useCallback(async (boutiqueId: string, clientNom: string, montantInitial: number) => {
    try {
      createArdoiseSchema.parse({ clientNom, montantInitial });

      const ardoiseId = crypto.randomUUID();
      const timestamp = new Date().toISOString();

      const ardoiseData = {
        id: ardoiseId,
        boutique_id: boutiqueId,
        client_nom: clientNom.trim(),
        montant_total: montantInitial,
        statut: 'en_cours' as const,
        created_at: timestamp,
        updated_at: timestamp,
      };

      await db.transaction('rw', [db.ardoises, db.outbox], async () => {
        await db.ardoises.add(ardoiseData);
        await queueMutation('ardoises', 'INSERT', ardoiseId, ardoiseData);
      });

      onSuccess("Ardoise créée avec succès.");
    } catch (err) {
      if (err instanceof z.ZodError) {
        onError(err.issues[0]?.message || "Erreur de validation");
      } else {
        console.error(err);
        onError("Une erreur est survenue.");
      }
    }
  }, [onSuccess, onError]);

  const addPayment = useCallback(async (ardoiseId: string, montantPaiement: number) => {
    try {
      paymentSchema.parse({ montant: montantPaiement });

      const ardoise = await db.ardoises.get(ardoiseId);
      if (!ardoise) {
        onError("Ardoise introuvable.");
        return;
      }

      // Compute current total paid so far
      const payments = await db.ardoise_paiements.where('ardoise_id').equals(ardoiseId).toArray();
      const currentPaid = payments.reduce((sum, p) => sum + p.montant, 0);
      const remaining = ardoise.montant_total - currentPaid;

      if (montantPaiement > remaining) {
        onError(`Le paiement dépasse le solde restant (${remaining} FCFA).`);
        return;
      }

      const paymentId = crypto.randomUUID();
      const timestamp = new Date().toISOString();

      await db.transaction('rw', [db.ardoises, db.ardoise_paiements, db.outbox], async () => {
        const paymentData = {
          id: paymentId,
          ardoise_id: ardoiseId,
          montant: montantPaiement,
          paid_at: timestamp,
          updated_at: timestamp,
        };

        // Save payment
        await db.ardoise_paiements.add(paymentData);
        await queueMutation('ardoise_paiements', 'INSERT', paymentId, paymentData);

        // Update ardoise status if fully paid
        const isFullyPaid = (currentPaid + montantPaiement) >= ardoise.montant_total;
        const updatedArdoise = {
          ...ardoise,
          statut: isFullyPaid ? ('soldee' as const) : ('en_cours' as const),
          updated_at: timestamp,
        };

        await db.ardoises.put(updatedArdoise);
        await queueMutation('ardoises', 'UPDATE', ardoiseId, updatedArdoise);
      });

      onSuccess("Paiement enregistré avec succès.");
    } catch (err) {
      if (err instanceof z.ZodError) {
        onError(err.issues[0]?.message || "Erreur de validation");
      } else {
        console.error(err);
        onError("Une erreur est survenue lors de l'enregistrement du paiement.");
      }
    }
  }, [onSuccess, onError]);

  return {
    createArdoise,
    addPayment,
  };
}
