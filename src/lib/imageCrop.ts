interface PixelCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.crossOrigin = 'anonymous';
    image.src = src;
  });

/**
 * Découpe une image source selon une zone en pixels (fournie par react-easy-crop)
 * et la redessine sur un canvas carré de taille fixe, pour obtenir un rendu
 * cohérent avec le reste de la compression d'images du projet.
 */
export async function getCroppedImageDataUrl(
  imageSrc: string,
  crop: PixelCrop,
  outputSize = 480,
  quality = 0.78,
): Promise<string> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) return imageSrc;

  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    outputSize,
    outputSize,
  );

  return canvas.toDataURL('image/jpeg', quality);
}
