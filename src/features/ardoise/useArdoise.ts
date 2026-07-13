import { useCallback } from 'react';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { supabaseService } from '../../services/supabaseService';
import { formatMontantFull } from '../../lib/format';

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

      await supabaseService.upsertArdoise(ardoiseData);
      onSuccess("Ardoise créée avec succès.");
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        onError(err.issues[0]?.message || "Erreur de validation");
      } else {
        console.error(err);
        onError(err?.message || "Une erreur est survenue.");
      }
    }
  }, [onSuccess, onError]);

  const addPayment = useCallback(async (ardoiseId: string, montantPaiement: number) => {
    try {
      paymentSchema.parse({ montant: montantPaiement });

      const { data: ardoise, error: fetchError } = await supabase
        .from('ardoises')
        .select('*')
        .eq('id', ardoiseId)
        .maybeSingle();

      if (fetchError || !ardoise) {
        onError("Ardoise introuvable.");
        return;
      }

      const payments = await supabaseService.getArdoisePaiements(ardoiseId);
      const currentPaid = payments.reduce((sum, p) => sum + p.montant, 0);
      const remaining = ardoise.montant_total - currentPaid;

      if (montantPaiement > remaining) {
        onError(`Le versement dépasse le solde restant (${formatMontantFull(remaining)} FCFA).`);
        return;
      }

      const paymentId = crypto.randomUUID();
      const timestamp = new Date().toISOString();

      const paymentData = {
        id: paymentId,
        ardoise_id: ardoiseId,
        montant: montantPaiement,
        paid_at: timestamp,
        updated_at: timestamp,
      };

      await supabaseService.addArdoisePaiement(paymentData);

      const isFullyPaid = (currentPaid + montantPaiement) >= ardoise.montant_total;
      const updatedArdoise = {
        ...ardoise,
        statut: isFullyPaid ? ('soldee' as const) : ('en_cours' as const),
      };

      await supabaseService.upsertArdoise(updatedArdoise);
      onSuccess("Versement enregistré ✓");
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        onError(err.issues[0]?.message || "Erreur de validation");
      } else {
        console.error(err);
        onError(err?.message || "Une erreur est survenue lors de l'enregistrement du versement.");
      }
    }
  }, [onSuccess, onError]);

  const addDebt = useCallback(async (ardoiseId: string, montantDebt: number) => {
    try {
      paymentSchema.parse({ montant: montantDebt });

      const { data: ardoise, error: fetchError } = await supabase
        .from('ardoises')
        .select('*')
        .eq('id', ardoiseId)
        .maybeSingle();

      if (fetchError || !ardoise) {
        onError("Ardoise introuvable.");
        return;
      }

      const updatedArdoise = {
        ...ardoise,
        montant_total: ardoise.montant_total + montantDebt,
        statut: 'en_cours' as const,
      };

      await supabaseService.upsertArdoise(updatedArdoise);
      onSuccess(`${formatMontantFull(montantDebt)} FCFA ajoutés à l'ardoise.`);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        onError(err.issues[0]?.message || "Montant invalide.");
      } else {
        console.error(err);
        onError(err?.message || "Une erreur est survenue.");
      }
    }
  }, [onSuccess, onError]);

  return {
    createArdoise,
    addPayment,
    addDebt,
  };
}
