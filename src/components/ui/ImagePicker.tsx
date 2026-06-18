import React, { useRef } from 'react';

interface ImagePickerProps {
  value: string;
  onChange: (dataUrl: string) => void;
  label?: string;
}

/**
 * Compresse une image côté client via Canvas.
 * Résultat : JPEG max 480px, qualité 0.78 → ~25-60 Ko typiquement.
 */
const compressImage = (file: File, maxPx = 480, quality = 0.78): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (evt) => {
      const src = evt.target?.result as string;
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const ratio = Math.min(maxPx / img.width, maxPx / img.height, 1);
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(src); return; }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });

export const ImagePicker: React.FC<ImagePickerProps> = ({
  value,
  onChange,
  label = 'Photo du Produit',
}) => {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined, ref: React.RefObject<HTMLInputElement>) => {
    if (!file) return;
    try {
      const dataUrl = await compressImage(file);
      onChange(dataUrl);
    } catch {
      onChange('');
    }
    // Reset input so the same file can be re-sélectionné
    if (ref.current) ref.current.value = '';
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      {/* Label */}
      <span className="text-[11px] text-on-surface-variant font-semibold uppercase tracking-wider">
        {label}
      </span>

      {/* Aperçu de l'image */}
      <div className="w-full h-32 rounded-2xl overflow-hidden border-2 border-dashed border-outline-variant bg-primary-container/20 flex items-center justify-center relative group">
        {value ? (
          <>
            <img
              src={value}
              alt="Aperçu produit"
              className="w-full h-full object-cover"
            />
            {/* Bouton supprimer l'image */}
            <button
              type="button"
              onClick={() => onChange('')}
              className="absolute top-2 right-2 bg-black/55 text-white w-7 h-7 rounded-full flex items-center justify-center hover:bg-black/75 active:scale-90 transition-all"
            >
              <span className="material-symbols-outlined text-[15px]">close</span>
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-outline pointer-events-none select-none">
            <span className="material-symbols-outlined text-4xl opacity-60">add_photo_alternate</span>
            <span className="text-[10px] font-bold uppercase tracking-wide opacity-60">Aucune photo</span>
          </div>
        )}
      </div>

      {/* Boutons d'action */}
      <div className="grid grid-cols-2 gap-2">
        {/* Galerie */}
        <button
          type="button"
          onClick={() => galleryRef.current?.click()}
          className="flex items-center justify-center gap-1.5 h-10 bg-primary-container text-on-primary-container rounded-xl font-bold text-xs active:scale-95 hover:opacity-90 transition-all premium-shadow-sm"
        >
          <span className="material-symbols-outlined text-[18px]">photo_library</span>
          Galerie
        </button>

        {/* Caméra */}
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          className="flex items-center justify-center gap-1.5 h-10 bg-secondary-container text-on-secondary-container rounded-xl font-bold text-xs active:scale-95 hover:opacity-90 transition-all premium-shadow-sm"
        >
          <span className="material-symbols-outlined text-[18px]">photo_camera</span>
          Caméra
        </button>
      </div>

      {/* Inputs file cachés */}
      {/* Galerie — sans capture, ouvre le sélecteur de fichiers/galerie */}
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0], galleryRef)}
      />
      {/* Caméra — capture="environment" = caméra arrière sur mobile */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0], cameraRef)}
      />
    </div>
  );
};
