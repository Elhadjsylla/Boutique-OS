import { supabase } from '../lib/supabase';
import { db } from '../db/db';

export const signalementService = {
  /**
   * Crée un signalement en ligne ou hors-ligne.
   */
  async createSignalement(
    boutiqueId: string,
    type: 'bug' | 'paiement' | 'compte' | 'autre',
    sujet: string,
    message: string,
    isOnline: boolean,
    captureUrl: string | null = null
  ): Promise<{ success: boolean; offline?: boolean; error?: string }> {
    const uuid = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    if (isOnline) {
      try {
        // boutique_id n'est plus envoyé : le RPC le dérive côté serveur
        // (get_my_boutique_id()) pour empêcher un client de le falsifier.
        const { error } = await supabase.rpc('create_signalement', {
          p_type: type,
          p_sujet: sujet.trim(),
          p_message: message.trim(),
          p_capture_url: captureUrl
        });

        if (error) throw error;

        // Également sauvegarder localement mais marqué comme déjà synchronisé
        await db.signalements_local.add({
          uuid,
          boutique_id: boutiqueId,
          type,
          sujet: sujet.trim(),
          message: message.trim(),
          capture_url: captureUrl,
          created_at: createdAt,
          synced: 1
        });

        return { success: true };
      } catch (err: any) {
        console.warn('Erreur envoi direct signalement, sauvegarde locale:', err);
        // Repli local en cas d'erreur de requête
      }
    }

    // Sauvegarde locale hors-ligne
    await db.signalements_local.add({
      uuid,
      boutique_id: boutiqueId,
      type,
      sujet: sujet.trim(),
      message: message.trim(),
      capture_url: captureUrl,
      created_at: createdAt,
      synced: 0
    });

    return { success: true, offline: true };
  },

  /**
   * Synchronise les signalements locaux non synchronisés vers Supabase.
   */
  async syncLocalSignalements(): Promise<void> {
    try {
      const pending = await db.signalements_local
        .where('synced')
        .equals(0)
        .toArray();

      if (pending.length === 0) return;

      console.log(`[Sync] Synchronisation de ${pending.length} signalement(s) en attente...`);

      for (const sig of pending) {
        try {
          const { error } = await supabase.rpc('create_signalement', {
            p_type: sig.type,
            p_sujet: sig.sujet,
            p_message: sig.message,
            p_capture_url: sig.capture_url
          });

          if (error) {
            console.error(`[Sync] Échec pour le signalement ${sig.uuid}:`, error);
            continue;
          }

          // Marquer comme synchronisé
          if (sig.id) {
            await db.signalements_local.update(sig.id, { synced: 1 });
          }
        } catch (err) {
          console.error(`[Sync] Erreur réseau lors de la synchro du signalement ${sig.uuid}:`, err);
        }
      }
    } catch (err) {
      console.error('[Sync] Erreur lors de la récupération des signalements en attente:', err);
    }
  }
};
