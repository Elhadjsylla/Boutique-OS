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

export const Caisse: React.FC = () => {
  const [search, setSearch] = useState('');
  const [isCartOpen, setIsCartOpen] = useState(false);
  
  // Toast notifications
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Seed DB if empty
  useEffect(() => {
    const seed = async () => {
      const count = await db.produits.count();
      if (count === 0) {
        await db.produits.bulkAdd(SEED_PRODUCTS);
      }
    };
    seed();
  }, []);

  // Fetch products & sales using Dexie Live Query
  const products = useLiveQuery(
    () => db.produits.where('archive').equals(0).toArray(),
    []
  ) || [];

  const todaySales = useLiveQuery(
    () => {
      const today = new Date().toISOString().split('T')[0];
      return db.ventes.where('created_at').aboveOrEqual(today).reverse().toArray();
    },
    []
  ) || [];

  // Cart Management
  const handleSuccess = (change: number) => {
    setToast({
      message: `Vente enregistrée — Rendu : ${new Intl.NumberFormat('fr-FR').format(change)} FCFA`,
      type: 'success'
    });
    setIsCartOpen(false);
  };

  const handleError = (msg: string) => {
    setToast({ message: msg, type: 'error' });
  };

  const {
    cart,
    cartTotal,
    amountReceived,
    setAmountReceived,
    changeDue,
    addToCart,
    updateQuantity,
    removeItem,
    validateAndCheckout,
  } = useCart(handleSuccess, handleError);

  // Filter products by search term
  const filteredProducts = products.filter(p =>
    p.nom.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="pb-40 pt-16 px-margin-mobile max-w-lg mx-auto flex flex-col gap-md">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Search Bar */}
      <div className="relative flex items-center mt-sm">
        <span className="material-symbols-outlined absolute left-4 text-outline">search</span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-12 pr-4 h-12 bg-surface-container-lowest border-outline-variant border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all font-body-lg text-body-lg text-on-surface"
          placeholder="Rechercher un produit..."
        />
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-2 gap-md">
        {filteredProducts.map((p) => {
          const isOutOfStock = p.quantite === 0;
          const isLowStock = p.quantite <= p.seuil_alerte && !isOutOfStock;
          
          return (
            <div
              key={p.id}
              onClick={() => !isOutOfStock && addToCart(p.id, p.nom, p.prix, p.quantite)}
              className={`bg-surface-container-lowest rounded-xl border border-outline-variant product-card-shadow flex flex-col overflow-hidden relative transition-transform duration-150 ${
                isOutOfStock ? 'opacity-40 cursor-not-allowed' : 'active:scale-95 cursor-pointer'
              }`}
            >
              <div className="h-28 bg-surface-container flex items-center justify-center text-outline">
                <span className="material-symbols-outlined text-4xl">image</span>
              </div>
              <div className="p-sm flex flex-col flex-grow text-left">
                <div className="flex justify-between items-start mb-1 gap-1">
                  <h3 className="font-headline-sm text-on-surface leading-tight truncate flex-1">{p.nom}</h3>
                  {isOutOfStock ? (
                    <Badge variant="danger">Rupture</Badge>
                  ) : isLowStock ? (
                    <Badge variant="warning">Bas</Badge>
                  ) : (
                    <Badge variant="success">OK</Badge>
                  )}
                </div>
                <div className="mt-auto flex justify-between items-baseline">
                  <MoneyText value={p.prix} className="text-base text-primary font-bold" />
                  <span className="text-[10px] text-outline-variant font-bold">Qty: {p.quantite}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Cart Floating Trigger */}
      {cart.length > 0 && (
        <div className="fixed bottom-20 left-0 w-full px-margin-mobile z-40">
          <div className="bg-primary text-on-primary rounded-2xl p-4 cart-shadow flex items-center justify-between border border-on-primary/10 max-w-lg mx-auto">
            <div className="flex items-center gap-md">
              <div className="relative">
                <span className="material-symbols-outlined text-3xl">shopping_cart</span>
                <span className="absolute -top-2 -right-2 bg-secondary-fixed text-on-secondary-fixed text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {cart.reduce((s, i) => s + i.quantite, 0)}
                </span>
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs opacity-80 font-medium">Panier</span>
                <MoneyText value={cartTotal} className="text-white font-bold" />
              </div>
            </div>
            <button
              onClick={() => setIsCartOpen(true)}
              className="bg-secondary text-white px-6 h-10 rounded-xl font-bold text-sm active:scale-95 transition-transform"
            >
              ENCAISSER
            </button>
          </div>
        </div>
      )}

      {/* Cart Bottom Sheet */}
      <BottomSheet
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        title="Détails de l'encaissement"
      >
        <div className="flex flex-col gap-md">
          {/* Cart items list */}
          <div className="flex flex-col gap-sm max-h-40 overflow-y-auto">
            {cart.map((item) => (
              <div key={item.produitId} className="flex justify-between items-center border-b border-border pb-sm">
                <div className="flex flex-col text-left">
                  <span className="font-semibold text-on-surface">{item.nom}</span>
                  <MoneyText value={item.prix} className="text-xs text-outline" />
                </div>
                <div className="flex items-center gap-sm">
                  <button
                    onClick={() => updateQuantity(item.produitId, -1)}
                    className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-on-surface hover:bg-surface-container-low"
                  >
                    -
                  </button>
                  <span className="font-bold w-6 text-center">{item.quantite}</span>
                  <button
                    onClick={() => updateQuantity(item.produitId, 1)}
                    className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-on-surface hover:bg-surface-container-low"
                  >
                    +
                  </button>
                  <button
                    onClick={() => removeItem(item.produitId)}
                    className="material-symbols-outlined text-error hover:opacity-85 ml-md"
                  >
                    close
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between font-bold text-lg border-t border-border pt-sm">
            <span>TOTAL :</span>
            <MoneyText value={cartTotal} className="text-primary font-bold" />
          </div>

          {/* Money input */}
          <div className="flex flex-col gap-xs mt-sm text-left">
            <Input
              label="Montant Reçu (FCFA)"
              type="number"
              value={amountReceived}
              onChange={(e) => setAmountReceived(e.target.value)}
              placeholder="Saisir la somme reçue..."
            />
            {amountReceived && (
              <div className="flex justify-between items-center mt-xs">
                <span className="text-xs font-semibold">Rendu monnaie :</span>
                <span className={`font-bold ${changeDue >= 0 ? 'text-secondary' : 'text-error'}`}>
                  {changeDue >= 0 ? (
                    `+ ${new Intl.NumberFormat('fr-FR').format(changeDue)} FCFA`
                  ) : (
                    `Reste ${new Intl.NumberFormat('fr-FR').format(Math.abs(changeDue))} FCFA`
                  )}
                </span>
              </div>
            )}
          </div>

          {/* Checkout Button */}
          <Button
            onClick={() => validateAndCheckout('boutique-1', 'caissier-1')}
            disabled={!amountReceived || changeDue < 0}
            className="w-full mt-md"
          >
            VALIDER LA VENTE
          </Button>
        </div>
      </BottomSheet>

      {/* Today's Sales History */}
      <section className="text-left mt-lg">
        <h3 className="font-headline-sm border-b border-border pb-xs mb-sm">Ventes du Jour</h3>
        {todaySales.length === 0 ? (
          <p className="text-sm text-outline">Aucune vente enregistrée aujourd'hui.</p>
        ) : (
          <div className="flex flex-col gap-sm">
            {todaySales.map((sale) => (
              <Card key={sale.id} className="flex justify-between items-center p-sm">
                <div className="flex flex-col">
                  <span className="text-xs text-outline">{new Date(sale.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="text-xs font-semibold text-on-surface-variant">ID: {sale.id.slice(0, 8)}</span>
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
