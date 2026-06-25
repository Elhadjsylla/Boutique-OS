import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { PLAN_CONFIG, type PlanType, type PaymentMethod } from '../hooks/useSubscription';

interface AbonnementProps {
  onSuccess?: () => void;
  onLogout?: () => void;
}

type Step = 'plans' | 'payment' | 'waiting' | 'success';

const PAYMENT_ICONS: Record<PaymentMethod, string> = {
  wave:         'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%231A73E8"/><text y=".9em" font-size="60" x="10" fill="white">W</text></svg>',
  orange_money: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%23FF6600"/><text y=".9em" font-size="60" x="10" fill="white">O</text></svg>',
};

export const Abonnement: React.FC<AbonnementProps> = ({ onSuccess, onLogout }) => {
  const [step, setStep]               = useState<Step>('plans');
  const [selectedPlan, setSelectedPlan] = useState<PlanType | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('wave');
  const [phone, setPhone]             = useState('');
  const [isLoading, setIsLoading]     = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [paymentUrl, setPaymentUrl]   = useState<string | null>(null);

  const handleSelectPlan = (plan: PlanType) => {
    setSelectedPlan(plan);
    setStep('payment');
  };

  const handleInitiatePayment = async () => {
    if (!selectedPlan || !phone.trim()) return;
    setIsLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Non connecté');

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/initiate-payment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            plan:           selectedPlan,
            payment_method: paymentMethod,
            phone:          phone.trim(),
          }),
        },
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erreur de paiement');

      if (data.payment_url) {
        setPaymentUrl(data.payment_url);
        window.open(data.payment_url, '_blank');
      }
      setStep('waiting');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmPayment = () => {
    setStep('success');
    setTimeout(() => onSuccess?.(), 2000);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-start pt-16 pb-10 px-4 animate-fade-in">
      {/* Bouton Déconnexion */}
      {onLogout && (
        <div className="w-full max-w-sm flex justify-end mt-2 mb-2">
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-on-surface-variant border border-outline-variant rounded-xl hover:bg-surface-container-low transition-all active:scale-95"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>logout</span>
            Se déconnecter
          </button>
        </div>
      )}
      {/* Header */}
      <div className="text-center mt-8 mb-8">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center mx-auto mb-4 shadow-md">
          <span className="material-symbols-outlined text-white" style={{ fontSize: '28px' }}>storefront</span>
        </div>
        <h1 className="font-headline-lg text-on-surface">Choisissez votre plan</h1>
        <p className="font-body-md text-on-surface-variant mt-1">Accédez à toutes les fonctionnalités de Sama Boutik</p>
      </div>

      {/* ÉTAPE 1 — Plans */}
      {step === 'plans' && (
        <div className="w-full max-w-sm flex flex-col gap-4">
          {(Object.entries(PLAN_CONFIG) as [PlanType, typeof PLAN_CONFIG[PlanType]][]).map(([key, config]) => (
            <button
              key={key}
              onClick={() => handleSelectPlan(key)}
              className={`w-full text-left bg-white border-2 rounded-2xl p-5 transition-all active:scale-95 shadow-sm hover:shadow-md ${
                key === 'annual' ? 'border-secondary' : 'border-outline-variant hover:border-primary'
              }`}
            >
              {key === 'annual' && (
                <span className="inline-block bg-secondary text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full mb-3">
                  Meilleure offre
                </span>
              )}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-headline-sm text-on-surface">{config.label}</h3>
                  <p className="text-[11px] text-outline mt-0.5">{config.duration}</p>
                </div>
                <div className="text-right">
                  <span className="font-numeric-display text-primary">{config.amount.toLocaleString('fr-FR')}</span>
                  <span className="text-xs text-outline ml-1">XOF</span>
                </div>
              </div>
              <ul className="mt-3 flex flex-col gap-1.5">
                {config.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-[12px] text-on-surface-variant">
                    <span className="material-symbols-outlined text-secondary" style={{ fontSize: '14px' }}>check_circle</span>
                    {f}
                  </li>
                ))}
              </ul>
            </button>
          ))}
        </div>
      )}

      {/* ÉTAPE 2 — Moyen de paiement & numéro */}
      {step === 'payment' && selectedPlan && (
        <div className="w-full max-w-sm flex flex-col gap-5">
          {/* Récap plan */}
          <div className="bg-primary-container border border-primary/20 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-primary/70">Plan sélectionné</p>
              <p className="font-headline-sm text-primary mt-0.5">{PLAN_CONFIG[selectedPlan].label}</p>
            </div>
            <div className="text-right">
              <span className="font-numeric-display text-primary">{PLAN_CONFIG[selectedPlan].amount.toLocaleString('fr-FR')}</span>
              <span className="text-xs text-primary/70 ml-1">XOF</span>
            </div>
          </div>

          {/* Choix du moyen */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant mb-3">Moyen de paiement</p>
            <div className="grid grid-cols-2 gap-3">
              {(['wave', 'orange_money'] as PaymentMethod[]).map(method => (
                <button
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  className={`h-16 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all active:scale-95 ${
                    paymentMethod === method
                      ? 'border-primary bg-primary-container'
                      : 'border-outline-variant bg-white hover:border-primary/40'
                  }`}
                >
                  <span className="text-lg font-black" style={{ color: method === 'wave' ? '#1A73E8' : '#FF6600' }}>
                    {method === 'wave' ? 'Wave' : 'Orange Money'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Numéro de téléphone */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant">
              Numéro {paymentMethod === 'wave' ? 'Wave' : 'Orange Money'}
            </label>
            <input
              type="tel"
              placeholder="7X XXX XX XX"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full h-12 px-4 bg-surface-container-low border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm font-semibold text-on-surface"
            />
          </div>

          {error && (
            <p className="text-error text-xs font-semibold bg-error-container px-4 py-2 rounded-xl">{error}</p>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep('plans')}
              className="flex-1 h-12 rounded-2xl border border-outline-variant text-on-surface-variant text-sm font-bold hover:bg-surface-container-low transition-all active:scale-95"
            >
              Retour
            </button>
            <button
              onClick={handleInitiatePayment}
              disabled={isLoading || !phone.trim()}
              className="flex-[2] h-12 rounded-2xl bg-secondary text-white text-sm font-black transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {isLoading ? 'Chargement...' : 'Payer maintenant'}
            </button>
          </div>
        </div>
      )}

      {/* ÉTAPE 3 — En attente de confirmation */}
      {step === 'waiting' && (
        <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center mt-4">
          <div className="w-20 h-20 rounded-full bg-secondary-container flex items-center justify-center animate-pulse">
            <span className="material-symbols-outlined text-secondary" style={{ fontSize: '40px' }}>
              {paymentMethod === 'wave' ? 'waves' : 'smartphone'}
            </span>
          </div>
          <div>
            <h2 className="font-headline-sm text-on-surface">Paiement en cours...</h2>
            <p className="font-body-md text-on-surface-variant mt-2">
              Complétez le paiement sur votre application{' '}
              <strong>{paymentMethod === 'wave' ? 'Wave' : 'Orange Money'}</strong>.
              <br />Une fois payé, appuyez sur "Confirmer".
            </p>
          </div>
          {paymentUrl && (
            <a
              href={paymentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full h-12 rounded-2xl bg-primary text-white text-sm font-black flex items-center justify-center gap-2 shadow-sm"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>open_in_new</span>
              Ouvrir le lien de paiement
            </a>
          )}
          <button
            onClick={handleConfirmPayment}
            className="w-full h-12 rounded-2xl bg-secondary text-white text-sm font-black active:scale-95 transition-all shadow-sm"
          >
            J'ai payé — Confirmer
          </button>
          <button
            onClick={() => setStep('plans')}
            className="text-sm text-outline underline underline-offset-2"
          >
            Annuler
          </button>
        </div>
      )}

      {/* ÉTAPE 4 — Succès */}
      {step === 'success' && (
        <div className="w-full max-w-sm flex flex-col items-center gap-4 text-center mt-4 animate-scale-in">
          <div className="w-20 h-20 rounded-full bg-secondary-container flex items-center justify-center">
            <span className="material-symbols-outlined text-secondary" style={{ fontSize: '44px' }}>check_circle</span>
          </div>
          <h2 className="font-headline-sm text-on-surface">Abonnement activé !</h2>
          <p className="font-body-md text-on-surface-variant">
            Bienvenue dans Sama Boutik. Votre boutique est prête.
          </p>
        </div>
      )}
    </div>
  );
};

export default Abonnement;
