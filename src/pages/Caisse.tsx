import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/dexie';
import { useCart } from '../features/caisse/useCart';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { MoneyText } from '../components/ui/MoneyText';
import { Toast } from '../components/ui/Toast';
import { BottomSheet } from '../components/ui/BottomSheet';
import { getProductIconAndGradient } from '../lib/productHelper';

const SEED_PRODUCTS = [
  { id: '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed', boutique_id: 'boutique-1', nom: 'Huile de Palme', prix: 2500, quantite: 15, seuil_alerte: 5, archive: 0, updated_at: new Date().toISOString() },
  { id: '2b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bee', boutique_id: 'boutique-1', nom: 'Riz Long Grain 5kg', prix: 6750, quantite: 3, seuil_alerte: 4, archive: 0, updated_at: new Date().toISOString() },
  { id: '3b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bef', boutique_id: 'boutique-1', nom: 'Eau Minérale 1.5L', prix: 500, quantite: 24, seuil_alerte: 10, archive: 0, updated_at: new Date().toISOString() },
  { id: '4b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bf0', boutique_id: 'boutique-1', nom: 'Savon Corporel', prix: 1200, quantite: 0, seuil_alerte: 5, archive: 0, updated_at: new Date().toISOString() },
];

interface CaisseProps {
  boutiqueId: string;
  caissierId: string;
}

export const Caisse: React.FC<CaisseProps> = ({ boutiqueId, caissierId }) => {
  const [search, setSearch] = useState('');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  const [clientNom, setClientNom] = useState('');
  const [selectedArdoiseId, setSelectedArdoiseId] = useState<string | null>(null);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);

  useEffect(() => {
    const seed = async () => {
      if ((await db.produits.count()) === 0) await db.produits.bulkAdd(SEED_PRODUCTS);
    };
    seed();
  }, []);

  const products = useLiveQuery(() => db.produits.where('archive').equals(0).toArray(), []) || [];
  const todaySales = useLiveQuery(() => {
    const today = new Date().toISOString().split('T')[0];
    return db.ventes.where('created_at').aboveOrEqual(today).reverse().toArray();
  }, []) || [];
  const ardoises = useLiveQuery(() => db.ardoises.toArray(), []) || [];

  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [isSaleDetailOpen, setIsSaleDetailOpen] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'vente' | 'tickets'>('vente');

  const selectedSaleItems = useLiveQuery(async () => {
    if (!selectedSaleId) return [];
    const items = await db.vente_items.where('vente_id').equals(selectedSaleId).toArray();
    const itemsWithProduct = await Promise.all(items.map(async (item) => {
      const prod = await db.produits.get(item.produit_id);
      return {
        ...item,
        nom: prod ? prod.nom : 'Produit inconnu'
      };
    }));
    return itemsWithProduct;
  }, [selectedSaleId]) || [];

  const selectedSale = todaySales.find(s => s.id === selectedSaleId);

  const {
    cart, cartTotal, amountReceived, setAmountReceived, changeDue,
    addToCart, updateQuantity, removeItem, validateAndCheckout
  } = useCart(
    (change) => {
      if (change >= 0) {
        setToast({ message: `Vente validée. Rendu : ${new Intl.NumberFormat('fr-FR').format(change)} FCFA`, type: 'success' });
      } else {
        setToast({ message: `Vente enregistrée avec une dette de ${new Intl.NumberFormat('fr-FR').format(Math.abs(change))} FCFA pour ${clientNom}.`, type: 'success' });
      }
      setIsCartOpen(false);
      setClientNom('');
      setSelectedArdoiseId(null);
    },
    (msg) => setToast({ message: msg, type: 'error' })
  );

  const filteredProducts = products.filter(p => p.nom.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="pb-40 pt-20 px-4 max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto flex flex-col gap-6 animate-fade-in">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Sub-tab navigation */}
      <div className="flex bg-white p-1 rounded-2xl border border-outline-variant/30 max-w-[280px] mx-auto w-full shadow-sm overflow-hidden">
        <button
          onClick={() => setActiveSubTab('vente')}
          className={`flex-1 py-2.5 px-4 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 ${
            activeSubTab === 'vente'
              ? 'bg-primary text-white shadow-sm'
              : 'text-outline hover:text-on-surface bg-transparent'
          }`}
        >
          <span className="material-symbols-outlined text-lg select-none">point_of_sale</span>
          <span>Caisse</span>
        </button>
        <button
          onClick={() => setActiveSubTab('tickets')}
          className={`flex-1 py-2.5 px-4 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 ${
            activeSubTab === 'tickets'
              ? 'bg-primary text-white shadow-sm'
              : 'text-outline hover:text-on-surface bg-transparent'
          }`}
        >
          <span className="material-symbols-outlined text-lg select-none">receipt_long</span>
          <span>Tickets</span>
        </button>
      </div>

      {activeSubTab === 'vente' ? (
        <>
          {/* Modern Search bar */}
          <div className="relative flex items-center mt-2 group">
            <span className="material-symbols-outlined absolute left-4 text-outline group-focus-within:text-primary transition-colors">search</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 h-13 bg-white border border-outline-variant rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-body-lg text-body-lg text-on-surface premium-shadow-sm"
              placeholder="Rechercher un produit..."
            />
          </div>

          {/* Grid */}
          <div className="grid grid-cols-2 gap-4">
            {filteredProducts.map((p) => {
              const isOutOfStock = p.quantite === 0;
              const isLowStock = p.quantite <= p.seuil_alerte && !isOutOfStock;
              const style = getProductIconAndGradient(p.nom);
              const cartItem = cart.find(i => i.produitId === p.id);
              
              return (
                <div
                  key={p.id}
                  onClick={() => !isOutOfStock && addToCart(p.id, p.nom, p.prix, p.quantite)}
                  className={`bg-white rounded-2xl border premium-shadow-sm flex flex-col overflow-hidden relative transition-all duration-200 ${
                    isOutOfStock
                      ? 'opacity-40 cursor-not-allowed border-outline-variant'
                      : cartItem
                        ? 'border-primary/50 ring-2 ring-primary/20 cursor-pointer hover:shadow-md active:scale-95'
                        : 'border-outline-variant cursor-pointer hover:border-primary/30 hover:shadow-md hover:scale-[1.02] active:scale-95'
                  }`}
                >
                  {/* Badge quantité en panier */}
                  {cartItem && (
                    <div className="absolute top-2 left-2 z-10 bg-primary text-white text-[10px] font-black min-w-[22px] h-[22px] rounded-full flex items-center justify-center shadow-md border-2 border-white px-1">
                      {cartItem.quantite}
                    </div>
                  )}

                  {/* Product Visual Container (Image or Apple-style gradient emoji) */}
                  <div className="h-24 flex items-center justify-center relative overflow-hidden bg-primary-container">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.nom} className="w-full h-full object-cover" />
                    ) : (
                      <div className={`w-full h-full bg-gradient-to-br ${style.bg} flex items-center justify-center relative`}>
                        <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
                        <span className="text-4xl filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.25)] select-none">
                          {style.emoji}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="p-3.5 flex flex-col flex-grow text-left">
                    <div className="flex justify-between items-start mb-2 gap-1">
                      <h3 className="font-headline-sm text-sm text-on-surface leading-tight truncate flex-1 font-bold">{p.nom}</h3>
                      {isOutOfStock ? (
                        <Badge variant="danger">Rupture</Badge>
                      ) : isLowStock ? (
                        <Badge variant="warning">Bas</Badge>
                      ) : (
                        <Badge variant="success">OK</Badge>
                      )}
                    </div>
                    <div className="mt-auto flex justify-between items-center pt-1">
                      <MoneyText value={p.prix} className="text-base text-primary font-bold" />
                      <div className="flex items-center gap-1.5">
                        {/* Bouton retirer du panier — visible seulement si en panier */}
                        {cartItem && (
                          <button
                            onClick={(e) => { e.stopPropagation(); updateQuantity(p.id, -1); }}
                            className="w-6 h-6 rounded-full bg-error/10 text-error flex items-center justify-center font-black text-sm hover:bg-error/20 active:scale-90 transition-all leading-none"
                            title="Retirer un du panier"
                          >
                            −
                          </button>
                        )}
                        <span className="text-[10px] text-outline font-bold">Stock: {p.quantite}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sales History Preview */}
          <section className="text-left mt-4 animate-fade-in">
            <div className="flex justify-between items-center border-b border-border pb-2 mb-4">
              <h3 className="font-headline-sm text-primary font-bold">Dernières Ventes</h3>
              {todaySales.length > 3 && (
                <button
                  onClick={() => setActiveSubTab('tickets')}
                  className="text-xs font-black text-secondary hover:underline flex items-center gap-1 transition-all active:scale-95 animate-fade-in"
                >
                  Voir tout ({todaySales.length})
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              )}
            </div>
            {todaySales.length === 0 ? (
              <p className="text-sm text-outline text-center py-6 bg-white rounded-2xl border border-outline-variant">Aucune vente enregistrée aujourd'hui.</p>
            ) : (
              <div className="flex flex-col gap-2 animate-fade-in">
                {todaySales.slice(0, 3).map((sale) => (
                  <Card
                    key={sale.id}
                    onClick={() => {
                      setSelectedSaleId(sale.id);
                      setIsSaleDetailOpen(true);
                    }}
                    className="flex justify-between items-center p-3.5 hover:shadow-md hover:border-primary/20 active:scale-[0.99] transition-all gap-3 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="bg-primary-container p-2 rounded-xl text-primary">
                        <span className="material-symbols-outlined text-xl">receipt_long</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-outline font-semibold">{new Date(sale.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                        <span className="text-xs font-bold text-on-surface-variant">Ticket #{sale.id.slice(0, 8).toUpperCase()}</span>
                      </div>
                    </div>
                    <MoneyText value={sale.total} className="text-base text-primary font-bold" />
                  </Card>
                ))}
              </div>
            )}
          </section>
        </>
      ) : (
        <section className="text-left animate-fade-in flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h3 className="font-headline-sm text-primary font-bold">Historique des Tickets</h3>
            <p className="text-xs text-outline font-semibold">Toutes les ventes enregistrées dans cette session.</p>
          </div>
          {todaySales.length === 0 ? (
            <p className="text-sm text-outline text-center py-12 bg-white rounded-2xl border border-outline-variant">Aucun ticket enregistré aujourd'hui.</p>
          ) : (
            <div className="flex flex-col gap-3 animate-fade-in">
              {todaySales.map((sale) => (
                <Card
                  key={sale.id}
                  onClick={() => {
                    setSelectedSaleId(sale.id);
                    setIsSaleDetailOpen(true);
                  }}
                  className="flex justify-between items-center p-4 hover:shadow-md hover:border-primary/20 active:scale-[0.99] transition-all gap-3 cursor-pointer border-outline-variant/60"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-primary-container p-2.5 rounded-xl text-primary">
                      <span className="material-symbols-outlined text-2xl">receipt_long</span>
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-bold text-on-surface">Ticket #{sale.id.slice(0, 8).toUpperCase()}</span>
                      <span className="text-[10px] text-outline font-semibold mt-0.5">
                        {new Date(sale.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} à {new Date(sale.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <MoneyText value={sale.total} className="text-base text-primary font-bold" />
                    <span className="text-[9px] text-outline font-bold uppercase">caissier: {sale.caissier_id.slice(0, 8).toUpperCase()}</span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Floating Island Cart Trigger */}
      {cart.length > 0 && activeSubTab === 'vente' && (
        <div className="fixed bottom-22 left-0 w-full px-4 z-40 animate-pulse-subtle">
          <div className="bg-primary text-on-primary rounded-2xl p-4 premium-shadow-lg flex items-center justify-between border border-white/10 max-w-md mx-auto">
            <div className="flex items-center gap-4">
              <div className="relative bg-white/10 p-2.5 rounded-xl">
                <span className="material-symbols-outlined text-2xl text-white">shopping_cart</span>
                <span className="absolute -top-1.5 -right-1.5 bg-secondary text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-primary">
                  {cart.reduce((s, i) => s + i.quantite, 0)}
                </span>
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[10px] opacity-70 font-semibold uppercase tracking-wider">Panier</span>
                <MoneyText value={cartTotal} className="text-white text-lg font-bold" />
              </div>
            </div>
            <button
              onClick={() => setIsCartOpen(true)}
              className="bg-secondary hover:bg-secondary/90 text-white px-5 h-11 rounded-xl font-bold text-sm active:scale-95 transition-all shadow-sm"
            >
              ENCAISSER
            </button>
          </div>
        </div>
      )}

      {/* Cart Bottom Sheet */}
      <BottomSheet
        isOpen={isCartOpen}
        onClose={() => {
          setIsCartOpen(false);
          setClientNom('');
          setSelectedArdoiseId(null);
          setShowClientSuggestions(false);
        }}
        title="Détails de l'encaissement"
      >
        <div className="flex flex-col gap-3 text-left">
          {/* Cart Items List — scroll uniquement si > 3 articles */}
          <div className="flex flex-col gap-2 max-h-[34svh] overflow-y-auto custom-scrollbar pr-1">
            {cart.map((item) => {
              const itemStyle = getProductIconAndGradient(item.nom);
              return (
                <div 
                  key={item.produitId} 
                  className="flex justify-between items-center bg-primary-container/20 border border-primary-container/60 p-2 rounded-xl transition-all hover:bg-primary-container/30"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${itemStyle.bg} flex items-center justify-center flex-shrink-0 relative shadow-sm border border-outline-variant/30`}>
                      <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
                      <span className="text-base select-none">{itemStyle.emoji}</span>
                    </div>
                    <div className="flex flex-col text-left gap-0.5 min-w-0 flex-1">
                      <span className="font-extrabold text-on-surface text-xs truncate">{item.nom}</span>
                      <div className="flex items-center gap-1.5">
                        <MoneyText value={item.prix} className="text-[10px] text-texte-2 font-bold" />
                        <span className="text-[10px] text-outline">•</span>
                        <span className="text-[10px] text-outline font-semibold truncate">Total : {new Intl.NumberFormat('fr-FR').format(item.prix * item.quantite)} FCFA</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="flex items-center bg-white border border-outline-variant rounded-lg p-0.5 shadow-sm">
                      <button 
                        onClick={() => updateQuantity(item.produitId, -1)} 
                        className="w-6 h-6 rounded flex items-center justify-center font-black text-texte-2 hover:bg-surface-container active:scale-90 transition-all cursor-pointer text-xs"
                      >
                        -
                      </button>
                      <span className="font-extrabold w-5 text-center text-xs text-on-surface">{item.quantite}</span>
                      <button 
                        onClick={() => updateQuantity(item.produitId, 1)} 
                        className="w-6 h-6 rounded flex items-center justify-center font-black text-texte-2 hover:bg-surface-container active:scale-90 transition-all cursor-pointer text-xs"
                      >
                        +
                      </button>
                    </div>
                    <button 
                      onClick={() => removeItem(item.produitId)} 
                      className="material-symbols-outlined text-error/80 hover:text-error hover:bg-error-container/60 p-1 rounded-lg transition-all cursor-pointer text-base"
                      title="Supprimer du panier"
                    >
                      delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Premium Total Card */}
          <div className="bg-gradient-to-r from-primary to-primary/90 text-on-primary rounded-xl p-2.5 flex justify-between items-center premium-shadow-sm border border-white/5">
            <div className="flex flex-col text-left">
              <span className="text-[9px] opacity-75 font-bold uppercase tracking-widest leading-none">Montant Total</span>
              <span className="text-[10px] opacity-90 font-semibold mt-0.5">{cart.reduce((s, i) => s + i.quantite, 0)} article(s) au panier</span>
            </div>
            <MoneyText value={cartTotal} className="text-white font-black text-lg tracking-tight" />
          </div>

          {/* Payment Input & Quick Bills */}
          <div className="flex flex-col gap-2">
            <div className="relative">
              <Input
                label="Montant Reçu (FCFA)"
                type="number"
                value={amountReceived}
                onChange={(e) => setAmountReceived(e.target.value)}
                placeholder="Saisir la somme reçue..."
                className="pr-16 text-base font-bold text-primary h-11"
              />
              {amountReceived && (
                <button 
                  onClick={() => setAmountReceived('')}
                  className="absolute right-3 bottom-2 material-symbols-outlined text-outline hover:text-on-surface p-1 rounded-full hover:bg-surface-container transition-all text-sm"
                >
                  clear
                </button>
              )}
            </div>

            {/* Quick Suggestions for Senegal (Dakar Bills) */}
            <div className="flex flex-col gap-1">
              <span className="text-[9px] text-outline font-bold uppercase tracking-wider">Billets courants</span>
              <div className="grid grid-cols-4 gap-1.5">
                {[1000, 2000, 5000, 10000].map((bill) => (
                  <button
                    key={bill}
                    type="button"
                    onClick={() => setAmountReceived(bill.toString())}
                    className={`h-8 border text-[10px] font-extrabold rounded-lg transition-all cursor-pointer flex items-center justify-center ${
                      Number(amountReceived) === bill 
                        ? 'bg-secondary border-secondary text-white shadow-sm scale-95' 
                        : 'border-outline-variant bg-white text-texte-2 hover:border-primary/30 hover:bg-primary-container/20'
                    }`}
                  >
                    {new Intl.NumberFormat('fr-FR').format(bill)}
                  </button>
                ))}
              </div>
            </div>

            {/* Change Due Feedbacks */}
            {amountReceived && (
              <div className="animate-fade-in">
                {changeDue >= 0 ? (
                  <div className="flex justify-between items-center bg-secondary-container/60 border border-secondary-container p-2 rounded-xl">
                    <div className="flex items-center gap-1.5 text-secondary">
                      <span className="material-symbols-outlined text-lg animate-pulse">payments</span>
                      <span className="text-[10px] font-extrabold uppercase tracking-wide">Rendu Monnaie :</span>
                    </div>
                    <span className="font-black text-secondary text-sm">
                      {new Intl.NumberFormat('fr-FR').format(changeDue)} FCFA
                    </span>
                  </div>
                ) : (
                  <div className="flex justify-between items-center bg-error-container/60 border border-error-container p-2 rounded-xl">
                    <div className="flex items-center gap-1.5 text-error">
                      <span className="material-symbols-outlined text-lg">warning</span>
                      <span className="text-[10px] font-extrabold uppercase tracking-wide">Reste à payer :</span>
                    </div>
                    <span className="font-black text-error text-sm">
                      {new Intl.NumberFormat('fr-FR').format(Math.abs(changeDue))} FCFA
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Client Input for credit / debt */}
            {amountReceived && changeDue < 0 && (
              <div className="flex flex-col gap-2 p-3 bg-error-container/10 border border-error-container/20 rounded-xl animate-fade-in relative">
                <span className="text-[10px] font-bold text-error uppercase tracking-wider">Vente à crédit : Client requis</span>
                <div className="relative">
                  <Input
                    label="Nom & Prénom du Client"
                    type="text"
                    value={clientNom}
                    onChange={(e) => {
                      setClientNom(e.target.value);
                      setSelectedArdoiseId(null);
                      setShowClientSuggestions(true);
                    }}
                    onFocus={() => setShowClientSuggestions(true)}
                    onBlur={() => {
                      // Slight timeout to let the onClick on suggestions register
                      setTimeout(() => setShowClientSuggestions(false), 200);
                    }}
                    placeholder="Saisir ou sélectionner un client..."
                    className="pr-10 text-xs font-bold h-10"
                  />
                  {clientNom && (
                    <button 
                      type="button"
                      onClick={() => {
                        setClientNom('');
                        setSelectedArdoiseId(null);
                      }}
                      className="absolute right-3 bottom-1.5 material-symbols-outlined text-outline hover:text-on-surface p-1 rounded-full hover:bg-surface-container transition-all text-xs"
                    >
                      clear
                    </button>
                  )}
                </div>

                {/* Client Suggestions Dropdown */}
                {showClientSuggestions && clientNom.trim().length > 0 && (
                  (() => {
                    const filtered = ardoises.filter(a => 
                      a.client_nom.toLowerCase().includes(clientNom.toLowerCase())
                    );
                    if (filtered.length === 0) return null;
                    return (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-outline-variant rounded-xl shadow-lg z-50 max-h-36 overflow-y-auto">
                        {filtered.map(a => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => {
                              setClientNom(a.client_nom);
                              setSelectedArdoiseId(a.id);
                              setShowClientSuggestions(false);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-primary-container/20 text-[10px] font-bold text-on-surface border-b border-outline-variant/30 last:border-b-0 flex justify-between items-center"
                          >
                            <span>{a.client_nom}</span>
                            <span className="text-[8px] text-outline font-normal">
                              Compte existant
                            </span>
                          </button>
                        ))}
                      </div>
                    );
                  })()
                )}
              </div>
            )}
          </div>

          {/* Validation Action Button */}
          <Button
            onClick={() => validateAndCheckout(boutiqueId, caissierId, clientNom, selectedArdoiseId || undefined)}
            disabled={!amountReceived || (changeDue < 0 && !clientNom.trim())}
            className="w-full h-11 rounded-xl flex items-center justify-center gap-1.5 font-black tracking-wider text-xs transition-all premium-shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-md active:scale-98"
          >
            <span className="material-symbols-outlined text-sm">check_circle</span>
            VALIDER LA VENTE
          </Button>
        </div>
      </BottomSheet>

      {/* Sale Detail Bottom Sheet */}
      <BottomSheet
        isOpen={isSaleDetailOpen}
        onClose={() => {
          setIsSaleDetailOpen(false);
          setSelectedSaleId(null);
        }}
        title={selectedSale ? `Ticket #${selectedSale.id.slice(0, 8).toUpperCase()}` : ''}
      >
        {selectedSale && (
          <div className="flex flex-col gap-4 text-left">
            <div className="flex justify-between items-center bg-primary-container/20 border border-primary-container/60 p-3 rounded-xl">
              <div className="flex flex-col text-left">
                <span className="text-[10px] text-outline font-bold uppercase tracking-wider">Date & Heure</span>
                <span className="text-xs font-bold text-on-surface">
                  {new Date(selectedSale.created_at).toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                  })} à {new Date(selectedSale.created_at).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
              <div className="flex flex-col text-right">
                <span className="text-[10px] text-outline font-bold uppercase tracking-wider">Caissier</span>
                <span className="text-xs font-bold text-on-surface">{selectedSale.caissier_id.slice(0, 8).toUpperCase()}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs text-outline font-extrabold uppercase tracking-wider">Articles vendus</span>
              <div className="flex flex-col gap-2 max-h-[30svh] overflow-y-auto pr-1">
                {selectedSaleItems.map((item) => {
                  const style = getProductIconAndGradient(item.nom);
                  return (
                    <div
                      key={item.id}
                      className="flex justify-between items-center bg-white border border-outline-variant/60 p-2.5 rounded-xl"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${style.bg} flex items-center justify-center flex-shrink-0 relative shadow-sm border border-outline-variant/30`}>
                          <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
                          <span className="text-base select-none">{style.emoji}</span>
                        </div>
                        <div className="flex flex-col text-left min-w-0 flex-1">
                          <span className="font-extrabold text-on-surface text-xs truncate">{item.nom}</span>
                          <span className="text-[10px] text-outline font-bold">
                            {item.quantite} x {new Intl.NumberFormat('fr-FR').format(item.prix_unitaire)} FCFA
                          </span>
                        </div>
                      </div>
                      <MoneyText value={item.prix_unitaire * item.quantite} className="text-xs font-black text-on-surface flex-shrink-0" />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-gradient-to-r from-primary to-primary/90 text-on-primary rounded-xl p-3 flex justify-between items-center premium-shadow-sm border border-white/5 mt-2">
              <span className="text-xs font-bold uppercase tracking-wider">Total Ticket</span>
              <MoneyText value={selectedSale.total} className="text-white font-black text-base" />
            </div>

            <Button
              onClick={() => setIsSaleDetailOpen(false)}
              className="w-full h-11 rounded-xl font-bold text-xs mt-1"
            >
              FERMER
            </Button>
          </div>
        )}
      </BottomSheet>
    </div>
  );
};
export default Caisse;
