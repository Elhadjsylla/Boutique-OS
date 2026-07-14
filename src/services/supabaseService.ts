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

export interface BoutiqueSubscriptionStatus {
  actif: boolean;
  plan: string | null;
  date_fin: string | null;
}

export interface DashboardStats {
  ca_today: number;
  ca_week: number;
  ca_month: number;
  sales_count_today: number;
  open_ardoises_count: number;
  out_of_stock_count: number;
  daily_sales_history: number[];
  top_products: { nom: string; qty: number }[];
}

interface PageOptions {
  limit?: number;
  offset?: number;
}

const PRODUIT_COLUMNS = 'id, boutique_id, nom, prix, quantite, seuil_alerte, archive, updated_at, image_url, deleted_at';
const VENTE_COLUMNS = 'id, boutique_id, caissier_id, total, created_at, updated_at, deleted_at';
const VENTE_ITEM_COLUMNS = 'id, vente_id, produit_id, quantite, prix_unitaire, updated_at';
const ARDOISE_COLUMNS = 'id, boutique_id, client_nom, montant_total, statut, created_at, updated_at, access_token, client_id, deleted_at';
const ARDOISE_PAIEMENT_COLUMNS = 'id, ardoise_id, montant, paid_at, updated_at';

// Catalogue produit d'une boutique typique de quelques dizaines à quelques centaines d'articles :
// une limite par défaut généreuse évite de casser la recherche instantanée existante en Caisse
// tout en gardant la pagination disponible pour les gros catalogues.
const DEFAULT_PRODUITS_LIMIT = 200;
const DEFAULT_VENTES_LIMIT = 50;
const DEFAULT_ARDOISES_LIMIT = 200;

export const supabaseService = {
  // --- PRODUITS ---
  /** Liste paginée, avec recherche optionnelle côté serveur sur le nom (préfixe, insensible à la casse). */
  async getProduits(boutiqueId: string, opts: PageOptions & { search?: string } = {}): Promise<Produit[]> {
    const { limit = DEFAULT_PRODUITS_LIMIT, offset = 0, search } = opts;
    let query = supabase
      .from('produits')
      .select(PRODUIT_COLUMNS)
      .eq('boutique_id', boutiqueId)
      .eq('archive', 0)
      .is('deleted_at', null);

    if (search?.trim()) {
      query = query.ilike('nom', `%${search.trim()}%`);
    }

    const { data, error } = await query
      .order('nom')
      .range(offset, offset + limit - 1);

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
  /** Liste paginée des ventes, triée par date décroissante (page la plus récente en premier). */
  async getVentes(boutiqueId: string, opts: PageOptions & { sinceDate?: string } = {}): Promise<Vente[]> {
    const { limit = DEFAULT_VENTES_LIMIT, offset = 0, sinceDate } = opts;
    let query = supabase
      .from('ventes')
      .select(VENTE_COLUMNS)
      .eq('boutique_id', boutiqueId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (sinceDate) {
      query = query.gte('created_at', sinceDate);
    }

    const { data, error } = await query.range(offset, offset + limit - 1);
    if (error) throw error;
    return data || [];
  },

  /**
   * Historique complet des ventes (sans pagination) — pour les usages qui ont réellement besoin
   * de tout l'historique : export CSV/PDF, bilans multi-périodes, analyse produits dormants.
   * Ne pas utiliser pour un simple affichage de liste : préférer getVentes() (paginé).
   */
  async getVentesAll(boutiqueId: string): Promise<Vente[]> {
    const { data, error } = await supabase
      .from('ventes')
      .select(VENTE_COLUMNS)
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
      .select(VENTE_ITEM_COLUMNS)
      .in('vente_id', venteIds);

    if (error) throw error;
    return data || [];
  },

  /**
   * Tous les articles vendus d'une boutique (toutes ventes confondues) — pour l'analyse produits
   * dormants/gagnants. Un seul aller-retour (embedding PostgREST) au lieu de : fetch les ids de
   * ventes, puis fetch les vente_items.
   */
  async getVenteItemsAll(boutiqueId: string): Promise<VenteItem[]> {
    const { data, error } = await supabase
      .from('vente_items')
      .select(`${VENTE_ITEM_COLUMNS}, ventes!inner(boutique_id, deleted_at)`)
      .eq('ventes.boutique_id', boutiqueId)
      .is('ventes.deleted_at', null);

    if (error) throw error;
    return (data || []).map(({ ventes, ...rest }: any) => rest);
  },

  // --- ARDOISES ---
  /** Liste paginée, avec recherche optionnelle côté serveur sur le nom du client. */
  async getArdoises(boutiqueId: string, opts: PageOptions & { search?: string } = {}): Promise<Ardoise[]> {
    const { limit = DEFAULT_ARDOISES_LIMIT, offset = 0, search } = opts;
    let query = supabase
      .from('ardoises')
      .select(ARDOISE_COLUMNS)
      .eq('boutique_id', boutiqueId)
      .is('deleted_at', null);

    if (search?.trim()) {
      query = query.ilike('client_nom', `%${search.trim()}%`);
    }

    const { data, error } = await query
      .order('client_nom')
      .range(offset, offset + limit - 1);

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
      .select(ARDOISE_PAIEMENT_COLUMNS)
      .eq('ardoise_id', ardoiseId)
      .order('paid_at');

    if (error) throw error;
    return data || [];
  },

  /** Un seul aller-retour (embedding PostgREST) au lieu de : fetch les ids d'ardoises, puis fetch les paiements. */
  async getArdoisePaiementsAll(boutiqueId: string): Promise<ArdoisePaiement[]> {
    const { data, error } = await supabase
      .from('ardoise_paiements')
      .select(`${ARDOISE_PAIEMENT_COLUMNS}, ardoises!inner(boutique_id)`)
      .eq('ardoises.boutique_id', boutiqueId);

    if (error) throw error;
    return (data || []).map(({ ardoises, ...rest }: any) => rest);
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
  },

  // --- ABONNEMENT ---
  /** Statut d'abonnement de la boutique {actif, plan, date_fin} en un seul appel RPC indexé. */
  async getBoutiqueSubscriptionStatus(boutiqueId: string): Promise<BoutiqueSubscriptionStatus> {
    const { data, error } = await supabase.rpc('get_boutique_subscription_status', { p_boutique_id: boutiqueId });
    if (error) throw error;
    return data as BoutiqueSubscriptionStatus;
  },

  // --- DASHBOARD ---
  /** Stats agrégées côté serveur (CA jour/semaine/mois, top produits, etc.) — un seul appel RPC. */
  async getDashboardStats(boutiqueId: string): Promise<DashboardStats> {
    const { data, error } = await supabase.rpc('get_dashboard_stats', { p_boutique_id: boutiqueId });
    if (error) throw error;
    return data as DashboardStats;
  },
};
