import React, { useState } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Select } from './ui/Select';
import { Input } from './ui/Input';
import { useOnline } from '../hooks/useOnline';
import { signalementService } from '../services/signalementService';

interface SignalementModalProps {
  isOpen: boolean;
  onClose: () => void;
  boutiqueId: string;
}

export const SignalementModal: React.FC<SignalementModalProps> = ({
  isOpen,
  onClose,
  boutiqueId,
}) => {
  const isOnline = useOnline();
  const [type, setType] = useState<'bug' | 'suggestion' | 'plainte' | 'autre'>('bug');
  const [sujet, setSujet] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (sujet.trim().length < 3) {
      setErrorMsg('Le sujet doit contenir au moins 3 caractères.');
      return;
    }

    if (message.trim().length < 10) {
      setErrorMsg('La description doit contenir au moins 10 caractères.');
      return;
    }

    setLoading(true);
    try {
      const res = await signalementService.createSignalement(
        boutiqueId,
        type,
        sujet,
        message,
        isOnline
      );

      if (res.success) {
        if (res.offline) {
          setSuccessMsg("Signalement enregistré localement (hors-ligne). Il sera envoyé dès le retour d'Internet.");
        } else {
          setSuccessMsg("Signalement envoyé, merci !");
        }
        setSujet('');
        setMessage('');
        setType('bug');
      } else {
        setErrorMsg(res.error || "Une erreur est survenue lors de l'envoi.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Une erreur inattendue est survenue.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Signaler un problème">
      {successMsg ? (
        <div className="flex flex-col items-center justify-center py-6 text-center gap-4">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-600">
            <span className="material-symbols-outlined text-2xl">check_circle</span>
          </div>
          <p className="text-sm font-bold text-on-surface">{successMsg}</p>
          <Button onClick={onClose} className="mt-2 w-full">Fermer</Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Select
            label="Catégorie"
            value={type}
            onChange={(val) => setType(val as any)}
            options={[
              { value: 'bug', label: 'Bug / Dysfonctionnement' },
              { value: 'suggestion', label: 'Suggestion d\'amélioration' },
              { value: 'plainte', label: 'Problème de Paiement/Facturation' },
              { value: 'autre', label: 'Autre demande' },
            ]}
          />

          <Input
            label="Sujet"
            value={sujet}
            onChange={(e) => setSujet(e.target.value)}
            placeholder="Ex: La caisse ne s'ouvre plus"
            required
            disabled={loading}
          />

          <div className="flex flex-col text-left w-full">
            <label className="font-label-md text-label-md text-on-surface-variant mb-xs font-semibold uppercase tracking-wider">
              Description du problème
            </label>
            <textarea
              className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl p-md text-body-lg text-on-surface outline-none transition-all focus:ring-2 focus:ring-primary focus:border-transparent min-h-[120px] resize-none"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Veuillez décrire le problème avec le plus de précisions possibles (actions effectuées, messages affichés, etc.)"
              required
              disabled={loading}
              maxLength={1000}
            />
            <div className="flex justify-between items-center mt-1 text-[10px] text-outline font-semibold">
              <span>Min. 10 caractères</span>
              <span>{message.length} / 1000</span>
            </div>
          </div>

          {!isOnline && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex gap-2.5 items-center">
              <span className="material-symbols-outlined text-amber-600 text-lg flex-shrink-0">wifi_off</span>
              <span className="text-[10px] font-bold text-amber-800 leading-normal">
                Vous êtes hors-ligne. Le signalement sera mis en attente et envoyé automatiquement à la reconnexion.
              </span>
            </div>
          )}

          {errorMsg && (
            <p className="text-xs text-error font-bold text-left">{errorMsg}</p>
          )}

          <div className="flex gap-3 justify-end mt-2">
            <Button
              type="button"
              onClick={onClose}
              variant="ghost"
              disabled={loading}
              className="flex-1 sm:flex-none"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 sm:flex-none"
            >
              {loading ? 'Envoi...' : 'Envoyer'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
