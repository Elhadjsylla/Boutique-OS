import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useRateLimitTimer } from '../hooks/useRateLimitTimer';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Toast } from './ui/Toast';

// null  = not in forgot-password flow
// email = step 1 — enter email
// code  = step 2 — enter 6-digit OTP received by email
// newpw = step 3 — enter new password (after OTP verified or old magic-link)
type ForgotStep = 'email' | 'code' | 'newpw' | null;

export const Login: React.FC<{ isModal?: boolean }> = ({ isModal = false }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [forgotStep, setForgotStep] = useState<ForgotStep>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [boutiqueName, setBoutiqueName] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Rate-limit timers — each tracks its own localStorage key and countdown
  const otpRequestRL = useRateLimitTimer('otp_request'); // resetPasswordForEmail
  const otpVerifyRL = useRateLimitTimer('otp_verify');   // verifyOtp
  const signInRL = useRateLimitTimer('sign_in', 60);     // signInWithPassword (GoTrue gives no timing → 60s fallback)

  useEffect(() => {
    // Backward compat: users who still have an old magic-link in their inbox
    if (window.location.hash.includes('type=recovery')) {
      setForgotStep('newpw');
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setForgotStep('newpw');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Step 1 — send OTP code ──────────────────────────────────────────────────
  const handleRequestOtp = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email) {
      setToast({ message: "Veuillez entrer votre adresse email.", type: 'error' });
      return;
    }
    if (otpRequestRL.isRateLimited) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) throw error;
      otpRequestRL.clear();
      setForgotStep('code');
      setToast({ message: "Code envoyé ! Vérifiez votre boite mail.", type: 'success' });
    } catch (err: any) {
      if (otpRequestRL.handleError(err)) {
        setToast({ message: `Trop de tentatives. Réessayez dans ${otpRequestRL.secondsLeft}s.`, type: 'error' });
      } else {
        setToast({ message: err.message || "Erreur lors de l'envoi du code.", type: 'error' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (otpRequestRL.isRateLimited) return;
    setOtpCode('');
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) throw error;
      otpRequestRL.clear();
      setToast({ message: "Nouveau code envoyé !", type: 'success' });
    } catch (err: any) {
      if (otpRequestRL.handleError(err)) {
        setToast({ message: `Trop de tentatives. Réessayez dans ${otpRequestRL.secondsLeft}s.`, type: 'error' });
      } else {
        setToast({ message: err.message || "Erreur lors du renvoi.", type: 'error' });
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2 — verify OTP code ────────────────────────────────────────────────
  const handleVerifyOtp = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!otpCode || otpCode.length < 6) {
      setToast({ message: "Entrez le code à 6 chiffres reçu par email.", type: 'error' });
      return;
    }
    if (otpVerifyRL.isRateLimited) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otpCode.trim(),
        type: 'recovery',
      });
      if (error) throw error;
      otpVerifyRL.clear();
      setForgotStep('newpw');
    } catch (err: any) {
      if (otpVerifyRL.handleError(err)) {
        setToast({ message: `Trop de tentatives. Réessayez dans ${otpVerifyRL.secondsLeft}s.`, type: 'error' });
      } else {
        const msg = (err.message || '').toLowerCase();
        if (msg.includes('expired') || msg.includes('invalid') || msg.includes('otp')) {
          setToast({ message: "Code invalide ou expiré. Cliquez sur « Renvoyer le code ».", type: 'error' });
        } else {
          setToast({ message: err.message || "Code incorrect.", type: 'error' });
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3 — set new password ───────────────────────────────────────────────
  const handleUpdatePassword = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      setToast({ message: "Veuillez remplir tous les champs.", type: 'error' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setToast({ message: "Les mots de passe ne correspondent pas.", type: 'error' });
      return;
    }
    if (newPassword.length < 6) {
      setToast({ message: "Le mot de passe doit contenir au moins 6 caractères.", type: 'error' });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setToast({ message: "Mot de passe mis à jour ! Connexion en cours...", type: 'success' });
      setForgotStep(null);
      setNewPassword('');
      setConfirmPassword('');
      window.history.replaceState(null, '', window.location.pathname);
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      setToast({ message: err.message || "Erreur lors de la mise à jour.", type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // ── Google OAuth ────────────────────────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch (err: any) {
      setToast({ message: err.message || 'Erreur Google Sign-In', type: 'error' });
      setLoading(false);
    }
  };

  // ── Login / Sign-up ─────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
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
        const generatedBoutiqueId = crypto.randomUUID();
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              boutique_id: generatedBoutiqueId,
              boutique_name: boutiqueName.trim(),
              role: 'gerant',
            },
          },
        });
        if (error) throw error;
        setToast({
          message: "Compte créé ! Veuillez vérifier vos e-mails ou vous connecter.",
          type: 'success',
        });
      } else {
        if (signInRL.isRateLimited) {
          setLoading(false);
          return;
        }
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        signInRL.clear();
        if (import.meta.env.DEV) {
          localStorage.removeItem('dev_signed_out');
        }
        setToast({ message: "Connexion réussie !", type: 'success' });
      }
    } catch (err: any) {
      console.error('[Login] Erreur Supabase:', err);
      const errorMsg = err?.message || String(err);
      const isNetworkError =
        err instanceof TypeError ||
        errorMsg.toLowerCase().includes('failed to fetch') ||
        errorMsg.toLowerCase().includes('fetch failed') ||
        err?.name === 'AuthRetryableFetchError';
      const devBypassEnabled = import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS !== 'false';
      if (signInRL.handleError(err)) {
        setToast({ message: `Trop de tentatives. Réessayez dans ${signInRL.secondsLeft}s.`, type: 'error' });
      } else if (isNetworkError && devBypassEnabled) {
        localStorage.removeItem('dev_signed_out');
        setToast({ message: "Connexion hors-ligne (Mode Dev) réussie !", type: 'success' });
        setTimeout(() => window.location.reload(), 1000);
      } else if (isNetworkError) {
        setToast({ message: "Connexion impossible. Vérifiez votre connexion Internet.", type: 'error' });
      } else {
        setToast({ message: err.message || "Une erreur est survenue.", type: 'error' });
      }
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => (
    <div className="w-full max-w-md bg-white rounded-3xl border border-outline-variant premium-shadow-lg p-8 flex flex-col gap-6 text-center animate-fade-in mx-auto">
      {/* Logo */}
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

      {/* ── Step 3: New password ── */}
      {forgotStep === 'newpw' ? (
        <>
          <div className="flex flex-col gap-1">
            <h2 className="font-headline-md text-on-surface">Nouveau mot de passe</h2>
            <p className="text-sm text-outline">Choisissez un nouveau mot de passe pour votre compte.</p>
          </div>
          <form onSubmit={handleUpdatePassword} className="flex flex-col gap-4">
            <Input
              label="Nouveau mot de passe"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
            <Input
              label="Confirmer le mot de passe"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
            <Button type="submit" className="w-full mt-2" disabled={loading}>
              {loading ? 'Mise à jour...' : 'ENREGISTRER LE MOT DE PASSE'}
            </Button>
          </form>
        </>

      ) : forgotStep === 'code' ? (
        /* ── Step 2: Enter OTP code ── */
        <>
          <div className="flex flex-col gap-1">
            <h2 className="font-headline-md text-on-surface">Code de vérification</h2>
            <p className="text-sm text-outline">
              Entrez le code à 6 chiffres envoyé à <strong className="text-on-surface">{email}</strong>.
            </p>
          </div>
          <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
            <Input
              label="Code à 6 chiffres"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              required
            />
            <Button
              type="submit"
              className="w-full mt-2"
              disabled={loading || otpCode.length < 6 || otpVerifyRL.isRateLimited}
            >
              {loading
                ? 'Vérification...'
                : otpVerifyRL.isRateLimited
                ? `Réessayer dans ${otpVerifyRL.secondsLeft}s`
                : 'VALIDER LE CODE'}
            </Button>
          </form>
          <div className="border-t border-outline-variant pt-4 flex flex-col gap-2">
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={loading || otpRequestRL.isRateLimited}
              className="font-label-md text-xs text-secondary hover:text-secondary/80 font-bold uppercase tracking-wider disabled:opacity-50"
            >
              {otpRequestRL.isRateLimited
                ? `Renvoyer le code (${otpRequestRL.secondsLeft}s)`
                : 'Renvoyer le code'}
            </button>
            <button
              type="button"
              onClick={() => { setForgotStep(null); setOtpCode(''); }}
              className="font-label-md text-xs text-outline hover:text-on-surface font-bold uppercase tracking-wider"
            >
              Retour à la connexion
            </button>
          </div>
        </>

      ) : forgotStep === 'email' ? (
        /* ── Step 1: Enter email ── */
        <>
          <div className="flex flex-col gap-1">
            <h2 className="font-headline-md text-on-surface">Mot de passe oublié</h2>
            <p className="text-sm text-outline">Entrez votre email pour recevoir un code de vérification.</p>
          </div>
          <form onSubmit={handleRequestOtp} className="flex flex-col gap-4">
            <Input
              label="Adresse Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Ex: caissier@boutik.com"
              required
            />
            <Button type="submit" className="w-full mt-2" disabled={loading || otpRequestRL.isRateLimited}>
              {loading
                ? 'Envoi...'
                : otpRequestRL.isRateLimited
                ? `Réessayer dans ${otpRequestRL.secondsLeft}s`
                : 'ENVOYER LE CODE'}
            </Button>
          </form>
          <div className="border-t border-outline-variant pt-4">
            <button
              type="button"
              onClick={() => setForgotStep(null)}
              className="font-label-md text-xs text-secondary hover:text-secondary/80 font-bold uppercase tracking-wider"
            >
              Retour à la connexion
            </button>
          </div>
        </>

      ) : (
        /* ── Normal login / signup ── */
        <>
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

            <div className="flex flex-col gap-1">
              <Input
                label="Mot de passe"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
              {!isSignUp && (
                <button
                  type="button"
                  onClick={() => setForgotStep('email')}
                  className="self-end text-[11px] text-secondary hover:text-secondary/80 font-bold uppercase tracking-wider"
                >
                  Mot de passe oublié ?
                </button>
              )}
            </div>

            <Button type="submit" className="w-full mt-2" disabled={loading || (!isSignUp && signInRL.isRateLimited)}>
              {loading
                ? 'Traitement...'
                : !isSignUp && signInRL.isRateLimited
                ? `Réessayer dans ${signInRL.secondsLeft}s`
                : isSignUp ? "S'INSCRIRE" : "SE CONNECTER"}
            </Button>
          </form>

          {/* Google OAuth */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-outline-variant" />
            <span className="text-[10px] font-bold text-outline uppercase tracking-wider">ou</span>
            <div className="flex-1 h-px bg-outline-variant" />
          </div>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 h-11 px-4 bg-white border border-outline-variant rounded-2xl hover:bg-gray-50 active:scale-[0.98] transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            <span className="text-sm font-bold text-gray-700">Continuer avec Google</span>
          </button>

          <div className="border-t border-outline-variant pt-4">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="font-label-md text-xs text-secondary hover:text-secondary/80 font-bold uppercase tracking-wider"
            >
              {isSignUp
                ? 'Déjà inscrit ? Connectez-vous'
                : "Nouveau ? Enregistrez votre boutique"}
            </button>
          </div>
        </>
      )}
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
