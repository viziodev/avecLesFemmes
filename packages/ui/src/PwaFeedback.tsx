import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Check, CheckCircle2, Copy, Info, Share2, X, AlertCircle } from 'lucide-react';
import type { components } from '@aveclesfemmes/api-client';
import { Dialog } from './Dialog';
import { campaignColors } from './CampaignVisuals';

type Kind = 'info' | 'success' | 'error';
export function confirmedPayment(c: components['schemas']['ContributionView']) {
  if (
    !c?.id ||
    !c.reference ||
    c.voided_at ||
    !/^\d+$/.test(String(c.amount)) ||
    BigInt(c.amount) <= 0n ||
    !/^\d{4}-\d{2}-\d{2}/.test(c.paid_on || '')
  ) {
    throw new Error(
      'La réponse ne confirme pas un versement valide. Vérifiez l’historique avant de réessayer.',
    );
  }
  return c;
}

type Receipt = {
  contribution: components['schemas']['ContributionView'];
  campaign: string;
  group?: string;
  type: string;
  member?: string;
  personal?: boolean;
  returnFocus?: HTMLElement | null;
};
type Notice = { id: number; message: string; kind: Kind };
const empty = {
  notify: (_message: string, _kind: Kind = 'info') => {},
  showReceipt: (_receipt: Receipt) => {},
  clear: () => {},
  receiptOpen: false,
};
const FeedbackContext = createContext(empty);
export const usePwaFeedback = () => useContext(FeedbackContext);
const money = (value: string) => new Intl.NumberFormat('fr-SN').format(BigInt(value)) + ' FCFA';
const date = (value: string, time = false) =>
  new Date(time ? value : value.slice(0, 10) + 'T12:00:00Z').toLocaleString('fr-SN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...(time ? ({ hour: '2-digit', minute: '2-digit' } as const) : {}),
  });

function Notification({ notice, dismiss }: { notice: Notice; dismiss: () => void }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pause = () => {
    if (timer.current) clearTimeout(timer.current);
  };
  const resume = () => {
    pause();
    timer.current = setTimeout(dismiss, notice.kind === 'error' ? 12000 : 6500);
  };
  useEffect(() => {
    resume();
    return pause;
  }, [notice.id]);
  const Icon =
    notice.kind === 'success' ? CheckCircle2 : notice.kind === 'error' ? AlertCircle : Info;
  return (
    <div
      className={`pwa-notification ${notice.kind}`}
      onPointerEnter={pause}
      onPointerLeave={resume}
      onFocus={pause}
      onBlur={resume}
    >
      <Icon size={22} aria-hidden="true" />
      <span role="status">{notice.message}</span>
      <button
        type="button"
        className="icon-button"
        aria-label="Masquer la notification"
        onClick={dismiss}
      >
        <X size={18} />
      </button>
    </div>
  );
}

export function PwaFeedbackProvider({ children }: { children: ReactNode }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [sharing, setSharing] = useState(false);
  const serial = useRef(0);
  const notify = useCallback((message: string, kind: Kind = 'info') => {
    if (!message || document.documentElement.dataset.pwaLocked === 'true') return;
    const next = { id: ++serial.current, message, kind };
    setNotices([next]);
  }, []);
  const clear = useCallback(() => {
    setNotices([]);
    setReceipt(null);
  }, []);
  const showReceipt = useCallback(
    (next: Receipt) => {
      const c = next.contribution;
      // A local draft, refused response or voided payment must never look like a receipt.
      try {
        confirmedPayment(c);
      } catch (e) {
        notify((e as Error).message, 'error');
        return;
      }
      if (document.documentElement.dataset.pwaLocked !== 'true') setReceipt(next);
    },
    [notify],
  );
  const canShare = typeof navigator.share === 'function';
  const c = receipt?.contribution;
  const member = c?.name || receipt?.member || 'Membre';
  const text =
    receipt && c
      ? [
          'AvecLesFemmes · Reçu de cotisation',
          receipt.group,
          `Membre : ${member}`,
          `Campagne : ${receipt.campaign}`,
          `Montant : ${money(c.amount)}`,
          `Séance / tour du : ${date(c.paid_on)}`,
          c.created_at ? `Enregistré le : ${date(c.created_at, true)}` : '',
          `Référence : ${c.reference}`,
        ]
          .filter(Boolean)
          .join('\n')
      : '';
  function closeReceipt() {
    const target = receipt?.returnFocus;
    setReceipt(null);
    requestAnimationFrame(() => {
      if (document.documentElement.dataset.pwaLocked === 'true') return;
      const label = target?.getAttribute('aria-label');
      const current = target?.isConnected
        ? target
        : label
          ? document.querySelector<HTMLElement>(`button[aria-label="${CSS.escape(label)}"]`)
          : null;
      if (current?.matches('button, a, [tabindex]') && !(current as HTMLButtonElement).disabled)
        current.focus();
      else {
        const heading = document.querySelector<HTMLElement>('main h1');
        if (heading) {
          heading.tabIndex = -1;
          heading.focus();
        }
      }
    });
  }
  async function share() {
    if (sharing || !receipt) return;
    setSharing(true);
    try {
      if (canShare) {
        await navigator.share({ title: 'Reçu AvecLesFemmes', text });
        notify('Reçu transmis au partage de votre appareil.', 'success');
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        notify('Reçu copié. Vous pouvez le coller dans votre messagerie.', 'success');
      } else {
        notify(
          'La copie est indisponible. Vous pouvez sélectionner les informations du reçu.',
          'info',
        );
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError'))
        notify('Le partage a échoué. Le versement reste enregistré.', 'error');
    } finally {
      setSharing(false);
    }
  }
  return (
    <FeedbackContext.Provider value={{ notify, showReceipt, clear, receiptOpen: !!receipt }}>
      {children}
      <div className="pwa-feedback">
        {receipt && c && (
          <Dialog
            title={receipt.personal ? 'Versement confirmé' : 'Encaissement confirmé'}
            onClose={closeReceipt}
          >
            <div className="payment-receipt" style={campaignColors(receipt.type)}>
              <div className="receipt-success-icon">
                <Check size={32} strokeWidth={3} aria-hidden="true" />
              </div>
              <p className="receipt-status">
                {receipt.personal
                  ? 'Votre versement a été enregistré'
                  : 'Cotisation enregistrée avec succès'}
              </p>
              <strong className="receipt-amount">{money(c.amount)}</strong>
              <dl className="receipt-details">
                <div>
                  <dt>Membre</dt>
                  <dd>{member}</dd>
                </div>
                <div>
                  <dt>Campagne</dt>
                  <dd>{receipt.campaign}</dd>
                </div>
                {receipt.group && (
                  <div>
                    <dt>Groupement</dt>
                    <dd>{receipt.group}</dd>
                  </div>
                )}
              </dl>
              <dl className="receipt-details">
                <div>
                  <dt>Séance / tour du</dt>
                  <dd>{date(c.paid_on)}</dd>
                </div>
                {c.created_at && (
                  <div>
                    <dt>Enregistré le</dt>
                    <dd>{date(c.created_at, true)}</dd>
                  </div>
                )}
                <div>
                  <dt>Référence</dt>
                  <dd className="receipt-reference">{c.reference}</dd>
                </div>
              </dl>
              <div className="receipt-actions">
                <button
                  type="button"
                  className="secondary"
                  disabled={sharing}
                  onClick={() => void share()}
                >
                  {canShare ? <Share2 size={20} /> : <Copy size={20} />}
                  {sharing ? 'Préparation…' : canShare ? 'Partager le reçu' : 'Copier le reçu'}
                </button>
                <button type="button" className="primary" onClick={closeReceipt}>
                  Fermer
                </button>
              </div>
            </div>
          </Dialog>
        )}
        <div className="pwa-notifications" aria-label="Notifications d’information">
          {notices.map((notice) => (
            <Notification
              key={notice.id}
              notice={notice}
              dismiss={() => setNotices((all) => all.filter((n) => n.id !== notice.id))}
            />
          ))}
        </div>
      </div>
    </FeedbackContext.Provider>
  );
}
