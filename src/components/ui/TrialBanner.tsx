import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Toast } from './Toast';
import { useTranslation } from 'react-i18next';

interface TrialStatus {
  has_trial: boolean;
  status: 'trial' | 'trial_cancelled' | 'expired' | string;
  plan: 'starter' | 'pro' | 'annual' | string;
  trial_ends_at: string;
  cancellation_deadline: string;
  can_cancel: boolean;
  is_committed: boolean;
  is_expired: boolean;
  days_left: number;
  cancel_days_left: number;
}

interface TrialBannerProps {
  trialStatus: TrialStatus;
  onTrialExpired?: () => void;
}

export const TrialBanner: React.FC<TrialBannerProps> = ({ trialStatus, onTrialExpired }) => {
  const { t } = useTranslation();
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  React.useEffect(() => {
    if (trialStatus.is_expired) onTrialExpired?.();
  }, [trialStatus.is_expired]);

  if (trialStatus.is_expired) return null;

  const handleCancelTrial = async () => {
    setIsCancelling(true);
    try {
      const { error } = await supabase.rpc('cancel_free_trial');
      if (error) throw error;
      
      setToast({ message: t('common.succes'), type: 'success' });
      setShowConfirmModal(false);
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err: any) {
      setToast({ message: err.message || t('common.erreur'), type: 'error' });
    } finally {
      setIsCancelling(false);
    }
  };

  const { can_cancel, is_committed, days_left, cancel_days_left } = trialStatus;

  return (
    <div className="w-full px-4 pt-4 z-40">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      {can_cancel && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-2xl p-3 flex flex-col sm:flex-row justify-between items-center gap-3 text-left">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-400">info</span>
            <span className="text-xs font-bold uppercase tracking-wider">
              {t('trial_banner.actif_annulable', { days: days_left, cancel_days: cancel_days_left })}
            </span>
          </div>
          <button
            onClick={() => setShowConfirmModal(true)}
            className="h-8 px-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all active:scale-95 cursor-pointer border border-red-500/20"
          >
            {t('abonnement.annuler_essai')}
          </button>
        </div>
      )}

      {is_committed && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-2xl p-3 flex items-center gap-2 text-left">
          <span className="material-symbols-outlined text-emerald-400">check_circle</span>
          <span className="text-xs font-bold uppercase tracking-wider">
            {t('trial_banner.engage', { days: days_left })}
          </span>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[32px] w-full max-w-sm p-6 relative shadow-2xl text-left border border-slate-200">
            <h3 className="text-slate-900 font-black text-sm uppercase tracking-wider mb-2">⚠️ {t('abonnement.annuler_essai')}</h3>
            <p className="text-xs text-slate-500 leading-relaxed mb-5">
              {t('abonnement.annuler_confirmation')}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 h-10 border border-slate-200 text-[11px] font-black rounded-xl uppercase tracking-wider text-slate-600 hover:bg-slate-50 active:scale-95 transition-all cursor-pointer"
              >
                {t('common.annuler')}
              </button>
              <button
                onClick={handleCancelTrial}
                disabled={isCancelling}
                className="px-4 h-10 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-[11px] font-black rounded-xl uppercase tracking-wider active:scale-95 transition-all cursor-pointer flex items-center gap-2"
              >
                {isCancelling ? t('common.enregistrement') : t('common.confirmer')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
