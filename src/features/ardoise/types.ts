export interface ArdoiseItem {
  id: string;
  boutique_id: string;
  client_nom: string;
  montant_total: number;
  paid_amount: number;
  statut: 'en_cours' | 'soldee';
  created_at: string;
  updated_at: string;
}

export interface ArdoisePaiementItem {
  id: string;
  ardoise_id: string;
  montant: number;
  paid_at: string;
  updated_at: string;
}
