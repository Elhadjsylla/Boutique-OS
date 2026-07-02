import React, { useState, useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '../components/ui/Button';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const PwaPrompt: React.FC = () => {
  // 1. Service Worker registration and auto-update prompts
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r: ServiceWorkerRegistration | undefined) {
      console.log('SW registered:', r);
    },
    onRegisterError(error: unknown) {
      console.error('SW registration error:', error);
    },
  });

  // 2. BeforeInstallPrompt handling for app install banner
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallBanner(true);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setShowInstallBanner(false);
      console.log('Sama Boutik was installed successfully');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  return (
    <>
      {/* Service Worker Update Prompt */}
      {needRefresh && (
        <div className="fixed bottom-24 left-0 right-0 z-50 px-margin-mobile animate-fade-in-up">
          <div className="bg-primary text-on-primary p-md rounded-card border border-on-primary/10 shadow-lg flex flex-col gap-sm max-w-md mx-auto text-left">
            <div className="flex items-start gap-sm">
              <span className="material-symbols-outlined text-secondary-container">update</span>
              <div>
                <p className="font-semibold text-sm">Mise à jour disponible</p>
                <p className="text-xs opacity-80 mt-xs">Une nouvelle version de Sama Boutik est disponible pour votre appareil.</p>
              </div>
            </div>
            <div className="flex gap-sm mt-xs">
              <button
                onClick={() => setNeedRefresh(false)}
                className="flex-1 text-xs font-semibold py-2 hover:bg-white/10 rounded-button transition-colors cursor-pointer"
              >
                Ignorer
              </button>
              <button
                onClick={() => updateServiceWorker(true)}
                className="flex-1 bg-secondary text-white text-xs font-semibold py-2 rounded-button shadow hover:bg-secondary/95 transition-all cursor-pointer"
              >
                Mettre à jour
              </button>
            </div>
          </div>
        </div>
      )}

      {/* App Install Banner */}
      {showInstallBanner && deferredPrompt && (
        <div className="fixed bottom-6 left-0 right-0 z-50 px-margin-mobile animate-fade-in-up">
          <div className="bg-card border border-border p-md rounded-card shadow-lg flex items-center justify-between gap-md max-w-md mx-auto text-left">
            <div className="flex items-center gap-sm min-w-0">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-white text-xl">shop</span>
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm text-on-surface truncate">Installer Sama Boutik</p>
                <p className="text-[11px] text-outline truncate">Accès rapide depuis votre écran d'accueil.</p>
              </div>
            </div>
            <div className="flex gap-xs shrink-0">
              <button
                onClick={() => setShowInstallBanner(false)}
                className="text-xs text-outline hover:text-on-surface px-2 py-1"
              >
                Plus tard
              </button>
              <Button
                onClick={handleInstallClick}
                size="md"
                className="text-xs h-9 px-3 shrink-0"
              >
                Installer
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PwaPrompt;
