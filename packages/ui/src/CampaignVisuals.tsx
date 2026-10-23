import { useEffect, useState, type CSSProperties } from 'react';
import QRCode from 'qrcode';
export function campaignColors(type: string): CSSProperties {
  const normalized = type
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const hue = normalized.includes('tontine')
    ? 270
    : /avec|epargne/.test(normalized)
      ? 155
      : normalized.includes('solidarite')
        ? 25
        : [...normalized].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) % 360, 200);
  const key = normalized.includes('tontine')
    ? 'tontine'
    : /avec|epargne/.test(normalized)
      ? 'savings'
      : normalized.includes('solidarite')
        ? 'solidarity'
        : null;
  return key
    ? ({
        '--campaign-color': `var(--palette-${key}-ink)`,
        '--campaign-solid': `var(--palette-${key}-solid)`,
        '--campaign-tint': `var(--palette-${key}-tint)`,
      } as CSSProperties)
    : ({
        '--campaign-color': `hsl(${hue} 65% var(--campaign-ink-lightness, 28%))`,
        '--campaign-solid': `hsl(${hue} 65% 28%)`,
        '--campaign-tint': `hsl(${hue} 70% var(--campaign-tint-lightness, 94%))`,
      } as CSSProperties);
}

export function VectorQrView({ data, width = 170 }: { data: string; width?: number }) {
  const [svg, setSvg] = useState('');
  useEffect(() => {
    if (!data) return;
    QRCode.toString(data, { type: 'svg', margin: 1, width })
      .then(setSvg)
      .catch(() => {});
  }, [data, width]);

  return (
    <div
      className="wave-qr-code-svg"
      dangerouslySetInnerHTML={{ __html: svg }}
      style={{ width, height: width }}
    />
  );
}
