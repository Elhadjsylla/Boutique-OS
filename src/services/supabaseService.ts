import { supabase } from '../lib/supabase';

export interface Produit {
  id: string;
  boutique_id: string;
  nom: string;
  prix: number;
  quantite: number;
  seuil_alerte: number;
  archive: number;
  updated_at: string;
  image_url?: string;
  deleted_at?: string | null;
}

export interface Vente {
  id: string;
  boutique_id: string;
  caissier_id: string;
  total: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
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
  access_token?: string;
  deleted_at?: string | null;
}

export interface ArdoisePaiement {
  id: string;
  ardoise_id: string;
  montant: number;
  paid_at: string;
  updated_at: string;
}

export const supabaseService = {
  // --- PRODUITS ---
  async getProduits(boutiqueId: string): Promise<Produit[]> {
    const { data, error } = await supabase
      .from('produits')
      .select('*')
      .eq('boutique_id', boutiqueId)
      .eq('archive', 0)
      .is('deleted_at', null)
      .order('nom');
    
    if (error) throw error;
    return data || [];
  },

  async upsertProduit(produit: Omit<Produit, 'updated_at'>): Promise<void> {
    const timestamp = new Date().toISOString();
    const { error } = await supabase
      .from('produits')
      .upsert({
        ...produit,
        updated_at: timestamp
      });
    
    if (error) throw error;
  },

  async deleteProduit(id: string): Promise<void> {
    const timestamp = new Date().toISOString();
    const { error } = await supabase
      .from('produits')
      .update({
        deleted_at: timestamp,
        updated_at: timestamp
      })
      .eq('id', id);
    
    if (error) throw error;
  },

  // --- VENTES ---
  async getVentes(boutiqueId: string, sinceDate?: string): Promise<Vente[]> {
    let query = supabase
      .from('ventes')
      .select('*')
      .eq('boutique_id', boutiqueId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (sinceDate) {
      query = query.gte('created_at', sinceDate);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getVentesAll(boutiqueId: string): Promise<Vente[]> {
    const { data, error } = await supabase
      .from('ventes')
      .select('*')
      .eq('boutique_id', boutiqueId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async getVenteItems(venteIds: string[]): Promise<VenteItem[]> {
    if (venteIds.length === 0) return [];
    const { data, error } = await supabase
      .from('vente_items')
      .select('*')
      .in('vente_id', venteIds);
    
    if (error) throw error;
    return data || [];
  },

  async getVenteItemsAll(boutiqueId: string): Promise<VenteItem[]> {
    // Get all ventes first
    const { data: ventes, error: vError } = await supabase
      .from('ventes')
      .select('id')
      .eq('boutique_id', boutiqueId)
      .is('deleted_at', null);

    if (vError) throw vError;
    if (!ventes || ventes.length === 0) return [];

    const ids = ventes.map(v => v.id);
    const { data, error } = await supabase
      .from('vente_items')
      .select('*')
      .in('vente_id', ids);

    if (error) throw error;
    return data || [];
  },

  // --- ARDOISES ---
  async getArdoises(boutiqueId: string): Promise<Ardoise[]> {
    const { data, error } = await supabase
      .from('ardoises')
      .select('*')
      .eq('boutique_id', boutiqueId)
      .is('deleted_at', null)
      .order('client_nom');
    
    if (error) throw error;
    return data || [];
  },

  async upsertArdoise(ardoise: Omit<Ardoise, 'updated_at'>): Promise<void> {
    const timestamp = new Date().toISOString();
    const { error } = await supabase
      .from('ardoises')
      .upsert({
        ...ardoise,
        updated_at: timestamp
      });
    
    if (error) throw error;
  },

  async getArdoisePaiements(ardoiseId: string): Promise<ArdoisePaiement[]> {
    const { data, error } = await supabase
      .from('ardoise_paiements')
      .select('*')
      .eq('ardoise_id', ardoiseId)
      .order('paid_at');
    
    if (error) throw error;
    return data || [];
  },

  async getArdoisePaiementsAll(boutiqueId: string): Promise<ArdoisePaiement[]> {
    const { data: ardoises, error: aError } = await supabase
      .from('ardoises')
      .select('id')
      .eq('boutique_id', boutiqueId)
      .is('deleted_at', null);

    if (aError) throw aError;
    if (!ardoises || ardoises.length === 0) return [];

    const ids = ardoises.map(a => a.id);
    const { data, error } = await supabase
      .from('ardoise_paiements')
      .select('*')
      .in('ardoise_id', ids);

    if (error) throw error;
    return data || [];
  },

  async addArdoisePaiement(paiement: Omit<ArdoisePaiement, 'updated_at'>): Promise<void> {
    const timestamp = new Date().toISOString();
    const { error } = await supabase
      .from('ardoise_paiements')
      .insert({
        ...paiement,
        updated_at: timestamp
      });
    
    if (error) throw error;
  }
};
