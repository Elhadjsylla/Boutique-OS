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
        setToast({ message: "Connexion réussie !", type: 'success' });
      }
    } catch (err: any) {
      setToast({ message: err.message || "Une erreur est survenue.", type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => (
    <div className="w-full max-w-md bg-white rounded-3xl border border-outline-variant premium-shadow-lg p-8 flex flex-col gap-6 text-center animate-fade-in mx-auto">
      {/* Logo Section */}
      <div className="flex flex-col items-center gap-3">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center shadow-md">
          <span className="text-white text-2xl font-black">OS</span>
        </div>
        <div>
          <h1 className="font-headline-lg text-primary">BoutikOS</h1>
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
