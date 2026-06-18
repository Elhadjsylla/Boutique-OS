import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/dexie';
import { useStock } from '../features/stock/useStock';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { MoneyText } from '../components/ui/MoneyText';
import { Toast } from '../components/ui/Toast';
import { Modal } from '../components/ui/Modal';
import { BottomSheet } from '../components/ui/BottomSheet';

interface StockProps {
  boutiqueId: string;
}

export const Stock: React.FC<StockProps> = ({ boutiqueId }) => {
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Forms
  const [newNom, setNewNom] = useState('');
  const [newPrix, setNewPrix] = useState('');
  const [newQuantite, setNewQuantite] = useState('');
  const [newSeuilAlerte, setNewSeuilAlerte] = useState('5');

  const [editNom, setEditNom] = useState('');
  const [editPrix, setEditPrix] = useState('');
  const [editQuantite, setEditQuantite] = useState('');
  const [editSeuilAlerte, setEditSeuilAlerte] = useState('');

  const products = useLiveQuery(() => db.produits.where('archive').equals(0).toArray(), []) || [];

  const handleSuccess = (msg: string) => {
    setToast({ message: msg, type: 'success' });
    setIsCreateOpen(false);
    setIsEditOpen(false);
    setNewNom(''); setNewPrix(''); setNewQuantite(''); setNewSeuilAlerte('5');
  };

  const { createProduit, updateProduit, archiveProduit } = useStock(handleSuccess, (msg) => setToast({ message: msg, type: 'error' }));

  const filteredProducts = products.filter(p => p.nom.toLowerCase().includes(search.toLowerCase()));
  const selectedProduct = products.find(p => p.id === selectedProductId);

  const openEdit = (product: typeof products[0]) => {
    setSelectedProductId(product.id);
    setEditNom(product.nom);
    setEditPrix(product.prix.toString());
    setEditQuantite(product.quantite.toString());
    setEditSeuilAlerte(product.seuil_alerte.toString());
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
          { label: 'Articles', count: totalProducts, color: 'text-primary' },
          { label: 'Ruptures', count: outOfStock, color: 'text-error' },
          { label: 'Alerte Stock', count: lowStock, color: 'text-tertiary' }
        ].map((metric, i) => (
          <div key={i} className="bg-white border border-outline-variant p-3 rounded-2xl text-left flex flex-col justify-between h-20 premium-shadow-sm">
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

            return (
              <Card
                key={p.id}
                elevation={1}
                className="flex items-center justify-between p-3.5 cursor-pointer hover:bg-surface-container-low hover:border-primary/20 active:scale-[0.99] transition-all"
                onClick={() => openEdit(p)}
              >
                <div className="text-left flex-1 min-w-0 pr-4">
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
                <div className="text-right">
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
        <div className="flex flex-col gap-4">
          <Input label="Nom du Produit" value={newNom} onChange={(e) => setNewNom(e.target.value)} placeholder="Ex: Sac de Riz 5kg" />
          <Input label="Prix de Vente (FCFA)" type="number" value={newPrix} onChange={(e) => setNewPrix(e.target.value)} placeholder="Ex: 6750" />
          <Input label="Quantité Initiale" type="number" value={newQuantite} onChange={(e) => setNewQuantite(e.target.value)} placeholder="Ex: 15" />
          <Input label="Seuil d'Alerte de Stock" type="number" value={newSeuilAlerte} onChange={(e) => setNewSeuilAlerte(e.target.value)} placeholder="Ex: 5" />
          <Button onClick={() => createProduit(boutiqueId, newNom, parseFloat(newPrix), parseInt(newQuantite), parseInt(newSeuilAlerte))} disabled={!newNom || !newPrix || !newQuantite || !newSeuilAlerte} className="w-full mt-2">
            AJOUTER AU STOCK
          </Button>
        </div>
      </Modal>

      {/* BOTTOM SHEET: Edit & Archive */}
      <BottomSheet isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title={selectedProduct ? `Fiche Produit : ${selectedProduct.nom}` : ''}>
        <div className="flex flex-col gap-4 text-left">
          <Input label="Nom du Produit" value={editNom} onChange={(e) => setEditNom(e.target.value)} />
          <Input label="Prix de Vente (FCFA)" type="number" value={editPrix} onChange={(e) => setEditPrix(e.target.value)} />
          <Input label="Quantité en Stock" type="number" value={editQuantite} onChange={(e) => setEditQuantite(e.target.value)} />
          <Input label="Seuil d'Alerte" type="number" value={editSeuilAlerte} onChange={(e) => setEditSeuilAlerte(e.target.value)} />
          <div className="flex gap-3 mt-2">
            <Button variant="danger" onClick={() => selectedProductId && window.confirm("Archiver ce produit ? Il n'apparaîtra plus en vente.") && archiveProduit(selectedProductId)} className="flex-1">
              ARCHIVER
            </Button>
            <Button onClick={() => selectedProductId && updateProduit(selectedProductId, editNom, parseFloat(editPrix), parseInt(editQuantite), parseInt(editSeuilAlerte))} className="flex-[2]" disabled={!editNom || !editPrix || !editQuantite || !editSeuilAlerte}>
              SAUVEGARDER
            </Button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
};
export default Stock;
