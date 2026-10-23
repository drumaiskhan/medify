const MAX_BYTES = 4 * 1024 * 1024;
const MAX_SIDE = 1400;

// Detect the actual bytes: Word sometimes supplies a missing or incorrect MIME type.
export function rasterType(bytes: Uint8Array): string | null {
  if (bytes.length >= 12 && bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71) return 'image/png';
  if (bytes.length >= 12 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp';
  return null;
}

async function decode(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    const finish = (error?: Error) => {
      clearTimeout(timer); img.onload = null; img.onerror = null; URL.revokeObjectURL(url);
      if (error) reject(error); else resolve(img);
    };
    const timer = setTimeout(() => finish(new Error('Image decoding timed out')), 15000);
    img.onload = () => finish(img.naturalWidth && img.naturalHeight ? undefined : new Error('Empty image'));
    img.onerror = () => finish(new Error('This image format cannot be decoded by the browser'));
    img.src = url;
  });
}

function encode(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(null), 5000);
    try { canvas.toBlob(blob => { clearTimeout(timer); resolve(blob); }, type, 0.85); }
    catch { clearTimeout(timer); resolve(null); }
  });
}

export async function prepareImage(base64: string, contentType: string) {
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const type = rasterType(bytes);
  const original = new Blob([bytes], { type: type || contentType });
  let width: number | undefined, height: number | undefined;
  let canvas: HTMLCanvasElement | undefined;
  try {
    const img = await decode(original);
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    width = Math.max(1, Math.round(img.naturalWidth * scale));
    height = Math.max(1, Math.round(img.naturalHeight * scale));
    canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height); ctx.drawImage(img, 0, 0, width, height);
    for (const mime of ['image/webp', 'image/jpeg', 'image/png']) {
      const blob = await encode(canvas, mime);
      if (blob && blob.size > 0 && blob.size <= MAX_BYTES && /^image\/(webp|jpeg|png)$/.test(blob.type)) {
        // Keep an already smaller supported original without needless recompression.
        return { blob: type && original.size <= blob.size ? original : blob, width, height };
      }
    }
  } catch {
    // Compression is optional for supported originals below the API size limit.
  } finally {
    if (canvas) { canvas.width = 0; canvas.height = 0; }
  }
  if (type && original.size > 0 && original.size <= MAX_BYTES) return { blob: original, width, height };
  if (type) throw new Error('This image exceeds 4 MB and could not be resized. Save it as a smaller PNG/JPG in Word.');
  throw new Error('Unsupported or damaged Word image. Replace this picture with a PNG/JPG in Word.');
}
