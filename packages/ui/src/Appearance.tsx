import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
} from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { usePwaFeedback } from './PwaFeedback';

type Appearance = 'system' | 'light' | 'dark';
const storageKey = 'alf:pwa:appearance';
const mediaQuery = '(prefers-color-scheme: dark)';
const parseAppearance = (value: string | null): Appearance =>
  value === 'light' || value === 'dark' ? value : 'system';

function readAppearance(): Appearance {
  try {
    return parseAppearance(localStorage.getItem(storageKey));
  } catch {
    return 'system';
  }
}

const AppearanceContext = createContext<{
  preference: Appearance;
  resolved: 'light' | 'dark';
  saved: boolean;
  choose: (value: Appearance) => boolean;
} | null>(null);

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState(readAppearance);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia(mediaQuery).matches);
  const [saved, setSaved] = useState(true);
  const resolved = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;

  useEffect(() => {
    const media = window.matchMedia(mediaQuery);
    const changed = () => setSystemDark(media.matches);
    changed();
    media.addEventListener('change', changed);
    const stored = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null) {
        setPreference(readAppearance());
        setSaved(true);
      }
    };
    window.addEventListener('storage', stored);
    return () => {
      media.removeEventListener('change', changed);
      window.removeEventListener('storage', stored);
    };
  }, []);

  useLayoutEffect(() => {
    document.documentElement.dataset.pwaTheme = resolved;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', resolved === 'dark' ? '#101a16' : '#f6f8f7');
  }, [resolved]);

  function choose(value: Appearance) {
    setPreference(value);
    try {
      localStorage.setItem(storageKey, value);
      setSaved(true);
      return true;
    } catch {
      setSaved(false);
      return false;
    }
  }

  return (
    <AppearanceContext.Provider value={{ preference, resolved, saved, choose }}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function AppearanceSettings() {
  const feedback = usePwaFeedback();
  const appearance = useContext(AppearanceContext);
  if (!appearance) return null;
  return (
    <section className="appearance-settings" aria-label="Apparence">
      <h2>Apparence</h2>
      <p id="appearance-help">Choisissez le thème de votre PWA sur cet appareil.</p>
      <fieldset aria-describedby="appearance-help">
        <legend className="sr-only">Mode d’affichage</legend>
        {(
          [
            ['system', 'Automatique', Monitor],
            ['light', 'Clair', Sun],
            ['dark', 'Sombre', Moon],
          ] as const
        ).map(([value, label, Icon]) => (
          <label className="appearance-option" key={value}>
            <input
              type="radio"
              name="appearance"
              value={value}
              checked={appearance.preference === value}
              onChange={() => {
                const saved = appearance.choose(value);
                feedback.notify(
                  saved
                    ? `Mode ${label.toLowerCase()} enregistré sur cet appareil.`
                    : 'Thème appliqué pour cette visite. Le navigateur empêche son enregistrement.',
                  saved ? 'success' : 'info',
                );
              }}
            />
            <Icon size={22} aria-hidden="true" />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>
      <p role="status">
        {appearance.preference === 'system'
          ? `Suit le téléphone · thème ${appearance.resolved === 'dark' ? 'sombre' : 'clair'}.`
          : `Thème ${appearance.preference === 'dark' ? 'sombre' : 'clair'} activé.`}
        {!appearance.saved &&
          ' Votre choix est appliqué pour cette visite. Le navigateur empêche son enregistrement.'}
      </p>
    </section>
  );
}
