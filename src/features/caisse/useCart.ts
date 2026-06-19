import { useState, useCallback } from 'react';
import { z } from 'zod';
import { db, queueMutation, type Ardoise } from '../../db/dexie';
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

      // Execute all db changes in a single Dexie transaction for robustness
      await db.transaction('rw', [db.ventes, db.vente_items, db.produits, db.ardoises, db.outbox], async () => {
        const venteData = {
          id: venteId,
          boutique_id: boutiqueId,
          caissier_id: caissierId,
          total: cartTotal,
          created_at: timestamp,
          updated_at: timestamp,
        };

        // Write Vente locally
        await db.ventes.add(venteData);
        await queueMutation('ventes', 'INSERT', venteId, venteData);

        for (const item of cart) {
          const itemData = {
            id: crypto.randomUUID(),
            vente_id: venteId,
            produit_id: item.produitId,
            quantite: item.quantite,
            prix_unitaire: item.prix,
            updated_at: timestamp,
          };

          // Write VenteItem locally
          await db.vente_items.add(itemData);
          await queueMutation('vente_items', 'INSERT', itemData.id, itemData);

          // Decrement local stock in Dexie
          const dbProduct = await db.produits.get(item.produitId);
          if (dbProduct) {
            const updatedProduct = {
              ...dbProduct,
              quantite: Math.max(0, dbProduct.quantite - item.quantite),
              updated_at: timestamp,
            };
            await db.produits.put(updatedProduct);
            await queueMutation('produits', 'UPDATE', item.produitId, updatedProduct);
          }
        }

        // Handle partial payment (debt)
        if (isPartial && clientNom) {
          const trimmedClientNom = clientNom.trim();
          let targetArdoiseId = selectedArdoiseId;
          let ardoise = null;

          if (targetArdoiseId) {
            ardoise = await db.ardoises.get(targetArdoiseId);
          }
          if (!ardoise) {
            const existing = await db.ardoises
              .filter((a: Ardoise) => a.client_nom.toLowerCase() === trimmedClientNom.toLowerCase())
              .first();
            if (existing) {
              ardoise = existing;
              targetArdoiseId = existing.id;
            }
          }

          if (ardoise && targetArdoiseId) {
            // Add debt to existing ardoise
            const updatedArdoise = {
              ...ardoise,
              montant_total: ardoise.montant_total + debtAmount,
              statut: 'en_cours' as const,
              updated_at: timestamp,
            };
            await db.ardoises.put(updatedArdoise);
            await queueMutation('ardoises', 'UPDATE', targetArdoiseId, updatedArdoise);
          } else {
            // Create a new ardoise
            const newArdoiseId = crypto.randomUUID();
            const ardoiseData = {
              id: newArdoiseId,
              boutique_id: boutiqueId,
              client_nom: trimmedClientNom,
              montant_total: debtAmount,
              statut: 'en_cours' as const,
              created_at: timestamp,
              updated_at: timestamp,
            };
            await db.ardoises.add(ardoiseData);
            await queueMutation('ardoises', 'INSERT', newArdoiseId, ardoiseData);
          }
        }
      });

      onSuccess(changeDue);
      clearCart();
    } catch (err) {
      if (err instanceof z.ZodError) {
        onError(err.issues[0]?.message || "Erreur de validation du panier");
      } else {
        console.error(err);
        onError("Une erreur est survenue lors de l'enregistrement.");
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
