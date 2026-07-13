import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import type { Area, Point } from 'react-easy-crop';
import { Button } from './Button';
import { getCroppedImageDataUrl } from '../../lib/imageCrop';

interface ImageCropModalProps {
  imageSrc: string;
  /** Ratio largeur/hauteur de la case d'affichage produit — carré par défaut, comme les cartes produits. */
  aspect?: number;
  onCancel: () => void;
  onConfirm: (dataUrl: string) => void;
}

export const ImageCropModal: React.FC<ImageCropModalProps> = ({
  imageSrc,
  aspect = 1,
  onCancel,
  onConfirm,
}) => {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleCropComplete = useCallback((_croppedArea: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleValidate = async () => {
    if (!croppedAreaPixels) return;
    setIsProcessing(true);
    try {
      const dataUrl = await getCroppedImageDataUrl(imageSrc, croppedAreaPixels);
      onConfirm(dataUrl);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col overflow-hidden animate-fade-in">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 pt-safe pt-4 pb-3 bg-gradient-to-b from-black/70 to-transparent">
        <span className="text-white font-bold text-sm tracking-wide">Ajuster le cadrage</span>
        <button
          type="button"
          onClick={onCancel}
          className="w-9 h-9 bg-white/20 text-white rounded-full flex items-center justify-center hover:bg-white/30 active:scale-90 transition-all"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>

      {/* Zone de crop — la partie visible dans le cadre est exactement ce qui sera enregistré */}
      <div className="relative flex-1">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
          cropShape="rect"
          showGrid
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={handleCropComplete}
        />
      </div>

      {/* Contrôles */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 via-black/70 to-transparent pt-12 pb-safe pb-6 px-5 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-white/70 text-lg">zoom_out</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-primary"
            aria-label="Zoom"
          />
          <span className="material-symbols-outlined text-white/70 text-lg">zoom_in</span>
        </div>

        <p className="text-white/60 text-[10px] text-center uppercase tracking-wide font-semibold">
          Ce cadre correspond au rendu final dans la carte produit
        </p>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="flex-1 h-12 bg-white/15 text-white rounded-button font-semibold text-base active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
          >
            Annuler
          </button>
          <Button
            type="button"
            onClick={handleValidate}
            disabled={isProcessing || !croppedAreaPixels}
            className="flex-1"
          >
            {isProcessing ? 'Traitement…' : 'Valider le cadrage'}
          </Button>
        </div>
      </div>
    </div>
  );
};
