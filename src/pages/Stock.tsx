import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { supabaseService } from '../services/supabaseService';
import { useStock } from '../features/stock/useStock';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { MontantInput } from '../components/ui/MontantInput';
import { MoneyText } from '../components/ui/MoneyText';
import { Toast } from '../components/ui/Toast';
import { Modal } from '../components/ui/Modal';
import { BottomSheet } from '../components/ui/BottomSheet';
import { ImagePicker } from '../components/ui/ImagePicker';
import { getProductIconAndGradient } from '../lib/productHelper';
import { formatMontantFull } from '../lib/format';

const InteractiveCurve: React.FC<{
  items: any[];
  type: 'articles' | 'ruptures' | 'alertes';
  onSelectProduct: (p: any) => void;
  onReplenish: (id: string, qty: number) => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
}> = ({
  items,
  type,
  onSelectProduct,
  onReplenish,
  selectedId,
  setSelectedId
}) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  
  if (items.length === 0) return null;

  const paddingX = 30;
  const paddingY = 20;
  const width = 450;
  const height = 160;

  // Sort items to make a nice curve (e.g., by quantity ascending)
  const sortedItems = [...items].sort((a, b) => a.quantite - b.quantite);
  
  const getVal = (item: any) => {
    if (type === 'ruptures') return item.prix; // value of product
    return item.quantite;
  };

  const maxVal = Math.max(...sortedItems.map(getVal), 1);

  const points = sortedItems.map((item, index) => {
    const x = paddingX + (sortedItems.length > 1 ? (index / (sortedItems.length - 1)) * (width - 2 * paddingX) : (width / 2));
    const val = getVal(item);
    const y = height - paddingY - (val / maxVal) * (height - 2 * paddingY);
    return { x, y, item };
  });

  let pathD = '';
  let areaD = '';
  if (points.length > 1) {
    pathD = `M ${points[0].x} ${points[0].y}`;
    areaD = `M ${points[0].x} ${height - paddingY} L ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      pathD += ` L ${points[i].x} ${points[i].y}`;
      areaD += ` L ${points[i].x} ${points[i].y}`;
    }
    areaD += ` L ${points[points.length - 1].x} ${height - paddingY} Z`;
  }

  const selectedPoint = points.find(p => p.item.id === selectedId);
  const hoveredPoint = points.find(p => p.item.id === hoveredId);

  return (
    <div className="bg-gradient-to-b from-primary-container/20 to-transparent border border-outline-variant/40 rounded-2xl p-4 flex flex-col gap-3 relative shadow-inner">
      <div className="flex justify-between items-center">
        <span className="text-[10px] text-outline font-extrabold uppercase tracking-wider">
          {type === 'articles' ? 'Répartition des quantités' :
           type === 'ruptures' ? 'Valeur des produits à risque (FCFA)' : 'Niveau de stock vs Seuil critique'}
        </span>
        <Badge variant={type === 'articles' ? 'success' : type === 'ruptures' ? 'danger' : 'warning'} className="text-[9px] font-black uppercase">
          Interactif
        </Badge>
      </div>

      <div className="relative w-full overflow-visible">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
          <defs>
            <linearGradient id="curveGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#27AE60" />
              <stop offset="100%" stopColor="#1A3C5E" />
            </linearGradient>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1A3C5E" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#1A3C5E" stopOpacity="0.00" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="#E5E7EB" strokeWidth="1.5" />
          <line x1={paddingX} y1={paddingY} x2={width - paddingX} y2={paddingY} stroke="#E5E7EB" strokeWidth="0.5" strokeDasharray="3,3" />

          {/* Area fill */}
          {areaD && <path d={areaD} fill="url(#areaGradient)" />}

          {/* Line path */}
          {pathD && <path d={pathD} fill="none" stroke="url(#curveGradient)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}

          {/* Interactive dots */}
          {points.map((p) => {
            const isHovered = hoveredId === p.item.id;
            const isSelected = selectedId === p.item.id;

            return (
              <g
                key={p.item.id}
                onMouseEnter={() => setHoveredId(p.item.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => setSelectedId(isSelected ? null : p.item.id)}
                className="cursor-pointer"
              >
                {/* Glow ring */}
                {(isHovered || isSelected) && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={isSelected ? 9 : 7}
                    fill={type === 'ruptures' ? '#BA1A1A' : type === 'alertes' ? '#E69200' : '#27AE60'}
                    opacity="0.3"
                    className="transition-all duration-200"
                  />
                )}
                {/* Core dot */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="4.5"
                  fill={isSelected ? '#1A3C5E' : (type === 'ruptures' ? '#BA1A1A' : type === 'alertes' ? '#E69200' : '#27AE60')}
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                  className="transition-all duration-200 hover:scale-125"
                />
              </g>
            );
          })}
        </svg>

        {/* Tooltip */}
        {hoveredPoint && (() => {
          const percent = (hoveredPoint.x / width) * 100;
          let transform = 'translate(-50%, -105%)';
          let leftStyle = `${percent}%`;

          // Shift tooltip position to prevent clipping on edges
          if (percent < 25) {
            transform = 'translate(8px, -105%)';
          } else if (percent > 75) {
            transform = 'translate(-100%, -105%)';
          }

          return (
            <div
              className="absolute bg-slate-900/95 text-white p-2 rounded-xl text-left pointer-events-none z-50 shadow-md border border-white/10 flex flex-col gap-0.5"
              style={{
                left: leftStyle,
                transform: transform,
                top: `${(hoveredPoint.y / height) * 100}%`,
              }}
            >
              <span className="text-[10px] font-black whitespace-nowrap">{hoveredPoint.item.nom}</span>
              <span className="text-[9px] opacity-70 whitespace-nowrap">
                {type === 'ruptures'
                  ? `Valeur : ${formatMontantFull(hoveredPoint.item.prix)} FCFA`
                  : `Quantité : ${hoveredPoint.item.quantite} u`
                }
              </span>
            </div>
          );
        })()}
      </div>

      {/* Selected item quick action */}
      {selectedPoint ? (
        <div className="bg-white border border-outline-variant/80 p-3 rounded-xl flex flex-col gap-2.5 animate-scale-in text-left shadow-sm">
          <div className="flex justify-between items-center">
            <div className="flex flex-col">
              <span className="text-xs font-black text-on-surface">{selectedPoint.item.nom}</span>
              <span className="text-[9px] text-outline font-semibold">
                Prix: {formatMontantFull(selectedPoint.item.prix)} FCFA • Stock actuel: {selectedPoint.item.quantite}
              </span>
            </div>
            <button
              onClick={() => onSelectProduct(selectedPoint.item)}
              className="text-[10px] font-black text-primary border border-outline-variant hover:bg-primary-container/20 px-2.5 py-1 rounded-lg transition-all"
            >
              Fiche complète
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-outline font-bold uppercase tracking-wider">Réappro :</span>
            <div className="flex gap-1.5 flex-1">
              {[5, 10, 20].map(qty => (
                <button
                  key={qty}
                  onClick={() => onReplenish(selectedPoint.item.id, qty)}
                  className="flex-1 h-7 rounded-lg bg-primary-container/60 hover:bg-primary-container text-primary text-[10px] font-black active:scale-95 transition-all"
                >
                  +{qty}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <p className="text-[10px] text-outline text-center font-medium py-1">
          💡 Touchez un point sur la courbe pour interagir et réapprovisionner rapidement.
        </p>
      )}
    </div>
  );
};

interface StockProps {
  boutiqueId: string;
}

export const Stock: React.FC<StockProps> = ({ boutiqueId }) => {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [stockFilter, setStockFilter] = useState<'all' | 'rupture' | 'alerte'>('all');
  const [activeMetricMenu, setActiveMetricMenu] = useState<'articles' | 'ruptures' | 'alertes' | null>(null);
  const [selectedChartProductId, setSelectedChartProductId] = useState<string | null>(null);

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

  // État de confirmation personnalisé
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = async () => {
    try {
      const data = await supabaseService.getProduits(boutiqueId);
      setProducts(data);
    } catch (err) {
      console.error(err);
      setToast({ message: "Erreur lors du chargement des produits", type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [boutiqueId]);

  useEffect(() => {
    const handleFocus = () => {
      fetchProducts();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [boutiqueId]);

  useEffect(() => {
    const channel = supabase
      .channel('realtime_produits_stock')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'produits',
          filter: `boutique_id=eq.${boutiqueId}`
        },
        () => {
          fetchProducts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [boutiqueId]);

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

  // ── Réapprovisionnement rapide (inline pour rester sur le menu) ──────────
  const quickReplenish = async (productId: string, amount: number) => {
    try {
      const { data: produit, error } = await supabase
        .from('produits')
        .select('*')
        .eq('id', productId)
        .maybeSingle();

      if (error || !produit) {
        setToast({ message: 'Produit introuvable.', type: 'error' });
        return;
      }
      const updated = { ...produit, quantite: produit.quantite + amount };
      await supabaseService.upsertProduit(updated);
      setToast({ message: `${produit.nom} réapprovisionné (+${amount} unité(s)) ✓`, type: 'success' });
      fetchProducts();
    } catch {
      setToast({ message: 'Erreur lors du réapprovisionnement.', type: 'error' });
    }
  };

  // ── Retrait de stock (inline pour garder la fiche ouverte) ──────────────
  const handleRetrait = async (qty: number) => {
    if (!selectedProductId || qty <= 0) return;
    try {
      const { data: produit, error } = await supabase
        .from('produits')
        .select('*')
        .eq('id', selectedProductId)
        .maybeSingle();

      if (error || !produit) { setToast({ message: 'Produit introuvable.', type: 'error' }); return; }
      if (qty > produit.quantite) {
        setToast({ message: `Stock insuffisant — ${produit.quantite} unité(s) disponible(s).`, type: 'error' });
        return;
      }
      const updated = { ...produit, quantite: produit.quantite - qty };
      await supabaseService.upsertProduit(updated);
      setToast({ message: `${qty} unité(s) retirée(s) du stock ✓`, type: 'success' });
      setRetraitQty('');
      setShowCustomRetrait(false);
      fetchProducts();
    } catch {
      setToast({ message: 'Erreur lors du retrait.', type: 'error' });
    }
  };

  // ── Suppression définitive (inline pour contrôle complet du flux) ───────
  const handleDeleteProduct = async () => {
    if (!selectedProductId) return;
    setConfirmConfig({
      isOpen: true,
      title: 'Suppression définitive',
      message: 'Voulez-vous vraiment supprimer définitivement ce produit ? Cette action est irréversible.',
      onConfirm: async () => {
        try {
          await supabaseService.deleteProduit(selectedProductId);
          setIsEditOpen(false);
          setToast({ message: 'Produit supprimé définitivement.', type: 'success' });
          fetchProducts();
        } catch {
          setToast({ message: 'Erreur lors de la suppression.', type: 'error' });
        }
      }
    });
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.nom.toLowerCase().includes(debouncedSearch.toLowerCase());
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
            onClick={() => {
              setSelectedChartProductId(null);
              setActiveMetricMenu(
                metric.id === 'all' ? 'articles' : 
                metric.id === 'rupture' ? 'ruptures' : 'alertes'
              );
            }}
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
        {loading ? (
          <div className="flex flex-col gap-2 animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-white border border-outline-variant rounded-2xl gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-100 rounded w-2/3" />
                    <div className="h-3 bg-slate-100 rounded w-1/3" />
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <div className="h-5 bg-slate-100 rounded w-8 ml-auto" />
                  <div className="h-3 bg-slate-100 rounded w-12 ml-auto" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
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
            <MontantInput label="Prix (FCFA)" value={newPrix} onChange={setNewPrix} placeholder="6750" />
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
            <MontantInput label="Prix (FCFA)" value={editPrix} onChange={setEditPrix} />
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
              onClick={() => {
                if (selectedProductId) {
                  setConfirmConfig({
                    isOpen: true,
                    title: 'Archiver le produit',
                    message: "Voulez-vous vraiment archiver ce produit ? Il n'apparaîtra plus en vente.",
                    onConfirm: () => archiveProduit(selectedProductId)
                  });
                }
              }}
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
              <InteractiveCurve
                items={products}
                type="articles"
                onSelectProduct={(p) => {
                  setActiveMetricMenu(null);
                  openEdit(p);
                }}
                onReplenish={quickReplenish}
                selectedId={selectedChartProductId}
                setSelectedId={setSelectedChartProductId}
              />
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
              <InteractiveCurve
                items={products.filter(p => p.quantite === 0)}
                type="ruptures"
                onSelectProduct={(p) => {
                  setActiveMetricMenu(null);
                  openEdit(p);
                }}
                onReplenish={quickReplenish}
                selectedId={selectedChartProductId}
                setSelectedId={setSelectedChartProductId}
              />
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

              {/* Real interactive out-of-stock data */}
              {(() => {
                const ruptureProducts = products.filter(p => p.quantite === 0);
                return (
                  <div className="flex flex-col gap-2 max-h-[35svh] overflow-y-auto pr-1 mt-2 border-t border-outline-variant/30 pt-3">
                    <span className="text-[10px] text-outline font-bold uppercase tracking-wider block mb-1">Produits en rupture ({ruptureProducts.length})</span>
                    {ruptureProducts.length === 0 ? (
                      <p className="text-xs text-outline italic text-center py-4 bg-surface-container/20 rounded-xl">Aucun produit en rupture.</p>
                    ) : (
                      ruptureProducts.map(p => {
                        const style = getProductIconAndGradient(p.nom);
                        return (
                          <div key={p.id} className="flex justify-between items-center bg-error-container/10 border border-error-container/20 p-2.5 rounded-xl gap-3">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${style.bg} flex items-center justify-center flex-shrink-0 relative shadow-sm border border-outline-variant/30`}>
                                <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
                                <span className="text-base select-none">{style.emoji}</span>
                              </div>
                              <div className="flex flex-col text-left min-w-0 flex-1">
                                <span className="text-xs font-bold text-on-surface truncate">{p.nom}</span>
                                <span className="text-[9px] text-error font-extrabold uppercase">Rupture de Stock</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMetricMenu(null);
                                  openEdit(p);
                                }}
                                className="px-2.5 h-7 rounded-lg bg-white border border-outline-variant text-[10px] font-bold text-texte-2 hover:bg-surface-container active:scale-95 transition-all cursor-pointer"
                              >
                                Modifier
                              </button>
                              <button
                                type="button"
                                onClick={() => quickReplenish(p.id, 10)}
                                className="px-2.5 h-7 rounded-lg bg-primary text-on-primary text-[10px] font-black hover:bg-primary/90 active:scale-95 transition-all cursor-pointer"
                              >
                                +10
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                );
              })()}
            </>
          )}

          {activeMetricMenu === 'alertes' && (
            <>
              <InteractiveCurve
                items={products.filter(p => p.quantite > 0 && p.quantite <= p.seuil_alerte)}
                type="alertes"
                onSelectProduct={(p) => {
                  setActiveMetricMenu(null);
                  openEdit(p);
                }}
                onReplenish={quickReplenish}
                selectedId={selectedChartProductId}
                setSelectedId={setSelectedChartProductId}
              />
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

              {/* Real interactive low-stock alert data */}
              {(() => {
                const alertProducts = products.filter(p => p.quantite > 0 && p.quantite <= p.seuil_alerte);
                return (
                  <div className="flex flex-col gap-2 max-h-[35svh] overflow-y-auto pr-1 mt-2 border-t border-outline-variant/30 pt-3">
                    <span className="text-[10px] text-outline font-bold uppercase tracking-wider block mb-1">Produits en alerte ({alertProducts.length})</span>
                    {alertProducts.length === 0 ? (
                      <p className="text-xs text-outline italic text-center py-4 bg-surface-container/20 rounded-xl">Aucun produit en alerte.</p>
                    ) : (
                      alertProducts.map(p => {
                        const style = getProductIconAndGradient(p.nom);
                        return (
                          <div key={p.id} className="flex justify-between items-center bg-tertiary-container/10 border border-tertiary-container/30 p-2.5 rounded-xl gap-3">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${style.bg} flex items-center justify-center flex-shrink-0 relative shadow-sm border border-outline-variant/30`}>
                                <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
                                <span className="text-base select-none">{style.emoji}</span>
                              </div>
                              <div className="flex flex-col text-left min-w-0 flex-1">
                                <span className="text-xs font-bold text-on-surface truncate">{p.nom}</span>
                                <span className="text-[9px] text-outline font-bold">
                                  Stock: <span className="text-tertiary font-extrabold">{p.quantite}</span> / Seuil: {p.seuil_alerte}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMetricMenu(null);
                                  openEdit(p);
                                }}
                                className="px-2.5 h-7 rounded-lg bg-white border border-outline-variant text-[10px] font-bold text-texte-2 hover:bg-surface-container active:scale-95 transition-all cursor-pointer"
                              >
                                Modifier
                              </button>
                              <button
                                type="button"
                                onClick={() => quickReplenish(p.id, 10)}
                                className="px-2.5 h-7 rounded-lg bg-primary text-on-primary text-[10px] font-black hover:bg-primary/90 active:scale-95 transition-all cursor-pointer"
                              >
                                +10
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                );
              })()}
            </>
          )}
        </div>
      </BottomSheet>
      {/* Custom Confirm Modal */}
      {confirmConfig && (
        <Modal
          isOpen={confirmConfig.isOpen}
          onClose={() => setConfirmConfig(null)}
          title={confirmConfig.title}
        >
          <div className="flex flex-col gap-4 text-left">
            <p className="text-xs text-on-surface-variant leading-relaxed">
              {confirmConfig.message}
            </p>
            <div className="flex gap-3 justify-end mt-2">
              <button
                type="button"
                onClick={() => setConfirmConfig(null)}
                className="px-4 h-9 rounded-xl border border-outline-variant text-[10px] font-black uppercase text-texte-2 hover:bg-surface-container active:scale-95 transition-all cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmConfig.onConfirm();
                  setConfirmConfig(null);
                }}
                className="px-4 h-9 rounded-xl bg-error hover:bg-error/90 text-white text-[10px] font-black uppercase active:scale-95 transition-all shadow-sm cursor-pointer"
              >
                Confirmer
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
export default Stock;
