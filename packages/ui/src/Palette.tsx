import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { api } from '@aveclesfemmes/api-client';
import { usePwaFeedback } from './PwaFeedback';

export const defaultPalette = {
  primary: '#155d50',
  savings: '#197647',
  tontine: '#6d3fc0',
  solidarity: '#a85d12',
};
export type Palette = typeof defaultPalette;
type Rgb = [number, number, number];
const rgb = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
const mix = (a: Rgb, b: Rgb, weight: number): Rgb =>
  a.map((v, i) => Math.round(v * (1 - weight) + b[i] * weight)) as Rgb;
const hex = (color: Rgb) => '#' + color.map((v) => v.toString(16).padStart(2, '0')).join('');
function luminance(color: Rgb) {
  return color
    .map((v) => v / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
}
export function contrast(a: string, b: string) {
  const values = [luminance(rgb(a)), luminance(rgb(b))].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
function readable(color: string, backgrounds: string[], lighten = false) {
  for (let step = 0; step <= 100; step++) {
    const shade = hex(mix(rgb(color), lighten ? [255, 255, 255] : [0, 0, 0], step / 100));
    if (backgrounds.every((background) => contrast(shade, background) >= 4.6)) return shade;
  }
  return lighten ? '#ffffff' : '#000000';
}
export function validPalette(value: unknown): value is Palette {
  return (
    !!value &&
    typeof value === 'object' &&
    Object.keys(defaultPalette).every((key) =>
      /^#[0-9a-f]{6}$/i.test(String((value as Record<string, unknown>)[key])),
    )
  );
}
export function paletteStyle(palette: Palette, dark: boolean): CSSProperties {
  const vars: Record<string, string> = {};
  const darkInks: Palette = {
    primary: '#8bd9bd',
    savings: '#8fdfb0',
    tontine: '#d0b2ff',
    solidarity: '#f3c17d',
  };
  for (const [name, color] of Object.entries(palette)) {
    const tint = hex(mix(rgb(color), dark ? [24, 38, 32] : [255, 255, 255], dark ? 0.9 : 0.94));
    // Check every real receiving surface, including the navigation's selected fill.
    // Legacy surfaces remain here for compatibility with installed older components.
    const backgrounds = dark
      ? [tint, '#101a16', '#182620', '#21362c', '#192e26', '#21382e', '#193e31']
      : [tint, '#ffffff', '#f6f8f7', '#edf3ef', '#f4f7f5', '#eaf3ee'];
    const preferred =
      dark && color.toLowerCase() === defaultPalette[name as keyof Palette]
        ? darkInks[name as keyof Palette]
        : color;
    vars[`--palette-${name}-solid`] = readable(color, ['#ffffff']);
    vars[`--palette-${name}-ink`] = readable(preferred, backgrounds, dark);
    vars[`--palette-${name}-tint`] = tint;
  }
  vars['--navigation-selected-foreground'] = vars['--palette-primary-ink'];
  vars['--navigation-selected-background'] = vars['--palette-primary-tint'];
  vars['--focus-color'] = vars['--palette-primary-ink'];
  vars['--green'] = vars['--palette-primary-ink'];
  vars['--action'] = vars['--palette-primary-solid'];
  return vars as CSSProperties;
}

export function similarCampaignColors(palette: Palette) {
  const keys = ['savings', 'tontine', 'solidarity'] as const;
  const labels = { savings: 'Épargne', tontine: 'Tontine', solidarity: 'Solidarité' };
  return keys.flatMap((a, i) =>
    keys
      .slice(i + 1)
      .flatMap((b) =>
        Math.hypot(...rgb(palette[a]).map((v, channel) => v - rgb(palette[b])[channel])) < 60
          ? [`${labels[a]} et ${labels[b]}`]
          : [],
      ),
  );
}

const PaletteContext = createContext<{
  palette: Palette;
  loaded: boolean;
  error: string;
  refresh: () => Promise<void>;
  save: (palette: Palette) => Promise<void>;
  groupId: string | null;
  setGroupId: (groupId: string | null) => void;
  reset: () => Promise<void>;
} | null>(null);
export function PaletteProvider({ children }: { children: ReactNode }) {
  const [palette, setPalette] = useState(defaultPalette);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const revision = useRef(0);
  async function refresh() {
    const version = ++revision.current;
    try {
      const r = groupId
        ? await api.GET('/api/v1/groupements/{groupId}/appearance', {
            params: { path: { groupId } },
          })
        : await api.GET('/api/v1/appearance');
      if (!r.response.ok || !validPalette(r.data)) throw new Error();
      if (revision.current !== version) return;
      setPalette(r.data);
      setLoaded(true);
      setError('');
    } catch {
      if (revision.current === version)
        setError('Les couleurs communes ne sont pas disponibles. Réessayez.');
    }
  }
  useEffect(() => {
    void refresh();
    const visible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const timer = window.setInterval(visible, 300000);
    window.addEventListener('focus', visible);
    window.addEventListener('online', visible);
    document.addEventListener('visibilitychange', visible);
    return () => {
      revision.current++;
      clearInterval(timer);
      window.removeEventListener('focus', visible);
      window.removeEventListener('online', visible);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [groupId]);
  useLayoutEffect(() => {
    function apply() {
      const vars = paletteStyle(palette, document.documentElement.dataset.pwaTheme === 'dark');
      for (const el of [document.documentElement, document.body])
        for (const [key, value] of Object.entries(vars)) el.style.setProperty(key, String(value));
    }
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-pwa-theme'],
    });
    return () => observer.disconnect();
  }, [palette]);
  async function save(next: Palette) {
    ++revision.current;
    const r = groupId
      ? await api.PUT('/api/v1/groupements/{groupId}/appearance', {
          params: { path: { groupId } },
          body: next,
        })
      : await api.PUT('/api/v1/appearance', { body: next });
    if (!r.response.ok || !validPalette(r.data))
      throw new Error(
        'Enregistrement impossible. Vérifiez votre connexion et vos droits, puis réessayez.',
      );
    ++revision.current;
    setPalette(r.data);
    setLoaded(true);
    setError('');
  }
  async function reset() {
    if (!groupId) return;
    const r = await api.DELETE('/api/v1/groupements/{groupId}/appearance', {
      params: { path: { groupId } },
    });
    if (!r.response.ok || !validPalette(r.data))
      throw new Error('Restauration impossible. Réessayez en ligne.');
    setPalette(r.data);
  }
  return (
    <PaletteContext.Provider
      value={{ palette, loaded, error, refresh, save, groupId, setGroupId, reset }}
    >
      {children}
    </PaletteContext.Provider>
  );
}

export function useGroupPalette(groupId: string | null) {
  const setScope = useContext(PaletteContext)?.setGroupId;
  useEffect(() => {
    setScope?.(groupId || null);
    return () => setScope?.(null);
  }, [groupId, setScope]);
}

export function PlatformColors() {
  const feedback = usePwaFeedback();
  const settings = useContext(PaletteContext)!;
  const [draft, setDraft] = useState(settings.palette);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (message) feedback.notify(message, 'success');
  }, [message, feedback.notify]);
  useEffect(() => {
    if (error) feedback.notify(error, 'error');
  }, [error, feedback.notify]);
  useEffect(() => {
    if (!dirty) setDraft(settings.palette);
  }, [settings.palette, dirty]);
  const valid = validPalette(draft);
  const similar = valid ? similarCampaignColors(draft) : [];
  return (
    <section className="platform-colors" aria-label="Couleurs de l’application">
      <h2>{settings.groupId ? 'Couleurs du groupement' : 'Couleurs de l’application'}</h2>
      <p>
        {settings.groupId
          ? 'Une palette pour votre groupement et ses membres.'
          : 'Une palette commune aux groupements sans personnalisation.'}{' '}
        Les modes clair et sombre restent au choix de chaque personne.
      </p>
      {settings.error && (
        <div role="alert">
          {settings.error}{' '}
          <button className="secondary" onClick={() => void settings.refresh()}>
            Réessayer
          </button>
        </div>
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy || !valid) return;
          setBusy(true);
          setMessage('');
          setError('');
          try {
            await settings.save(draft);
            setDirty(false);
            setMessage(
              settings.groupId
                ? 'Couleurs enregistrées pour votre groupement.'
                : 'Couleurs enregistrées pour toute l’application.',
            );
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy || !settings.loaded} className="palette-fields">
          <legend className="sr-only">Palette commune</legend>
          {(
            [
              ['primary', 'Couleur principale'],
              ['savings', 'Épargne'],
              ['tontine', 'Tontine'],
              ['solidarity', 'Solidarité'],
            ] as const
          ).map(([key, label]) => (
            <div className="palette-field" key={key}>
              <label htmlFor={`palette-${key}`}>{label}</label>
              <div>
                <input
                  type="color"
                  aria-label={`Choisir la couleur ${label}`}
                  value={/^#[0-9a-f]{6}$/i.test(draft[key]) ? draft[key] : defaultPalette[key]}
                  onChange={(e) => {
                    setDraft({ ...draft, [key]: e.target.value });
                    setDirty(true);
                    setMessage('');
                  }}
                />
                <input
                  id={`palette-${key}`}
                  value={draft[key]}
                  maxLength={7}
                  pattern="#[0-9a-fA-F]{6}"
                  required
                  spellCheck={false}
                  onChange={(e) => {
                    setDraft({ ...draft, [key]: e.target.value });
                    setDirty(true);
                    setMessage('');
                  }}
                />
              </div>
            </div>
          ))}
        </fieldset>
        <p>
          Les nuances du texte et des boutons sont ajustées pour préserver la lisibilité. Les
          alertes et le QR gardent leurs couleurs fonctionnelles.
        </p>
        {similar.length > 0 && (
          <p className="palette-similarity" role="status">
            Couleurs proches : {similar.join(' ; ')}. Choisissez des teintes plus distinctes pour
            reconnaître les types. Le nom et l’icône restent affichés.
          </p>
        )}
        <div className="palette-previews">
          {([false, true] as const).map((dark) => (
            <section
              key={String(dark)}
              className={`palette-preview ${dark ? 'dark' : ''}`}
              style={paletteStyle(valid ? draft : defaultPalette, dark)}
              aria-label={`Aperçu ${dark ? 'sombre' : 'clair'}`}
            >
              <h3>Mode {dark ? 'sombre' : 'clair'}</h3>
              <div className="palette-preview-header">Mon groupement</div>
              <div className="palette-preview-campaigns">
                {(['savings', 'tontine', 'solidarity'] as const).map((key, i) => (
                  <span
                    key={key}
                    style={{
                      color: `var(--palette-${key}-ink)`,
                      background: `var(--palette-${key}-tint)`,
                    }}
                  >
                    {['Épargne', 'Tontine', 'Solidarité'][i]}
                  </span>
                ))}
              </div>
              <strong>12 500 FCFA</strong>
              <span className="palette-preview-action">Faire un versement</span>
            </section>
          ))}
        </div>
        {error && <p role="alert">{error}</p>}
        {message && <p role="status">{message}</p>}
        <div className="palette-actions">
          {settings.groupId && (
            <button
              type="button"
              className="secondary"
              disabled={busy || !settings.loaded}
              onClick={async () => {
                setBusy(true);
                setError('');
                try {
                  await settings.reset();
                  setDirty(false);
                  setMessage('Couleurs de la plateforme rétablies pour ce groupement.');
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Utiliser les couleurs de la plateforme
            </button>
          )}
          <button
            className="secondary"
            type="button"
            disabled={busy || !settings.loaded}
            onClick={() => {
              setDraft(defaultPalette);
              setDirty(true);
              setMessage('');
            }}
          >
            Rétablir les couleurs par défaut
          </button>
          <button className="primary" disabled={busy || !settings.loaded || !valid || !dirty}>
            {busy ? 'Enregistrement…' : 'Enregistrer les couleurs'}
          </button>
        </div>
      </form>
    </section>
  );
}
