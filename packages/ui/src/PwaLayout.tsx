import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Eye, EyeOff, QrCode, CheckCircle2, Clock, AlertCircle, WifiOff } from 'lucide-react';
import { campaignColors } from './CampaignVisuals';

type PwaPage = {
  tab: string;
  personalMode: boolean;
  adminSubView: 'dashboard' | 'settings' | 'chiffres';
};
export function usePwaNavigation(
  page: PwaPage,
  enabled: boolean,
  restore: (page: PwaPage) => void,
) {
  const previous = useRef('');
  const restoreRef = useRef(restore);
  restoreRef.current = restore;
  const serialized = JSON.stringify(page);
  useEffect(() => {
    if (!enabled) {
      previous.current = '';
      return;
    }
    if (previous.current === serialized) return;
    const state = { ...history.state, alfPwaPage: JSON.parse(serialized) };
    if (!previous.current) history.replaceState(state, '');
    else history.pushState(state, '');
    previous.current = serialized;
  }, [enabled, serialized]);
  useEffect(() => {
    if (!enabled) return;
    const back = (event: PopStateEvent) => {
      const value = event.state?.alfPwaPage;
      if (
        !value ||
        !['overview', 'campaigns', 'payments', 'members', 'more', 'history', 'archives'].includes(
          value.tab,
        ) ||
        !['dashboard', 'settings', 'chiffres'].includes(value.adminSubView) ||
        typeof value.personalMode !== 'boolean'
      )
        return;
      previous.current = JSON.stringify(value);
      restoreRef.current(value);
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('popstate', back);
    return () => window.removeEventListener('popstate', back);
  }, [enabled]);
}

export function useMoneyVisibility() {
  const [visible, setVisible] = useState(() => {
    try {
      return localStorage.getItem('alf:pwa:show-amounts') !== 'false';
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('alf:pwa:show-amounts', String(visible));
    } catch {}
  }, [visible]);
  return [visible, setVisible] as const;
}

export function MoneyVisibility({ visible, onChange }: { visible: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      className="icon-button money-visibility"
      onClick={onChange}
      aria-label={visible ? 'Masquer les montants' : 'Afficher les montants'}
      aria-pressed={!visible}
    >
      {visible ? <EyeOff size={21} /> : <Eye size={21} />}
    </button>
  );
}

export function CompactIdentity({
  group,
  person,
  onCard,
  cardLabel,
}: {
  group: string;
  person: string;
  onCard: () => void;
  cardLabel: string;
}) {
  return (
    <section className="pwa-compact-identity" aria-label="Identité du groupement et du membre">
      <div>
        <strong>{group}</strong>
        <span>{person}</span>
      </div>
      <button
        type="button"
        className="pwa-card-button"
        aria-label={cardLabel}
        onClick={(event) => {
          event.currentTarget.focus();
          onCard();
        }}
      >
        <QrCode size={22} aria-hidden="true" />
        <span>Ma carte</span>
      </button>
    </section>
  );
}

export function DayActionCard({
  title,
  type,
  state,
  period,
  children,
  visible,
  onVisibility,
}: {
  title: string;
  type: string;
  state: string;
  period: string;
  children: ReactNode;
  visible: boolean;
  onVisibility: () => void;
}) {
  const tone =
    state === 'Indisponible'
      ? 'error'
      : state === 'Hors connexion'
        ? 'warning'
        : ['Ouverte', 'Tirage effectué', 'Déjà versé'].includes(state)
          ? 'success'
          : 'neutral';
  const StateIcon =
    state === 'Hors connexion'
      ? WifiOff
      : tone === 'error'
        ? AlertCircle
        : tone === 'success'
          ? CheckCircle2
          : Clock;
  return (
    <section className="pwa-day-card" style={campaignColors(type)} aria-label="Action du jour">
      <div className="pwa-day-heading">
        <div>
          <h2>{title}</h2>
          <p>{type}</p>
        </div>
        <MoneyVisibility visible={visible} onChange={onVisibility} />
      </div>
      <div className="pwa-period">
        <span className="pwa-day-state" data-tone={tone}>
          <StateIcon aria-hidden="true" />
          {state}
        </span>
        <span>{period}</span>
      </div>
      {children}
    </section>
  );
}
