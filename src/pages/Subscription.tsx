import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Toast } from '../components/ui/Toast';
import { supabase } from '../lib/supabase';
import { PLAN_CONFIG } from '../hooks/useSubscription';
import { useAuthStore } from '../store/useAuthStore';
import { usePaymentPolling } from '../hooks/usePaymentPolling';

// ⚠️ PRODUCTION: remplacer par le vrai numéro WhatsApp avant le lancement
const WHATSAPP_SUPPORT = '221700000000';

interface SubscriptionProps {
  onBack: () => void;
  currentPlan?: string;
  onUpdatePlan?: (planName: string) => void;
}

export const Subscription: React.FC<SubscriptionProps> = ({ 
  onBack, 
  currentPlan = 'Starter'
}) => {
  const user = useAuthStore(state => state.user);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [selectedPlanForPayment, setSelectedPlanForPayment] = useState<any | null>(null);
  const [phoneNumber, setPhoneNumber] = useState(user?.user_metadata?.phone || '');
  const [provider, setProvider] = useState<'wave' | 'orange'>('wave');
  const [isPaying, setIsPaying] = useState(false);
  const [paymentData, setPaymentData] = useState<{ payment_url?: string; deep_links?: { MAXIT?: string; OM?: string }, subscription_id?: string } | null>(null);

  // Saved Payment Methods State
  const [savedMethods, setSavedMethods] = useState<any[]>([]);
  const [defaultMethods, setDefaultMethods] = useState<any>({});
  const [selectedSavedPhone, setSelectedSavedPhone] = useState<string>('');
  const [isCustomPhone, setIsCustomPhone] = useState(false);

  const fetchPaymentMethods = async () => {
    try {
      const { data: defaults, error: defErr } = await supabase.rpc('get_default_payment_method');
      if (defErr) throw defErr;
      if (defaults) setDefaultMethods(defaults);

      const { data: list, error: listErr } = await supabase
        .from('payment_methods')
        .select('*')
        .order('last_used_at', { ascending: false });
      if (listErr) throw listErr;
      if (list) setSavedMethods(list);
    } catch (err) {
      console.error('[Subscription] Erreur chargement payment methods:', err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchPaymentMethods();
    }
  }, [user]);

  // Sync selection and prefill based on provider changes
  useEffect(() => {
    const dbProvider = provider === 'orange' ? 'orange_money' : 'wave';
    const defaultForProvider = defaultMethods[dbProvider]?.phone_number;
    const providerSaved = savedMethods.filter(m => m.provider === dbProvider);
    
    if (providerSaved.length > 1) {
      const mostRecent = providerSaved[0].phone_number;
      setSelectedSavedPhone(mostRecent);
      setIsCustomPhone(false);
      setPhoneNumber(mostRecent);
    } else if (defaultForProvider) {
      setPhoneNumber(defaultForProvider);
      setSelectedSavedPhone(defaultForProvider);
      setIsCustomPhone(false);
    } else {
      setPhoneNumber(user?.user_metadata?.phone || '');
      setSelectedSavedPhone('');
      setIsCustomPhone(true);
    }
  }, [provider, defaultMethods, savedMethods]);

  usePaymentPolling(
    paymentData?.subscription_id || null,
    (status) => {
      if (status === 'active') {
        fetchPaymentMethods();
        setToast({ message: 'Paiement confirmé avec succès !', type: 'success' });
        setTimeout(() => window.location.reload(), 2000);
      } else if (status === 'timeout') {
        setToast({ message: "Le délai d'attente est écoulé. Si vous avez payé, l'activation sera faite sous peu.", type: 'error' });
        setPaymentData(null);
      } else {
        setToast({ message: `Le paiement a échoué ou a expiré (${status}).`, type: 'error' });
        setPaymentData(null);
      }
    }
  );

  const plans = [
    {
      id: 'starter',
      name: 'Plan Starter',
      price: `${PLAN_CONFIG.starter.amount.toLocaleString('fr-FR')} FCFA`,
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
      price: `${PLAN_CONFIG.pro.amount.toLocaleString('fr-FR')} FCFA`,
      period: 'mois',
      popular: true,
      description: 'Pour les boutiques en croissance qui veulent éliminer toutes les limites.',
      features: [
        { text: 'Produits illimités', type: 'yes' },
        { text: 'Transactions illimités', type: 'yes' },
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
      price: `${PLAN_CONFIG.annual.amount.toLocaleString('fr-FR')} FCFA`,
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

  const [trialStatus, setTrialStatus] = useState<any>(null);
  const [trialLoading, setTrialLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const { data } = await supabase.rpc('get_trial_status');
        if (data) setTrialStatus(data);
      } catch (err) {
        console.error(err);
      } finally {
        setTrialLoading(false);
      }
    };
    fetchStatus();
  }, []);

  const handleSubscribeClick = (plan: any) => {
    if (plan.id === 'starter' && currentPlan === 'Starter') {
      setToast({ message: 'Vous utilisez déjà le Plan Starter.', type: 'error' });
      return;
    }
    setSelectedPlanForPayment(plan);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber) {
      setToast({ message: 'Veuillez saisir votre numéro de téléphone.', type: 'error' });
      return;
    }

    setIsPaying(true);
    try {
      const planId = selectedPlanForPayment.id === 'annuel' ? 'annual' : selectedPlanForPayment.id;
      const cleanPhone = phoneNumber.replace(/\s+/g, '');
      
      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: {
          plan: planId,
          payment_method: provider === 'orange' ? 'orange_money' : 'wave',
          customer_number: cleanPhone
        }
      });

      if (error) throw error;

      if (data && data.success) {
        setPaymentData({
          payment_url: data.payment_url,
          deep_links: data.deep_links,
          subscription_id: data.subscription_id
        });

        const url = data.deep_links?.MAXIT || data.deep_links?.OM || data.payment_url;
        if (url) {
          window.open(url, '_blank');
        }
      } else {
        throw new Error(data?.error || 'Erreur lors de la création du paiement.');
      }
    } catch (err: any) {
      console.error(err);
      setToast({ message: err.message || 'Échec de la communication avec la passerelle.', type: 'error' });
    } finally {
      setIsPaying(false);
    }
  };

  const dbProvider = provider === 'orange' ? 'orange_money' : 'wave';
  const filteredSaved = savedMethods.filter(m => m.provider === dbProvider);

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

      {/* Free Trial Offer (First Block) */}
      {!trialLoading && !trialStatus?.has_trial && (
        <Card className="p-6 bg-gradient-to-r from-primary/10 to-secondary/15 border border-primary/20 flex flex-col md:flex-row justify-between items-center gap-6 rounded-[24px]">
          <div className="flex flex-col text-left gap-2">
            <h2 className="text-lg font-black text-primary uppercase tracking-wider flex items-center gap-2">
              <span>🎁</span> Essai Gratuit — 1 Mois
            </h2>
            <p className="text-xs font-bold text-texte-2">Accès complet sans paiement immédiat</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-1">
              <span className="text-[11px] font-bold text-texte-2 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-secondary text-sm">check_circle</span>
                30 jours offerts
              </span>
              <span className="text-[11px] font-bold text-texte-2 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-secondary text-sm">check_circle</span>
                Annulation libre pendant 7 jours
              </span>
              <span className="text-[11px] font-bold text-texte-2 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-secondary text-sm">check_circle</span>
                Aucune carte bancaire requise
              </span>
            </div>
          </div>
          <button
            onClick={async () => {
              try {
                const { error } = await supabase.rpc('start_free_trial', { p_plan: 'starter' });
                if (error) {
                  if (error.message.includes('Un abonnement ou essai existe déjà')) {
                    const { data: status } = await supabase.rpc('get_trial_status');
                    if (status) setTrialStatus(status);
                  }
                  throw error;
                }
                setToast({ message: 'Essai gratuit démarré !', type: 'success' });
                setTimeout(() => {
                  window.location.reload();
                }, 1000);
              } catch (err: any) {
                setToast({ message: err.message || 'Erreur lors du démarrage.', type: 'error' });
              }
            }}
            className="h-12 px-6 bg-primary hover:bg-primary/95 text-white text-xs font-black rounded-xl uppercase tracking-wider active:scale-95 transition-all shadow-md cursor-pointer whitespace-nowrap"
          >
            Démarrer l'essai gratuit (Starter)
          </button>
        </Card>
      )}

      {/* Paywall post-trial */}
      {trialStatus?.has_trial && trialStatus?.is_expired && (
        <Card className="p-6 bg-gradient-to-r from-red-500/10 to-transparent border border-red-500/20 flex flex-col items-center gap-4 text-center rounded-[24px]">
          <h2 className="text-lg font-black text-red-400 uppercase tracking-wider flex items-center gap-2">
            <span>⏰</span> Votre essai gratuit est terminé
          </h2>
          <p className="text-xs font-bold text-texte-2">Pour continuer, activez votre abonnement</p>
          <p className="text-xs text-outline leading-relaxed max-w-md">
            Contactez-nous pour recevoir votre lien de paiement Wave / Orange Money.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto mt-2">
            <a
              href={`https://wa.me/${WHATSAPP_SUPPORT}`}
              target="_blank"
              rel="noopener noreferrer"
              className="h-11 px-6 bg-[#25D366] hover:bg-[#20ba59] text-white text-xs font-black rounded-xl uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm"
            >
              <span className="material-symbols-outlined text-base">chat</span>
              WhatsApp
            </a>
            <a
              href="mailto:support@samaboutik.com"
              className="h-11 px-6 border border-outline hover:bg-surface-container text-texte text-xs font-black rounded-xl uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm"
            >
              <span className="material-symbols-outlined text-base">mail</span>
              Email support
            </a>
          </div>
          <div className="w-full flex items-center gap-3 my-2">
            <span className="flex-1 h-px bg-outline-variant/30" />
            <span className="text-[10px] font-black uppercase text-outline tracking-wider">ou choisissez votre formule</span>
            <span className="flex-1 h-px bg-outline-variant/30" />
          </div>
        </Card>
      )}

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

      {/* Simulated Mobile Money Payment Modal */}
      {selectedPlanForPayment && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[32px] w-full max-w-md p-7 relative z-10 shadow-2xl animate-scale-in">
            {/* Header */}
            <div className="flex justify-between items-start mb-6 text-left">
              <div>
                <h2 className="font-bold text-[22px] text-slate-900 tracking-tight leading-none">Paiement Mobile Money</h2>
                <p className="text-[13px] text-slate-500 mt-1.5">Passerelle de paiement sécurisée</p>
              </div>
              <button
                onClick={() => { setSelectedPlanForPayment(null); setPaymentData(null); }}
                className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[28px] font-light">close</span>
              </button>
            </div>

            {/* Interface Paiement en cours / Deep links */}
            {paymentData && (
              <div className="flex flex-col items-center gap-5 text-center pb-2">
                <div className="w-16 h-16 rounded-full bg-secondary-container flex items-center justify-center animate-pulse mb-2">
                  <span className="material-symbols-outlined text-secondary text-3xl">
                    {provider === 'wave' ? 'waves' : 'smartphone'}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Paiement en cours de vérification...</h3>
                  <p className="text-[13px] text-slate-500 mt-1 max-w-[280px]">
                    Veuillez valider le paiement sur l'application. Cette fenêtre se mettra à jour automatiquement.
                  </p>
                </div>

                <div className="flex flex-col gap-3 w-full mt-2">
                  {paymentData.deep_links?.MAXIT && (
                    <a
                      href={paymentData.deep_links.MAXIT}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full h-12 rounded-xl bg-orange-500 text-white text-sm font-black flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm"
                    >
                      Ouvrir l'application Max It
                    </a>
                  )}
                  {paymentData.deep_links?.OM && (
                    <a
                      href={paymentData.deep_links.OM}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full h-12 rounded-xl bg-slate-900 text-white text-sm font-black flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm"
                    >
                      Ouvrir Orange Money
                    </a>
                  )}
                  {paymentData.payment_url && (
                    <a
                      href={paymentData.payment_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full h-12 rounded-xl border-2 border-slate-200 text-slate-700 text-sm font-black flex items-center justify-center gap-2 active:scale-95 transition-all hover:bg-slate-50"
                    >
                      Ouvrir le lien Web
                    </a>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => { setSelectedPlanForPayment(null); setPaymentData(null); }}
                  className="text-xs font-bold text-slate-400 mt-2 hover:text-slate-600"
                >
                  Annuler
                </button>
              </div>
            )}

            {/* Content */}
            {!paymentData && <form onSubmit={handlePaymentSubmit} className="flex flex-col gap-7 text-left">
              {/* Plan Recap */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 flex justify-between items-center shadow-sm">
                <div className="flex flex-col">
                  <span className="text-[16px] font-bold text-slate-900">{selectedPlanForPayment.name}</span>
                  <span className="text-[13px] font-medium text-slate-400 mt-0.5">Paiement récurrent</span>
                </div>
                <span className="text-[22px] font-black text-slate-900 tracking-tight">{selectedPlanForPayment.price}</span>
              </div>

              {/* Provider Selection */}
              <div className="flex flex-col gap-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Sélectionnez le réseau</span>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setProvider('wave')}
                    className={`h-[60px] border rounded-2xl flex items-center justify-center gap-3 font-black uppercase text-[13px] transition-all cursor-pointer ${
                      provider === 'wave'
                        ? 'border-[#1CC5F4] bg-[#E8FAFF] text-[#1CC5F4]'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-600'
                    }`}
                  >
                    <img src="/wave.png" alt="Wave" className="w-6 h-6 object-contain rounded-md flex-shrink-0" />
                    <span>WAVE</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setProvider('orange')}
                    className={`h-[60px] border rounded-2xl flex items-center justify-center gap-2.5 px-2 font-black uppercase text-[11px] transition-all cursor-pointer ${
                      provider === 'orange'
                        ? 'border-[#FF7900] bg-[#FFF3E5] text-[#FF7900]'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-600'
                    }`}
                  >
                    <img src="/om.png" alt="Orange Money" className="w-6 h-6 object-contain rounded-md flex-shrink-0" />
                    <span className="flex flex-col text-left leading-tight">
                      <span>ORANGE</span>
                      <span>MONEY</span>
                    </span>
                  </button>
                </div>
              </div>

              {/* Phone number Input */}
              <div className="flex flex-col gap-3 text-left">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Numéro de téléphone mobile</label>
                
                {filteredSaved.length > 1 ? (
                  <div className="flex flex-col gap-3">
                    <div className="border border-slate-200 rounded-2xl h-[60px] flex items-center px-5 bg-white focus-within:border-slate-400 focus-within:ring-4 focus-within:ring-slate-100 transition-all shadow-sm">
                      <select
                        value={selectedSavedPhone}
                        onChange={e => {
                          const val = e.target.value;
                          setSelectedSavedPhone(val);
                          if (val === 'custom') {
                            setIsCustomPhone(true);
                            setPhoneNumber('');
                          } else {
                            setIsCustomPhone(false);
                            setPhoneNumber(val);
                          }
                        }}
                        className="flex-1 bg-transparent border-none outline-none text-[16px] font-bold text-slate-700 cursor-pointer"
                      >
                        {filteredSaved.map(m => (
                          <option key={m.phone_number} value={m.phone_number}>
                            +221 {m.phone_number} {m.is_default ? '(Par défaut)' : ''}
                          </option>
                        ))}
                        <option value="custom">Saisir un autre numéro...</option>
                      </select>
                    </div>

                    {isCustomPhone && (
                      <div className="border border-slate-200 rounded-2xl h-[60px] flex items-center px-5 bg-white focus-within:border-slate-400 focus-within:ring-4 focus-within:ring-slate-100 transition-all shadow-sm">
                        <span className="text-[16px] font-bold text-slate-400 mr-2">+221</span>
                        <input
                          type="tel"
                          required
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          placeholder="77 000 00 00"
                          className="flex-1 bg-transparent border-none outline-none text-[16px] font-bold text-slate-700 placeholder-slate-300"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <div className="border border-slate-200 rounded-2xl h-[60px] flex items-center px-5 bg-white focus-within:border-slate-400 focus-within:ring-4 focus-within:ring-slate-100 transition-all shadow-sm relative">
                      <span className="text-[16px] font-bold text-slate-400 mr-2">+221</span>
                      <input
                        type="tel"
                        required
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="77 000 00 00"
                        className="flex-1 bg-transparent border-none outline-none text-[16px] font-bold text-slate-700 placeholder-slate-300 pr-10"
                      />
                      {filteredSaved.length === 1 && phoneNumber === filteredSaved[0].phone_number && (
                        <span className="absolute right-5 text-primary material-symbols-outlined text-base" title="Numéro enregistré">
                          edit
                        </span>
                      )}
                    </div>
                    {filteredSaved.length === 1 && phoneNumber === filteredSaved[0].phone_number ? (
                      <span className="text-[10px] text-primary/80 font-bold flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">history</span>
                        Numéro utilisé la dernière fois
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic font-medium">Saisissez votre numéro pour initier la demande de débit USSD/OTP.</span>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setSelectedPlanForPayment(null)}
                  className="px-6 h-[48px] rounded-2xl border border-slate-200 text-[13px] font-bold uppercase text-slate-600 hover:bg-slate-50 hover:text-slate-900 active:scale-95 transition-all cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isPaying}
                  className="px-7 h-[48px] rounded-2xl bg-[#1A3C5E] hover:bg-[#132B44] text-white text-[13px] font-bold uppercase active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 shadow-md"
                >
                  {isPaying ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      TRAITEMENT...
                    </>
                  ) : (
                    `PAYER ${selectedPlanForPayment.price}`
                  )}
                </button>
              </div>
            </form>}
          </div>
        </div>
      )}
    </div>
  );
};
export default Subscription;
