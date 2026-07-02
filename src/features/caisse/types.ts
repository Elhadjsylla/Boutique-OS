export interface CartItem {
  produitId: string;
  nom: string;
  prix: number;
  quantite: number; // Quantity in cart
  stockMax: number; // Max available stock
}
