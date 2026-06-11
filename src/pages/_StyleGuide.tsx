import React, { useState } from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { MoneyText } from '../components/ui/MoneyText';
import { Toast } from '../components/ui/Toast';
import { BottomSheet } from '../components/ui/BottomSheet';
import { Modal } from '../components/ui/Modal';
import { BottomNav } from '../components/ui/BottomNav';
import type { TabType } from '../components/ui/BottomNav';

export const StyleGuide: React.FC = () => {
  // Navigation State
  const [activeTab, setActiveTab] = useState<TabType>('caisse');

  // Interactive component states
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [inputValue, setInputValue] = useState('');
  const [inputError, setInputError] = useState('');

  const triggerToast = (message: string, type: 'success' | 'error') => {
    setToastType(type);
    setToastMessage(message);
  };

  const handleValidation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue) {
      setInputError('Ce champ est obligatoire.');
    } else {
      setInputError('');
      triggerToast('Validation réussie !', 'success');
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-background pb-32">
      {/* Top App Bar Header */}
      <header className="bg-primary text-on-primary fixed top-0 left-0 w-full z-40 h-14 flex items-center px-margin-mobile">
        <h1 className="font-headline-md text-headline-md">BoutikOS Guide de Style</h1>
      </header>

      {/* Main Content */}
      <main className="pt-20 px-margin-mobile max-w-lg mx-auto flex flex-col gap-lg">
        {/* Title */}
        <div className="text-left">
          <h2 className="font-headline-lg text-on-surface">Design System & UI Kit</h2>
          <p className="text-body-md text-on-surface-variant">
            Composants atomiques et typographie basés sur les maquettes Stitch.
          </p>
        </div>

        {/* Section: Typography */}
        <section className="flex flex-col gap-sm text-left">
          <h3 className="font-headline-sm border-b border-border pb-xs">Typographie</h3>
          <div className="flex flex-col gap-xs bg-card p-md border border-border rounded-card">
            <div>
              <span className="text-[10px] text-outline font-bold">HEADLINE LG (28px/Bold/DM Sans)</span>
              <p className="font-headline-lg">Titre Principal</p>
            </div>
            <div>
              <span className="text-[10px] text-outline font-bold">HEADLINE MD (20px/Bold/DM Sans)</span>
              <p className="font-headline-md">Titre Section</p>
            </div>
            <div>
              <span className="text-[10px] text-outline font-bold">HEADLINE SM (18px/SemiBold/DM Sans)</span>
              <p className="font-headline-sm">Sous-titre / En-tête de carte</p>
            </div>
            <div>
              <span className="text-[10px] text-outline font-bold">BODY LG (16px/Regular/Inter)</span>
              <p className="font-body-lg">Corps de texte large</p>
            </div>
            <div>
              <span className="text-[10px] text-outline font-bold">BODY MD (14px/Regular/Inter)</span>
              <p className="font-body-md">Corps de texte moyen</p>
            </div>
            <div>
              <span className="text-[10px] text-outline font-bold">LABEL MD (12px/SemiBold/Inter/0.05em)</span>
              <p className="font-label-md">LIBELLÉ OU INSCRIPTION</p>
            </div>
            <div>
              <span className="text-[10px] text-outline font-bold">NUMERIC DISPLAY (22px/Bold/DM Sans/Tabular-nums)</span>
              <div className="font-numeric-display text-primary">1 250 000 FCFA</div>
            </div>
          </div>
        </section>

        {/* Section: Buttons */}
        <section className="flex flex-col gap-sm text-left">
          <h3 className="font-headline-sm border-b border-border pb-xs">Boutons</h3>
          <div className="flex flex-col gap-sm bg-card p-md border border-border rounded-card">
            <Button variant="primary">Bouton Principal (lg - 48px)</Button>
            <Button variant="ghost">Bouton Ghost</Button>
            <Button variant="danger">Bouton Danger</Button>
            <div className="flex gap-sm">
              <Button variant="primary" size="md" className="flex-1">Taille MD</Button>
              <Button variant="danger" size="md" className="flex-1">Taille MD</Button>
            </div>
          </div>
        </section>

        {/* Section: Cards & Badges */}
        <section className="flex flex-col gap-sm text-left">
          <h3 className="font-headline-sm border-b border-border pb-xs">Cartes & Badges</h3>
          <div className="flex flex-col gap-md">
            <Card elevation={1}>
              <h4 className="font-headline-sm mb-xs">Carte Standard (Élévation 1)</h4>
              <p className="text-body-md text-on-surface-variant">Simple bordure 1px sans ombre pour une clarté optimale.</p>
              <div className="flex gap-xs mt-sm flex-wrap">
                <Badge variant="success">En Stock</Badge>
                <Badge variant="warning">Alerte</Badge>
                <Badge variant="danger">Rupture</Badge>
                <Badge variant="neutral">Neutre</Badge>
              </div>
            </Card>

            <Card elevation={2}>
              <h4 className="font-headline-sm mb-xs">Carte Ombres (Élévation 2)</h4>
              <p className="text-body-md text-on-surface-variant">Ombre douce et diffuse pour faire ressortir l'élément interactif.</p>
            </Card>
          </div>
        </section>

        {/* Section: Input & Forms */}
        <section className="flex flex-col gap-sm text-left">
          <h3 className="font-headline-sm border-b border-border pb-xs">Saisie de Données</h3>
          <form onSubmit={handleValidation} className="flex flex-col gap-sm bg-card p-md border border-border rounded-card">
            <Input
              label="Nom du produit"
              placeholder="Ex: Sac de Riz 5kg"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                if (inputError) setInputError('');
              }}
              error={inputError}
            />
            <Button type="submit" variant="primary" size="md" className="self-end mt-sm">
              Valider le champ
            </Button>
          </form>
        </section>

        {/* Section: Money Formatting */}
        <section className="flex flex-col gap-sm text-left">
          <h3 className="font-headline-sm border-b border-border pb-xs">Formatage Monétaire</h3>
          <div className="bg-card p-md border border-border rounded-card flex justify-between items-center">
            <span className="font-label-md">Prix unitaire</span>
            <MoneyText value={7500} className="text-xl text-primary font-bold" />
          </div>
        </section>

        {/* Section: Modals & Sheets */}
        <section className="flex flex-col gap-sm text-left">
          <h3 className="font-headline-sm border-b border-border pb-xs">Modales & Alertes</h3>
          <div className="flex flex-col gap-sm bg-card p-md border border-border rounded-card">
            <Button onClick={() => triggerToast('Opération réussie !', 'success')}>
              Déclencher Toast Succès
            </Button>
            <Button variant="danger" onClick={() => triggerToast('Erreur de connexion.', 'error')}>
              Déclencher Toast Erreur
            </Button>
            <Button variant="ghost" onClick={() => setIsSheetOpen(true)}>
              Ouvrir le BottomSheet
            </Button>
            <Button variant="ghost" onClick={() => setIsModalOpen(true)}>
              Ouvrir la Modale
            </Button>
          </div>
        </section>
      </main>

      {/* Dynamic Overlays */}
      {toastMessage && (
        <Toast
          message={toastMessage}
          type={toastType}
          onClose={() => setToastMessage(null)}
        />
      )}

      <BottomSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        title="Détails du Panier"
      >
        <div className="flex flex-col gap-md text-left">
          <p className="text-body-md">Voici les articles ajoutés à la caisse.</p>
          <div className="flex justify-between border-t pt-sm border-border">
            <span className="font-bold">Total :</span>
            <MoneyText value={25000} className="font-bold text-primary" />
          </div>
        </div>
      </BottomSheet>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Confirmation"
      >
        <div className="flex flex-col gap-md text-left">
          <p className="text-body-md">Êtes-vous sûr de vouloir archiver ce produit ?</p>
          <div className="flex gap-sm mt-sm">
            <Button variant="ghost" size="md" className="flex-1" onClick={() => setIsModalOpen(false)}>
              Annuler
            </Button>
            <Button variant="danger" size="md" className="flex-1" onClick={() => {
              setIsModalOpen(false);
              triggerToast('Produit archivé', 'success');
            }}>
              Confirmer
            </Button>
          </div>
        </div>
      </Modal>

      {/* Bottom Navigation */}
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
};

export default StyleGuide;
