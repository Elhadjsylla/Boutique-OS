import { useState, useCallback } from 'react';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import type { CartItem } from './types';

// Zod Schema for Cart Validation
const cartSchema = z.array(
  z.object({
    produitId: z.string().uuid(),
    nom: z.string().min(1),
    prix: z.number().positive(),
    quantite: z.number().int().positive(),
    stockMax: z.number().int().nonnegative(),
  })
).min(1, "Le panier ne peut pas être vide");

export function useCart(onSuccess: (change: number) => void, onError: (msg: string) => void) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [amountReceived, setAmountReceived] = useState<string>('');

  const cartTotal = cart.reduce((sum, item) => sum + item.prix * item.quantite, 0);
  const changeDue = amountReceived ? parseFloat(amountReceived) - cartTotal : -cartTotal;

  const addToCart = useCallback((produitId: string, nom: string, prix: number, stock: number) => {
    if (stock <= 0) return;
    setCart((prev) => {
      const existing = prev.find((item) => item.produitId === produitId);
      if (existing) {
        if (existing.quantite >= stock) {
          onError("Quantité max en stock atteinte");
          return prev;
        }
        return prev.map((item) =>
          item.produitId === produitId ? { ...item, quantite: item.quantite + 1 } : item
        );
      }
      return [...prev, { produitId, nom, prix, quantite: 1, stockMax: stock }];
    });
  }, [onError]);

  const updateQuantity = useCallback((produitId: string, delta: number) => {
    setCart((prev) => {
      const item = prev.find((i) => i.produitId === produitId);
      if (!item) return prev;
      const newQty = item.quantite + delta;
      if (newQty <= 0) {
        return prev.filter((i) => i.produitId !== produitId);
      }
      if (newQty > item.stockMax) {
        onError("Stock insuffisant");
        return prev;
      }
      return prev.map((i) => (i.produitId === produitId ? { ...i, quantite: newQty } : i));
    });
  }, [onError]);

  const removeItem = useCallback((produitId: string) => {
    setCart((prev) => prev.filter((i) => i.produitId !== produitId));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setAmountReceived('');
  }, []);

  const validateAndCheckout = async (
    boutiqueId: string,
    caissierId: string,
    clientNom?: string,
    selectedArdoiseId?: string
  ) => {
    try {
      // Validate cart structure using Zod
      cartSchema.parse(cart);

      const received = amountReceived ? parseFloat(amountReceived) : 0;
      const isPartial = received < cartTotal;
      const debtAmount = cartTotal - received;

      if (isPartial && (!clientNom || !clientNom.trim())) {
        onError("Un nom de client est obligatoire pour enregistrer le reste à payer en dette.");
        return;
      }

      const venteId = crypto.randomUUID();
      const timestamp = new Date().toISOString();

      // Write Vente directly to Supabase
      const { error: venteError } = await supabase
        .from('ventes')
        .insert({
          id: venteId,
          boutique_id: boutiqueId,
          caissier_id: caissierId,
          total: cartTotal,
          created_at: timestamp,
          updated_at: timestamp,
        });

      if (venteError) throw venteError;

      // Write VenteItems and update stocks
      const itemsToInsert = [];
      for (const item of cart) {
        const itemData = {
          id: crypto.randomUUID(),
          vente_id: venteId,
          produit_id: item.produitId,
          quantite: item.quantite,
          prix_unitaire: item.prix,
          updated_at: timestamp,
        };
        itemsToInsert.push(itemData);

        // Fetch current product stock to update safely
        const { data: dbProduct } = await supabase
          .from('produits')
          .select('quantite')
          .eq('id', item.produitId)
          .maybeSingle();

        if (dbProduct) {
          await supabase
            .from('produits')
            .update({
              quantite: Math.max(0, dbProduct.quantite - item.quantite),
              updated_at: timestamp,
            })
            .eq('id', item.produitId);
        }
      }

      const { error: itemsError } = await supabase
        .from('vente_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      // Handle partial payment (debt)
      if (isPartial && clientNom) {
        const trimmedClientNom = clientNom.trim();
        let targetArdoiseId = selectedArdoiseId;
        let ardoise = null;

        if (targetArdoiseId) {
          const { data } = await supabase
            .from('ardoises')
            .select('*')
            .eq('id', targetArdoiseId)
            .maybeSingle();
          ardoise = data;
        }

        if (!ardoise) {
          // Look for an existing active ardoise with the same client name
          const { data } = await supabase
            .from('ardoises')
            .select('*')
            .eq('boutique_id', boutiqueId)
            .ilike('client_nom', trimmedClientNom)
            .is('deleted_at', null)
            .maybeSingle();
          
          if (data) {
            ardoise = data;
            targetArdoiseId = data.id;
          }
        }

        if (ardoise && targetArdoiseId) {
          // Add debt to existing ardoise
          await supabase
            .from('ardoises')
            .update({
              montant_total: ardoise.montant_total + debtAmount,
              statut: 'en_cours',
              updated_at: timestamp,
            })
            .eq('id', targetArdoiseId);
        } else {
          // Create a new ardoise
          const newArdoiseId = crypto.randomUUID();
          await supabase
            .from('ardoises')
            .insert({
              id: newArdoiseId,
              boutique_id: boutiqueId,
              client_nom: trimmedClientNom,
              montant_total: debtAmount,
              statut: 'en_cours',
              created_at: timestamp,
              updated_at: timestamp,
            });
        }
      }

      onSuccess(changeDue);
      clearCart();
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        onError(err.issues[0]?.message || "Erreur de validation du panier");
      } else {
        console.error(err);
        onError(err?.message || "Une erreur est survenue lors de l'enregistrement.");
      }
    }
  };

  return {
    cart,
    cartTotal,
    amountReceived,
    setAmountReceived,
    changeDue,
    addToCart,
    updateQuantity,
    removeItem,
    clearCart,
    validateAndCheckout,
  };
}
export type { CartItem };
