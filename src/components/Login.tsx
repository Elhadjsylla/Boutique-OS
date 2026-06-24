import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Toast } from './ui/Toast';

export const Login: React.FC<{ isModal?: boolean }> = ({ isModal = false }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [boutiqueName, setBoutiqueName] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setToast({ message: "Veuillez remplir tous les champs.", type: 'error' });
      return;
    }

    setLoading(true);

    try {
      if (isSignUp) {
        if (!boutiqueName) {
          setToast({ message: "Veuillez renseigner le nom de la boutique.", type: 'error' });
          setLoading(false);
          return;
        }

        const generatedBoutiqueId = `boutique-${crypto.randomUUID().slice(0, 8)}`;

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              boutique_id: generatedBoutiqueId,
              boutique_name: boutiqueName.trim(),
              role: 'caissier',
            },
          },
        });

        if (error) throw error;
        setToast({
          message: "Compte créé ! Veuillez vérifier vos e-mails ou vous connecter.",
          type: 'success',
        });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
        if (import.meta.env.DEV) {
          localStorage.removeItem('dev_signed_out');
        }
        setToast({ message: "Connexion réussie !", type: 'success' });
      }
    } catch (err: any) {
      const isFetchError = err.message?.toLowerCase().includes('failed to fetch') || err.message?.toLowerCase().includes('fetch');
      if (isFetchError) {
        if (import.meta.env.DEV) {
          localStorage.removeItem('dev_signed_out');
          setToast({ message: "Connexion hors-ligne (Mode Dev) réussie !", type: 'success' });
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        } else {
          setToast({ message: "Connexion impossible. Vous semblez hors ligne. Veuillez vérifier votre connexion Internet.", type: 'error' });
        }
      } else {
        setToast({ message: err.message || "Une erreur est survenue.", type: 'error' });
      }
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => (
    <div className="w-full max-w-md bg-white rounded-3xl border border-outline-variant premium-shadow-lg p-8 flex flex-col gap-6 text-center animate-fade-in mx-auto">
      {/* Logo Section */}
      <div className="flex flex-col items-center gap-3">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center shadow-md text-white">
          <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <path d="M16 10a4 4 0 0 1-8 0"></path>
          </svg>
        </div>
        <div>
          <h1 className="font-headline-lg text-primary">Sama Boutik</h1>
          <p className="font-body-md text-outline font-medium">Votre point de vente intelligent</p>
        </div>
      </div>

      <h2 className="font-headline-md text-on-surface">
        {isSignUp ? 'Créer un commerce' : 'Se connecter'}
      </h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {isSignUp && (
          <Input
            label="Nom de la Boutique"
            type="text"
            value={boutiqueName}
            onChange={(e) => setBoutiqueName(e.target.value)}
            placeholder="Ex: Épicerie du Centre"
            required
          />
        )}

        <Input
          label="Adresse Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Ex: caissier@boutik.com"
          required
        />

        <Input
          label="Mot de passe"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
        />

        <Button type="submit" className="w-full mt-2" disabled={loading}>
          {loading ? 'Traitement...' : isSignUp ? "S'INSCRIRE" : "SE CONNECTER"}
        </Button>
      </form>

      <div className="border-t border-outline-variant pt-4">
        <button
          onClick={() => setIsSignUp(!isSignUp)}
          className="font-label-md text-xs text-secondary hover:text-secondary/80 font-bold uppercase tracking-wider"
        >
          {isSignUp
            ? 'Déjà inscrit ? Connectez-vous'
            : "Nouveau ? Enregistrez votre boutique"}
        </button>
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div className="w-full">
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        {renderContent()}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center px-4 py-12">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {renderContent()}
    </div>
  );
};
