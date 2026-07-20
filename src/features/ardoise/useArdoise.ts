import { useCallback } from 'react';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { supabaseService } from '../../services/supabaseService';
import { formatMontantFull } from '../../lib/format';

// Même regex que handle_new_user()/update_phone_number() côté SQL (0027/0028).
const SENEGAL_PHONE_REGEX = /^(\+221|221)?7[0-9]{8}$/;

// Validation schemas using Zod
export const createArdoiseSchema = z.object({
  clientNom: z.string().min(1, "Le nom du client est obligatoire."),
  montantInitial: z.number().positive("Le montant doit être supérieur à 0."),
  description: z.string().optional(),
  whatsappNumero: z.string().regex(SENEGAL_PHONE_REGEX, "Numéro invalide — format Sénégal requis (ex: 77XXXXXXX).").optional().or(z.literal('')),
});

export const paymentSchema = z.object({
  montant: z.number().positive("Le montant du paiement doit être supérieur à 0."),
});

export function useArdoise(onSuccess: (msg: string) => void, onError: (msg: string) => void) {
  
  const createArdoise = useCallback(async (boutiqueId: string, clientNom: string, montantInitial: number, whatsappNumero?: string) => {
    try {
      createArdoiseSchema.parse({ clientNom, montantInitial, whatsappNumero });

      const ardoiseId = crypto.randomUUID();
      const timestamp = new Date().toISOString();

      const ardoiseData = {
        id: ardoiseId,
        boutique_id: boutiqueId,
        client_nom: clientNom.trim(),
        montant_total: montantInitial,
        statut: 'en_cours' as const,
        whatsapp_numero: whatsappNumero?.trim() || null,
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

  const updateWhatsapp = useCallback(async (ardoiseId: string, whatsappNumero: string) => {
    const trimmed = whatsappNumero.trim();
    if (trimmed && !SENEGAL_PHONE_REGEX.test(trimmed)) {
      onError("Numéro invalide — format Sénégal requis (ex: 77XXXXXXX).");
      return;
    }
    try {
      await supabaseService.updateArdoiseWhatsapp(ardoiseId, trimmed || null);
      onSuccess(trimmed ? "Numéro WhatsApp enregistré." : "Numéro WhatsApp retiré.");
    } catch (err: any) {
      console.error(err);
      onError(err?.message || "Erreur lors de l'enregistrement du numéro.");
    }
  }, [onSuccess, onError]);

  return {
    createArdoise,
    addPayment,
    addDebt,
    updateWhatsapp,
  };
}
