import React, { useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Toast } from '../components/ui/Toast';

const WaveIcon = () => (
  <svg viewBox="0 0 100 100" className="w-5 h-5 mr-1.5" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#1CC5F4"/>
    <path d="M50 15 C30 15 22 35 22 65 C22 85 32 85 40 85 C45 85 48 78 50 78 C52 78 55 85 60 85 C68 85 78 85 78 65 C78 35 70 15 50 15 Z" fill="#1A1A1A"/>
    <circle cx="38" cy="42" r="5" fill="#FFF"/>
    <circle cx="62" cy="42" r="5" fill="#FFF"/>
    <path d="M42 50 L58 50 L50 58 Z" fill="#FF7900"/>
    <ellipse cx="50" cy="70" rx="12" ry="15" fill="#FFF"/>
  </svg>
);

const OrangeMoneyIcon = () => (
  <svg viewBox="0 0 100 100" className="w-5 h-5 mr-1.5" xmlns="http://www.w3.org/2000/svg">
    <path d="M15,65 L45,35 L25,35 L25,10 L85,10 L85,70 L60,70 L60,45 L30,75 Z" fill="#000000"/>
    <path d="M85,35 L55,65 L75,65 L75,90 L15,90 L15,30 L40,30 L40,55 L70,25 Z" fill="#FF7900"/>
  </svg>
);

interface SubscriptionProps {
  onBack: () => void;
  currentPlan?: string;
  onUpdatePlan?: (planName: string) => void;
}

export const Subscription: React.FC<SubscriptionProps> = ({ 
  onBack, 
  currentPlan: initialPlan = 'Starter',
  onUpdatePlan 
}) => {
  const [currentPlan, setCurrentPlan] = useState(initialPlan);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [selectedPlanForPayment, setSelectedPlanForPayment] = useState<any | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [provider, setProvider] = useState<'wave' | 'orange'>('wave');
  const [isPaying, setIsPaying] = useState(false);

  const plans = [
    {
      id: 'starter',
      name: 'Plan Starter',
      price: '2 900 FCFA',
      period: 'mois',
      popular: false,
      description: 'Idéal pour démarrer et tester la gestion de votre boutique.',
      features: [
        { text: '50 produits max en stock', type: 'yes' },
        { text: '30 transactions / jour max', type: 'yes' },
        { text: '1 caissier seulement', type: 'yes' },
        { text: '10 crédits clients actifs max', type: 'yes' },
        { text: 'Pas de rapports / historique', type: 'no' },
        { text: 'Pas d\'export CSV/Excel', type: 'no' },
      ],
      color: 'from-slate-600 to-slate-800',
      actionText: 'Votre Plan Actuel'
    },
    {
      id: 'pro',
      name: 'Plan Pro',
      price: '5 900 FCFA',
      period: 'mois',
      popular: true,
      description: 'Pour les boutiques en croissance qui veulent éliminer toutes les limites.',
      features: [
        { text: 'Produits illimités', type: 'yes' },
        { text: 'Transactions illimitées', type: 'yes' },
        { text: 'Jusqu\'à 5 caissiers', type: 'yes' },
        { text: 'Crédits clients illimités', type: 'yes' },
        { text: 'Rapports & historique complet', type: 'yes' },
        { text: 'Export PDF/Excel activé', type: 'yes' },
      ],
      color: 'from-primary to-blue-700',
      actionText: 'Passer au Pro'
    },
    {
      id: 'annuel',
      name: 'Plan Annuel',
      price: '52 900 FCFA',
      period: 'an',
      popular: false,
      fomo: '🔥 Plus que 12 places au tarif de lancement — prix définitif après',
      description: 'L\'offre ultime pour économiser 25% sur l\'année complète.',
      features: [
        { text: 'Équivalent 4 408 FCFA / mois', type: 'yes' },
        { text: 'Économie de 25% par rapport au Pro', type: 'yes' },
        { text: 'Produits & ventes illimités', type: 'yes' },
        { text: 'Jusqu\'à 5 caissiers', type: 'yes' },
        { text: 'Rapports & historique complet', type: 'yes' },
        { text: 'Export PDF/Excel activé', type: 'yes' },
      ],
      color: 'from-secondary to-emerald-700',
      actionText: 'Choisir l\'Annuel'
    }
  ];

  const handleSubscribeClick = (plan: any) => {
    if (plan.id === 'starter' && currentPlan === 'Starter') {
      setToast({ message: 'Vous utilisez déjà le Plan Starter.', type: 'error' });
      return;
    }
    setSelectedPlanForPayment(plan);
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber) {
      setToast({ message: 'Veuillez saisir votre numéro de téléphone.', type: 'error' });
      return;
    }

    setIsPaying(true);

    // Simulate Payment Gateway call (Mobile Money Wave/Orange/Free)
    setTimeout(() => {
      setIsPaying(false);
      const planName = selectedPlanForPayment.name;
      setCurrentPlan(planName);
      if (onUpdatePlan) {
        onUpdatePlan(planName);
      }
      setToast({ message: `Félicitations ! Votre abonnement au ${planName} a été activé.`, type: 'success' });
      setSelectedPlanForPayment(null);
      setPhoneNumber('');

      // Play sound if possible
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc1.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
        osc1.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5
        osc1.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.3); // C6
        gain1.gain.setValueAtTime(0.15, ctx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start();
        osc1.stop(ctx.currentTime + 0.6);
      } catch (e) {}

    }, 2000);
  };

  return (
    <div className="pb-40 pt-20 px-4 max-w-6xl mx-auto flex flex-col gap-6 animate-fade-in text-left">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-outline-variant/30 pb-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="material-symbols-outlined hover:bg-surface-container p-2 rounded-full transition-all active:scale-90 text-texte cursor-pointer"
          >
            arrow_back
          </button>
          <div>
            <h1 className="font-headline-lg-mobile text-on-surface">Abonnement & Facturation</h1>
            <p className="font-body-md text-on-surface-variant">Libérez la puissance de votre boutique avec le bon forfait.</p>
          </div>
        </div>
        <div className="bg-primary-container/40 border border-primary/10 px-4 py-2.5 rounded-2xl flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-secondary animate-pulse" />
          <div className="flex flex-col text-left">
            <span className="text-[9px] uppercase tracking-wider text-outline font-black">Plan Actuel</span>
            <span className="text-xs font-black text-primary uppercase">{currentPlan}</span>
          </div>
        </div>
      </div>

      {/* Main Pricing Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4 items-stretch">
        {plans.map((plan) => {
          const isActive = currentPlan.toLowerCase().includes(plan.id);
          return (
            <Card 
              key={plan.id}
              elevation={plan.popular ? 2 : 1}
              className={`flex flex-col justify-between relative overflow-hidden transition-all duration-300 ${
                plan.popular 
                  ? 'border-2 border-primary shadow-lg scale-[1.02] lg:scale-[1.03]' 
                  : isActive 
                    ? 'border border-secondary/40 shadow-md bg-secondary-container/5'
                    : 'border border-outline-variant/50 hover:border-outline/40 hover:shadow-md'
              }`}
            >
              {/* Popular ribbon */}
              {plan.popular && (
                <div className="absolute top-0 right-0 bg-primary text-white text-[8px] font-black uppercase tracking-widest px-4 py-1.5 rounded-bl-xl shadow-sm">
                  Recommandé
                </div>
              )}

              {/* Top Section */}
              <div className="flex flex-col gap-4 p-4 text-left">
                {/* Plan Header */}
                <div>
                  <h3 className={`text-base font-black tracking-tight ${plan.popular ? 'text-primary' : 'text-on-surface'}`}>
                    {plan.name}
                  </h3>
                  <p className="text-[10px] text-outline mt-1 font-medium leading-relaxed">
                    {plan.description}
                  </p>
                </div>

                {/* FOMO banner */}
                {plan.fomo && (
                  <div className="bg-orange-500/10 border border-orange-500/25 p-2 rounded-xl text-center">
                    <p className="text-[10px] font-black text-orange-600 animate-pulse">
                      {plan.fomo}
                    </p>
                  </div>
                )}

                {/* Pricing Display */}
                <div className="flex items-baseline gap-1.5 border-y border-outline-variant/30 py-3">
                  <span className="text-2xl font-black text-on-surface tracking-tight">
                    {plan.price}
                  </span>
                  <span className="text-[10px] text-outline font-bold">
                    / {plan.period}
                  </span>
                </div>

                {/* Features List */}
                <div className="flex flex-col gap-2.5 pt-1">
                  {plan.features.map((feat, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span 
                        className={`material-symbols-outlined text-sm mt-0.5 ${
                          feat.type === 'yes' ? 'text-secondary' : 'text-error'
                        }`}
                        style={{ fontSize: '15px' }}
                      >
                        {feat.type === 'yes' ? 'check_circle' : 'cancel'}
                      </span>
                      <span className={`text-[11px] font-bold ${
                        feat.type === 'yes' ? 'text-texte-2' : 'text-outline line-through opacity-75'
                      }`}>
                        {feat.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Button Section */}
              <div className="p-4 pt-0 text-left">
                <button
                  onClick={() => handleSubscribeClick(plan)}
                  disabled={isActive && plan.id === 'starter'}
                  className={`w-full h-11 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-[0.98] ${
                    isActive
                      ? 'bg-secondary-container/40 border border-secondary text-secondary font-black cursor-default'
                      : plan.popular
                        ? 'bg-primary hover:bg-primary/95 text-white shadow-md'
                        : 'bg-white border border-outline hover:bg-surface-container text-texte'
                  }`}
                >
                  {isActive ? 'Plan Actif' : plan.actionText}
                </button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Trust & Guarantee Badge */}
      <Card elevation={1} className="p-4 bg-surface-container/20 border border-outline-variant/60 flex flex-col md:flex-row items-center justify-between gap-4 mt-6">
        <div className="flex items-center gap-3 text-left">
          <div className="w-10 h-10 rounded-full bg-secondary-container/55 flex items-center justify-center text-secondary">
            <span className="material-symbols-outlined text-xl">shield</span>
          </div>
          <div className="flex flex-col text-left">
            <span className="text-xs font-bold text-on-surface">Paiements Locaux 100% Sécurisés</span>
            <span className="text-[10px] text-outline">Intégration directe Wave et Orange Money sans frais cachés.</span>
          </div>
        </div>
        <div className="flex gap-2">
          {['Wave', 'Orange Money'].map((p) => (
            <span key={p} className="px-2.5 py-1 bg-white border border-outline-variant/50 rounded-lg text-[9px] font-black text-outline">
              {p}
            </span>
          ))}
        </div>
      </Card>

      {/* Simulated Mobile Money Payment Modal */}
      {selectedPlanForPayment && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-card rounded-card border border-border w-full max-w-md p-5 relative z-10 shadow-2xl animate-scale-in">
            {/* Header */}
            <div className="flex justify-between items-center mb-4 text-left">
              <div>
                <h2 className="font-headline-sm text-on-surface">Paiement Mobile Money</h2>
                <p className="text-[10px] text-outline mt-0.5">Simulateur de passerelle locale sécurisée</p>
              </div>
              <button
                onClick={() => setSelectedPlanForPayment(null)}
                className="material-symbols-outlined text-outline hover:text-on-surface w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-all cursor-pointer text-[20px]"
              >
                close
              </button>
            </div>

            {/* Content */}
            <form onSubmit={handlePaymentSubmit} className="flex flex-col gap-4 text-left">
              {/* Plan Recap */}
              <div className="bg-primary-container/20 border border-primary/10 rounded-xl p-3 flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-xs font-black text-primary">{selectedPlanForPayment.name}</span>
                  <span className="text-[10px] text-outline">Paiement récurrent</span>
                </div>
                <span className="text-base font-black text-on-surface">{selectedPlanForPayment.price}</span>
              </div>

              {/* Provider Selection */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-outline uppercase tracking-wider">Sélectionnez le réseau</span>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setProvider('wave')}
                    className={`h-12 border rounded-xl flex items-center justify-center font-black uppercase text-[11px] transition-all cursor-pointer ${
                      provider === 'wave'
                        ? 'border-[#1CC5F4] bg-[#1CC5F4]/10 text-[#1CC5F4] scale-95 ring-2 ring-[#1CC5F4]/20'
                        : 'border-outline-variant hover:border-outline bg-white text-texte-2'
                    }`}
                  >
                    <WaveIcon />
                    Wave
                  </button>
                  <button
                    type="button"
                    onClick={() => setProvider('orange')}
                    className={`h-12 border rounded-xl flex items-center justify-center font-black uppercase text-[11px] transition-all cursor-pointer ${
                      provider === 'orange'
                        ? 'border-[#FF7900] bg-[#FF7900]/10 text-[#FF7900] scale-95 ring-2 ring-[#FF7900]/20'
                        : 'border-outline-variant hover:border-outline bg-white text-texte-2'
                    }`}
                  >
                    <OrangeMoneyIcon />
                    Orange Money
                  </button>
                </div>
              </div>

              {/* Phone number Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-outline uppercase tracking-wider">Numéro de téléphone mobile</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-outline font-bold">+221</span>
                  <input
                    type="tel"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="77 000 00 00"
                    className="w-full h-11 pl-12 pr-4 bg-white border border-outline-variant rounded-xl text-xs font-bold focus:outline-none focus:border-primary placeholder:text-outline/50"
                  />
                </div>
                <span className="text-[9px] text-outline italic">Saisissez votre numéro pour initier la demande de débit USSD/OTP.</span>
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-end mt-2 pt-2 border-t border-outline-variant/30">
                <button
                  type="button"
                  onClick={() => setSelectedPlanForPayment(null)}
                  className="px-4 h-10 rounded-xl border border-outline-variant text-[10px] font-black uppercase text-texte-2 hover:bg-surface-container active:scale-95 transition-all cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isPaying}
                  className="px-5 h-10 rounded-xl bg-primary hover:bg-primary/95 text-white text-[10px] font-black uppercase active:scale-95 transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isPaying ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      TRAITEMENT...
                    </>
                  ) : (
                    `Payer ${selectedPlanForPayment.price}`
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default Subscription;
