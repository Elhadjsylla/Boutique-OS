import { db } from './dexie';
import { supabase } from '../lib/supabase';

// Helper to check if online
export function isBrowserOnline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine;
}

import { useAuthStore } from '../store/useAuthStore';

// Push local changes to Supabase
export async function pushLocalChanges(): Promise<void> {
  if (!isBrowserOnline()) return;

  const state = useAuthStore.getState();
  if (state.isLoading) return;
  const boutiqueId = state.profile?.boutique_id || state.boutique?.id;

  if (!boutiqueId) {
    console.error('[Sync Engine] Synchro annulée (push) : boutique_id invalide ou absent.');
    return;
  }

  const unsynced = await db.outbox.where('synced').equals(0).sortBy('updatedAt');

  for (const entry of unsynced) {
    try {
      const { table, op, payload } = entry;
      
      // Perform the operation on Supabase
      if (op === 'INSERT' || op === 'UPDATE') {
        const { error } = await supabase
          .from(table)
          .upsert(payload);
          
        if (error) throw error;
      } else if (op === 'DELETE') {
        const { error } = await supabase
          .from(table)
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', entry.id);
          
        if (error) throw error;
      }

      // Mark as synced in Dexie outbox
      await db.outbox.update(entry.id, { synced: 1 });
    } catch (error) {
      console.error(`[Sync Engine] Failed to push outbox entry ${entry.id}:`, error);
      // Stop execution so we don't push out of order
      throw error;
    }
  }
}

// Pull changes from Supabase since the last sync timestamp
export async function pullServerChanges(): Promise<void> {
  if (!isBrowserOnline()) return;

  const state = useAuthStore.getState();
  if (state.isLoading) return;
  const boutiqueId = state.profile?.boutique_id || state.boutique?.id;

  if (!boutiqueId) {
    console.error('[Sync Engine] Synchro annulée (pull) : boutique_id invalide ou absent.');
    return;
  }

  // Tables where boutique_id is a direct column — filter pull to the current boutique
  const tablesWithBoutiqueId = new Set(['produits', 'ventes', 'ardoises']);
  const tablesToSync = ['produits', 'ventes', 'vente_items', 'ardoises', 'ardoise_paiements'];

  for (const tableName of tablesToSync) {
    try {
      // Find the latest updated_at in the local table
      const localTable = db.table(tableName);
      const latestLocalRecord = await localTable.orderBy('updated_at').reverse().first();
      // Subtract 30 seconds from the last sync cursor to absorb client clock skew between devices
      const lastSyncCursor = latestLocalRecord
        ? new Date(new Date(latestLocalRecord.updated_at).getTime() - 30_000).toISOString()
        : new Date(0).toISOString();

      // Fetch new/updated records from Supabase
      let query = supabase
        .from(tableName)
        .select('*')
        .gte('updated_at', lastSyncCursor);

      if (tablesWithBoutiqueId.has(tableName)) {
        query = query.eq('boutique_id', boutiqueId);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data && data.length > 0) {
        // Bulk put into Dexie (last-write-wins from server)
        await db.transaction('rw', localTable, async () => {
          for (const item of data) {
            // Check if there's an unsynced outbox item for this record to prevent overwriting local pending edits
            const pending = await db.outbox.get(item.id);
            if (pending && pending.synced === 0) {
              // If local is newer or has not synced, let the local write eventually push and override
              continue;
            }
            
            if (item.deleted_at) {
              // Soft delete on server translates to hard delete locally in Dexie
              await localTable.delete(item.id);
            } else {
              await localTable.put(item);
            }
          }
        });
      }
    } catch (error) {
      console.error(`[Sync Engine] Failed to pull delta for ${tableName}:`, error);
      throw error;
    }
  }
}

// Main sync cycle
export async function syncEngineRun(): Promise<void> {
  try {
    await pushLocalChanges();
    await pullServerChanges();
    console.log('[Sync Engine] Sync completed successfully.');
  } catch (error) {
    console.error('[Sync Engine] Sync run failed:', error);
    throw error;
  }
}
