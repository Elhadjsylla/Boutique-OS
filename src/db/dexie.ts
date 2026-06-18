import Dexie, { type Table } from 'dexie';

export interface OutboxEntry {
  id: string; // client-generated UUID
  table: string; // e.g. 'produits', 'ventes', 'vente_items', 'ardoises', 'ardoise_paiements'
  op: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: any;
  updatedAt: string; // ISO String timestamp
  synced: number; // 0 = non synchro, 1 = synchro
}

export interface Produit {
  id: string;
  boutique_id: string;
  nom: string;
  prix: number;
  quantite: number;
  seuil_alerte: number;
  archive: number; // 0 or 1 for indexing
  updated_at: string;
  image_url?: string;
}

export interface Vente {
  id: string;
  boutique_id: string;
  caissier_id: string;
  total: number;
  created_at: string;
  updated_at: string;
}

export interface VenteItem {
  id: string;
  vente_id: string;
  produit_id: string;
  quantite: number;
  prix_unitaire: number;
  updated_at: string;
}

export interface Ardoise {
  id: string;
  boutique_id: string;
  client_nom: string;
  montant_total: number;
  statut: 'en_cours' | 'soldee';
  created_at: string;
  updated_at: string;
}

export interface ArdoisePaiement {
  id: string;
  ardoise_id: string;
  montant: number;
  paid_at: string;
  updated_at: string;
}

export class BoutikOSDatabase extends Dexie {
  produits!: Table<Produit, string>;
  ventes!: Table<Vente, string>;
  vente_items!: Table<VenteItem, string>;
  ardoises!: Table<Ardoise, string>;
  ardoise_paiements!: Table<ArdoisePaiement, string>;
  outbox!: Table<OutboxEntry, string>;

  constructor() {
    super('boutikos');
    this.version(1).stores({
      produits: 'id, boutique_id, archive, updated_at',
      ventes: 'id, boutique_id, created_at, updated_at',
      vente_items: 'id, vente_id, produit_id, updated_at',
      ardoises: 'id, boutique_id, statut, created_at, updated_at',
      ardoise_paiements: 'id, ardoise_id, paid_at, updated_at',
      outbox: 'id, table, synced, updatedAt',
    });
  }
}

export const db = new BoutikOSDatabase();

// Helper to queue a mutation to the outbox
export async function queueMutation(table: string, op: 'INSERT' | 'UPDATE' | 'DELETE', id: string, payload: any) {
  const timestamp = new Date().toISOString();
  await db.outbox.put({
    id,
    table,
    op,
    payload,
    updatedAt: timestamp,
    synced: 0
  });
}
