import React, { useState } from 'react';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { MontantInput } from '../components/ui/MontantInput';
import { Button } from '../components/ui/Button';
import type { Produit } from '../services/supabaseService';

export interface ProductFormInput {
  nom: string;
  prix: number;
  quantite: number;
  seuil_alerte: number;
  image_url?: string;
}

interface StockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: ProductFormInput) => Promise<boolean>;
  product: Produit | null;
  validationError: string | null;
}

export const StockModal: React.FC<StockModalProps> = ({
  isOpen,
  onClose,
  onSave,
  product,
  validationError,
}) => {
  const [nom, setNom] = useState(product?.nom || '');
  const [prix, setPrix] = useState(product?.prix.toString() || '');
  const [quantite, setQuantite] = useState(product?.quantite.toString() || '');
  const [seuilAlerte, setSeuilAlerte] = useState(product?.seuil_alerte.toString() || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const success = await onSave({
      nom,
      prix: parseFloat(prix),
      quantite: parseInt(quantite, 10),
      seuil_alerte: parseInt(seuilAlerte, 10),
    });
    setIsSubmitting(false);
    if (success) {
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={product ? "Modifier le produit" : "Ajouter un produit"}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-md">
        {validationError && (
          <div className="bg-error-container text-on-error-container text-xs p-sm rounded-lg font-medium">
            {validationError}
          </div>
        )}

        <Input
          label="Nom du produit"
          type="text"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          placeholder="Ex: Riz Long Grain 5kg"
          required
        />

        <div className="grid grid-cols-2 gap-sm">
          <MontantInput
            label="Prix (FCFA)"
            value={prix}
            onChange={setPrix}
            placeholder="Ex: 5000"
            required
          />
          <Input
            label="Quantité"
            type="number"
            value={quantite}
            onChange={(e) => setQuantite(e.target.value)}
            placeholder="Ex: 10"
            required
            min="0"
          />
        </div>

        <Input
          label="Seuil d'alerte (Stock faible)"
          type="number"
          value={seuilAlerte}
          onChange={(e) => setSeuilAlerte(e.target.value)}
          placeholder="Ex: 3"
          required
          min="0"
        />

        <div className="flex gap-sm mt-md">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="flex-1"
            disabled={isSubmitting}
          >
            Annuler
          </Button>
          <Button
            type="submit"
            className="flex-1"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
export default StockModal;
