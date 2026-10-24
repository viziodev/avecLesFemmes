import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

/** Camera frames and uploaded images stay on this device. Only decoded member IDs reach the API. */
export function QrScanner({ onScan }: { onScan: (code: string) => Promise<void> }) {
  const video = useRef<HTMLVideoElement>(null);
  const callback = useRef(onScan);
  callback.current = onScan;
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const lock = useRef(false);
  useEffect(() => {
    let disposed = false;
    let stream: MediaStream | undefined;
    let lastCode = '';
    let timer: ReturnType<typeof setTimeout>;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    async function tick() {
      if (disposed) return;
      const v = video.current;
      if (v && v.readyState >= 2 && context && !lock.current) {
        canvas.width = Math.min(800, v.videoWidth);
        canvas.height = Math.round((canvas.width * v.videoHeight) / v.videoWidth);
        context.drawImage(v, 0, 0, canvas.width, canvas.height);
        const frame = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(frame.data, frame.width, frame.height);
        if (code && code.data !== lastCode) {
          lastCode = code.data;
          lock.current = true;
          try {
            await callback.current(code.data);
          } catch (e) {
            if (!disposed) setError((e as Error).message);
          } finally {
            lock.current = false;
          }
        }
      }
      if (!disposed) timer = setTimeout(tick, 400);
    }
    setError('');
    navigator.mediaDevices?.getUserMedia
      ? navigator.mediaDevices
          .getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
          .then(async (s) => {
            stream = s;
            if (disposed) {
              s.getTracks().forEach((t) => t.stop());
              return;
            }
            if (video.current) {
              video.current.srcObject = s;
              await video.current.play();
            }
            void tick();
          })
          .catch(() => {
            if (!disposed)
              setError('Caméra indisponible. Autorisez son accès ou choisissez une image du QR.');
          })
      : setError('Caméra indisponible sur ce navigateur. Choisissez une image du QR.');
    return () => {
      disposed = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [retry]);
  return (
    <div className="qr-scanner">
      <p>
        Cadrez le QR d’une membre inscrite à cette campagne. Vous vérifierez le montant avant de
        confirmer.
      </p>
      <video ref={video} muted playsInline aria-label="Caméra de lecture QR" />
      {error && <p role="alert">{error}</p>}
      <button type="button" className="secondary" onClick={() => setRetry((n) => n + 1)}>
        Réessayer la caméra
      </button>
      <label>
        Choisir une image du QR
        <input
          type="file"
          accept="image/*"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file || lock.current) return;
            if (file.size > 10 * 1024 * 1024) {
              setError('Image trop volumineuse (10 Mo maximum).');
              return;
            }
            lock.current = true;
            const url = URL.createObjectURL(file);
            try {
              const img = new Image();
              img.src = url;
              await img.decode();
              const canvas = document.createElement('canvas');
              const ratio = Math.min(1, 1600 / Math.max(img.width, img.height));
              canvas.width = Math.round(img.width * ratio);
              canvas.height = Math.round(img.height * ratio);
              const ctx = canvas.getContext('2d')!;
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(frame.data, frame.width, frame.height);
              if (!code) throw new Error('Aucun QR lisible dans cette image.');
              await callback.current(code.data);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              URL.revokeObjectURL(url);
              lock.current = false;
            }
          }}
        />
      </label>
    </div>
  );
}
