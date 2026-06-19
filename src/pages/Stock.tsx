import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, queueMutation } from '../db/dexie';
import { useStock } from '../features/stock/useStock';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { MoneyText } from '../components/ui/MoneyText';
import { Toast } from '../components/ui/Toast';
import { Modal } from '../components/ui/Modal';
import { BottomSheet } from '../components/ui/BottomSheet';
import { ImagePicker } from '../components/ui/ImagePicker';
import { getProductIconAndGradient } from '../lib/productHelper';

interface StockProps {
  boutiqueId: string;
}

export const Stock: React.FC<StockProps> = ({ boutiqueId }) => {
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [stockFilter, setStockFilter] = useState<'all' | 'rupture' | 'alerte'>('all');
  const [activeMetricMenu, setActiveMetricMenu] = useState<'articles' | 'ruptures' | 'alertes' | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Forms création
  const [newNom, setNewNom] = useState('');
  const [newPrix, setNewPrix] = useState('');
  const [newQuantite, setNewQuantite] = useState('');
  const [newSeuilAlerte, setNewSeuilAlerte] = useState('5');
  const [newImageUrl, setNewImageUrl] = useState('');

  // Forms édition
  const [editNom, setEditNom] = useState('');
  const [editPrix, setEditPrix] = useState('');
  const [editQuantite, setEditQuantite] = useState('');
  const [editSeuilAlerte, setEditSeuilAlerte] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');

  // États retrait de stock
  const [retraitQty, setRetraitQty] = useState('');
  const [showCustomRetrait, setShowCustomRetrait] = useState(false);

  const products = useLiveQuery(() => db.produits.where('archive').equals(0).toArray(), []) || [];

  const handleSuccess = (msg: string) => {
    setToast({ message: msg, type: 'success' });
    setIsCreateOpen(false);
    setIsEditOpen(false);
    setNewNom(''); setNewPrix(''); setNewQuantite(''); setNewSeuilAlerte('5'); setNewImageUrl('');
    setRetraitQty(''); setShowCustomRetrait(false);
  };

  // create/update/archive passent par le hook
  const { createProduit, updateProduit, archiveProduit } = useStock(
    handleSuccess,
    (msg) => setToast({ message: msg, type: 'error' })
  );

  // ── Retrait de stock (inline pour garder la fiche ouverte) ──────────────
  const handleRetrait = async (qty: number) => {
    if (!selectedProductId || qty <= 0) return;
    try {
      const produit = await db.produits.get(selectedProductId);
      if (!produit) { setToast({ message: 'Produit introuvable.', type: 'error' }); return; }
      if (qty > produit.quantite) {
        setToast({ message: `Stock insuffisant — ${produit.quantite} unité(s) disponible(s).`, type: 'error' });
        return;
      }
      const timestamp = new Date().toISOString();
      const updated = { ...produit, quantite: produit.quantite - qty, updated_at: timestamp };
      await db.transaction('rw', [db.produits, db.outbox], async () => {
        await db.produits.put(updated);
        await queueMutation('produits', 'UPDATE', selectedProductId, updated);
      });
      setToast({ message: `${qty} unité(s) retirée(s) du stock ✓`, type: 'success' });
      setRetraitQty('');
      setShowCustomRetrait(false);
      // La fiche reste ouverte : l'utilisateur voit le stock se mettre à jour
    } catch {
      setToast({ message: 'Erreur lors du retrait.', type: 'error' });
    }
  };

  // ── Suppression définitive (inline pour contrôle complet du flux) ───────
  const handleDeleteProduct = async () => {
    if (!selectedProductId) return;
    if (!window.confirm('Supprimer définitivement ce produit ?\nCette action est irréversible.')) return;
    try {
      await db.transaction('rw', [db.produits, db.outbox], async () => {
        await db.produits.delete(selectedProductId);
        await queueMutation('produits', 'DELETE', selectedProductId, {});
      });
      setIsEditOpen(false);
      setToast({ message: 'Produit supprimé définitivement.', type: 'success' });
    } catch {
      setToast({ message: 'Erreur lors de la suppression.', type: 'error' });
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.nom.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (stockFilter === 'rupture') return p.quantite === 0;
    if (stockFilter === 'alerte') return p.quantite > 0 && p.quantite <= p.seuil_alerte;
    return true;
  });
  const selectedProduct = products.find(p => p.id === selectedProductId);

  const openEdit = (product: typeof products[0]) => {
    setSelectedProductId(product.id);
    setEditNom(product.nom);
    setEditPrix(product.prix.toString());
    setEditQuantite(product.quantite.toString());
    setEditSeuilAlerte(product.seuil_alerte.toString());
    setEditImageUrl(product.image_url || '');
    setRetraitQty('');
    setShowCustomRetrait(false);
    setIsEditOpen(true);
  };

  const totalProducts = products.length;
  const outOfStock = products.filter(p => p.quantite === 0).length;
  const lowStock = products.filter(p => p.quantite > 0 && p.quantite <= p.seuil_alerte).length;

  return (
    <div className="pb-40 pt-20 px-4 max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto flex flex-col gap-6 animate-fade-in">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="text-left mt-2">
        <h1 className="font-headline-lg-mobile text-on-surface">Gestion des Stocks</h1>
        <p className="font-body-md text-on-surface-variant">Surveillez vos produits et ajustez vos prix et quantités en un instant.</p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { id: 'all', label: 'Articles', count: totalProducts, color: 'text-primary' },
          { id: 'rupture', label: 'Ruptures', count: outOfStock, color: 'text-error' },
          { id: 'alerte', label: 'Alerte Stock', count: lowStock, color: 'text-tertiary' }
        ].map((metric) => (
          <div 
            key={metric.id}
            onClick={() => setActiveMetricMenu(metric.id as any)}
            className={`cursor-pointer border p-3 rounded-2xl text-left flex flex-col justify-between h-20 premium-shadow-sm transition-all duration-200 hover:shadow-md hover:border-primary/30 active:scale-95 ${
              stockFilter === metric.id 
                ? 'bg-primary-container/20 border-primary ring-2 ring-primary/20' 
                : 'bg-white border-outline-variant'
            }`}
          >
            <span className="text-[9px] text-outline font-bold uppercase tracking-wider">{metric.label}</span>
            <p className={`text-xl font-extrabold ${metric.color} font-numeric-display`}>{metric.count}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative flex items-center group">
        <span className="material-symbols-outlined absolute left-4 text-outline group-focus-within:text-primary transition-colors">search</span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-12 pr-4 h-13 bg-white border border-outline-variant rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-body-lg text-body-lg text-on-surface premium-shadow-sm"
          placeholder="Rechercher un produit..."
        />
      </div>

      {/* Products List */}
      <div className="flex flex-col gap-2">
        {filteredProducts.length === 0 ? (
          <p className="text-sm text-outline text-center py-10 bg-white rounded-2xl border border-outline-variant">Aucun produit en stock.</p>
        ) : (
          filteredProducts.map((p) => {
            const isOutOfStock = p.quantite === 0;
            const isLowStock = p.quantite <= p.seuil_alerte && !isOutOfStock;

            const style = getProductIconAndGradient(p.nom);
            return (
              <Card
                key={p.id}
                elevation={1}
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-surface-container-low hover:border-primary/20 active:scale-[0.99] transition-all gap-3"
                onClick={() => openEdit(p)}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {/* Thumbnail Image / Apple-style Icon */}
                  <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center relative bg-primary-container shadow-sm border border-outline-variant/30">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.nom} className="w-full h-full object-cover" />
                    ) : (
                      <div className={`w-full h-full bg-gradient-to-br ${style.bg} flex items-center justify-center relative`}>
                        <div className="absolute inset-0 bg-gradient-to-b from-white/25 to-transparent" />
                        <span className="text-xl filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.2)] select-none">{style.emoji}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="text-left flex-1 min-w-0 pr-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-sm text-on-surface truncate">{p.nom}</h3>
                      {isOutOfStock ? (
                        <Badge variant="danger">Rupture</Badge>
                      ) : isLowStock ? (
                        <Badge variant="warning">Stock Bas</Badge>
                      ) : (
                        <Badge variant="success">OK</Badge>
                      )}
                    </div>
                    <MoneyText value={p.prix} className="text-sm font-semibold text-primary" />
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-bold font-numeric-display text-on-surface">{p.quantite}</p>
                  <p className="text-[10px] text-outline font-bold uppercase">En Stock</p>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => setIsCreateOpen(true)}
        className="fixed bottom-22 right-4 w-14 h-14 bg-primary text-white rounded-full shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-40"
      >
        <span className="material-symbols-outlined text-[28px]">add_box</span>
      </button>

      {/* MODAL: Create Product */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Ajouter un nouveau produit">
        <div className="flex flex-col gap-3">
          <Input label="Nom du Produit" value={newNom} onChange={(e) => setNewNom(e.target.value)} placeholder="Ex: Sac de Riz 5kg" />
          {/* Champs numériques en grille compacte */}
          <div className="grid grid-cols-3 gap-2">
            <Input label="Prix (FCFA)" type="number" value={newPrix} onChange={(e) => setNewPrix(e.target.value)} placeholder="6750" />
            <Input label="Quantité" type="number" value={newQuantite} onChange={(e) => setNewQuantite(e.target.value)} placeholder="15" />
            <Input label="Seuil alerte" type="number" value={newSeuilAlerte} onChange={(e) => setNewSeuilAlerte(e.target.value)} placeholder="5" />
          </div>
          <ImagePicker
            label="Photo du Produit (Optionnel)"
            value={newImageUrl}
            onChange={setNewImageUrl}
          />
          <Button onClick={() => createProduit(boutiqueId, newNom, parseFloat(newPrix), parseInt(newQuantite), parseInt(newSeuilAlerte), newImageUrl)} disabled={!newNom || !newPrix || !newQuantite || !newSeuilAlerte} className="w-full mt-1">
            AJOUTER AU STOCK
          </Button>
        </div>
      </Modal>

      {/* BOTTOM SHEET: Edit, Retrait & Archive */}
      <BottomSheet isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title={selectedProduct ? `Fiche : ${selectedProduct.nom}` : ''}>
        <div className="flex flex-col gap-3 text-left">
          <Input label="Nom du Produit" value={editNom} onChange={(e) => setEditNom(e.target.value)} />
          {/* Champs numériques en grille compacte */}
          <div className="grid grid-cols-3 gap-2">
            <Input label="Prix (FCFA)" type="number" value={editPrix} onChange={(e) => setEditPrix(e.target.value)} />
            <Input label="Quantité" type="number" value={editQuantite} onChange={(e) => setEditQuantite(e.target.value)} />
            <Input label="Seuil" type="number" value={editSeuilAlerte} onChange={(e) => setEditSeuilAlerte(e.target.value)} />
          </div>
          <ImagePicker
            label="Photo du Produit (Optionnel)"
            value={editImageUrl}
            onChange={setEditImageUrl}
          />

          {/* ── Section Retrait de stock ── */}
          <div className="border-t border-outline-variant pt-3">
            <div className="flex items-center gap-2 mb-2.5">
              <span className="material-symbols-outlined text-error text-lg">remove_circle</span>
              <h4 className="text-xs text-error font-extrabold uppercase tracking-wider">Retrait de stock</h4>
              {selectedProduct && (
                <span className="ml-auto text-[10px] text-outline font-semibold">
                  {selectedProduct.quantite} unité(s) disponible(s)
                </span>
              )}
            </div>

            {selectedProduct && selectedProduct.quantite > 0 ? (
              <div className="flex flex-col gap-2">
                {/* Boutons rapides */}
                <div className="grid grid-cols-4 gap-1.5">
                  {[1, 5, 10].map((qty) => (
                    <button
                      key={qty}
                      type="button"
                      onClick={() => handleRetrait(qty)}
                      disabled={selectedProduct.quantite < qty}
                      className="h-9 border text-xs font-extrabold rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-error-container/50 border-error-container text-error hover:bg-error-container active:scale-90"
                    >
                      -{qty}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowCustomRetrait(!showCustomRetrait)}
                    className={`h-9 border text-[10px] font-extrabold rounded-xl transition-all active:scale-90 ${
                      showCustomRetrait
                        ? 'bg-error border-error text-white'
                        : 'border-outline-variant bg-white text-texte-2 hover:border-error/40'
                    }`}
                  >
                    Autre
                  </button>
                </div>

                {/* Saisie personnalisée */}
                {showCustomRetrait && (
                  <div className="flex gap-2 items-end animate-fade-in">
                    <div className="flex-1">
                      <Input
                        label={`Qté à retirer (max ${selectedProduct.quantite})`}
                        type="number"
                        value={retraitQty}
                        onChange={(e) => setRetraitQty(e.target.value)}
                        placeholder="Ex: 3"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRetrait(parseInt(retraitQty))}
                      disabled={!retraitQty || parseInt(retraitQty) <= 0 || parseInt(retraitQty) > selectedProduct.quantite}
                      className="h-12 px-4 bg-error text-white rounded-xl font-bold text-sm active:scale-95 transition-all disabled:opacity-40 flex-shrink-0 mb-0"
                    >
                      OK
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-outline italic">Stock à zéro — aucun retrait possible.</p>
            )}
          </div>

          {/* ── Actions principales ── */}
          <div className="flex gap-2 mt-1">
            <Button
              variant="danger"
              onClick={() => selectedProductId && window.confirm("Archiver ce produit ? Il n'apparaîtra plus en vente.") && archiveProduit(selectedProductId)}
              className="flex-1 text-xs"
            >
              Archiver
            </Button>
            <Button
              onClick={() => selectedProductId && updateProduit(selectedProductId, editNom, parseFloat(editPrix), parseInt(editQuantite), parseInt(editSeuilAlerte), editImageUrl)}
              className="flex-[2]"
              disabled={!editNom || !editPrix || !editQuantite || !editSeuilAlerte}
            >
              SAUVEGARDER
            </Button>
          </div>

          {/* Supprimer définitivement — action destructive discrète */}
          <div className="border-t border-outline-variant pt-3">
            <button
              type="button"
              onClick={handleDeleteProduct}
              className="flex items-center gap-1.5 text-[11px] text-error/70 hover:text-error font-bold active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-base">delete_forever</span>
              Supprimer définitivement ce produit
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* Metrics Menu Bottom Sheet */}
      <BottomSheet
        isOpen={activeMetricMenu !== null}
        onClose={() => setActiveMetricMenu(null)}
        title={
          activeMetricMenu === 'articles' ? 'Options - Articles' :
          activeMetricMenu === 'ruptures' ? 'Options - Ruptures' : 'Options - Alertes Stock'
        }
      >
        <div className="flex flex-col gap-3 text-left">
          {activeMetricMenu === 'articles' && (
            <>
              <button
                type="button"
                onClick={() => {
                  setStockFilter('all');
                  setActiveMetricMenu(null);
                }}
                className="w-full text-left p-3.5 bg-primary-container/20 hover:bg-primary-container/30 border border-outline-variant/60 rounded-xl flex items-center gap-3 transition-all active:scale-[0.98] cursor-pointer"
              >
                <span className="material-symbols-outlined text-primary">list</span>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold text-on-surface">Afficher tous les produits</span>
                  <span className="text-[10px] text-outline">Afficher la totalité des articles enregistrés en stock.</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveMetricMenu(null);
                  setIsCreateOpen(true);
                }}
                className="w-full text-left p-3.5 bg-primary-container/20 hover:bg-primary-container/30 border border-outline-variant/60 rounded-xl flex items-center gap-3 transition-all active:scale-[0.98] cursor-pointer"
              >
                <span className="material-symbols-outlined text-primary">add_box</span>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold text-on-surface">Ajouter un produit</span>
                  <span className="text-[10px] text-outline">Créer une nouvelle fiche produit dans la base.</span>
                </div>
              </button>
            </>
          )}

          {activeMetricMenu === 'ruptures' && (
            <>
              <button
                type="button"
                onClick={() => {
                  setStockFilter('rupture');
                  setActiveMetricMenu(null);
                }}
                className="w-full text-left p-3.5 bg-primary-container/20 hover:bg-primary-container/30 border border-outline-variant/60 rounded-xl flex items-center gap-3 transition-all active:scale-[0.98] cursor-pointer"
              >
                <span className="material-symbols-outlined text-primary">error</span>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold text-on-surface">Filtrer par ruptures</span>
                  <span className="text-[10px] text-outline">Voir uniquement les produits dont la quantité est à zéro.</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveMetricMenu(null);
                  setIsCreateOpen(true);
                }}
                className="w-full text-left p-3.5 bg-primary-container/20 hover:bg-primary-container/30 border border-outline-variant/60 rounded-xl flex items-center gap-3 transition-all active:scale-[0.98] cursor-pointer"
              >
                <span className="material-symbols-outlined text-primary">add_box</span>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold text-on-surface">Ajouter un produit</span>
                  <span className="text-[10px] text-outline">Créer une nouvelle fiche produit dans la base.</span>
                </div>
              </button>
            </>
          )}

          {activeMetricMenu === 'alertes' && (
            <>
              <button
                type="button"
                onClick={() => {
                  setStockFilter('alerte');
                  setActiveMetricMenu(null);
                }}
                className="w-full text-left p-3.5 bg-primary-container/20 hover:bg-primary-container/30 border border-outline-variant/60 rounded-xl flex items-center gap-3 transition-all active:scale-[0.98] cursor-pointer"
              >
                <span className="material-symbols-outlined text-primary">warning</span>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold text-on-surface">Filtrer par alertes</span>
                  <span className="text-[10px] text-outline">Afficher les produits sous le seuil critique d'alerte.</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveMetricMenu(null);
                  setIsCreateOpen(true);
                }}
                className="w-full text-left p-3.5 bg-primary-container/20 hover:bg-primary-container/30 border border-outline-variant/60 rounded-xl flex items-center gap-3 transition-all active:scale-[0.98] cursor-pointer"
              >
                <span className="material-symbols-outlined text-primary">add_box</span>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold text-on-surface">Ajouter un produit</span>
                  <span className="text-[10px] text-outline">Créer une nouvelle fiche produit dans la base.</span>
                </div>
              </button>
            </>
          )}
        </div>
      </BottomSheet>
    </div>
  );
};
export default Stock;
