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

  const {
    cart, cartTotal, amountReceived, setAmountReceived, changeDue,
    addToCart, updateQuantity, removeItem, validateAndCheckout
  } = useCart(
    (change) => {
      setToast({ message: `Vente validée. Rendu : ${new Intl.NumberFormat('fr-FR').format(change)} FCFA`, type: 'success' });
      setIsCartOpen(false);
    },
    (msg) => setToast({ message: msg, type: 'error' })
  );

  const filteredProducts = products.filter(p => p.nom.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="pb-40 pt-20 px-4 max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto flex flex-col gap-6 animate-fade-in">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

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

      {/* Floating Island Cart Trigger */}
      {cart.length > 0 && (
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
      <BottomSheet isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} title="Détails de l'encaissement">
        <div className="flex flex-col gap-3 text-left">
          {/* Cart Items List — scroll uniquement si > 3 articles */}
          <div className="flex flex-col gap-2 max-h-[34svh] overflow-y-auto custom-scrollbar pr-1">
            {cart.map((item) => (
              <div 
                key={item.produitId} 
                className="flex justify-between items-center bg-primary-container/20 border border-primary-container/60 p-2 rounded-xl transition-all hover:bg-primary-container/30"
              >
                <div className="flex flex-col text-left gap-0.5 min-w-0 flex-1">
                  <span className="font-extrabold text-on-surface text-xs truncate">{item.nom}</span>
                  <div className="flex items-center gap-1.5">
                    <MoneyText value={item.prix} className="text-[10px] text-texte-2 font-bold" />
                    <span className="text-[10px] text-outline">•</span>
                    <span className="text-[10px] text-outline font-semibold truncate">Total : {new Intl.NumberFormat('fr-FR').format(item.prix * item.quantite)} FCFA</span>
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
            ))}
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
          </div>

          {/* Validation Action Button */}
          <Button
            onClick={() => validateAndCheckout(boutiqueId, caissierId)}
            disabled={!amountReceived || changeDue < 0}
            className="w-full h-11 rounded-xl flex items-center justify-center gap-1.5 font-black tracking-wider text-xs transition-all premium-shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-md active:scale-98"
          >
            <span className="material-symbols-outlined text-sm">check_circle</span>
            VALIDER LA VENTE
          </Button>
        </div>
      </BottomSheet>

      {/* Sales History */}
      <section className="text-left mt-4">
        <h3 className="font-headline-sm border-b border-border pb-2 mb-4 text-primary font-bold">Ventes du Jour</h3>
        {todaySales.length === 0 ? (
          <p className="text-sm text-outline text-center py-6 bg-white rounded-2xl border border-outline-variant">Aucune vente enregistrée aujourd'hui.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {todaySales.map((sale) => (
              <Card key={sale.id} className="flex justify-between items-center p-3.5 hover:shadow-md transition-all">
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
    </div>
  );
};
export default Caisse;
