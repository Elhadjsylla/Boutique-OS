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

const SEED_PRODUCTS = [
  { id: '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed', boutique_id: 'boutique-1', nom: 'Huile de Palme', prix: 2500, quantite: 15, seuil_alerte: 5, archive: 0, updated_at: new Date().toISOString() },
  { id: '2b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bee', boutique_id: 'boutique-1', nom: 'Riz Long Grain 5kg', prix: 6750, quantite: 3, seuil_alerte: 4, archive: 0, updated_at: new Date().toISOString() },
  { id: '3b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bef', boutique_id: 'boutique-1', nom: 'Eau Minérale 1.5L', prix: 500, quantite: 24, seuil_alerte: 10, archive: 0, updated_at: new Date().toISOString() },
  { id: '4b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bf0', boutique_id: 'boutique-1', nom: 'Savon Corporel', prix: 1200, quantite: 0, seuil_alerte: 5, archive: 0, updated_at: new Date().toISOString() },
];

const getProductCardStyle = (name: string) => {
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const styles = [
    { bg: 'from-blue-500/10 to-indigo-500/10 text-primary', icon: 'shopping_bag' },
    { bg: 'from-emerald-500/10 to-teal-500/10 text-secondary', icon: 'restaurant_menu' },
    { bg: 'from-amber-500/10 to-orange-500/10 text-tertiary', icon: 'storefront' },
    { bg: 'from-purple-500/10 to-pink-500/10 text-purple-700', icon: 'category' },
  ];
  return styles[hash % styles.length];
};

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
          const cardStyle = getProductCardStyle(p.nom);
          
          return (
            <div
              key={p.id}
              onClick={() => !isOutOfStock && addToCart(p.id, p.nom, p.prix, p.quantite)}
              className={`bg-white rounded-2xl border border-outline-variant premium-shadow-sm flex flex-col overflow-hidden relative transition-all duration-200 ${
                isOutOfStock ? 'opacity-40 cursor-not-allowed' : 'active:scale-95 hover:scale-[1.02] cursor-pointer hover:border-primary/30 hover:shadow-md'
              }`}
            >
              <div className={`h-24 bg-gradient-to-br ${cardStyle.bg} flex items-center justify-center`}>
                <span className="material-symbols-outlined text-4xl">{cardStyle.icon}</span>
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
                <div className="mt-auto flex justify-between items-baseline pt-1">
                  <MoneyText value={p.prix} className="text-base text-primary font-bold" />
                  <span className="text-[10px] text-outline font-bold">Stock: {p.quantite}</span>
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
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
            {cart.map((item) => (
              <div key={item.produitId} className="flex justify-between items-center bg-surface-container/30 p-2.5 rounded-xl border border-outline-variant">
                <div className="flex flex-col text-left">
                  <span className="font-bold text-on-surface text-sm">{item.nom}</span>
                  <MoneyText value={item.prix} className="text-xs text-outline font-semibold" />
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateQuantity(item.produitId, -1)} className="w-8 h-8 rounded-full border border-border flex items-center justify-center font-bold hover:bg-surface-container active:scale-90 transition-all">-</button>
                  <span className="font-bold w-5 text-center text-sm">{item.quantite}</span>
                  <button onClick={() => updateQuantity(item.produitId, 1)} className="w-8 h-8 rounded-full border border-border flex items-center justify-center font-bold hover:bg-surface-container active:scale-90 transition-all">+</button>
                  <button onClick={() => removeItem(item.produitId)} className="material-symbols-outlined text-error/85 hover:text-error ml-2 p-1 rounded-full hover:bg-error-container">close</button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between font-bold text-lg border-t border-border pt-4">
            <span>TOTAL À PAYER :</span>
            <MoneyText value={cartTotal} className="text-primary font-extrabold text-xl" />
          </div>

          <div className="flex flex-col gap-1 mt-2 text-left">
            <Input
              label="Montant Reçu (FCFA)"
              type="number"
              value={amountReceived}
              onChange={(e) => setAmountReceived(e.target.value)}
              placeholder="Saisir la somme reçue..."
            />
            {amountReceived && (
              <div className="flex justify-between items-center mt-2 bg-surface-container/40 p-2.5 rounded-xl">
                <span className="text-xs font-bold text-outline">Rendu monnaie :</span>
                <span className={`font-extrabold text-base ${changeDue >= 0 ? 'text-secondary' : 'text-error'}`}>
                  {changeDue >= 0 ? `${new Intl.NumberFormat('fr-FR').format(changeDue)} FCFA` : `Reste ${new Intl.NumberFormat('fr-FR').format(Math.abs(changeDue))} FCFA`}
                </span>
              </div>
            )}
          </div>

          <Button
            onClick={() => validateAndCheckout(boutiqueId, caissierId)}
            disabled={!amountReceived || changeDue < 0}
            className="w-full mt-2"
          >
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
