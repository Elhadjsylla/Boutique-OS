import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useStock, type ProductFormInput } from '../features/stock/useStock';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { MoneyText } from '../components/ui/MoneyText';
import { Toast } from '../components/ui/Toast';
import { Modal } from '../components/ui/Modal';
import { StockModal } from './StockModal';
import type { Produit } from '../db/dexie';

export const Stock: React.FC = () => {
  const { profile, boutique } = useAuth();
  
  // Role checks
  const canEdit = profile?.role === 'gerant' || profile?.role === 'super_admin';
  const boutiqueId = profile?.boutique_id || boutique?.id || 'boutique-1';

  const {
    filteredProducts,
    search,
    setSearch,
    filterLowStock,
    setFilterLowStock,
    error,
    setError,
    saveProduct,
    archiveProduct,
  } = useStock(boutiqueId);

  // UI States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Produit | null>(null);
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const handleSave = async (data: ProductFormInput): Promise<boolean> => {
    const success = await saveProduct(data, editingProduct?.id);
    if (success) {
      setToast({
        message: editingProduct ? "Produit mis à jour avec succès" : "Produit ajouté avec succès",
        type: 'success'
      });
      setEditingProduct(null);
    }
    return success;
  };

  const handleArchiveConfirm = async () => {
    if (!archiveId) return;
    const success = await archiveProduct(archiveId);
    if (success) {
      setToast({ message: "Produit archivé avec succès", type: 'success' });
    } else if (error) {
      setToast({ message: error, type: 'error' });
    }
    setArchiveId(null);
  };

  const handleOpenEdit = (product: Produit) => {
    setEditingProduct(product);
    setIsFormOpen(true);
  };

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setIsFormOpen(true);
  };

  return (
    <div className="pb-40 pt-16 px-margin-mobile max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto flex flex-col gap-md text-left">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Header Section */}
      <div className="flex justify-between items-center mt-sm">
        <div>
          <h2 className="font-headline-md text-on-surface">Gestion de Stock</h2>
          <p className="text-xs text-outline">{filteredProducts.length} produit(s) trouvé(s)</p>
        </div>
        {canEdit && (
          <Button onClick={handleOpenAdd} size="md" className="flex items-center gap-xs">
            <span className="material-symbols-outlined text-base">add</span>
            Ajouter
          </Button>
        )}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-sm">
        <div className="relative flex items-center">
          <span className="material-symbols-outlined absolute left-4 text-outline">search</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 h-12 bg-surface-container-lowest border-outline-variant border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all font-body-lg text-body-lg text-on-surface"
            placeholder="Rechercher par nom..."
          />
        </div>
        
        <div className="flex gap-sm">
          <button
            onClick={() => setFilterLowStock(!filterLowStock)}
            className={`flex-1 h-10 px-4 rounded-xl border flex items-center justify-center gap-xs font-semibold text-xs transition-all ${
              filterLowStock
                ? 'bg-tertiary-container/20 border-on-tertiary-container text-on-tertiary-container'
                : 'bg-surface-container-lowest border-outline-variant text-outline'
            }`}
          >
            <span className="material-symbols-outlined text-sm">warning</span>
            Stock Faible
          </button>
        </div>
      </div>

      {/* Products List */}
      <div className="flex flex-col gap-sm">
        {filteredProducts.length === 0 ? (
          <div className="bg-card border border-border p-lg rounded-card shadow-sm text-center">
            <span className="material-symbols-outlined text-4xl text-outline mb-xs">inventory_2</span>
            <p className="text-body-md text-outline">Aucun produit en stock.</p>
          </div>
        ) : (
          filteredProducts.map((p) => {
            const isOutOfStock = p.quantite === 0;
            const isLowStock = p.quantite <= p.seuil_alerte && !isOutOfStock;

            return (
              <Card key={p.id} className="p-sm flex justify-between items-center bg-surface-container-lowest border border-outline-variant">
                <div className="flex flex-col gap-xs min-w-0 flex-1 mr-sm">
                  <div className="flex items-center gap-xs min-w-0">
                    <span className="font-semibold text-on-surface truncate">{p.nom}</span>
                    {isOutOfStock ? (
                      <Badge variant="danger">Rupture</Badge>
                    ) : isLowStock ? (
                      <Badge variant="warning">Alerte</Badge>
                    ) : (
                      <Badge variant="success">OK</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-md text-xs text-outline font-medium">
                    <span>Stock: <strong className={isOutOfStock ? 'text-error' : isLowStock ? 'text-on-tertiary-container' : 'text-on-surface'}>{p.quantite}</strong></span>
                    <span>Seuil: {p.seuil_alerte}</span>
                  </div>
                </div>

                <div className="flex items-center gap-md">
                  <MoneyText value={p.prix} className="text-base text-primary font-bold" />
                  
                  {canEdit && (
                    <div className="flex gap-xs border-l border-border pl-md">
                      <button
                        onClick={() => handleOpenEdit(p)}
                        className="material-symbols-outlined text-outline hover:text-primary active:scale-90 transition-transform p-1"
                        title="Modifier"
                      >
                        edit
                      </button>
                      <button
                        onClick={() => setArchiveId(p.id)}
                        className="material-symbols-outlined text-outline hover:text-error active:scale-90 transition-transform p-1"
                        title="Archiver"
                      >
                        archive
                      </button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Add/Edit Modal */}
      {isFormOpen && (
        <StockModal
          key={editingProduct?.id || 'new'}
          isOpen={isFormOpen}
          onClose={() => {
            setIsFormOpen(false);
            setError(null);
          }}
          onSave={handleSave}
          product={editingProduct}
          validationError={error}
        />
      )}

      {/* Archive Confirmation Modal */}
      <Modal isOpen={!!archiveId} onClose={() => setArchiveId(null)} title="Archiver le produit">
        <div className="flex flex-col gap-md text-left">
          <p className="text-body-md text-outline">
            Êtes-vous sûr de vouloir archiver ce produit ? Il ne sera plus visible lors de l'encaissement, mais l'historique des ventes sera conservé.
          </p>
          <div className="flex gap-sm">
            <Button variant="ghost" onClick={() => setArchiveId(null)} className="flex-1">
              Annuler
            </Button>
            <Button variant="danger" onClick={handleArchiveConfirm} className="flex-1">
              Archiver
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
export default Stock;
