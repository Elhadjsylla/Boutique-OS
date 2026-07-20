import Dexie, { type Table } from 'dexie';

export interface LocalSignalement {
  id?: number;
  uuid: string;
  boutique_id: string;
  type: 'bug' | 'suggestion' | 'plainte' | 'autre';
  sujet: string;
  message: string;
  created_at: string;
  synced: number; // 0 = non synchronisé, 1 = synchronisé
}

export class SamaBoutikDexie extends Dexie {
  signalements_local!: Table<LocalSignalement>;

  constructor() {
    super('SamaBoutikOfflineDB');
    this.version(1).stores({
      signalements_local: '++id, uuid, synced, created_at'
    });
  }
}

export const db = new SamaBoutikDexie();
