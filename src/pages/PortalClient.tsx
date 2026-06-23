import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(n);

interface ArdoiseData {
  id: string;
  client_nom: string;
  montant_total: number;
  statut: 'en_cours' | 'soldee';
  created_at: string;
}

interface PaiementData {
  id: string;
  montant: number;
  paid_at: string;
}

interface PortalData {
  ardoise: ArdoiseData;
  paiements: PaiementData[];
}

interface PortalClientProps {
  token: string;
}

export const PortalClient: React.FC<PortalClientProps> = ({ token }) => {
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data: result, error } = await supabase.rpc('get_ardoise_by_token', {
          p_token: token,
        });
        if (!active) return;
        if (error || !result) {
          setNotFound(true);
        } else {
          setData(result as PortalData);
        }
      } catch {
        if (active) setNotFound(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F7FA]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-texte-2 font-medium">Chargement de votre ardoise...</p>
        </div>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F7FA] px-4">
        <div className="text-center max-w-sm">
          <span className="material-symbols-outlined text-5xl text-outline block mb-4">link_off</span>
          <h2 className="text-xl font-black text-primary mb-2">Lien invalide</h2>
          <p className="text-sm text-texte-2 leading-relaxed">
            Ce lien d'accès est invalide ou introuvable. Demandez un nouveau lien à votre commerçant.
          </p>
          <button
            onClick={() => { window.location.href = '/'; }}
            className="mt-6 px-6 h-10 bg-primary text-white text-xs font-black uppercase tracking-wide rounded-xl"
          >
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  const { ardoise, paiements } = data;
  const totalVerse = paiements.reduce((s, p) => s + p.montant, 0);
  const resteAdu = Math.max(0, ardoise.montant_total - totalVerse);
  const percent = ardoise.montant_total > 0
    ? Math.min(100, Math.round((totalVerse / ardoise.montant_total) * 100))
    : 0;
  const isSoldee = ardoise.statut === 'soldee';

  return (
    <div className="min-h-screen bg-[#F5F7FA] text-[#1A1A2E] font-body-md">
      {/* Header */}
      <header className="bg-primary text-white px-4 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-secondary to-secondary/80 flex items-center justify-center shadow-sm">
            <span className="text-white text-xs font-black">OS</span>
          </div>
          <span className="font-black tracking-tight">BoutikOS</span>
        </div>
        <span className="text-[10px] font-extrabold opacity-70 uppercase tracking-widest">Espace Client</span>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-5">

        {/* Identity card */}
        <div className="bg-white border border-outline-variant rounded-[24px] p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-2xl bg-primary-container flex items-center justify-center flex-shrink-0">
              <span className="text-primary font-black text-xl">
                {ardoise.client_nom.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h1 className="font-black text-lg text-primary leading-tight">{ardoise.client_nom}</h1>
              <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full mt-0.5 ${
                isSoldee
                  ? 'bg-secondary-container text-secondary'
                  : 'bg-error-container text-error'
              }`}>
                <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>
                  {isSoldee ? 'check_circle' : 'schedule'}
                </span>
                {isSoldee ? 'Soldée' : 'En cours'}
              </span>
            </div>
          </div>

          {/* Amounts grid */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="bg-surface-container rounded-xl p-3 text-center">
              <p className="text-[9px] font-bold text-outline uppercase tracking-wide mb-1">Crédit total</p>
              <p className="font-black text-sm text-texte">{fmt(ardoise.montant_total)} F</p>
            </div>
            <div className="bg-secondary-container rounded-xl p-3 text-center">
              <p className="text-[9px] font-bold text-outline uppercase tracking-wide mb-1">Versé</p>
              <p className="font-black text-sm text-secondary">{fmt(totalVerse)} F</p>
            </div>
            <div className={`rounded-xl p-3 text-center ${resteAdu > 0 ? 'bg-error-container' : 'bg-secondary-container'}`}>
              <p className="text-[9px] font-bold text-outline uppercase tracking-wide mb-1">Reste dû</p>
              <p className={`font-black text-sm ${resteAdu > 0 ? 'text-error' : 'text-secondary'}`}>
                {fmt(resteAdu)} F
              </p>
            </div>
          </div>
        </div>

        {/* Progress */}
        {ardoise.montant_total > 0 && (
          <div className="bg-white border border-outline-variant rounded-[24px] p-5">
            <div className="flex justify-between text-xs font-bold text-texte-2 mb-2">
              <span>Progression du remboursement</span>
              <span className="font-black text-primary">{percent}%</span>
            </div>
            <div className="w-full h-3 bg-surface-container rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  percent >= 100 ? 'bg-secondary' : percent >= 50 ? 'bg-tertiary' : 'bg-error'
                }`}
                style={{ width: `${percent}%` }}
              />
            </div>
            {isSoldee && (
              <p className="text-xs font-extrabold text-secondary text-center mt-3">
                Ardoise entièrement soldée
              </p>
            )}
          </div>
        )}

        {/* Payment history */}
        <div className="bg-white border border-outline-variant rounded-[24px] p-5">
          <h2 className="font-black text-sm text-primary mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-base">payments</span>
            Historique des versements
          </h2>

          {paiements.length === 0 ? (
            <p className="text-sm text-texte-2 text-center py-4 bg-surface-container rounded-xl">
              Aucun versement enregistré.
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-outline-variant">
              {paiements.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-secondary-container flex items-center justify-center">
                      <span className="material-symbols-outlined text-secondary" style={{ fontSize: '14px' }}>paid</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-texte">Versement</p>
                      <p className="text-[10px] text-texte-2">
                        {new Date(p.paid_at).toLocaleDateString('fr-FR', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                  <span className="font-black text-secondary text-sm">+{fmt(p.montant)} F</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ad placeholder — replace with real ad unit once domain is ready */}
        <div className="border border-dashed border-outline-variant rounded-[24px] p-4 text-center bg-surface-container-lowest">
          <p className="text-[10px] font-bold text-outline uppercase tracking-wider mb-2">Sponsorisé / Publicité</p>
          <div className="h-20 bg-surface-container rounded-xl flex items-center justify-center">
            <p className="text-[11px] text-texte-2">Espace publicitaire — à activer avec le domaine</p>
          </div>
        </div>

        <p className="text-center text-[10px] text-outline pb-4">
          Espace gratuit fourni par <span className="font-black">BoutikOS</span>
        </p>
      </main>
    </div>
  );
};
