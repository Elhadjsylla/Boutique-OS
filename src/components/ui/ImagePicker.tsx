import React, { useRef, useState, useEffect } from 'react';

/* ─── Compression via Canvas ─────────────────────────────────────────────── */
const compressFromFile = (file: File, maxPx = 480, quality = 0.78): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (evt) => {
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
        if (!ctx) { resolve(evt.target?.result as string); return; }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = evt.target?.result as string;
    };
    reader.readAsDataURL(file);
  });

/* ─── Modale de capture caméra (getUserMedia) ────────────────────────────── */
interface CameraModalProps {
  onCapture: (dataUrl: string) => void;
  onClose: () => void;
}

const CameraModal: React.FC<CameraModalProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            if (!cancelled) videoRef.current?.play().then(() => setReady(true));
          };
        }
      } catch {
        if (!cancelled) setError("Impossible d'accéder à la caméra.\nVérifiez les autorisations du navigateur.");
      }
    };
    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const stopAndClose = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onClose();
  };

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video) return;
    const maxPx = 480;
    const ratio = Math.min(maxPx / video.videoWidth, maxPx / video.videoHeight, 1);
    const w = Math.round(video.videoWidth * ratio);
    const h = Math.round(video.videoHeight * ratio);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.78);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onCapture(dataUrl);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col overflow-hidden animate-fade-in">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 pt-safe pt-4 pb-3 bg-gradient-to-b from-black/70 to-transparent">
        <span className="text-white font-bold text-sm tracking-wide">📸 Prendre une photo</span>
        <button
          onClick={stopAndClose}
          className="w-9 h-9 bg-white/20 text-white rounded-full flex items-center justify-center hover:bg-white/30 active:scale-90 transition-all"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>

      {/* Flux vidéo */}
      {error ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-4">
          <span className="material-symbols-outlined text-white/50 text-6xl">no_photography</span>
          <p className="text-white/80 text-sm leading-relaxed whitespace-pre-line">{error}</p>
          <button
            onClick={stopAndClose}
            className="mt-2 px-5 py-2.5 bg-white/20 text-white rounded-xl font-bold text-sm active:scale-95 transition-all"
          >
            Fermer
          </button>
        </div>
      ) : (
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
          autoPlay
        />
      )}

      {/* Overlay sombre en bas */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />

      {/* Bouton capture */}
      {ready && !error && (
        <div className="absolute bottom-10 left-0 right-0 flex items-center justify-center gap-8">
          {/* Annuler */}
          <button
            onClick={stopAndClose}
            className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center active:scale-90 transition-all"
          >
            <span className="material-symbols-outlined text-white text-2xl">close</span>
          </button>

          {/* Déclencheur principal */}
          <button
            onClick={handleCapture}
            className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-2xl border-4 border-white/40 active:scale-90 transition-all"
          >
            <div className="w-14 h-14 rounded-full bg-white border-4 border-gray-300 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-3xl">photo_camera</span>
            </div>
          </button>

          {/* Placeholder pour centrer */}
          <div className="w-12 h-12" />
        </div>
      )}

      {/* Indicateur chargement */}
      {!ready && !error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin" />
            <span className="text-white text-xs font-semibold">Démarrage de la caméra…</span>
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── ImagePicker principal ──────────────────────────────────────────────── */
interface ImagePickerProps {
  value: string;
  onChange: (dataUrl: string) => void;
  label?: string;
}

export const ImagePicker: React.FC<ImagePickerProps> = ({
  value,
  onChange,
  label = 'Photo du Produit',
}) => {
  const galleryRef = useRef<HTMLInputElement>(null);
  const [showCamera, setShowCamera] = useState(false);

  const handleFileChange = async (file: File | undefined) => {
    if (!file) return;
    const dataUrl = await compressFromFile(file);
    onChange(dataUrl);
    if (galleryRef.current) galleryRef.current.value = '';
  };

  const handleCapture = (dataUrl: string) => {
    setShowCamera(false);
    onChange(dataUrl);
  };

  return (
    <>
      <div className="flex flex-col gap-2 w-full">
        {/* Label */}
        <span className="text-[11px] text-on-surface-variant font-semibold uppercase tracking-wider">
          {label}
        </span>

        {/* Aperçu */}
        <div className="w-full h-32 rounded-2xl overflow-hidden border-2 border-dashed border-outline-variant bg-primary-container/20 flex items-center justify-center relative">
          {value ? (
            <>
              <img src={value} alt="Aperçu produit" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => onChange('')}
                className="absolute top-2 right-2 bg-black/55 text-white w-7 h-7 rounded-full flex items-center justify-center hover:bg-black/75 active:scale-90 transition-all"
              >
                <span className="material-symbols-outlined text-[15px]">close</span>
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-1.5 text-outline select-none pointer-events-none">
              <span className="material-symbols-outlined text-4xl opacity-50">add_photo_alternate</span>
              <span className="text-[10px] font-bold uppercase tracking-wide opacity-50">Aucune photo</span>
            </div>
          )}
        </div>

        {/* Boutons */}
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

          {/* Caméra — getUserMedia */}
          <button
            type="button"
            onClick={() => setShowCamera(true)}
            className="flex items-center justify-center gap-1.5 h-10 bg-secondary-container text-on-secondary-container rounded-xl font-bold text-xs active:scale-95 hover:opacity-90 transition-all premium-shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">photo_camera</span>
            Caméra
          </button>
        </div>

        {/* Input galerie caché */}
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFileChange(e.target.files?.[0])}
        />
      </div>

      {/* Modale caméra full-screen */}
      {showCamera && (
        <CameraModal
          onCapture={handleCapture}
          onClose={() => setShowCamera(false)}
        />
      )}
    </>
  );
};
