import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { MoneyText } from '../components/ui/MoneyText';

interface PortalClientProps {
  token?: string;
}

export const PortalClient: React.FC<PortalClientProps> = ({ token }) => {
  const [session, setSession] = useState<any>(null);
  const [claimed, setClaimed] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authSent, setAuthSent] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null); // contains { ardoise: {...}, paiements: [...] }

  // Auth State
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  // Fetch ardoise by token
  useEffect(() => {
    if (!token) {
      setError("Aucun jeton d'accès fourni.");
      setLoading(false);
      return;
    }
    
    const fetchArdoise = async () => {
      setLoading(true);
      try {
        const { data: res, error: err } = await supabase.rpc('get_ardoise_by_token', { p_token: token });
        if (err) throw err;
        if (!res) throw new Error("Ardoise introuvable.");
        setData(res);
      } catch (e: any) {
        setError(e.message || "Erreur lors du chargement de l'ardoise.");
      } finally {
        setLoading(false);
      }
    };

    fetchArdoise();
  }, [token]);

  // Claim ardoise if logged in as client
  useEffect(() => {
    if (session?.user?.user_metadata?.user_type === 'client' && data && !claimed) {
      supabase.rpc('claim_ardoise', { p_token: token })
        .then(({ data: claimRes, error: claimErr }) => {
          if (claimErr) console.error("Error claiming ardoise:", claimErr);
          else setClaimed(true);
        });
    }
  }, [session, data, claimed, token]);

  const getRepaymentBadge = (percent: number) => {
    if (percent === 100) return { label: 'Entièrement Libéré 🎉', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
    if (percent >= 75) return { label: 'Excellent Payeur ⭐', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' };
    if (percent >= 50) return { label: 'Bon Rythme 👍', color: 'bg-sky-500/20 text-sky-300 border-sky-500/30' };
    if (percent >= 25) return { label: 'En Cours de Règlement 🕒', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
    return { label: 'Début de Remboursement 🌱', color: 'bg-rose-500/20 text-rose-300 border-rose-500/30' };
  };

  const handleDownloadReceipt = () => {
    if (!data?.ardoise) return;
    const { ardoise, paiements } = data;
    const paid = paiements.reduce((sum: number, p: any) => sum + p.montant, 0);
    const remaining = Math.max(0, ardoise.montant_total - paid);
    const percent = ardoise.montant_total > 0 ? Math.round((paid / ardoise.montant_total) * 100) : 0;

    const text = `==================================\n` +
                 `      REÇU DE COMPTE - BOUTIKOS   \n` +
                 `==================================\n` +
                 `Client : ${ardoise.client_nom}\n` +
                 `Date : ${new Date().toLocaleDateString('fr-FR')}\n\n` +
                 `Statut : ${ardoise.statut === 'soldee' ? 'SOLDÉ' : 'EN COURS'}\n` +
                 `Crédit Initial : ${new Intl.NumberFormat('fr-FR').format(ardoise.montant_total)} FCFA\n` +
                 `Total Versé    : ${new Intl.NumberFormat('fr-FR').format(paid)} FCFA\n` +
                 `Reste à Payer  : ${new Intl.NumberFormat('fr-FR').format(remaining)} FCFA\n` +
                 `Remboursé à    : ${percent}%\n` +
                 `==================================\n` +
                 `Merci pour votre confiance !`;

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `recu_ardoise_${ardoise.client_nom.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail.trim()) return;
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: authEmail.trim(),
        options: {
          data: { user_type: 'client' },
          emailRedirectTo: window.location.origin + '/?token=' + token,
        },
      });
      if (error) throw error;
      setAuthSent(true);
    } catch (err: any) {
      alert("Erreur d'authentification: " + err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-center items-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-outline font-bold text-xs uppercase tracking-wider">Chargement de votre ardoise...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="pb-40 pt-20 px-4 max-w-lg mx-auto flex flex-col gap-6 animate-fade-in text-center">
        <div className="text-left mt-2">
          <h1 className="font-headline-lg-mobile text-on-surface">Espace Client Ardoise</h1>
        </div>
        <Card className="p-6 bg-error-container/20 border border-error/20 text-error rounded-[24px]">
          <span className="material-symbols-outlined text-3xl mb-2">warning</span>
          <p className="text-sm font-bold">{error || "Une erreur est survenue."}</p>
        </Card>
      </div>
    );
  }

  const { ardoise, paiements } = data;
  const paid = paiements.reduce((sum: number, p: any) => sum + p.montant, 0);
  const remaining = Math.max(0, ardoise.montant_total - paid);
  const percent = ardoise.montant_total > 0 ? Math.round((paid / ardoise.montant_total) * 100) : 0;
  const b = getRepaymentBadge(percent);

  return (
    <div className="pb-40 pt-20 px-4 max-w-lg mx-auto flex flex-col gap-6 animate-fade-in">
      <div className="text-left mt-2">
        <h1 className="font-headline-lg-mobile text-on-surface">Mon Ardoise</h1>
        <p className="font-body-md text-on-surface-variant">Consultez l'état de votre compte en toute transparence.</p>
      </div>

      <div className="flex flex-col gap-5 animate-scale-in">
        {/* Premium Client Dashboard Card */}
        <div className="relative overflow-hidden bg-gradient-to-br from-primary to-primary-container text-white p-6 rounded-[24px] shadow-lg border border-white/5 flex flex-col gap-4 text-left">
          {/* Ambient glows */}
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-secondary rounded-full filter blur-2xl opacity-30" />
          <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-primary-container rounded-full filter blur-2xl opacity-20" />

          <div className="flex justify-between items-start z-10">
            <div className="flex flex-col">
              <span className="text-[9px] opacity-75 font-black tracking-widest uppercase">Espace Client</span>
              <h2 className="text-lg font-black tracking-tight mt-0.5">{ardoise.client_nom}</h2>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-[9px] font-black border ${b.color}`}>
              {b.label}
            </span>
          </div>

          <div className="mt-2 z-10">
            <span className="text-[10px] opacity-75 font-bold uppercase tracking-wider block">Solde Restant Dû</span>
            <MoneyText value={remaining} className="text-3xl font-black text-white font-numeric-display" />
          </div>

          {/* Repayment progress */}
          <div className="flex flex-col gap-1.5 mt-2 z-10">
            <div className="flex justify-between text-[10px] font-bold">
              <span className="opacity-80">Remboursé à {percent}%</span>
              <span className="opacity-80">{new Intl.NumberFormat('fr-FR').format(paid)} / {new Intl.NumberFormat('fr-FR').format(ardoise.montant_total)} FCFA</span>
            </div>
            <div className="h-2.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-secondary rounded-full transition-all duration-700"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleDownloadReceipt}
            className="h-10 bg-white border border-outline-variant hover:bg-surface-container rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all active:scale-[0.97]"
          >
            <span className="material-symbols-outlined text-base">download</span>
            Télécharger Reçu
          </button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`Bonjour, je consulte mon ardoise sur BoutikOS. Solde restant dû : ${new Intl.NumberFormat('fr-FR').format(remaining)} FCFA.`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="h-10 bg-green-500 hover:bg-green-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all active:scale-[0.97]"
          >
            <span className="material-symbols-outlined text-base">chat</span>
            Contacter Boutique
          </a>
        </div>

        {/* Payment History */}
        <div className="flex flex-col gap-3 text-left">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-outline">Historique de vos Versements</h3>
          {paiements.length === 0 ? (
            <p className="text-xs text-outline italic text-center py-6 bg-surface-container/20 rounded-xl border border-outline-variant/40">
              Aucun versement n'a encore été enregistré sur cette fiche.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {paiements.map((payment: any, index: number) => (
                <div
                  key={payment.id}
                  className="p-3 bg-white border border-outline-variant/60 rounded-xl flex items-center justify-between shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-secondary-container text-secondary flex items-center justify-center font-bold text-[10px]">
                      #{paiements.length - index}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-on-surface">Versement Reçu</span>
                      <span className="text-[9px] text-outline">
                        {new Date(payment.paid_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  <MoneyText value={payment.montant} className="text-xs font-black text-secondary" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Auth CTA Banner */}
        {session?.user?.user_metadata?.user_type === 'client' ? (
          <div className="bg-primary-container border border-primary/20 rounded-[24px] p-5 flex flex-col gap-3 text-left">
            <p className="font-black text-sm text-primary">Ardoise liée à votre compte</p>
            <p className="text-xs text-texte-2">Retrouvez toutes vos ardoises dans votre espace personnel.</p>
            <button
              onClick={() => { window.location.href = '/?espace=client'; }}
              className="h-10 bg-primary text-white text-xs font-black uppercase tracking-wide rounded-xl active:scale-[0.98] transition-all cursor-pointer"
            >
              Mon Espace →
            </button>
          </div>
        ) : !session ? (
          <div className="bg-primary text-white rounded-[24px] p-5 flex flex-col gap-3 text-left">
            <p className="font-black text-sm">Retrouvez toutes vos ardoises en un seul endroit</p>
            <p className="text-xs opacity-80">Créez un compte gratuit pour suivre vos dettes chez tous vos commerçants.</p>
            <button
              onClick={() => setShowAuthModal(true)}
              className="h-10 bg-white text-primary text-xs font-black uppercase tracking-wide rounded-xl active:scale-[0.98] transition-all cursor-pointer"
            >
              Créer mon compte gratuit
            </button>
          </div>
        ) : null}

        {/* Publicité / Ads Placeholder */}
        <div className="mt-6 p-4 rounded-2xl bg-surface-container/30 border border-dashed border-outline-variant flex flex-col items-center justify-center gap-2 text-center text-outline">
          <span className="text-[9px] font-black uppercase tracking-widest bg-outline/10 px-2 py-0.5 rounded text-outline-variant">Sponsorisé / Publicité</span>
          <div className="w-full h-20 rounded-xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 flex items-center justify-center border border-outline-variant/40">
            <p className="text-[10px] italic">Espace publicitaire réservé (Configuration en attente du nom de domaine)</p>
          </div>
        </div>
      </div>

      {/* Modal d'auth */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[24px] p-6 max-w-sm w-full relative shadow-xl text-left border border-outline-variant/40 flex flex-col gap-4 animate-scale-in">
            <button 
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 text-outline hover:text-on-surface font-black text-lg p-1 cursor-pointer"
            >
              ×
            </button>
            <h3 className="text-sm font-black text-primary uppercase">Créer mon compte Client</h3>
            <p className="text-[11px] text-outline leading-relaxed">
              Saisissez votre adresse e-mail. Nous vous enverrons un lien magique pour vous connecter instantanément et lier votre ardoise.
            </p>
            
            {authSent ? (
              <div className="p-3.5 bg-secondary-container/20 border border-secondary/20 rounded-xl text-center">
                <p className="text-xs font-bold text-secondary">📧 Lien envoyé !</p>
                <p className="text-[10px] text-outline mt-1">Vérifiez votre boîte mail et cliquez sur le lien reçu.</p>
              </div>
            ) : (
              <form onSubmit={handleSendOtp} className="flex flex-col gap-3">
                <input
                  type="email"
                  required
                  placeholder="Ex: client@mail.com"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="w-full h-11 px-4 text-xs bg-surface-container-low border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="submit"
                  className="h-10 bg-primary text-white text-xs font-black uppercase tracking-wide rounded-xl active:scale-[0.98] transition-all cursor-pointer"
                >
                  Envoyer le lien
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
