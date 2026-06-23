import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { MoneyText } from '../components/ui/MoneyText';

export const MonEspace: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [ardoises, setArdoises] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Monitor Auth State
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) {
        // Stop loading if no session is active so we can redirect
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch ardoises when authenticated
  useEffect(() => {
    if (session) {
      if (session.user?.user_metadata?.user_type !== 'client') {
        window.location.href = '/';
        return;
      }

      const fetchMyArdoises = async () => {
        setLoading(true);
        try {
          const { data, error } = await supabase.rpc('get_my_ardoises_as_client');
          if (error) throw error;
          setArdoises(data || []);
        } catch (e: any) {
          console.error("Error loading client ardoises:", e);
        } finally {
          setLoading(false);
        }
      };

      fetchMyArdoises();
    } else if (!loading) {
      // If we are not loading and there's no session, redirect to landing/login
      window.location.href = '/';
    }
  }, [session, loading]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-center items-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-outline font-bold text-xs uppercase tracking-wider">Chargement de votre espace...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-on-background flex flex-col">
      {/* Header */}
      <header className="bg-primary text-on-primary fixed top-0 left-0 w-full z-50 h-16 flex justify-between items-center px-4 border-b border-white/5 shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-secondary to-secondary/80 flex items-center justify-center shadow-sm">
            <span className="text-white text-sm font-black">OS</span>
          </div>
          <span className="text-lg font-black tracking-tight text-white">Mon Espace</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center justify-center h-9 px-3.5 text-on-primary border border-white/20 hover:bg-white/10 rounded-xl transition-all active:scale-95 cursor-pointer"
        >
          <span className="material-symbols-outlined text-sm">logout</span>
          <span className="ml-1.5 text-[10px] uppercase font-black">Déconnexion</span>
        </button>
      </header>

      {/* Main content */}
      <main className="flex-1 w-full max-w-lg mx-auto px-4 pt-24 pb-32 flex flex-col gap-6">
        <div className="text-left mt-2">
          <h1 className="font-headline-lg-mobile text-on-surface">Mes Comptes Commerçants</h1>
          <p className="font-body-md text-on-surface-variant">
            Suivez en temps réel le solde de vos ardoises chez tous vos commerçants.
          </p>
        </div>

        {/* Ardoises List */}
        <div className="flex flex-col gap-5">
          {ardoises.length === 0 ? (
            <div className="p-8 bg-surface-container/20 rounded-[24px] border border-outline-variant/60 text-center flex flex-col items-center gap-3">
              <span className="material-symbols-outlined text-4xl text-outline">menu_book</span>
              <p className="text-sm font-black text-on-surface">Aucune ardoise liée à ce compte</p>
              <p className="text-xs text-outline max-w-xs leading-relaxed">
                Demandez le lien d'accès à votre commerçant et cliquez dessus pour lier automatiquement votre ardoise.
              </p>
            </div>
          ) : (
            ardoises.map((item, idx) => {
              const { ardoise, boutique_nom, paiements } = item;
              const totalVerse = (paiements || []).reduce((s: number, p: any) => s + p.montant, 0);
              const resteAdu = Math.max(0, ardoise.montant_total - totalVerse);
              const percent = ardoise.montant_total > 0 ? Math.min(100, Math.round((totalVerse / ardoise.montant_total) * 100)) : 0;
              const isSoldee = ardoise.statut === 'soldee' || resteAdu === 0;

              return (
                <Card key={ardoise.id || idx} className="p-5 rounded-[24px] border border-outline-variant/60 flex flex-col gap-4 text-left shadow-sm hover:shadow-md transition-all">
                  <div className="flex justify-between items-center">
                    <h3 className="font-black text-sm text-primary uppercase tracking-wide">{boutique_nom}</h3>
                    {isSoldee ? (
                      <Badge variant="success">Soldée</Badge>
                    ) : (
                      <Badge variant="danger">En cours</Badge>
                    )}
                  </div>

                  {/* 3 columns metrics */}
                  <div className="grid grid-cols-3 gap-2 py-1 bg-surface-container/10 rounded-xl border border-outline-variant/30 px-3">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold text-outline uppercase">Crédit Total</span>
                      <MoneyText value={ardoise.montant_total} className="text-xs font-black text-on-surface" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold text-outline uppercase">Versé</span>
                      <MoneyText value={totalVerse} className="text-xs font-black text-secondary" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold text-outline uppercase">Reste Dû</span>
                      <MoneyText value={resteAdu} className={`text-xs font-black ${resteAdu > 0 ? 'text-error' : 'text-on-surface'}`} />
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-[9px] font-bold text-outline">
                      <span>Remboursé à {percent}%</span>
                    </div>
                    <div className="h-2 bg-surface-container rounded-full overflow-hidden">
                      <div
                        className="h-full bg-secondary rounded-full transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

                  {/* Detail link */}
                  <button
                    onClick={() => {
                      window.location.href = '/?token=' + ardoise.access_token;
                    }}
                    className="mt-1 h-9 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-black uppercase tracking-wider rounded-xl transition-all active:scale-[0.98] cursor-pointer text-center w-full"
                  >
                    Voir le détail →
                  </button>
                </Card>
              );
            })
          )}
        </div>

        {/* Sponsorisé / Publicité */}
        <div className="border border-dashed border-outline-variant rounded-[24px] p-4 text-center bg-surface-container-lowest mt-4 flex flex-col gap-2">
          <p className="text-[10px] font-bold text-outline uppercase tracking-wider mb-2">Sponsorisé / Publicité</p>
          <div className="h-20 bg-surface-container rounded-xl flex items-center justify-center border border-outline-variant/40">
            <p className="text-[11px] text-texte-2">Espace publicitaire — à activer avec le domaine</p>
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center text-[10px] text-outline font-medium tracking-wide mt-6">
          Espace gratuit fourni par BoutikOS
        </footer>
      </main>
    </div>
  );
};
