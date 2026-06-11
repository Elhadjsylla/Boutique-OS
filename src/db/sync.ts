import { db } from './dexie';
import { supabase } from '../lib/supabase';

// Helper to check if online
export function isBrowserOnline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine;
}

// Push local changes to Supabase
export async function pushLocalChanges(): Promise<void> {
  if (!isBrowserOnline()) return;

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
          .delete()
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

  const tablesToSync = ['produits', 'ventes', 'vente_items', 'ardoises', 'ardoise_paiements'];

  for (const tableName of tablesToSync) {
    try {
      // Find the latest updated_at in the local table
      const localTable = db.table(tableName);
      const latestLocalRecord = await localTable.orderBy('updated_at').reverse().first();
      const lastSyncTime = latestLocalRecord ? latestLocalRecord.updated_at : new Date(0).toISOString();

      // Fetch new/updated records from Supabase
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .gt('updated_at', lastSyncTime);

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
            await localTable.put(item);
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
