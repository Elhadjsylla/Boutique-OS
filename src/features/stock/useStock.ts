import { useState, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { z } from 'zod';
import { db, queueMutation, type Produit } from '../../db/dexie';

export const productSchema = z.object({
  nom: z.string().min(1, "Le nom est requis"),
  prix: z.number({ message: "Le prix doit être un nombre" }).positive("Le prix doit être supérieur à 0"),
  quantite: z.number({ message: "La quantité doit être un nombre" }).int().nonnegative("La quantité doit être positive ou nulle"),
  seuil_alerte: z.number({ message: "Le seuil d'alerte doit être un nombre" }).int().nonnegative("Le seuil d'alerte doit être positif ou nul"),
});

export type ProductFormInput = z.infer<typeof productSchema>;

export function useStock(boutiqueId: string) {
  const [search, setSearch] = useState('');
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live query of active products (archive = 0)
  const products = useLiveQuery(
    async () => {
      return await db.produits.where('archive').equals(0).toArray();
    },
    []
  ) || [];

  // Filter products by search and low stock threshold
  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.nom.toLowerCase().includes(search.toLowerCase());
    const matchesLowStock = !filterLowStock || p.quantite <= p.seuil_alerte;
    return matchesSearch && matchesLowStock;
  });

  const saveProduct = useCallback(async (data: ProductFormInput, productId?: string) => {
    try {
      setError(null);
      const parsed = productSchema.parse(data);
      const timestamp = new Date().toISOString();
      const id = productId || crypto.randomUUID();
      const isNew = !productId;

      const productData: Produit = {
        id,
        boutique_id: boutiqueId,
        nom: parsed.nom,
        prix: parsed.prix,
        quantite: parsed.quantite,
        seuil_alerte: parsed.seuil_alerte,
        archive: 0,
        updated_at: timestamp,
      };

      await db.transaction('rw', [db.produits, db.outbox], async () => {
        await db.produits.put(productData);
        await queueMutation('produits', isNew ? 'INSERT' : 'UPDATE', id, productData as unknown as Record<string, unknown>);
      });

      return true;
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.issues[0]?.message || "Erreur de validation");
      } else {
        console.error(err);
        setError("Erreur lors de l'enregistrement du produit");
      }
      return false;
    }
  }, [boutiqueId]);

  const archiveProduct = useCallback(async (id: string) => {
    try {
      setError(null);
      const product = await db.produits.get(id);
      if (!product) {
        setError("Produit introuvable");
        return false;
      }

      const timestamp = new Date().toISOString();
      const updatedProduct: Produit = {
        ...product,
        archive: 1,
        updated_at: timestamp,
      };

      await db.transaction('rw', [db.produits, db.outbox], async () => {
        await db.produits.put(updatedProduct);
        await queueMutation('produits', 'UPDATE', id, updatedProduct as unknown as Record<string, unknown>);
      });

      return true;
    } catch (err) {
      console.error(err);
      setError("Erreur lors de l'archivage du produit");
      return false;
    }
  }, []);

  return {
    products,
    filteredProducts,
    search,
    setSearch,
    filterLowStock,
    setFilterLowStock,
    error,
    setError,
    saveProduct,
    archiveProduct,
  };
}
