import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import QRCode from 'qrcode';
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  BarChart3,
  Calendar,
  CalendarCheck,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Coins,
  Copy,
  CreditCard,
  Download,
  Edit2,
  Eye,
  EyeOff,
  Filter,
  FolderHeart,
  Gift,
  HelpCircle,
  Info,
  KeyRound,
  LayoutDashboard,
  Leaf,
  Lock,
  LogOut,
  MapPin,
  Phone,
  Play,
  Plus,
  QrCode,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Shuffle,
  Smartphone,
  Sparkles,
  Trash2,
  Unlock,
  UserCheck,
  UserPlus,
  Users,
  Volume2,
  VolumeX,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import { api, type components } from '@aveclesfemmes/api-client';

type S = components['schemas'];
type Actor = S['ActorView'];
type Group = S['GroupView'];
type Campaign = S['CampaignView'];
type Member = S['MemberView'];
type Participant = S['ParticipationView'];
type Contribution = S['ContributionView'];
type GroupFunction = S['GroupFunctionView'];
type CampaignEvent = S['CampaignEventView'];
type TontineRound = S['TontineRoundView'];
type GracePeriod = S['GracePeriodView'];
type CampaignSession = S['CampaignSessionView'];
type CashboxState = S['CashboxStateView'];
type SuperDashboard = S['SuperDashboardView'];

const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const money = (amount: string | number) =>
  `${new Intl.NumberFormat('fr-SN').format(Number(amount))} FCFA`;
const date = (value: string) =>
  new Date(value.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('fr-SN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

async function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): Promise<T> {
  if (!result.response.ok) {
    const e = result.error as { message?: string | string[] } | undefined;
    throw new Error(
      Array.isArray(e?.message)
        ? e.message.join(' · ')
        : e?.message || 'Le service est indisponible.',
    );
  }
  return result.data as T;
}

function values(e: FormEvent<HTMLFormElement>) {
  e.preventDefault();
  return Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Pager({
  page,
  total,
  limit = 25,
  onChange,
}: {
  page: number;
  total: number;
  limit?: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="pager">
      <span>
        {total} résultat{total > 1 ? 's' : ''} · Page {page}
      </span>
      <button
        className="icon-button"
        aria-label="Page précédente"
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
      >
        <ArrowLeft size={17} />
      </button>
      <button
        className="icon-button"
        aria-label="Page suivante"
        disabled={page * limit >= total}
        onClick={() => onChange(page + 1)}
      >
        <ArrowRight size={17} />
      </button>
    </div>
  );
}

function Dialog({
  title,
  subtitle,
  onClose,
  children,
  busy,
  wide,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  busy?: boolean;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function esc(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onClose();
    }
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose, busy]);
  return (
    <div
      className="dialog-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        className={`dialog-card ${wide ? 'wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        ref={ref}
      >
        <div className="dialog-header">
          <div>
            <h2 id="dialog-title">{title}</h2>
            {subtitle && <p className="dialog-subtitle">{subtitle}</p>}
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Fermer"
            disabled={busy}
            onClick={() => onClose()}
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function QrModal({
  title,
  subtitle,
  data,
  onClose,
}: {
  title: string;
  subtitle?: string;
  data: string;
  onClose: () => void;
}) {
  const [svg, setSvg] = useState('');
  useEffect(() => {
    QRCode.toString(data, { type: 'svg', margin: 1, width: 220 })
      .then(setSvg)
      .catch(() => {});
  }, [data]);

  const downloadSvg = () => {
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qrcode-${title.toLowerCase().replace(/\s+/g, '-')}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog title={title} onClose={onClose}>
      <div className="qr-container">
        {subtitle && <p className="muted">{subtitle}</p>}
        <div className="qr-box" dangerouslySetInnerHTML={{ __html: svg }} />
        <div className="qr-code-raw">{data}</div>
        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          <button type="button" className="primary" onClick={downloadSvg}>
            <Download size={16} />
            Télécharger le QR Code
          </button>
        </div>
      </div>
    </Dialog>
  );
}

function VectorQrView({ data, width = 170 }: { data: string; width?: number }) {
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

function NumericKeypad({
  amount,
  onChange,
  onAddQuick,
}: {
  amount: string;
  onChange: (val: string) => void;
  onAddQuick: (add: number) => void;
}) {
  const handleDigit = (digit: string) => {
    if (digit === '0' && amount === '') return;
    if (amount.length >= 8) return;
    onChange(amount + digit);
  };

  const handleBackspace = () => {
    onChange(amount.slice(0, -1));
  };

  const handleClear = () => {
    onChange('');
  };

  const keys = [
    { digit: '1', letters: '' },
    { digit: '2', letters: 'ABC' },
    { digit: '3', letters: 'DEF' },
    { digit: '4', letters: 'GHI' },
    { digit: '5', letters: 'JKL' },
    { digit: '6', letters: 'MNO' },
    { digit: '7', letters: 'PQRS' },
    { digit: '8', letters: 'TUV' },
    { digit: '9', letters: 'WXYZ' },
    { digit: 'C', letters: 'EFFACER', isClear: true },
    { digit: '0', letters: '' },
    { digit: '⌫', letters: '', isBackspace: true },
  ];

  return (
    <div className="wave-keypad-container">
      <div className="wave-keypad-shortcuts">
        {[1000, 2000, 5000, 10000].map((quick) => (
          <button
            key={quick}
            type="button"
            className="wave-keypad-shortcut-pill"
            onClick={() => onAddQuick(quick)}
          >
            +{new Intl.NumberFormat('fr-SN').format(quick)} F
          </button>
        ))}
      </div>
      <div className="wave-keypad-grid">
        {keys.map((k) => (
          <button
            key={k.digit}
            type="button"
            className={`wave-keypad-btn ${k.isClear || k.isBackspace ? 'action-btn' : ''}`}
            onClick={() => {
              if (k.isBackspace) handleBackspace();
              else if (k.isClear) handleClear();
              else handleDigit(k.digit);
            }}
          >
            <span className="wave-keypad-digit">{k.digit}</span>
            {k.letters && <span className="wave-keypad-letters">{k.letters}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function CameraScannerOverlay({
  onClose,
  onScan,
  title = 'Scanner un Code QR pour cotiser',
}: {
  onClose: () => void;
  onScan: (val: string) => void;
  title?: string;
}) {
  const [flashlight, setFlashlight] = useState(false);

  return (
    <div className="wave-scanner-overlay" role="dialog" aria-modal="true" aria-label="Scanner QR">
      <div className="wave-scanner-topbar">
        <button
          type="button"
          className="wave-scanner-close-btn"
          aria-label="Fermer le scanner"
          onClick={onClose}
        >
          <X size={22} />
        </button>
        <span style={{ fontWeight: 700, fontSize: 16 }}>Viseur Caméra</span>
        <button
          type="button"
          className="wave-scanner-flash-btn"
          aria-label="Lampe torche"
          onClick={() => setFlashlight(!flashlight)}
          style={{ background: flashlight ? '#10b981' : undefined }}
        >
          <Zap size={20} />
        </button>
      </div>

      <div className="wave-scanner-center">
        <div className="wave-scanner-frame">
          <div className="wave-scanner-laser" />
        </div>
        <p className="wave-scanner-instruction">{title}</p>
      </div>

      <div className="wave-scanner-bottom">
        <button
          type="button"
          className="wave-scanner-sim-btn"
          onClick={() => {
            onScan('DEMO_SCAN_CODE');
          }}
        >
          <Camera size={18} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} />
          Simuler lecture instantanée du QR Code
        </button>
      </div>
    </div>
  );
}

function WaveChiffresView({
  totalAmount,
  contributionsCount,
  period,
  onPeriodChange,
  onBack,
}: {
  totalAmount: number;
  contributionsCount: number;
  period: 'day' | 'week' | 'month';
  onPeriodChange: (p: 'day' | 'week' | 'month') => void;
  onBack: () => void;
}) {
  const barData = useMemo(() => {
    if (period === 'day') {
      return [
        { label: 'dim. 11', amount: 0, height: 8 },
        { label: 'lun. 12', amount: 0, height: 8 },
        { label: 'mar. 13', amount: 0, height: 8 },
        { label: 'mer. 14', amount: 0, height: 8 },
        { label: 'jeu. 15', amount: 0, height: 8 },
        { label: 'ven. 16', amount: totalAmount, height: totalAmount > 0 ? 55 : 8, active: true },
      ];
    } else if (period === 'week') {
      return [
        { label: '14 sept.', amount: 11500, height: 75 },
        { label: '21 sept.', amount: 12500, height: 85 },
        { label: '28 sept.', amount: 0, height: 8 },
        { label: '05 oct.', amount: 500, height: 22 },
        { label: '12 oct.', amount: totalAmount, height: totalAmount > 0 ? 60 : 8, active: true },
      ];
    } else {
      return [
        { label: 'Juin', amount: 0, height: 8 },
        { label: 'Juil.', amount: 10500, height: 50 },
        { label: 'Août', amount: 0, height: 8 },
        { label: 'Sept.', amount: 24077, height: 95 },
        { label: 'Oct.', amount: totalAmount || 500, height: 35, active: true },
      ];
    }
  }, [period, totalAmount]);

  return (
    <div className="wave-chiffres-screen">
      <div className="wave-top-header">
        <button
          type="button"
          className="wave-header-btn"
          aria-label="Retour"
          onClick={onBack}
        >
          <ArrowLeft size={20} />
        </button>
        <span className="wave-header-title">Chiffres</span>
        <div style={{ width: 42 }} />
      </div>

      <div className="wave-balance-hero">
        <span className="wave-balance-eyebrow">Encaissements total</span>
        <span className="wave-balance-amount">{money(totalAmount)}</span>
      </div>

      <div className="wave-segmented-control">
        <button
          type="button"
          className={`wave-segmented-btn ${period === 'day' ? 'active' : ''}`}
          onClick={() => onPeriodChange('day')}
        >
          Aujourd'hui
        </button>
        <button
          type="button"
          className={`wave-segmented-btn ${period === 'week' ? 'active' : ''}`}
          onClick={() => onPeriodChange('week')}
        >
          Semaine
        </button>
        <button
          type="button"
          className={`wave-segmented-btn ${period === 'month' ? 'active' : ''}`}
          onClick={() => onPeriodChange('month')}
        >
          Mois
        </button>
      </div>

      <div className="wave-summary-card">
        <div className="wave-summary-card-title">
          {period === 'day'
            ? 'Résumé du jour'
            : period === 'week'
              ? 'Résumé de cette semaine'
              : 'Résumé de ce mois-ci'}
        </div>
        <div className="wave-summary-row">
          <span className="wave-summary-label">
            {contributionsCount} paiement{contributionsCount > 1 ? 's' : ''} reçu{contributionsCount > 1 ? 's' : ''}
          </span>
          <span className="wave-summary-val">{money(totalAmount)}</span>
        </div>
        <div className="wave-summary-row">
          <span className="wave-summary-label">Frais AvecLesFemmes*</span>
          <span className="wave-summary-val">0 FCFA</span>
        </div>
        <div className="wave-summary-row">
          <span className="wave-summary-label">Revenu net</span>
          <span className="wave-summary-val">{money(totalAmount)}</span>
        </div>
        <div className="wave-summary-footnote">
          *Zéro frais jusqu'à 20.000F encaissés, puis 0% solidaire.
          <br />
          Gestion 100% transparente et solidaire pour les calebasses féminines.
        </div>
      </div>

      <div className="wave-chart-section">
        <div className="wave-chart-title">
          {period === 'day'
            ? 'Par rapport aux jours précédents'
            : period === 'week'
              ? 'Par rapport aux semaines précédentes'
              : 'Par rapport aux mois précédents'}
        </div>

        <div className="wave-bar-chart-card">
          <div className="wave-bar-chart-cols">
            {barData.map((b, i) => (
              <div
                key={i}
                className={`wave-bar-col ${b.active ? 'active' : ''} ${b.amount > 0 ? 'has-val' : ''}`}
              >
                <span className="wave-bar-amount">
                  {b.amount === 0 ? '0F' : `${new Intl.NumberFormat('fr-SN').format(b.amount)}F`}
                </span>
                <div className="wave-bar-fill" style={{ height: `${b.height}%` }} />
              </div>
            ))}
          </div>
          <div className="wave-bar-labels">
            {barData.map((b, i) => (
              <div
                key={i}
                className={`wave-bar-label-item ${b.active ? 'active' : ''}`}
              >
                {b.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function WaveSettingsView({
  announceVoice,
  onToggleVoice,
  actorLogin,
  onOpenQr,
  onGoCampaigns,
  onGoMembers,
  onGoArchives,
  onLogout,
  onBack,
}: {
  announceVoice: boolean;
  onToggleVoice: () => void;
  actorLogin: string;
  onOpenQr: () => void;
  onGoCampaigns: () => void;
  onGoMembers: () => void;
  onGoArchives: () => void;
  onLogout: () => void;
  onBack: () => void;
}) {
  return (
    <div className="wave-settings-screen">
      <div className="wave-top-header">
        <button
          type="button"
          className="wave-header-btn"
          aria-label="Retour"
          onClick={onBack}
        >
          <ArrowLeft size={20} />
        </button>
        <span className="wave-header-title">Paramètres</span>
        <div style={{ width: 42 }} />
      </div>

      <div className="wave-settings-group">
        <div className="wave-settings-group-title">Notifications</div>
        <div className="wave-settings-card">
          <div className="wave-settings-row" style={{ cursor: 'default' }}>
            <div className="wave-settings-row-left">
              <span className="wave-settings-row-icon">
                <Volume2 size={20} />
              </span>
              <span>Annoncer les paiements</span>
            </div>
            <label className="wave-switch">
              <input
                type="checkbox"
                checked={announceVoice}
                onChange={onToggleVoice}
              />
              <span className="wave-switch-slider" />
            </label>
          </div>
          <div className="wave-settings-hint">
            Pour entendre les paiements à voix haute, activez les notifications, désactivez le mode silencieux et augmentez le volume.
          </div>
        </div>
      </div>

      <div className="wave-settings-group">
        <div className="wave-settings-group-title">Outils professionnels</div>
        <div className="wave-settings-card">
          <button type="button" className="wave-settings-row" onClick={onOpenQr}>
            <div className="wave-settings-row-left">
              <span className="wave-settings-row-icon">
                <QrCode size={19} />
              </span>
              <span>Afficher QR code</span>
            </div>
            <ChevronRight size={18} color="#94a3b8" />
          </button>
          <button type="button" className="wave-settings-row" onClick={onGoCampaigns}>
            <div className="wave-settings-row-left">
              <span className="wave-settings-row-icon">
                <FolderHeart size={19} />
              </span>
              <span>Gérer les campagnes & forfaits</span>
            </div>
            <ChevronRight size={18} color="#94a3b8" />
          </button>
          <button type="button" className="wave-settings-row" onClick={onGoMembers}>
            <div className="wave-settings-row-left">
              <span className="wave-settings-row-icon">
                <Users size={19} />
              </span>
              <span>Documents & Liste des membres</span>
            </div>
            <ChevronRight size={18} color="#94a3b8" />
          </button>
          <button type="button" className="wave-settings-row" onClick={onGoArchives}>
            <div className="wave-settings-row-left">
              <span className="wave-settings-row-icon">
                <Archive size={19} />
              </span>
              <span>Archives & Clôtures</span>
            </div>
            <ChevronRight size={18} color="#94a3b8" />
          </button>
        </div>
      </div>

      <div className="wave-settings-group">
        <div className="wave-settings-group-title">Sécurité</div>
        <div className="wave-settings-card">
          <div className="wave-settings-row">
            <div className="wave-settings-row-left">
              <span className="wave-settings-row-icon">
                <Lock size={19} />
              </span>
              <span>Sécurité & Code PIN</span>
            </div>
            <span style={{ fontSize: 13, color: '#10b981', fontWeight: 700 }}>Actif</span>
          </div>
          <div className="wave-settings-row">
            <div className="wave-settings-row-left">
              <span className="wave-settings-row-icon">
                <ShieldCheck size={19} />
              </span>
              <span>Vérifier conformité Calebasse</span>
            </div>
            <span style={{ fontSize: 13, color: '#10b981', fontWeight: 700 }}>Conforme</span>
          </div>
        </div>
      </div>

      <div className="wave-settings-group">
        <div className="wave-settings-group-title">Support</div>
        <div className="wave-settings-card">
          <a
            href="tel:+221770000000"
            className="wave-settings-row"
            style={{ textDecoration: 'none' }}
          >
            <div className="wave-settings-row-left">
              <span className="wave-settings-row-icon">
                <Phone size={19} />
              </span>
              <span>Appelez le service client gratuitement</span>
            </div>
            <ChevronRight size={18} color="#94a3b8" />
          </a>
          <button
            type="button"
            className="wave-settings-row"
            onClick={() => alert('Vidéos de formation disponibles sur notre portail.')}
          >
            <div className="wave-settings-row-left">
              <span className="wave-settings-row-icon">
                <Play size={19} />
              </span>
              <span>Vidéos de formation</span>
            </div>
            <ChevronRight size={18} color="#94a3b8" />
          </button>
        </div>
      </div>

      <div className="wave-settings-group">
        <div className="wave-settings-card">
          <button
            type="button"
            className="wave-settings-row"
            onClick={onLogout}
            style={{ color: '#dc2626' }}
          >
            <div className="wave-settings-row-left">
              <span className="wave-settings-row-icon" style={{ color: '#dc2626' }}>
                <LogOut size={19} />
              </span>
              <div>
                <strong>Se déconnecter</strong>
                <div style={{ fontSize: 12, color: '#64748b' }}>({actorLogin})</div>
              </div>
            </div>
            <ChevronRight size={18} color="#94a3b8" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark" aria-hidden="true">
        <Leaf size={22} />
      </span>
      <span>
        AvecLesFemmes
        <span className="badge brand-tag">Épargne solidaire</span>
      </span>
    </div>
  );
}

function Login({ portal, onLogin }: { portal: 'super' | 'member'; onLogin: (a: Actor) => void }) {
  const [mode, setMode] = useState<'pin' | 'password' | 'phone'>(
    portal === 'member' ? 'pin' : 'password',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [phone, setPhone] = useState('');
  const [sent, setSent] = useState(false);
  const [localCode, setLocalCode] = useState('');

  // États pour la saisie et le pré-remplissage interactif
  const [loginVal, setLoginVal] = useState('');
  const [passwordVal, setPasswordVal] = useState('');
  const [phoneVal, setPhoneVal] = useState('');
  const [pinVal, setPinVal] = useState('');
  const [demoPassword, setDemoPassword] = useState('be3c24993bdd62d7b39c1b25');
  const [showPassword, setShowPassword] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/auth/demo')
      .then((r) => r.json())
      .then((data) => {
        if (data?.demoPassword) {
          setDemoPassword(data.demoPassword);
        }
      })
      .catch(() => {});
  }, []);

  const copyToClipboard = (text: string, key: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((curr) => (curr === key ? null : curr));
    }, 2000);
  };

  const handleAutoFill = (opts: {
    mode: 'password' | 'pin' | 'phone';
    login?: string;
    phone?: string;
    pin?: string;
  }) => {
    setMode(opts.mode);
    setError('');
    setSent(false);
    setLocalCode('');
    if (opts.login !== undefined) setLoginVal(opts.login);
    if (demoPassword) setPasswordVal(demoPassword);
    if (opts.phone !== undefined) {
      setPhoneVal(opts.phone);
      setPhone(opts.phone);
    }
    if (opts.pin !== undefined) setPinVal(opts.pin);
  };

  async function submit(e: FormEvent<HTMLFormElement>) {
    const v = values(e);
    const effectiveLogin = (v.login || loginVal).trim();
    const effectivePassword = v.password || passwordVal;
    const effectivePhone = (v.phone || phoneVal).trim();
    const effectivePin = (v.pin || pinVal).trim();

    setError('');
    setBusy(true);
    try {
      if (mode === 'pin') {
        onLogin(
          await unwrap(
            await api.POST('/api/v1/auth/login/pin', {
              body: { phone: effectivePhone, pin: effectivePin },
            }),
          ),
        );
      } else if (mode === 'password') {
        onLogin(
          await unwrap(
            await api.POST('/api/v1/auth/login', {
              body: { login: effectiveLogin, password: effectivePassword },
            }),
          ),
        );
      } else if (!sent) {
        const response = await unwrap(
          await api.POST('/api/v1/auth/otp/request', { body: { phone: effectivePhone } }),
        );
        setPhone(effectivePhone);
        setLocalCode(response.developmentCode || '');
        setSent(true);
        setError(response.message);
      } else {
        onLogin(
          await unwrap(
            await api.POST('/api/v1/auth/otp/verify', { body: { phone, code: v.code } }),
          ),
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <section className="login-story">
        <Brand />
        <div>
          <span className="eyebrow">ENSEMBLE, ALLONS PLUS LOIN</span>
          <h1>
            Une épargne.
            <br />
            Des projets.
            <br />
            <em>Notre avenir.</em>
          </h1>
          <p>Un espace pour faire grandir l’épargne solidaire et les projets de chaque femme.</p>
          <div className="story-note">
            <Users size={24} />
            <span>
              Votre groupement, à vos côtés.
              <br />
              <small>Chaque contribution compte.</small>
            </span>
          </div>
          <div className="login-story-credentials">
            <span className="story-creds-title">
              <KeyRound size={15} />
              Identifiants de test disponibles
            </span>
            {portal === 'super' ? (
              <p style={{ margin: 0, fontSize: 12, color: '#2a5135', lineHeight: 1.5 }}>
                Compte : <strong>superadmin</strong> · SMS : <strong>+221770000001</strong>
              </p>
            ) : (
              <p style={{ margin: 0, fontSize: 12, color: '#2a5135', lineHeight: 1.5 }}>
                Admin : <strong>admin.ndeye</strong> · Membre : <strong>membre.awa</strong>
              </p>
            )}
          </div>
        </div>
        <small>AvecLesFemmes · Épargne solidaire</small>
      </section>
      <section className="login-form">
        <div className="mobile-brand">
          <Brand />
        </div>
        <span className="pill">
          <ShieldCheck size={14} />
          {portal === 'super' ? 'Administration de la plateforme' : 'Espace membre et groupement'}
        </span>
        <h2>Bienvenue dans votre espace</h2>
        <p className="muted">Connectez-vous pour retrouver vos campagnes.</p>
        <div className="segmented">
          {portal === 'member' && (
            <button
              type="button"
              className={mode === 'pin' ? 'selected' : ''}
              onClick={() => {
                setMode('pin');
                setError('');
              }}
            >
              Code PIN
            </button>
          )}
          <button
            type="button"
            className={mode === 'password' ? 'selected' : ''}
            onClick={() => {
              setMode('password');
              setError('');
            }}
          >
            Identifiant
          </button>
          <button
            type="button"
            className={mode === 'phone' ? 'selected' : ''}
            onClick={() => {
              setMode('phone');
              setError('');
            }}
          >
            Code SMS
          </button>
        </div>
        <form onSubmit={submit}>
          <fieldset disabled={busy}>
            {mode === 'pin' ? (
              <>
                <Field label="Téléphone avec indicatif">
                  <input
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="+221771234567"
                    pattern="\+[1-9][0-9]{7,14}"
                    value={phoneVal}
                    onChange={(e) => setPhoneVal(e.target.value)}
                    required
                  />
                </Field>
                <Field label="Code secret (4 chiffres)">
                  <input
                    name="pin"
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]{4}"
                    maxLength={4}
                    placeholder="••••"
                    value={pinVal}
                    onChange={(e) => setPinVal(e.target.value)}
                    required
                  />
                </Field>
              </>
            ) : mode === 'password' ? (
              <>
                <Field label="Identifiant">
                  <input
                    name="login"
                    autoComplete="username"
                    placeholder="Votre identifiant"
                    value={loginVal}
                    onChange={(e) => setLoginVal(e.target.value)}
                    required
                  />
                </Field>
                <Field label="Mot de passe">
                  <input
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="Votre mot de passe"
                    value={passwordVal}
                    onChange={(e) => setPasswordVal(e.target.value)}
                    required
                  />
                </Field>
              </>
            ) : sent ? (
              <>
                <p>Numéro : {phone}</p>
                <Field label="Code reçu par SMS">
                  <input
                    name="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                  />
                </Field>
                {localCode && (
                  <p className="local-code">
                    Test local uniquement · Aucun SMS envoyé.
                    <br />
                    Code de démonstration : <strong>{localCode}</strong>
                  </p>
                )}
              </>
            ) : (
              <Field label="Téléphone avec indicatif">
                <input
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="+221771234567"
                  pattern="\+[1-9][0-9]{7,14}"
                  value={phoneVal}
                  onChange={(e) => setPhoneVal(e.target.value)}
                  required
                />
              </Field>
            )}
            {error && (
              <p role="alert" className="form-message">
                {error}
              </p>
            )}
            <button className="primary full" type="submit">
              {busy
                ? 'Veuillez patienter…'
                : mode === 'phone' && !sent
                  ? 'Recevoir un code'
                  : 'Se connecter'}
              <ArrowRight size={18} />
            </button>
            {sent && mode === 'phone' && (
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setSent(false);
                  setLocalCode('');
                }}
              >
                Changer de numéro ou renvoyer un code
              </button>
            )}
          </fieldset>
        </form>

        {/* Section explicite des identifiants et comptes de test */}
        <div className="login-demo-card">
          <div className="login-demo-header">
            <div className="login-demo-title">
              <KeyRound size={16} />
              <span>Identifiants & Comptes de test</span>
            </div>
            <span className="login-demo-badge">
              {portal === 'super' ? 'Espace Super Admin' : 'Espace Membre & Groupement'}
            </span>
          </div>

          <p className="login-demo-instructions">
            💡 Cliquez sur <strong>« Remplir »</strong> pour renseigner automatiquement le formulaire sans saisie manuelle.
          </p>

          <div className="login-demo-accounts">
            {portal === 'super' ? (
              <div className="login-demo-item">
                <div className="login-demo-item-top">
                  <div className="login-demo-item-role">
                    <ShieldCheck size={14} className="muted" />
                    <strong>Super Administrateur</strong>
                  </div>
                  <span className="login-demo-tag super">Plateforme</span>
                </div>
                <div className="login-demo-item-desc">
                  Accès global, pilotage des groupements, types et événements
                </div>
                <div className="login-demo-fields">
                  <div className="login-demo-field-pill">
                    <span>Identifiant :</span>
                    <code>superadmin</code>
                    <button
                      type="button"
                      className="login-demo-copy-btn"
                      title="Copier l'identifiant"
                      onClick={() => copyToClipboard('superadmin', 'superadmin-login')}
                    >
                      {copiedKey === 'superadmin-login' ? <Check size={12} color="#1c4b28" /> : <Copy size={12} />}
                    </button>
                  </div>
                  <div className="login-demo-field-pill">
                    <span>Tél SMS :</span>
                    <code>+221770000001</code>
                    <button
                      type="button"
                      className="login-demo-copy-btn"
                      title="Copier le numéro"
                      onClick={() => copyToClipboard('+221770000001', 'superadmin-phone')}
                    >
                      {copiedKey === 'superadmin-phone' ? <Check size={12} color="#1c4b28" /> : <Copy size={12} />}
                    </button>
                  </div>
                </div>
                <div className="login-demo-actions">
                  <button
                    type="button"
                    className="login-demo-btn-fill"
                    onClick={() => handleAutoFill({ mode: 'password', login: 'superadmin' })}
                  >
                    <Check size={13} />
                    Remplir (Identifiant)
                  </button>
                  <button
                    type="button"
                    className="login-demo-btn-fill"
                    onClick={() => handleAutoFill({ mode: 'phone', phone: '+221770000001' })}
                  >
                    <Phone size={13} />
                    Remplir (SMS)
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="login-demo-item">
                  <div className="login-demo-item-top">
                    <div className="login-demo-item-role">
                      <Users size={14} className="muted" />
                      <strong>Ndèye Diop (Administratrice)</strong>
                    </div>
                    <span className="login-demo-tag admin">Groupement</span>
                  </div>
                  <div className="login-demo-item-desc">
                    Les Femmes de Grand Yoff · Campagnes, membres & cotisations
                  </div>
                  <div className="login-demo-fields">
                    <div className="login-demo-field-pill">
                      <span>Identifiant :</span>
                      <code>admin.ndeye</code>
                      <button
                        type="button"
                        className="login-demo-copy-btn"
                        title="Copier l'identifiant"
                        onClick={() => copyToClipboard('admin.ndeye', 'admin-ndeye-login')}
                      >
                        {copiedKey === 'admin-ndeye-login' ? <Check size={12} color="#1c4b28" /> : <Copy size={12} />}
                      </button>
                    </div>
                    <div className="login-demo-field-pill">
                      <span>Tél (SMS/PIN) :</span>
                      <code>+221770000002</code>
                      <button
                        type="button"
                        className="login-demo-copy-btn"
                        title="Copier le numéro"
                        onClick={() => copyToClipboard('+221770000002', 'admin-ndeye-phone')}
                      >
                        {copiedKey === 'admin-ndeye-phone' ? <Check size={12} color="#1c4b28" /> : <Copy size={12} />}
                      </button>
                    </div>
                  </div>
                  <div className="login-demo-actions">
                    <button
                      type="button"
                      className="login-demo-btn-fill"
                      onClick={() => handleAutoFill({ mode: 'password', login: 'admin.ndeye' })}
                    >
                      <Check size={13} />
                      Remplir (Identifiant)
                    </button>
                    <button
                      type="button"
                      className="login-demo-btn-fill"
                      onClick={() => handleAutoFill({ mode: 'phone', phone: '+221770000002' })}
                    >
                      <Phone size={13} />
                      Remplir (SMS)
                    </button>
                  </div>
                </div>

                <div className="login-demo-item">
                  <div className="login-demo-item-top">
                    <div className="login-demo-item-role">
                      <UserCheck size={14} className="muted" />
                      <strong>Awa Fall (Membre participante)</strong>
                    </div>
                    <span className="login-demo-tag member">Membre</span>
                  </div>
                  <div className="login-demo-item-desc">
                    Les Femmes de Grand Yoff · Épargne personnelle & QR Code
                  </div>
                  <div className="login-demo-fields">
                    <div className="login-demo-field-pill">
                      <span>Identifiant :</span>
                      <code>membre.awa</code>
                      <button
                        type="button"
                        className="login-demo-copy-btn"
                        title="Copier l'identifiant"
                        onClick={() => copyToClipboard('membre.awa', 'membre-awa-login')}
                      >
                        {copiedKey === 'membre-awa-login' ? <Check size={12} color="#1c4b28" /> : <Copy size={12} />}
                      </button>
                    </div>
                    <div className="login-demo-field-pill">
                      <span>Tél (SMS/PIN) :</span>
                      <code>+221770000003</code>
                      <button
                        type="button"
                        className="login-demo-copy-btn"
                        title="Copier le numéro"
                        onClick={() => copyToClipboard('+221770000003', 'membre-awa-phone')}
                      >
                        {copiedKey === 'membre-awa-phone' ? <Check size={12} color="#1c4b28" /> : <Copy size={12} />}
                      </button>
                    </div>
                  </div>
                  <div className="login-demo-actions">
                    <button
                      type="button"
                      className="login-demo-btn-fill"
                      onClick={() => handleAutoFill({ mode: 'password', login: 'membre.awa' })}
                    >
                      <Check size={13} />
                      Remplir (Identifiant)
                    </button>
                    <button
                      type="button"
                      className="login-demo-btn-fill"
                      onClick={() => handleAutoFill({ mode: 'phone', phone: '+221770000003' })}
                    >
                      <Phone size={13} />
                      Remplir (SMS)
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Barre du mot de passe commun */}
          <div className="login-demo-password-bar">
            <div className="login-demo-password-info">
              <Lock size={13} className="muted" />
              <span>Mot de passe :</span>
              <span className="login-demo-password-val">
                {showPassword ? demoPassword : '••••••••••••'}
              </span>
              <button
                type="button"
                className="login-demo-copy-btn"
                title={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
              <button
                type="button"
                className="login-demo-copy-btn"
                title="Copier le mot de passe"
                onClick={() => copyToClipboard(demoPassword, 'password-val')}
              >
                {copiedKey === 'password-val' ? <Check size={13} color="#1c4b28" /> : <Copy size={13} />}
              </button>
            </div>
            {copiedKey === 'password-val' && (
              <span style={{ fontSize: 10, color: '#1c4b28', fontWeight: 600 }}>Copié !</span>
            )}
          </div>

          <div className="login-demo-footer">
            {portal === 'super' ? (
              <span>
                💡 Vous souhaitez tester l’espace membre ou groupement ? Rendez-vous sur la{' '}
                <strong>PWA Membre</strong> (port 8086 ou 5174) avec les comptes <code>admin.ndeye</code> ou <code>membre.awa</code>.
              </span>
            ) : (
              <span>
                💡 Vous êtes Super Administrateur ? Rendez-vous sur la{' '}
                <strong>Console Super Admin</strong> (port 8085 ou 5173) avec le compte <code>superadmin</code>.
              </span>
            )}
          </div>
        </div>

        <p className="login-help">
          Votre accès est créé par votre responsable de groupement ou l’administration.
        </p>
      </section>
    </div>
  );
}

export function App({
  portal,
  onUpdate,
}: {
  portal: 'super' | 'member';
  onUpdate?: () => Promise<void>;
}) {
  const [actor, setActor] = useState<Actor | null>(null);
  const [checking, setChecking] = useState(true);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupTotal, setGroupTotal] = useState(0);
  const [groupPage, setGroupPage] = useState(1);
  const [groupId, setGroupId] = useState('');
  const [tab, setTab] = useState('overview');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignTotal, setCampaignTotal] = useState(0);
  const [campaignId, setCampaignId] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [memberTotal, setMemberTotal] = useState(0);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [participantTotal, setParticipantTotal] = useState(0);
  const [memberOptions, setMemberOptions] = useState<Member[]>([]);
  const [optionTotal, setOptionTotal] = useState(0);
  const [optionPage, setOptionPage] = useState(1);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [contributionTotal, setContributionTotal] = useState(0);
  const [dashboard, setDashboard] = useState<S['DashboardView'] | null>(null);
  const [types, setTypes] = useState<S['TypeView'][]>([]);
  const [functions, setFunctions] = useState<GroupFunction[]>([]);
  const [events, setEvents] = useState<CampaignEvent[]>([]);
  const [cashbox, setCashbox] = useState<CashboxState | null>(null);
  const [sessions, setSessions] = useState<CampaignSession[]>([]);
  const [tontineRounds, setTontineRounds] = useState<TontineRound[]>([]);
  const [gracePeriods, setGracePeriods] = useState<GracePeriod[]>([]);
  const [superCockpit, setSuperCockpit] = useState<SuperDashboard | null>(null);
  const [historyFilter, setHistoryFilter] = useState('ALL');
  const [qrModal, setQrModal] = useState<{ title: string; subtitle?: string; data: string } | null>(
    null,
  );
  const [resetPinMember, setResetPinMember] = useState<{ id: string; name: string } | null>(null);
  const [graceMemberId, setGraceMemberId] = useState('');
  const [editEvent, setEditEvent] = useState<CampaignEvent | null>(null);
  const [editType, setEditType] = useState<S['TypeView'] | null>(null);
  const [groupSearch, setGroupSearch] = useState('');
  const [groupDropdownOpen, setGroupDropdownOpen] = useState(false);
  const [campaignTypeId, setCampaignTypeId] = useState('');
  const [campaignDetailTab, setCampaignDetailTab] = useState<'participants' | 'sessions'>('participants');
  const [expandedSessionDate, setExpandedSessionDate] = useState<string | null>(null);
  const [contributionSort, setContributionSort] = useState<'date' | 'session' | 'member'>('date');
  const [expandedTontineRound, setExpandedTontineRound] = useState<number | null>(null);

  // Filtres de sélection autocomplete pour l'historique des cotisations
  const [sessionFilterSearch, setSessionFilterSearch] = useState('');
  const [sessionFilterDropdownOpen, setSessionFilterDropdownOpen] = useState(false);
  const [selectedSessionFilter, setSelectedSessionFilter] = useState<string | null>(null);

  const [periodFilterSearch, setPeriodFilterSearch] = useState('');
  const [periodFilterDropdownOpen, setPeriodFilterDropdownOpen] = useState(false);
  const [selectedPeriodFilter, setSelectedPeriodFilter] = useState<number | null>(null);

  const [memberFilterSearch, setMemberFilterSearch] = useState('');
  const [memberFilterDropdownOpen, setMemberFilterDropdownOpen] = useState(false);
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string | null>(null);

  const groupSearchRef = useRef<HTMLDivElement>(null);
  const sessionFilterRef = useRef<HTMLDivElement>(null);
  const periodFilterRef = useRef<HTMLDivElement>(null);
  const memberFilterRef = useRef<HTMLDivElement>(null);

  const [page, setPage] = useState(1);
  const [participantPage, setParticipantPage] = useState(1);
  const [campaignPage, setCampaignPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [dialog, setDialog] = useState('');
  const [voidId, setVoidId] = useState('');
  const [notice, setNotice] = useState('');
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [update, setUpdate] = useState(false);
  const idempotency = useRef(crypto.randomUUID());
  const [personalMode, setPersonalMode] = useState(false);

  // Wave UX / UI States
  const [showBalance, setShowBalance] = useState(true);
  const [adminSubView, setAdminSubView] = useState<'dashboard' | 'chiffres' | 'settings'>('dashboard');
  const [statsPeriod, setStatsPeriod] = useState<'day' | 'week' | 'month'>('day');
  const [announceVoice, setAnnounceVoice] = useState(true);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [keypadAmount, setKeypadAmount] = useState('');

  const group = groups.find((g) => g.id === groupId);
  const admin = group?.my_role === 'ADMIN';
  const superAdmin = actor?.isSuper && portal === 'super';
  const campaign = campaigns.find((c) => c.id === campaignId);
  const canManage = admin && !personalMode;

  const activeGroups = groups.filter((g) => g.active !== false);
  const archivedGroups = groups.filter((g) => g.active === false);
  const activeCampaigns = campaigns.filter((c) => c.active !== false);
  const archivedCampaigns = campaigns.filter((c) => !c.active);

  const isTontineCampaign = !!campaign?.type_name?.toLowerCase().includes('tontine');

  // 1. Liste des sessions passées pour Type Épargne (sessions officielles + dates trouvées dans l'historique)
  const availableSessions = useMemo(() => {
    const map = new Map<string, { date: string; count: number; total: number }>();
    sessions.forEach((s) => {
      if (s.session_date) {
        map.set(s.session_date, {
          date: s.session_date,
          count: s.count || (s.contributions ? s.contributions.length : 0),
          total: Number(s.total_amount || 0),
        });
      }
    });
    contributions.forEach((c) => {
      if (c.paid_on && !map.has(c.paid_on)) {
        const matching = contributions.filter((x) => x.paid_on === c.paid_on);
        const tot = matching.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
        map.set(c.paid_on, { date: c.paid_on, count: matching.length, total: tot });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [sessions, contributions]);

  // 2. Liste des périodes passées pour Type Tontine (tours de rotation)
  const availablePeriods = useMemo(() => {
    return tontineRounds
      .map((tr) => ({
        roundNumber: tr.round_number,
        expectedDate: tr.expected_date,
        beneficiaryName: tr.beneficiary_name || 'Bénéficiaire à désigner',
        totalCollected: Number(tr.total_collected_amount || 0),
        totalExpected: Number(tr.payout_amount || 0),
        paidOutAt: tr.paid_at,
        contributionsCount: tr.contributions ? tr.contributions.length : 0,
      }))
      .sort((a, b) => a.roundNumber - b.roundNumber);
  }, [tontineRounds]);

  // 3. Liste des membres de cette cotisation (participantes de la campagne + cotisations)
  const availableMembers = useMemo(() => {
    const map = new Map<string, { id: string; name: string; phone?: string | null }>();
    participants.forEach((p) => {
      if (p.name) {
        const memberInfo = members.find((m) => m.id === p.membership_id);
        map.set(p.name.toLowerCase().trim(), {
          id: p.id,
          name: p.name,
          phone: memberInfo?.phone,
        });
      }
    });
    contributions.forEach((c) => {
      if (c.name) {
        const k = c.name.toLowerCase().trim();
        if (!map.has(k)) {
          map.set(k, {
            id: c.participation_id,
            name: c.name,
          });
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }, [participants, members, contributions]);

  // Filtrage combiné des cotisations selon session/période et membre
  const filteredContributions = useMemo(() => {
    return contributions.filter((c) => {
      if (!isTontineCampaign && selectedSessionFilter) {
        if (c.paid_on !== selectedSessionFilter) return false;
      }
      if (isTontineCampaign && selectedPeriodFilter !== null) {
        const round = tontineRounds.find((r) => r.round_number === selectedPeriodFilter);
        if (round && round.contributions && round.contributions.length > 0) {
          const ids = new Set(round.contributions.map((rc) => rc.contribution_id));
          if (!ids.has(c.id)) return false;
        } else if (round && round.expected_date) {
          if (!c.paid_on.startsWith(round.expected_date.slice(0, 7)) && c.paid_on !== round.expected_date) {
            return false;
          }
        }
      }
      if (selectedMemberFilter) {
        if (c.name.toLowerCase().trim() !== selectedMemberFilter.toLowerCase().trim()) {
          return false;
        }
      }
      return true;
    });
  }, [contributions, isTontineCampaign, selectedSessionFilter, selectedPeriodFilter, tontineRounds, selectedMemberFilter]);

  // Tri des cotisations filtrées
  const sortedContributions = useMemo(() => {
    return [...filteredContributions].sort((a, b) => {
      if (contributionSort === 'member') {
        const cmp = a.name.localeCompare(b.name, 'fr');
        if (cmp !== 0) return cmp;
        return b.paid_on.localeCompare(a.paid_on);
      }
      if (contributionSort === 'session') {
        const cmp = b.paid_on.localeCompare(a.paid_on);
        if (cmp !== 0) return cmp;
        return a.name.localeCompare(b.name, 'fr');
      }
      const cmp = b.paid_on.localeCompare(a.paid_on);
      if (cmp !== 0) return cmp;
      return b.id.localeCompare(a.id);
    });
  }, [filteredContributions, contributionSort]);

  useEffect(() => {
    api
      .GET('/api/v1/auth/me')
      .then((r) => {
        if (r.response.ok) setActor(r.data || null);
      })
      .finally(() => setChecking(false));
    const on = () => setOnline(true),
      off = () => setOnline(false),
      u = () => setUpdate(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    window.addEventListener('pwa-update', u);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      window.removeEventListener('pwa-update', u);
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 6500);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!actor) return;
    let active = true;
    setLoading(true);
    setLoadError('');
    Promise.all([
      api
        .GET('/api/v1/groupements', { params: { query: { page: groupPage, limit: 100 } } })
        .then(unwrap),
      api.GET('/api/v1/campaign-types').then(unwrap),
      api
        .GET('/api/v1/group-functions')
        .then(unwrap)
        .catch(() => []),
      api
        .GET('/api/v1/campaign-events')
        .then(unwrap)
        .catch(() => []),
      superAdmin
        ? api
            .GET('/api/v1/super-admin/dashboard')
            .then(unwrap)
            .catch(() => null)
        : Promise.resolve(null),
    ])
      .then(([g, t, fn, ev, sc]) => {
        if (active) {
          setGroups(g.items);
          setGroupTotal(g.total);
          setTypes(t);
          setFunctions(fn);
          setEvents(ev);
          if (sc) setSuperCockpit(sc);
          setGroupId((id) => {
            const activeItems = g.items.filter((x) => x.active !== false);
            const next = activeItems.some((x) => x.id === id)
              ? id
              : activeItems[0]?.id || g.items[0]?.id || '';
            const sel = g.items.find((x) => x.id === next);
            if (sel) setGroupSearch(sel.name);
            return next;
          });
        }
      })
      .catch((e) => active && setLoadError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [actor, refresh, groupPage, superAdmin]);

  useEffect(() => {
    if (!actor || !groupId) return;
    let active = true;
    setLoadError('');
    api
      .GET('/api/v1/groupements/{groupId}/campaigns', {
        params: { path: { groupId }, query: { page: campaignPage, limit: 25 } },
      })
      .then(unwrap)
      .then((r) => {
        if (active) {
          setCampaigns(r.items);
          setCampaignTotal(r.total);
          setCampaignId((id) => {
            const activeItems = r.items.filter((c) => c.active !== false);
            return activeItems.some((c) => c.id === id)
              ? id
              : activeItems[0]?.id || r.items[0]?.id || '';
          });
        }
      })
      .catch((e) => active && setLoadError(e.message));
    return () => {
      active = false;
    };
  }, [actor, groupId, refresh, campaignPage]);

  useEffect(() => {
    if (!actor || !groupId) return;
    let active = true;
    api
      .GET('/api/v1/groupements/{groupId}/members', {
        params: {
          path: { groupId },
          query: { page, limit: 25, scope: personalMode ? 'personal' : 'group' },
        },
      })
      .then(unwrap)
      .then((r) => {
        if (active) {
          setMembers(r.items);
          setMemberTotal(r.total);
        }
      })
      .catch((e) => active && setLoadError(e.message));
    return () => {
      active = false;
    };
  }, [actor, groupId, page, refresh, personalMode]);

  useEffect(() => {
    if (dialog !== 'participant' || !groupId) return;
    let active = true;
    api
      .GET('/api/v1/groupements/{groupId}/members', {
        params: { path: { groupId }, query: { page: optionPage, limit: 100 } },
      })
      .then(unwrap)
      .then((r) => {
        if (active) {
          setMemberOptions(r.items);
          setOptionTotal(r.total);
        }
      })
      .catch((e) => active && setNotice(e.message));
    return () => {
      active = false;
    };
  }, [dialog, groupId, optionPage]);

  useEffect(() => {
    if (!actor || !groupId || !campaignId) {
      setDashboard(null);
      setParticipants([]);
      setContributions([]);
      setCashbox(null);
      setSessions([]);
      setTontineRounds([]);
      setGracePeriods([]);
      return;
    }
    let active = true;
    setDashboard(null);
    setContributions([]);
    setParticipants([]);
    setSessions([]);
    setTontineRounds([]);
    const path = { groupId, id: campaignId };
    Promise.all([
      api
        .GET('/api/v1/groupements/{groupId}/campaigns/{id}/dashboard', {
          params: { path, query: { scope: personalMode ? 'personal' : 'group' } },
        })
        .then(unwrap),
      api
        .GET('/api/v1/groupements/{groupId}/campaigns/{id}/participants', {
          params: {
            path,
            query: {
              page: participantPage,
              limit: 100,
              scope: personalMode ? 'personal' : 'group',
            },
          },
        })
        .then(unwrap),
      api
        .GET('/api/v1/groupements/{groupId}/campaigns/{campaignId}/contributions', {
          params: {
            path: { groupId, campaignId },
            query: { page, limit: 25, scope: personalMode ? 'personal' : 'group', sort: contributionSort },
          },
        })
        .then(unwrap),
      api
        .GET('/api/v1/groupements/{groupId}/campaigns/{id}/cashbox', { params: { path } })
        .then(unwrap)
        .catch(() => null),
      api
        .GET('/api/v1/groupements/{groupId}/campaigns/{id}/sessions', { params: { path } })
        .then(unwrap)
        .catch(() => []),
      api
        .GET('/api/v1/groupements/{groupId}/campaigns/{id}/tontine/rounds', { params: { path } })
        .then(unwrap)
        .catch(() => []),
      api
        .GET('/api/v1/groupements/{groupId}/campaigns/{id}/grace-periods', { params: { path } })
        .then(unwrap)
        .catch(() => []),
    ])
      .then(([d, p, c, cb, sess, tr, gp]) => {
        if (active) {
          setDashboard(d);
          setParticipants(p.items);
          setParticipantTotal(p.total);
          setContributions(c.items);
          setContributionTotal(c.total);
          if (cb) setCashbox(cb);
          if (sess) setSessions(sess);
          if (tr) setTontineRounds(tr);
          if (gp) setGracePeriods(gp);
        }
      })
      .catch((e) => active && setLoadError(e.message));
    return () => {
      active = false;
    };
  }, [actor, groupId, campaignId, page, participantPage, refresh, personalMode, contributionSort]);

  const resetFilters = useCallback(() => {
    setSelectedSessionFilter(null);
    setSessionFilterSearch('');
    setSelectedPeriodFilter(null);
    setPeriodFilterSearch('');
    setSelectedMemberFilter(null);
    setMemberFilterSearch('');
  }, []);

  const selectGroup = useCallback(
    (id: string) => {
      if (id === groupId) return;
      setGroupId(id);
      const sel = groups.find((g) => g.id === id);
      if (sel) setGroupSearch(sel.name);
      setCampaignId('');
      setCampaigns([]);
      setMembers([]);
      setDashboard(null);
      setParticipants([]);
      setContributions([]);
      resetFilters();
      setPage(1);
      setCampaignPage(1);
      setParticipantPage(1);
      setTab('overview');
    },
    [groupId, groups, resetFilters],
  );

  useEffect(() => {
    resetFilters();
  }, [campaignId, resetFilters]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (groupSearchRef.current && !groupSearchRef.current.contains(e.target as Node)) {
        setGroupDropdownOpen(false);
      }
      if (sessionFilterRef.current && !sessionFilterRef.current.contains(e.target as Node)) {
        setSessionFilterDropdownOpen(false);
      }
      if (periodFilterRef.current && !periodFilterRef.current.contains(e.target as Node)) {
        setPeriodFilterDropdownOpen(false);
      }
      if (memberFilterRef.current && !memberFilterRef.current.contains(e.target as Node)) {
        setMemberFilterDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (group && !groupSearch) {
      setGroupSearch(group.name);
    }
  }, [group, groupSearch]);

  async function handleDeleteType(typeItem: S['TypeView']) {
    if (!confirm(`Confirmez-vous la suppression du type "${typeItem.name}" ?`)) return;
    await action(
      () =>
        api
          .DELETE('/api/v1/campaign-types/{id}', {
            params: { path: { id: typeItem.id } },
          })
          .then(unwrap),
      'Type de campagne supprimé.',
    );
    setRefresh((x) => x + 1);
  }

  async function handleDeleteEvent(eventItem: CampaignEvent) {
    if (!confirm(`Confirmez-vous la suppression de l’événement "${eventItem.name}" ?`)) return;
    await action(
      () =>
        api
          .DELETE('/api/v1/campaign-events/{id}', {
            params: { path: { id: eventItem.id } },
          })
          .then(unwrap),
      'Événement supprimé.',
    );
    setRefresh((x) => x + 1);
  }

  function open(name: string) {
    idempotency.current = crypto.randomUUID();
    setOptionPage(1);
    if (name === 'campaign') {
      setCampaignTypeId(types[0]?.id || '');
    }
    setDialog(name);
  }

  async function action(task: () => Promise<unknown>, message: string) {
    if (busy) return;
    setBusy(true);
    try {
      await task();
      setNotice(message);
      setDialog('');
      setResetPinMember(null);
      setRefresh((n) => n + 1);
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    const v = values(e);
    const campaignPath = { groupId, id: campaignId };

    if (dialog === 'group') {
      const formData = new FormData(e.currentTarget);
      const selectedTypeIds = formData.getAll('typeIds') as string[];
      const selectedEventIds = formData.getAll('eventIds') as string[];

      if (types.length > 0 && selectedTypeIds.length === 0) {
        setNotice('Veuillez sélectionner au moins un type de campagne.');
        return;
      }
      if (events.length > 0 && selectedEventIds.length === 0) {
        setNotice('Veuillez sélectionner au moins un événement.');
        return;
      }

      await action(
        () =>
          api
            .POST('/api/v1/groupements', {
              body: {
                name: v.name,
                address: v.address,
                phone: v.phone,
                typeIds: selectedTypeIds.length > 0 ? selectedTypeIds : undefined,
                eventIds: selectedEventIds.length > 0 ? selectedEventIds : undefined,
              },
            })
            .then(unwrap),
        'Groupement créé avec ses types et événements affectés.',
      );
    }

    if (dialog === 'member')
      await action(
        () =>
          api
            .POST('/api/v1/groupements/{groupId}/members', {
              params: { path: { groupId } },
              body: {
                name: v.name,
                gender: (v.gender as 'F' | 'M') || 'F',
                address: v.address || undefined,
                functionId: v.functionId || undefined,
                pin: v.pin || undefined,
                ...(v.phone ? { phone: v.phone } : {}),
                ...(v.login ? { login: v.login } : {}),
                ...(v.password ? { password: v.password } : {}),
                admin: v.admin === 'on',
              },
            })
            .then(unwrap),
        'Membre ajoutée.',
      );

    if (dialog === 'type')
      await action(
        () =>
          api.POST('/api/v1/campaign-types', { body: { name: v.name, code: v.code } }).then(unwrap),
        'Type de campagne créé.',
      );

    if (dialog === 'edit-type' && editType)
      await action(
        () =>
          api
            .PATCH('/api/v1/campaign-types/{id}', {
              params: { path: { id: editType.id } },
              body: {
                name: v.name,
                code: v.code ? v.code.toUpperCase() : undefined,
              },
            })
            .then(unwrap),
        'Type de campagne mis à jour.',
      );

    if (dialog === 'event')
      await action(
        () =>
          api
            .POST('/api/v1/campaign-events', {
              body: {
                name: v.name,
                code: v.code.toUpperCase(),
                description: v.description || undefined,
              },
            })
            .then(unwrap),
        'Événement ajouté au catalogue.',
      );

    if (dialog === 'edit-event' && editEvent)
      await action(
        () =>
          api
            .PATCH('/api/v1/campaign-events/{id}', {
              params: { path: { id: editEvent.id } },
              body: {
                name: v.name,
                code: v.code ? v.code.toUpperCase() : undefined,
                description: v.description || undefined,
              },
            })
            .then(unwrap),
        'Événement mis à jour.',
      );

    if (dialog === 'campaign') {
      const typeObj = types.find((t) => t.id === v.typeId);
      const isRotative =
        typeObj?.code === 'TONTINE' || (typeObj?.name || '').toLowerCase().includes('tontine');

      const today = new Date();
      const todayStr = today.toISOString().slice(0, 10);
      const nextYear = new Date(today);
      nextYear.setFullYear(today.getFullYear() + 1);
      const nextYearStr = nextYear.toISOString().slice(0, 10);

      await action(
        () =>
          api
            .POST('/api/v1/groupements/{groupId}/campaigns', {
              params: { path: { groupId } },
              body: {
                name: v.name,
                typeId: v.typeId,
                startDate: isRotative ? (v.startDate || todayStr) : v.startDate,
                endDate: isRotative ? (v.endDate || nextYearStr) : v.endDate,
                weekday: isRotative ? (v.weekday ? Number(v.weekday) : 2) : Number(v.weekday || 2),
                intervalWeeks: isRotative
                  ? (v.intervalWeeks ? Number(v.intervalWeeks) : 1)
                  : Number(v.intervalWeeks || 1),
                isMandatory: v.isMandatory === 'on',
                eventId: v.eventId || undefined,
                standardAmount: !isRotative && v.standardAmount ? Number(v.standardAmount) : undefined,
                rotationInterval: isRotative
                  ? ((v.rotationInterval as 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY') || 'MONTHLY')
                  : undefined,
                dueDay: isRotative && v.dueDay ? Number(v.dueDay) : undefined,
              },
            })
            .then(unwrap),
        'Campagne créée. Ajoutez maintenant ses participantes.',
      );
    }

    if (dialog === 'participant')
      await action(
        () =>
          api
            .POST('/api/v1/groupements/{groupId}/campaigns/{id}/participants', {
              params: { path: campaignPath },
              body: {
                membershipId: v.membershipId,
                forfait: v.forfait ? Number(v.forfait) : null,
                isRandom: v.isRandom === 'on',
              },
            })
            .then(unwrap),
        'Participation et forfait enregistrés.',
      );

    if (dialog === 'contribution') {
      const pId = v.participationId;
      const part = participants.find((p) => p.id === pId);
      const participantName = part?.name || 'la membre';
      const contribAmount = Number(v.amount);
      await action(
        () =>
          api
            .POST('/api/v1/groupements/{groupId}/campaigns/{campaignId}/contributions', {
              params: { path: { groupId, campaignId } },
              body: {
                participationId: pId,
                amount: contribAmount,
                paidOn: v.paidOn,
                idempotencyKey: idempotency.current,
              },
            })
            .then(unwrap),
        'Cotisation enregistrée.',
      );
      if (announceVoice && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          const utter = new SpeechSynthesisUtterance(
            `Cotisation de ${contribAmount} francs CFA reçue pour ${participantName}.`,
          );
          utter.lang = 'fr-FR';
          utter.rate = 0.95;
          window.speechSynthesis.speak(utter);
        } catch {
          // ignore speech synthesis errors
        }
      }
    }

    if (dialog === 'grace')
      await action(
        () =>
          api
            .POST('/api/v1/groupements/{groupId}/campaigns/{id}/grace-periods', {
              params: { path: campaignPath },
              body: {
                membershipId: v.membershipId || graceMemberId,
                periodDate: v.periodDate,
                extendedDeadline: v.extendedDeadline,
                reason: v.reason || undefined,
              },
            })
            .then(unwrap),
        'Délai de grâce accordé.',
      );

    if (dialog === 'reset-pin')
      await action(
        () =>
          api
            .POST('/api/v1/groupements/{groupId}/members/{memberId}/reset-pin', {
              params: { path: { groupId, memberId: resetPinMember!.id } },
              body: { pin: v.pin },
            })
            .then(unwrap),
        'Code PIN réinitialisé avec succès.',
      );

    if (dialog === 'void')
      await action(
        () =>
          api
            .POST('/api/v1/groupements/{groupId}/campaigns/{campaignId}/contributions/{id}/void', {
              params: { path: { groupId, campaignId, id: voidId } },
              body: { reason: v.reason },
            })
            .then(unwrap),
        'Cotisation annulée. L’historique est conservé.',
      );
  }

  if (checking)
    return (
      <div className="splash">
        <Brand />
        <p>Chargement de votre espace…</p>
      </div>
    );

  if (!actor)
    return (
      <Login
        portal={portal}
        onLogin={(a) => {
          setGroups([]);
          setGroupId('');
          setCampaigns([]);
          setMembers([]);
          setParticipants([]);
          setContributions([]);
          setDashboard(null);
          setPersonalMode(false);
          setTab('overview');
          setActor(a);
        }}
      />
    );

  if ((portal === 'super' && !actor.isSuper) || (portal === 'member' && actor.isSuper))
    return (
      <div className="splash">
        <Brand />
        <h2>Ce compte appartient à un autre espace</h2>
        <p>Utilisez {actor.isSuper ? 'le web super administrateur' : 'la PWA membre'}.</p>
        <button
          className="primary"
          onClick={() =>
            action(async () => {
              await api.POST('/api/v1/auth/logout').then(unwrap);
              setActor(null);
            }, 'Déconnexion effectuée.')
          }
        >
          Se déconnecter
        </button>
      </div>
    );

  const title =
    tab === 'members'
      ? 'Les membres'
      : tab === 'campaigns'
        ? 'Les campagnes actives'
        : tab === 'types'
          ? 'Types de campagne'
          : tab === 'cockpit'
            ? 'Cockpit Plateforme 360°'
            : tab === 'archives'
              ? 'Archives (Groupements inactifs & Campagnes fermées)'
              : 'Vue d’ensemble';

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <div className="space-label">
          {superAdmin ? 'PILOTAGE DE LA PLATEFORME' : 'MON GROUPEMENT'}
        </div>
        <nav>
          {[
            ['overview', 'Vue d’ensemble', LayoutDashboard],
            ['campaigns', 'Campagnes', FolderHeart],
            ['members', 'Membres', Users],
            ...(superAdmin
              ? [
                  ['cockpit', 'Cockpit 360°', Sparkles],
                  ['types', 'Types & Événements', Coins],
                ]
              : []),
            ...(superAdmin || admin ? [['archives', 'Archives', Archive]] : []),
          ].map(([key, label, Icon]) => {
            const I = Icon as typeof Users;
            return (
              <button
                key={key as string}
                className={tab === key ? 'nav-item active' : 'nav-item'}
                onClick={() => {
                  setTab(key as string);
                  setPage(1);
                }}
              >
                <I size={19} />
                {label as string}
                {tab === key && <ChevronRight size={16} />}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <span className="round-avatar">{actor.name.slice(0, 1)}</span>
          <div>
            <strong>{actor.name}</strong>
            <small>
              {superAdmin ? 'Super administrateur' : admin ? 'Administratrice et membre' : 'Membre'}
            </small>
          </div>
          <button
            className="icon-button"
            title="Se déconnecter"
            aria-label="Se déconnecter"
            onClick={() =>
              action(async () => {
                await api.POST('/api/v1/auth/logout').then(unwrap);
                setActor(null);
                setGroups([]);
                setGroupId('');
              }, 'Déconnexion effectuée.')
            }
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <span>
            <span className="status-dot" />
            {online ? 'Espace connecté' : 'Hors connexion'}
          </span>
          <span className="topbar-right">
            {!superAdmin && (
              <button
                type="button"
                className="secondary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  fontSize: 12,
                }}
                onClick={() =>
                  setQrModal({
                    title: `Carte Membre · ${actor.name}`,
                    subtitle: `${group?.name || 'Groupement'} · ${actor.login}`,
                    data: `ALF:MEMBER:${groupId}:${actor.id}:${actor.login}`,
                  })
                }
              >
                <QrCode size={15} />
                Mon Code QR
              </button>
            )}
            <span>Épargne solidaire</span>
            <button
              className="icon-button mobile-logout"
              aria-label="Se déconnecter"
              onClick={() =>
                action(async () => {
                  await api.POST('/api/v1/auth/logout').then(unwrap);
                  setActor(null);
                  setGroups([]);
                  setGroupId('');
                }, 'Déconnexion effectuée.')
              }
            >
              <LogOut size={17} />
            </button>
            <span className="round-avatar small">{actor.name.slice(0, 1)}</span>
          </span>
        </header>
        <div className="content">
          <div className="breadcrumb">
            AvecLesFemmes <ChevronRight size={13} /> {superAdmin ? 'Administration' : 'Mon espace'}
          </div>
          <div className="page-heading">
            <div>
              <h1>{title}</h1>
              <p className="muted">
                {superAdmin
                  ? 'Accompagnez les groupements et suivez leurs campagnes.'
                  : 'Retrouvez votre groupement et faites grandir vos projets.'}
              </p>
            </div>
            {superAdmin && tab !== 'types' && tab !== 'cockpit' && tab !== 'archives' && (
              <button className="primary" onClick={() => open('group')}>
                <Plus size={18} />
                Créer un groupement
              </button>
            )}
            {superAdmin && tab === 'types' && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="secondary" onClick={() => open('event')}>
                  <Plus size={18} />
                  Créer un événement
                </button>
                <button className="primary" onClick={() => open('type')}>
                  <Plus size={18} />
                  Créer un type
                </button>
              </div>
            )}
          </div>
          {!online && (
            <div className="alert">
              Connexion nécessaire pour consulter les données à jour et enregistrer une cotisation.
            </div>
          )}
          {update && (
            <div className="alert">
              Une nouvelle version est disponible.{' '}
              <button disabled={!!dialog} className="text-button" onClick={() => onUpdate?.()}>
                <Download size={15} />
                Mettre à jour
              </button>
              {dialog && ' Terminez votre saisie avant la mise à jour.'}
            </div>
          )}
          {notice && (
            <div className="toast" role="status">
              <Check size={18} />
              {notice}
              <button className="icon-button" aria-label="Masquer" onClick={() => setNotice('')}>
                <X size={16} />
              </button>
            </div>
          )}
          {loadError && (
            <div className="alert" role="alert">
              {loadError}
              <button className="text-button" onClick={() => setRefresh((n) => n + 1)}>
                Réessayer
              </button>
            </div>
          )}
          {admin && (
            <div className="view-switch">
              <span>Votre espace</span>
              <button
                className={!personalMode ? 'selected' : ''}
                onClick={() => {
                  setPersonalMode(false);
                  setPage(1);
                }}
              >
                Gestion du groupement
              </button>
              <button
                className={personalMode ? 'selected' : ''}
                onClick={() => {
                  setPersonalMode(true);
                  setPage(1);
                }}
              >
                Mon épargne personnelle
              </button>
            </div>
          )}
          {tab !== 'types' && tab !== 'cockpit' && (
            <>
              <div className="group-selector">
                <span className="group-symbol">
                  <Users size={22} />
                </span>
                <div className="group-autocomplete-wrapper" ref={groupSearchRef}>
                  <div className="group-autocomplete-label-row">
                    <label htmlFor="group-search-input">
                      {superAdmin ? 'Rechercher un groupement' : 'Votre groupement'}
                    </label>
                    {group && (
                      <span className="current-group-badge">
                        <Check size={12} /> Actif : <strong>{group.name}</strong>
                      </span>
                    )}
                  </div>
                  <div className="group-autocomplete-input-box">
                    <Search size={16} className="muted" />
                    <input
                      id="group-search-input"
                      type="text"
                      placeholder="Rechercher par nom, adresse, téléphone…"
                      value={groupSearch}
                      onChange={(e) => {
                        setGroupSearch(e.target.value);
                        setGroupDropdownOpen(true);
                      }}
                      onFocus={() => setGroupDropdownOpen(true)}
                    />
                    {groupSearch && (
                      <button
                        type="button"
                        className="icon-button"
                        style={{ padding: 2 }}
                        title="Effacer"
                        onClick={() => {
                          setGroupSearch('');
                          setGroupDropdownOpen(true);
                        }}
                      >
                        <X size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="autocomplete-chevron-btn"
                      title="Ouvrir la liste"
                      onClick={() => setGroupDropdownOpen(!groupDropdownOpen)}
                    >
                      {groupDropdownOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>

                  {groupDropdownOpen && (
                    <div className="group-autocomplete-dropdown">
                      <div className="group-autocomplete-guide">
                        <span>Sélectionnez un groupement :</span>
                        <span className="badge-count">
                          {
                            activeGroups.filter(
                              (g) =>
                                !groupSearch.trim() ||
                                (group && groupSearch.trim().toLowerCase() === group.name.toLowerCase()) ||
                                g.name.toLowerCase().includes(groupSearch.toLowerCase()) ||
                                g.address.toLowerCase().includes(groupSearch.toLowerCase()) ||
                                g.phone.toLowerCase().includes(groupSearch.toLowerCase()),
                            ).length
                          }{' '}
                          disponible(s)
                        </span>
                      </div>
                      {activeGroups
                        .filter(
                          (g) =>
                            !groupSearch.trim() ||
                            (group && groupSearch.trim().toLowerCase() === group.name.toLowerCase()) ||
                            g.name.toLowerCase().includes(groupSearch.toLowerCase()) ||
                            g.address.toLowerCase().includes(groupSearch.toLowerCase()) ||
                            g.phone.toLowerCase().includes(groupSearch.toLowerCase()),
                        )
                        .map((g) => (
                          <div
                            key={g.id}
                            className={
                              g.id === groupId
                                ? 'group-autocomplete-item selected'
                                : 'group-autocomplete-item'
                            }
                            onClick={() => {
                              selectGroup(g.id);
                              setGroupSearch(g.name);
                              setGroupDropdownOpen(false);
                            }}
                          >
                            <div className="group-item-avatar">
                              <Users size={16} />
                            </div>
                            <div className="group-item-content">
                              <div className="group-item-header">
                                <strong>{g.name}</strong>
                                {g.id === groupId && (
                                  <span className="badge-selected-pill">
                                    <Check size={11} /> Actuel
                                  </span>
                                )}
                              </div>
                              <div className="group-item-meta">
                                <span className="group-meta-sub">
                                  <MapPin size={12} /> {g.address}
                                </span>
                                <span className="group-meta-sub">
                                  <Phone size={12} /> {g.phone}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      {!activeGroups.some(
                        (g) =>
                          !groupSearch.trim() ||
                          g.name.toLowerCase().includes(groupSearch.toLowerCase()) ||
                          g.address.toLowerCase().includes(groupSearch.toLowerCase()) ||
                          g.phone.toLowerCase().includes(groupSearch.toLowerCase()),
                      ) && (
                        <div className="group-autocomplete-empty">
                          <p>Aucun groupement actif trouvé.</p>
                          <button
                            type="button"
                            className="btn-link"
                            onClick={() => {
                              setGroupSearch('');
                              setGroupDropdownOpen(true);
                            }}
                          >
                            Voir tous les groupements
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="group-select-picker">
                  <label htmlFor="group-select">Sélection directe</label>
                  <select
                    id="group-select"
                    value={groupId}
                    onChange={(e) => selectGroup(e.target.value)}
                    aria-label="Sélectionner un groupement"
                  >
                    {!activeGroups.length && (
                      <option value="">{loading ? 'Chargement…' : 'Aucun groupement actif'}</option>
                    )}
                    {activeGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>

                {groupTotal > 25 && (
                  <Pager page={groupPage} total={groupTotal} onChange={setGroupPage} />
                )}
              </div>

              {/* Fiche détaillée du groupement sélectionné */}
              {group && (
                <div className="group-details-card">
                  <div className="group-details-main">
                    <div className="group-details-avatar">
                      <Users size={22} />
                    </div>
                    <div className="group-details-info">
                      <div className="group-details-header">
                        <h3 className="group-details-name">{group.name}</h3>
                        <span className="badge-pill-success">Groupement solidaire</span>
                      </div>
                      <div className="group-details-meta">
                        <span className="group-meta-item">
                          <MapPin size={14} />
                          <span>{group.address}</span>
                        </span>
                        <span className="group-meta-item">
                          <Phone size={14} />
                          <a href={`tel:${group.phone}`}>{group.phone}</a>
                        </span>
                        {group.responsible && (
                          <span className="group-meta-item muted">
                            Responsable : {group.responsible}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="group-details-actions">
                    <button
                      type="button"
                      className="btn-group-qr"
                      onClick={() =>
                        setQrModal({
                          title: `Groupement · ${group.name}`,
                          subtitle: `${group.address} · Tél: ${group.phone}`,
                          data: `ALF:GROUP:${group.id}`,
                        })
                      }
                    >
                      <QrCode size={16} />
                      <span>Code QR du Groupement</span>
                    </button>
                    {superAdmin && group.active !== false && (
                      <button
                        type="button"
                        className="btn-archive-group"
                        disabled={busy}
                        title="Archiver et désactiver ce groupement"
                        onClick={() =>
                          action(
                            () =>
                              api
                                .PATCH('/api/v1/groupements/{groupId}/activation', {
                                  params: { path: { groupId: group.id } },
                                  body: { active: false },
                                })
                                .then(unwrap),
                            'Groupement archivé avec succès.',
                          )
                        }
                      >
                        <Archive size={15} />
                        <span>Archiver le groupement</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
          {!groupId && tab !== 'types' && tab !== 'cockpit' && tab !== 'archives' && !loading ? (
            <div className="empty big">
              <Users size={40} />
              <h2>{superAdmin ? 'Votre premier groupement' : 'Votre espace est prêt'}</h2>
              <p>
                {superAdmin
                  ? 'Créez un groupement, puis ajoutez ses membres.'
                  : 'Aucun groupement n’est associé à votre compte.'}
              </p>
              {superAdmin && (
                <button className="primary" onClick={() => open('group')}>
                  <Plus size={17} />
                  Créer un groupement
                </button>
              )}
            </div>
          ) : (
            <>
              {tab === 'overview' && (
                adminSubView === 'chiffres' ? (
                  <WaveChiffresView
                    totalAmount={Number(dashboard?.total || 0)}
                    contributionsCount={Number(dashboard?.payments || 0)}
                    period={statsPeriod}
                    onPeriodChange={setStatsPeriod}
                    onBack={() => setAdminSubView('dashboard')}
                  />
                ) : adminSubView === 'settings' ? (
                  <WaveSettingsView
                    announceVoice={announceVoice}
                    onToggleVoice={() => setAnnounceVoice(!announceVoice)}
                    actorLogin={actor?.login || actor?.name || ''}
                    onOpenQr={() => {
                      if (group) {
                        setQrModal({
                          title: `Groupement · ${group.name}`,
                          subtitle: `${group.address || 'Sénégal'} · ${group.phone}`,
                          data: `ALF:GROUP:${group.id}:${group.name}`,
                        });
                      }
                    }}
                    onGoCampaigns={() => {
                      setTab('campaigns');
                      setAdminSubView('dashboard');
                    }}
                    onGoMembers={() => {
                      setTab('members');
                      setAdminSubView('dashboard');
                    }}
                    onGoArchives={() => {
                      setTab('archives');
                      setAdminSubView('dashboard');
                    }}
                    onLogout={() =>
                      action(async () => {
                        await api.POST('/api/v1/auth/logout').then(unwrap);
                        setActor(null);
                        setGroups([]);
                        setGroupId('');
                      }, 'Déconnexion effectuée.')
                    }
                    onBack={() => setAdminSubView('dashboard')}
                  />
                ) : (
                <>
                  {superAdmin ? (
                    <section className="welcome-panel">
                      <div>
                        <span className="eyebrow">CHAQUE CONTRIBUTION COMPTE</span>
                        <h2>
                          Ensemble, les projets
                          <br />
                          prennent vie.
                        </h2>
                        <p>
                          {group?.name} · Consultation des campagnes
                        </p>
                      </div>
                      <div className="welcome-art" aria-hidden="true">
                        <div className="coin coin-one">
                          <Leaf size={48} />
                        </div>
                        <div className="coin coin-two">
                          <Coins size={48} />
                        </div>
                        <span className="art-spark">✦</span>
                      </div>
                    </section>
                  ) : dashboard?.personal ? (
                    /* SÉRIE 1 : ESPACE MEMBRE (STYLE WAVE PARTICULIER) */
                    <div className="wave-member-hero-section">
                      <div className="wave-balance-hero">
                        <span className="wave-balance-eyebrow">Solde d'épargne disponible</span>
                        <div className="wave-balance-row">
                          <span className="wave-balance-amount">
                            {showBalance ? money(dashboard?.total || 0) : '•••••• FCFA'}
                          </span>
                          <button
                            type="button"
                            className="wave-eye-toggle"
                            aria-label={showBalance ? 'Masquer le solde' : 'Afficher le solde'}
                            onClick={() => setShowBalance(!showBalance)}
                          >
                            {showBalance ? <Eye size={22} /> : <EyeOff size={22} />}
                          </button>
                        </div>
                      </div>

                      <div className="wave-qr-card-container">
                        <div className="wave-qr-card">
                          <div className="wave-qr-white-box">
                            <VectorQrView
                              data={`ALF:MEMBER:${groupId}:${actor?.id}:${actor?.login}`}
                              width={160}
                            />
                            <button
                              type="button"
                              className="wave-qr-scan-btn"
                              onClick={() => setScannerOpen(true)}
                            >
                              <Camera size={16} />
                              <span>Scanner</span>
                            </button>
                          </div>
                          <div className="wave-qr-mascot" title="AvecLesFemmes Solidaire">
                            🐧
                          </div>
                        </div>
                      </div>

                      <div className="wave-actions-grid">
                        <button
                          type="button"
                          className="wave-action-circle-item"
                          onClick={() => setTab('campaigns')}
                        >
                          <div className="wave-action-circle wave-circle-blue">
                            <Coins size={24} />
                          </div>
                          <span className="wave-action-label">Cotiser</span>
                        </button>

                        <button
                          type="button"
                          className="wave-action-circle-item"
                          aria-label="Paiements et Campagnes"
                          onClick={() => setTab('campaigns')}
                        >
                          <div className="wave-action-circle wave-circle-orange">
                            <FolderHeart size={24} />
                          </div>
                          <span className="wave-action-label">Paiements</span>
                        </button>

                        <button
                          type="button"
                          className="wave-action-circle-item"
                          onClick={() => setTab('campaigns')}
                        >
                          <div className="wave-action-circle wave-circle-sky">
                            <Wallet size={24} />
                          </div>
                          <span className="wave-action-label">Forfaits</span>
                        </button>

                        <button
                          type="button"
                          className="wave-action-circle-item"
                          onClick={() => {
                            const el = document.getElementById('contributions-history-anchor');
                            el?.scrollIntoView({ behavior: 'smooth' });
                          }}
                        >
                          <div className="wave-action-circle wave-circle-pink">
                            <Lock size={24} />
                          </div>
                          <span className="wave-action-label">Calebasse</span>
                        </button>

                        <button
                          type="button"
                          className="wave-action-circle-item"
                          onClick={() => {
                            const el = document.querySelector('.tontine-rounds-table');
                            el?.scrollIntoView({ behavior: 'smooth' });
                          }}
                        >
                          <div className="wave-action-circle wave-circle-green">
                            <Sparkles size={24} />
                          </div>
                          <span className="wave-action-label">Tontines</span>
                        </button>

                        <button
                          type="button"
                          className="wave-action-circle-item"
                          onClick={() =>
                            setQrModal({
                              title: `Carte Membre · ${actor?.name}`,
                              subtitle: `${group?.name || 'Groupement'} · ${actor?.login}`,
                              data: `ALF:MEMBER:${groupId}:${actor?.id}:${actor?.login}`,
                            })
                          }
                        >
                          <div className="wave-action-circle wave-circle-purple">
                            <QrCode size={24} />
                          </div>
                          <span className="wave-action-label">Mon QR</span>
                        </button>

                        <button
                          type="button"
                          className="wave-action-circle-item"
                          onClick={() => setHistoryFilter('SOLIDARITE')}
                        >
                          <div className="wave-action-circle wave-circle-mint">
                            <ShieldCheck size={24} />
                          </div>
                          <span className="wave-action-label">Solidarité</span>
                        </button>

                        <button
                          type="button"
                          className="wave-action-circle-item"
                          onClick={() => {
                            const el = document.getElementById('contributions-history-anchor');
                            el?.scrollIntoView({ behavior: 'smooth' });
                          }}
                        >
                          <div className="wave-action-circle wave-circle-slate">
                            <Clock size={24} />
                          </div>
                          <span className="wave-action-label">Historique</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* SÉRIE 2 : ESPACE ADMIN GROUPEMENT (STYLE WAVE BUSINESS) */
                    <div className="wave-admin-hero-section">
                      <div className="wave-top-header">
                        <button
                          type="button"
                          className="wave-header-btn"
                          aria-label="Paramètres du groupement"
                          title="Paramètres"
                          onClick={() => setAdminSubView('settings')}
                        >
                          <Settings size={20} />
                        </button>
                        <span className="wave-header-title">{group?.name || 'Mon Groupement'}</span>
                        <button
                          type="button"
                          className="wave-header-btn"
                          aria-label="Afficher les chiffres"
                          title="Chiffres"
                          onClick={() => setAdminSubView('chiffres')}
                        >
                          <BarChart3 size={20} />
                        </button>
                      </div>

                      <div className="wave-balance-hero">
                        <span className="wave-balance-eyebrow">SOLDE CAISSE</span>
                        <div className="wave-balance-row">
                          <span className="wave-balance-amount">
                            {showBalance ? money(dashboard?.total || 0) : '•••••• FCFA'}
                          </span>
                          <button
                            type="button"
                            className="wave-eye-toggle"
                            aria-label={showBalance ? 'Masquer le solde' : 'Afficher le solde'}
                            onClick={() => setShowBalance(!showBalance)}
                          >
                            {showBalance ? <Eye size={22} /> : <EyeOff size={22} />}
                          </button>
                        </div>
                      </div>

                      {/* Bouton géant d'encaissement WAVE Business */}
                      {canManage && campaign?.active && (
                        <div className="wave-giant-cta-wrapper">
                          <button
                            type="button"
                            className="wave-giant-cta"
                            aria-label="Enregistrer une cotisation"
                            disabled={!online || busy}
                            onClick={() => open('contribution')}
                          >
                            <span className="wave-giant-cta-icon">
                              <QrCode size={22} />
                            </span>
                            <span className="wave-giant-cta-text">ENCAISSER UNE MEMBRE</span>
                          </button>
                        </div>
                      )}

                      <div className="wave-actions-grid">
                        <button
                          type="button"
                          className="wave-action-circle-item"
                          onClick={() => setTab('members')}
                        >
                          <div className="wave-action-circle wave-circle-blue">
                            <Users size={24} />
                          </div>
                          <span className="wave-action-label">Membres</span>
                        </button>

                        <button
                          type="button"
                          className="wave-action-circle-item"
                          onClick={() => setTab('campaigns')}
                        >
                          <div className="wave-action-circle wave-circle-orange">
                            <FolderHeart size={24} />
                            <span className="wave-action-pill-badge">Actives</span>
                          </div>
                          <span className="wave-action-label">Campagnes</span>
                        </button>

                        <button
                          type="button"
                          className="wave-action-circle-item"
                          onClick={() => {
                            const el = document.querySelector('.tontine-rounds-table');
                            el?.scrollIntoView({ behavior: 'smooth' });
                          }}
                        >
                          <div className="wave-action-circle wave-circle-sky">
                            <Shuffle size={24} />
                          </div>
                          <span className="wave-action-label">Tontines</span>
                        </button>

                        <button
                          type="button"
                          className="wave-action-circle-item"
                          onClick={() => setAdminSubView('chiffres')}
                        >
                          <div className="wave-action-circle wave-circle-purple">
                            <BarChart3 size={24} />
                          </div>
                          <span className="wave-action-label">Chiffres</span>
                        </button>

                        <button
                          type="button"
                          className="wave-action-circle-item"
                          onClick={() => {
                            const el = document.querySelector('.cashbox-grid');
                            el?.scrollIntoView({ behavior: 'smooth' });
                          }}
                        >
                          <div className="wave-action-circle wave-circle-pink">
                            <Lock size={24} />
                          </div>
                          <span className="wave-action-label">Coffre</span>
                        </button>

                        <button
                          type="button"
                          className="wave-action-circle-item"
                          onClick={() => {
                            if (group) {
                              setQrModal({
                                title: `Groupement · ${group.name}`,
                                subtitle: `${group.address || 'Sénégal'} · ${group.phone}`,
                                data: `ALF:GROUP:${group.id}:${group.name}`,
                              });
                            }
                          }}
                        >
                          <div className="wave-action-circle wave-circle-mint">
                            <QrCode size={24} />
                          </div>
                          <span className="wave-action-label">Code QR</span>
                        </button>

                        <button
                          type="button"
                          className="wave-action-circle-item"
                          onClick={() => setTab('archives')}
                        >
                          <div className="wave-action-circle wave-circle-slate">
                            <Archive size={24} />
                          </div>
                          <span className="wave-action-label">Archives</span>
                        </button>

                        <button
                          type="button"
                          className="wave-action-circle-item"
                          onClick={() => open('member')}
                        >
                          <div className="wave-action-circle wave-circle-green">
                            <UserPlus size={24} />
                          </div>
                          <span className="wave-action-label">+ Membre</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* État de la caisse pour l'administration du groupement */}
                  {canManage && cashbox && (
                    <div className="cashbox-grid">
                      <div className="cashbox-card highlight">
                        <div className="cashbox-label">Solde en caisse disponible</div>
                        <div className="cashbox-value">{money(cashbox.balance)}</div>
                      </div>
                      <div className="cashbox-card">
                        <div className="cashbox-label">Total encaissé</div>
                        <div className="cashbox-value">{money(cashbox.total_collected)}</div>
                      </div>
                      <div className="cashbox-card">
                        <div className="cashbox-label">Total cagnottes reversées</div>
                        <div className="cashbox-value">{money(cashbox.total_paid_out)}</div>
                      </div>
                    </div>
                  )}

                  <div className="section-heading">
                    <h2>{dashboard?.personal ? 'Mon épargne' : 'Suivi de campagne'}</h2>
                    <select
                      aria-label="Campagne suivie"
                      value={campaignId}
                      onChange={(e) => {
                        setCampaignId(e.target.value);
                        setPage(1);
                      }}
                    >
                      {!activeCampaigns.length && <option value="">Aucune campagne active</option>}
                      {activeCampaigns.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.event_name ? `(${c.event_name})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  {campaignTotal > 25 && (
                    <Pager page={campaignPage} total={campaignTotal} onChange={setCampaignPage} />
                  )}
                  <div className="stats">
                    <article>
                      <span className="stat-icon">
                        <Coins size={21} />
                      </span>
                      <span>
                        {dashboard?.personal ? 'Mon montant versé' : 'Montant total versé'}
                      </span>
                      <strong>{dashboard ? money(dashboard.total) : '—'}</strong>
                      <small>Versements valides · FCFA</small>
                    </article>
                    <article>
                      <span className="stat-icon sand">
                        <FolderHeart size={21} />
                      </span>
                      <span>Cotisations enregistrées</span>
                      <strong>{dashboard?.payments || '—'}</strong>
                      <small>
                        {dashboard?.personal ? 'Mes cotisations' : 'Dans cette campagne'}
                      </small>
                    </article>
                    <article>
                      <span className="stat-icon lilac">
                        <Users size={21} />
                      </span>
                      <span>
                        {dashboard?.personal ? 'Ma participation' : 'Participantes inscrites'}
                      </span>
                      <strong>{dashboard?.participants || '—'}</strong>
                      <small>
                        {campaign
                          ? `${days[campaign.weekday]} · toutes les ${campaign.interval_weeks} semaine(s)`
                          : 'Ajoutez une campagne pour commencer'}
                      </small>
                    </article>
                  </div>
                  {dashboard && (
                    <p className="updated">
                      Actualisé le {new Date(dashboard.updatedAt).toLocaleString('fr-SN')}
                    </p>
                  )}

                  {/* Tontine rotative - tours et tirage au sort */}
                  {campaign?.type_name?.toLowerCase().includes('tontine') && (
                    <section className="panel" style={{ marginTop: 20 }}>
                      <div className="section-heading">
                        <div>
                          <h2>Tontine Rotative · Tirage au sort</h2>
                          <p className="muted">
                            Attribution des cagnottes ({campaign.rotation_interval || 'Mensuel'})
                          </p>
                        </div>
                        {canManage && (
                          <button
                            type="button"
                            className="secondary"
                            disabled={busy || participants.length < 2}
                            onClick={() =>
                              action(
                                () =>
                                  api
                                    .POST(
                                      '/api/v1/groupements/{groupId}/campaigns/{id}/tontine/draw',
                                      {
                                        params: { path: { groupId, id: campaignId } },
                                      },
                                    )
                                    .then(unwrap),
                                'Tirage au sort effectué.',
                              )
                            }
                          >
                            <Shuffle size={16} />
                            Tirage au sort
                          </button>
                        )}
                      </div>
                      <div className="table-scroll">
                        <table className="tontine-rounds-table">
                          <thead>
                            <tr>
                              <th>Mois / Tour</th>
                              <th>Montant à verser</th>
                              <th>Montant Total Versé</th>
                              <th>Membre qui prend</th>
                              <th style={{ textAlign: 'right' }}>Détails</th>
                            </tr>
                          </thead>
                          <tbody>
                            {!tontineRounds.length ? (
                              <tr>
                                <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                                  <Clock size={28} style={{ display: 'block', margin: '0 auto 8px', color: '#94a3b8' }} />
                                  Aucun tour de tontine généré pour le moment.
                                </td>
                              </tr>
                            ) : (
                              tontineRounds.map((tr) => {
                                const isExpanded = expandedTontineRound === tr.round_number;
                                const roundContribs = tr.contributions || [];
                                return (
                                  <>
                                    <tr key={tr.id}>
                                      <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                          <Calendar size={15} color="#64748b" />
                                          <div>
                                            <strong>Tour n°{tr.round_number}</strong>
                                            <div className="muted" style={{ fontSize: 11 }}>
                                              {date(tr.expected_date)}
                                            </div>
                                          </div>
                                        </div>
                                      </td>
                                      <td>
                                        <strong style={{ color: '#0f172a', fontSize: 14 }}>
                                          {money(tr.payout_amount)}
                                        </strong>
                                      </td>
                                      <td>
                                        <strong style={{ color: '#166534', fontSize: 14 }}>
                                          {money(tr.total_collected_amount || '0')}
                                        </strong>
                                      </td>
                                      <td>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                          <span style={{ fontWeight: 600 }}>{tr.beneficiary_name}</span>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                            {tr.paid ? (
                                              <span className="badge-pill-success" title="Cagnotte déjà remise">
                                                <Check size={11} />
                                                <span>Cagnotte versée {tr.paid_at ? `(${date(tr.paid_at)})` : ''}</span>
                                              </span>
                                            ) : (
                                              <span className="badge-pill-amber" title="En attente de paiement">
                                                <Clock size={11} />
                                                <span>En attente</span>
                                              </span>
                                            )}
                                            {canManage && !tr.paid && (
                                              <button
                                                type="button"
                                                className="primary mini"
                                                style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4 }}
                                                disabled={busy}
                                                onClick={() =>
                                                  action(
                                                    () =>
                                                      api
                                                        .PATCH(
                                                          '/api/v1/groupements/{groupId}/campaigns/{id}/tontine/rounds/{roundNumber}/pay',
                                                          {
                                                            params: {
                                                              path: {
                                                                groupId,
                                                                id: campaignId,
                                                                roundNumber: tr.round_number,
                                                              },
                                                            },
                                                          },
                                                        )
                                                        .then(unwrap),
                                                    `Cagnotte du tour ${tr.round_number} marquée comme versée.`,
                                                  )
                                                }
                                              >
                                                <Check size={12} /> Verser
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      </td>
                                      <td style={{ textAlign: 'right' }}>
                                        <button
                                          type="button"
                                          className="session-expand-btn"
                                          onClick={() =>
                                            setExpandedTontineRound(isExpanded ? null : tr.round_number)
                                          }
                                        >
                                          <span>{isExpanded ? 'Masquer' : 'Détails'}</span>
                                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                        </button>
                                      </td>
                                    </tr>
                                    {isExpanded && (
                                      <tr key={`${tr.id}-details`} className="session-details-row">
                                        <td
                                          colSpan={5}
                                          style={{ background: '#f8fafc', padding: '14px 18px', borderTop: 'none' }}
                                        >
                                          <div
                                            style={{
                                              fontSize: 12,
                                              fontWeight: 700,
                                              marginBottom: 8,
                                              color: '#334155',
                                            }}
                                          >
                                            Cotisations enregistrées pour cette période ({roundContribs.length}) :
                                          </div>
                                          {!roundContribs.length ? (
                                            <p className="muted" style={{ margin: 0, fontStyle: 'italic', fontSize: 13 }}>
                                              Aucune cotisation enregistrée pour cette période.
                                            </p>
                                          ) : (
                                            <div className="session-contributions-grid">
                                              {roundContribs.map((c) => (
                                                <div key={c.contribution_id} className="session-contrib-card">
                                                  <span className="session-contrib-name">{c.member_name}</span>
                                                  <span className="session-contrib-amount">{money(c.amount)}</span>
                                                  <span className="session-contrib-ref">
                                                    {c.paid_on ? date(c.paid_on) + ' · ' : ''}Réf : {c.reference}
                                                  </span>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </td>
                                      </tr>
                                    )}
                                  </>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  )}

                  {/* Cahier de séance pour l'administratrice */}
                  {canManage && sessions.length > 0 && (
                    <section className="panel" style={{ marginTop: 20 }}>
                      <div className="section-heading">
                        <div>
                          <h2>Cahier de séance</h2>
                          <p className="muted">
                            Total encaissé et détail des cotisations par séance
                          </p>
                        </div>
                      </div>
                      <div className="session-ledger">
                        {sessions.map((s) => (
                          <div key={s.session_date} className="session-card">
                            <div className="session-header">
                              <span className="session-date">Séance du {date(s.session_date)}</span>
                              <span className="session-total">
                                Total séance : {money(s.total_amount)} ({s.count} versement
                                {s.count > 1 ? 's' : ''})
                              </span>
                            </div>
                            <div className="session-breakdown">
                              {s.contributions.map((cb) => (
                                <div key={cb.contribution_id} className="session-member-entry">
                                  <span>{cb.member_name}</span>
                                  <strong>{money(cb.amount)}</strong>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Historique des cotisations */}
                  <section className="panel" style={{ marginTop: 20 }}>
                    <div className="section-heading">
                      <div>
                        <h2>
                          {dashboard?.personal ? 'Mes versements' : 'Historique des cotisations'}
                        </h2>
                        <p className="muted">{campaign?.name || 'Aucune campagne sélectionnée'}</p>
                      </div>
                      {canManage && campaign?.active && (
                        <button
                          className="secondary"
                          disabled={!online || busy}
                          onClick={() => open('contribution')}
                        >
                          <Plus size={17} />
                          Encaisser
                        </button>
                      )}
                    </div>

                    {/* Filtres de style Mobile Money pour la vue membre */}
                    {dashboard?.personal && (
                      <div className="mm-filters">
                        {['ALL', 'AVEC', 'RAMADAN', 'TABASKI', 'SOLIDARITE', 'RENTREE'].map((f) => (
                          <button
                            key={f}
                            type="button"
                            className={
                              historyFilter === f ? 'mm-filter-btn active' : 'mm-filter-btn'
                            }
                            onClick={() => setHistoryFilter(f)}
                          >
                            {f === 'ALL'
                              ? 'Toutes les cotisations'
                              : f === 'AVEC'
                                ? 'Calabasse AVEC'
                                : f === 'RAMADAN'
                                  ? 'Épargne Ramadan'
                                  : f === 'TABASKI'
                                    ? 'Épargne Tabaski'
                                    : f === 'SOLIDARITE'
                                      ? 'Solidarité'
                                      : 'Rentrée scolaire'}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Filtres de sélection Autocomplete pour l'Historique des cotisations */}
                    {!dashboard?.personal && (
                      <div className="contributions-filters-card">
                        <div className="contributions-filters-header">
                          <div className="contributions-filters-title">
                            <Filter size={16} />
                            <span>Filtres de recherche</span>
                          </div>
                          <span className="contributions-filters-subtitle">
                            Filtrer facilement par session/période ou par nom de membre
                          </span>
                        </div>

                        <div className="contributions-filters-grid">
                          {/* 1. Filtre Session (Épargne) ou Période (Tontine) */}
                          {!isTontineCampaign ? (
                            <div className="filter-autocomplete-wrapper" ref={sessionFilterRef}>
                              <label htmlFor="session-filter-input">
                                <Calendar size={13} />
                                Filtrer par session passée
                              </label>
                              <div className="filter-autocomplete-box">
                                <CalendarCheck size={16} className="muted" />
                                <input
                                  id="session-filter-input"
                                  type="text"
                                  placeholder="Rechercher une séance passée…"
                                  value={
                                    sessionFilterSearch ||
                                    (selectedSessionFilter ? `Séance du ${date(selectedSessionFilter)}` : '')
                                  }
                                  onChange={(e) => {
                                    setSessionFilterSearch(e.target.value);
                                    setSessionFilterDropdownOpen(true);
                                  }}
                                  onFocus={() => setSessionFilterDropdownOpen(true)}
                                />
                                {(sessionFilterSearch || selectedSessionFilter) && (
                                  <button
                                    type="button"
                                    className="filter-clear-btn"
                                    title="Effacer ce filtre"
                                    onClick={() => {
                                      setSelectedSessionFilter(null);
                                      setSessionFilterSearch('');
                                    }}
                                  >
                                    <X size={14} />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="filter-chevron-btn"
                                  title="Ouvrir la liste des séances"
                                  onClick={() => setSessionFilterDropdownOpen(!sessionFilterDropdownOpen)}
                                >
                                  {sessionFilterDropdownOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                                </button>
                              </div>

                              {sessionFilterDropdownOpen && (
                                <div className="filter-autocomplete-dropdown">
                                  <div
                                    className={`filter-dropdown-item all-item ${!selectedSessionFilter ? 'selected' : ''}`}
                                    onClick={() => {
                                      setSelectedSessionFilter(null);
                                      setSessionFilterSearch('');
                                      setSessionFilterDropdownOpen(false);
                                    }}
                                  >
                                    <div className="filter-dropdown-icon">
                                      <Calendar size={15} />
                                    </div>
                                    <div className="filter-dropdown-content">
                                      <strong>Toutes les sessions passées</strong>
                                      <span className="muted">Afficher toutes les séances</span>
                                    </div>
                                    {!selectedSessionFilter && <Check size={15} className="item-check" />}
                                  </div>

                                  {availableSessions
                                    .filter((s) => {
                                      const isFiltering =
                                        sessionFilterSearch.trim() &&
                                        (!selectedSessionFilter ||
                                          sessionFilterSearch.trim().toLowerCase() !==
                                            `séance du ${date(selectedSessionFilter)}`.toLowerCase());
                                      if (!isFiltering) return true;
                                      const q = sessionFilterSearch.toLowerCase();
                                      return s.date.includes(q) || date(s.date).toLowerCase().includes(q);
                                    })
                                    .map((s) => (
                                      <div
                                        key={s.date}
                                        className={`filter-dropdown-item ${selectedSessionFilter === s.date ? 'selected' : ''}`}
                                        onClick={() => {
                                          setSelectedSessionFilter(s.date);
                                          setSessionFilterSearch(`Séance du ${date(s.date)}`);
                                          setSessionFilterDropdownOpen(false);
                                        }}
                                      >
                                        <div className="filter-dropdown-icon">
                                          <CalendarCheck size={15} />
                                        </div>
                                        <div className="filter-dropdown-content">
                                          <strong>Séance du {date(s.date)}</strong>
                                          <span className="muted">
                                            {s.count} versement{s.count > 1 ? 's' : ''} · Total : {money(s.total)}
                                          </span>
                                        </div>
                                        {selectedSessionFilter === s.date && <Check size={15} className="item-check" />}
                                      </div>
                                    ))}

                                  {!availableSessions.some((s) => {
                                    const isFiltering =
                                      sessionFilterSearch.trim() &&
                                      (!selectedSessionFilter ||
                                        sessionFilterSearch.trim().toLowerCase() !==
                                          `séance du ${date(selectedSessionFilter)}`.toLowerCase());
                                    if (!isFiltering) return true;
                                    const q = sessionFilterSearch.toLowerCase();
                                    return s.date.includes(q) || date(s.date).toLowerCase().includes(q);
                                  }) && (
                                    <div className="filter-dropdown-empty">
                                      Aucune session passée trouvée.
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="filter-autocomplete-wrapper" ref={periodFilterRef}>
                              <label htmlFor="period-filter-input">
                                <Clock size={13} />
                                Filtrer par période passée
                              </label>
                              <div className="filter-autocomplete-box">
                                <Clock size={16} className="muted" />
                                <input
                                  id="period-filter-input"
                                  type="text"
                                  placeholder="Rechercher une période passée…"
                                  value={
                                    periodFilterSearch ||
                                    (selectedPeriodFilter !== null ? `Tour ${selectedPeriodFilter}` : '')
                                  }
                                  onChange={(e) => {
                                    setPeriodFilterSearch(e.target.value);
                                    setPeriodFilterDropdownOpen(true);
                                  }}
                                  onFocus={() => setPeriodFilterDropdownOpen(true)}
                                />
                                {(periodFilterSearch || selectedPeriodFilter !== null) && (
                                  <button
                                    type="button"
                                    className="filter-clear-btn"
                                    title="Effacer ce filtre"
                                    onClick={() => {
                                      setSelectedPeriodFilter(null);
                                      setPeriodFilterSearch('');
                                    }}
                                  >
                                    <X size={14} />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="filter-chevron-btn"
                                  title="Ouvrir la liste des périodes"
                                  onClick={() => setPeriodFilterDropdownOpen(!periodFilterDropdownOpen)}
                                >
                                  {periodFilterDropdownOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                                </button>
                              </div>

                              {periodFilterDropdownOpen && (
                                <div className="filter-autocomplete-dropdown">
                                  <div
                                    className={`filter-dropdown-item all-item ${selectedPeriodFilter === null ? 'selected' : ''}`}
                                    onClick={() => {
                                      setSelectedPeriodFilter(null);
                                      setPeriodFilterSearch('');
                                      setPeriodFilterDropdownOpen(false);
                                    }}
                                  >
                                    <div className="filter-dropdown-icon">
                                      <Clock size={15} />
                                    </div>
                                    <div className="filter-dropdown-content">
                                      <strong>Toutes les périodes passées</strong>
                                      <span className="muted">Afficher tous les tours de tontine</span>
                                    </div>
                                    {selectedPeriodFilter === null && <Check size={15} className="item-check" />}
                                  </div>

                                  {availablePeriods
                                    .filter((p) => {
                                      const isFiltering =
                                        periodFilterSearch.trim() &&
                                        (selectedPeriodFilter === null ||
                                          !periodFilterSearch
                                            .trim()
                                            .toLowerCase()
                                            .startsWith(`tour ${selectedPeriodFilter}`.toLowerCase()));
                                      if (!isFiltering) return true;
                                      const q = periodFilterSearch.toLowerCase();
                                      return (
                                        `tour ${p.roundNumber}`.includes(q) ||
                                        p.beneficiaryName.toLowerCase().includes(q) ||
                                        (p.expectedDate && date(p.expectedDate).toLowerCase().includes(q))
                                      );
                                    })
                                    .map((p) => (
                                      <div
                                        key={p.roundNumber}
                                        className={`filter-dropdown-item ${selectedPeriodFilter === p.roundNumber ? 'selected' : ''}`}
                                        onClick={() => {
                                          setSelectedPeriodFilter(p.roundNumber);
                                          setPeriodFilterSearch(
                                            `Tour ${p.roundNumber}${p.expectedDate ? ' · ' + date(p.expectedDate) : ''}`,
                                          );
                                          setPeriodFilterDropdownOpen(false);
                                        }}
                                      >
                                        <div className="filter-dropdown-icon">
                                          <Clock size={15} />
                                        </div>
                                        <div className="filter-dropdown-content">
                                          <strong>
                                            Tour {p.roundNumber}
                                            {p.expectedDate ? ` · ${date(p.expectedDate)}` : ''}
                                          </strong>
                                          <span className="muted">
                                            Bénéficiaire : {p.beneficiaryName} · Collecté : {money(p.totalCollected)}
                                          </span>
                                        </div>
                                        {selectedPeriodFilter === p.roundNumber && (
                                          <Check size={15} className="item-check" />
                                        )}
                                      </div>
                                    ))}

                                  {!availablePeriods.some((p) => {
                                    const isFiltering =
                                      periodFilterSearch.trim() &&
                                      (selectedPeriodFilter === null ||
                                        !periodFilterSearch
                                          .trim()
                                          .toLowerCase()
                                          .startsWith(`tour ${selectedPeriodFilter}`.toLowerCase()));
                                    if (!isFiltering) return true;
                                    const q = periodFilterSearch.toLowerCase();
                                    return (
                                      `tour ${p.roundNumber}`.includes(q) ||
                                      p.beneficiaryName.toLowerCase().includes(q) ||
                                      (p.expectedDate && date(p.expectedDate).toLowerCase().includes(q))
                                    );
                                  }) && (
                                    <div className="filter-dropdown-empty">
                                      Aucune période passée trouvée.
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* 2. Filtre Membre (Épargne & Tontine) */}
                          <div className="filter-autocomplete-wrapper" ref={memberFilterRef}>
                            <label htmlFor="member-filter-input">
                              <Users size={13} />
                              Filtrer par membre
                            </label>
                            <div className="filter-autocomplete-box">
                              <Users size={16} className="muted" />
                              <input
                                id="member-filter-input"
                                type="text"
                                placeholder="Rechercher ou choisir un membre…"
                                value={
                                  memberFilterSearch ||
                                  (selectedMemberFilter ? selectedMemberFilter : '')
                                }
                                onChange={(e) => {
                                  setMemberFilterSearch(e.target.value);
                                  setMemberFilterDropdownOpen(true);
                                }}
                                onFocus={() => setMemberFilterDropdownOpen(true)}
                              />
                              {(memberFilterSearch || selectedMemberFilter) && (
                                <button
                                  type="button"
                                  className="filter-clear-btn"
                                  title="Effacer ce filtre"
                                  onClick={() => {
                                    setSelectedMemberFilter(null);
                                    setMemberFilterSearch('');
                                  }}
                                >
                                  <X size={14} />
                                </button>
                              )}
                              <button
                                type="button"
                                className="filter-chevron-btn"
                                title="Ouvrir la liste des membres"
                                onClick={() => setMemberFilterDropdownOpen(!memberFilterDropdownOpen)}
                              >
                                {memberFilterDropdownOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                              </button>
                            </div>

                            {memberFilterDropdownOpen && (
                              <div className="filter-autocomplete-dropdown">
                                <div
                                  className={`filter-dropdown-item all-item ${!selectedMemberFilter ? 'selected' : ''}`}
                                  onClick={() => {
                                    setSelectedMemberFilter(null);
                                    setMemberFilterSearch('');
                                    setMemberFilterDropdownOpen(false);
                                  }}
                                >
                                  <div className="filter-dropdown-icon">
                                    <Users size={15} />
                                  </div>
                                  <div className="filter-dropdown-content">
                                    <strong>Tous les membres</strong>
                                    <span className="muted">Afficher toutes les participantes</span>
                                  </div>
                                  {!selectedMemberFilter && <Check size={15} className="item-check" />}
                                </div>

                                {availableMembers
                                  .filter((m) => {
                                    const isFiltering =
                                      memberFilterSearch.trim() &&
                                      (!selectedMemberFilter ||
                                        memberFilterSearch.trim().toLowerCase() !==
                                          selectedMemberFilter.toLowerCase());
                                    if (!isFiltering) return true;
                                    const q = memberFilterSearch.toLowerCase();
                                    return (
                                      m.name.toLowerCase().includes(q) ||
                                      (m.phone && m.phone.includes(q))
                                    );
                                  })
                                  .map((m) => (
                                    <div
                                      key={m.name}
                                      className={`filter-dropdown-item ${selectedMemberFilter === m.name ? 'selected' : ''}`}
                                      onClick={() => {
                                        setSelectedMemberFilter(m.name);
                                        setMemberFilterSearch(m.name);
                                        setMemberFilterDropdownOpen(false);
                                      }}
                                    >
                                      <div className="filter-dropdown-avatar">
                                        {m.name.slice(0, 1).toUpperCase()}
                                      </div>
                                      <div className="filter-dropdown-content">
                                        <strong>{m.name}</strong>
                                        <span className="muted">
                                          {m.phone ? `${m.phone} · ` : ''}Membre de la cotisation
                                        </span>
                                      </div>
                                      {selectedMemberFilter === m.name && (
                                        <Check size={15} className="item-check" />
                                      )}
                                    </div>
                                  ))}

                                {!availableMembers.some((m) => {
                                  if (!memberFilterSearch.trim()) return true;
                                  const q = memberFilterSearch.toLowerCase();
                                  return (
                                    m.name.toLowerCase().includes(q) ||
                                    (m.phone && m.phone.includes(q))
                                  );
                                }) && (
                                  <div className="filter-dropdown-empty">
                                    Aucun membre trouvé.
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Bannière récapitulative des filtres actifs */}
                        {(selectedSessionFilter || selectedPeriodFilter !== null || selectedMemberFilter) && (
                          <div className="active-filters-banner">
                            <span className="active-filters-title">
                              <Filter size={13} /> Filtre{selectedMemberFilter && (selectedSessionFilter || selectedPeriodFilter !== null) ? 's appliqués :' : ' appliqué :'}
                            </span>
                            {selectedSessionFilter && (
                              <span className="active-filter-badge">
                                <CalendarCheck size={12} />
                                <span>Session : {date(selectedSessionFilter)}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedSessionFilter(null);
                                    setSessionFilterSearch('');
                                  }}
                                  title="Retirer le filtre de session"
                                >
                                  <X size={12} />
                                </button>
                              </span>
                            )}
                            {selectedPeriodFilter !== null && (
                              <span className="active-filter-badge">
                                <Clock size={12} />
                                <span>Tour {selectedPeriodFilter}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedPeriodFilter(null);
                                    setPeriodFilterSearch('');
                                  }}
                                  title="Retirer le filtre de période"
                                >
                                  <X size={12} />
                                </button>
                              </span>
                            )}
                            {selectedMemberFilter && (
                              <span className="active-filter-badge">
                                <Users size={12} />
                                <span>Membre : {selectedMemberFilter}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedMemberFilter(null);
                                    setMemberFilterSearch('');
                                  }}
                                  title="Retirer le filtre de membre"
                                >
                                  <X size={12} />
                                </button>
                              </span>
                            )}
                            <button
                              type="button"
                              className="btn-clear-all-filters"
                              onClick={resetFilters}
                            >
                              <RotateCcw size={12} /> Tout effacer
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Barre de tri de l'Historique */}
                    <div className="contributions-sort-bar">
                      <span className="contributions-sort-label">
                        <ArrowUpDown size={14} /> Trier par :
                      </span>
                      <button
                        type="button"
                        className={`sort-pill-btn ${contributionSort === 'date' ? 'active' : ''}`}
                        onClick={() => {
                          setContributionSort('date');
                          setPage(1);
                        }}
                      >
                        <Calendar size={13} />
                        Date (décroissant)
                      </button>
                      <button
                        type="button"
                        className={`sort-pill-btn ${contributionSort === 'session' ? 'active' : ''}`}
                        onClick={() => {
                          setContributionSort('session');
                          setPage(1);
                        }}
                      >
                        <CalendarCheck size={13} />
                        {campaign?.type_name?.toLowerCase().includes('tontine')
                          ? 'Par période (Tontine)'
                          : 'Par session (Épargne)'}
                      </button>
                      <button
                        type="button"
                        className={`sort-pill-btn ${contributionSort === 'member' ? 'active' : ''}`}
                        onClick={() => {
                          setContributionSort('member');
                          setPage(1);
                        }}
                      >
                        <Users size={13} />
                        Par membre
                      </button>
                      <span className="contributions-count-badge">
                        {sortedContributions.length} cotisation{sortedContributions.length > 1 ? 's' : ''}
                      </span>
                    </div>

                    {contributions.length ? (
                      dashboard?.personal ? (
                        <div className="mm-list">
                          {contributions.map((c) => (
                            <div key={c.id} className="mm-item">
                              <div className="mm-left">
                                <div className="mm-icon">
                                  <Leaf size={20} />
                                </div>
                                <div className="mm-details">
                                  <span className="mm-title">
                                    {campaign?.name || 'Cotisation solidaire'}
                                  </span>
                                  <span className="mm-meta">
                                    {date(c.paid_on)} · Réf : {c.reference}
                                  </span>
                                  {campaign?.event_name && (
                                    <span className="mm-badge">{campaign.event_name}</span>
                                  )}
                                </div>
                              </div>
                              <div>
                                <div className="mm-amount">+ {money(c.amount)}</div>
                                <span className={c.voided_at ? 'badge neutral' : 'badge'}>
                                  {c.voided_at ? 'Annulée' : 'Validée'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : sortedContributions.length ? (
                        <div className="table-scroll">
                          <table className="contribution-table">
                            <thead>
                              <tr>
                                <th
                                  className="th-sortable"
                                  onClick={() => {
                                    setContributionSort('member');
                                    setPage(1);
                                  }}
                                  title="Trier par membre"
                                >
                                  Membre {contributionSort === 'member' && '▲'}
                                </th>
                                <th
                                  className="th-sortable"
                                  onClick={() => {
                                    setContributionSort(contributionSort === 'date' ? 'session' : 'date');
                                    setPage(1);
                                  }}
                                  title={
                                    campaign?.type_name?.toLowerCase().includes('tontine')
                                      ? 'Trier par date / période'
                                      : 'Trier par date / session'
                                  }
                                >
                                  {campaign?.type_name?.toLowerCase().includes('tontine')
                                    ? 'Date / Période'
                                    : 'Date / Session'}
                                  {contributionSort === 'date' && ' ▼'}
                                  {contributionSort === 'session' && ' 🗓️'}
                                </th>
                                <th>Montant</th>
                                <th>État</th>
                                {canManage && <th>Action</th>}
                              </tr>
                            </thead>
                            <tbody>
                              {sortedContributions.map((c) => (
                                <tr key={c.id}>
                                  <td>
                                    <span className="member-cell">
                                      <span className="round-avatar small">
                                        {c.name.slice(0, 1)}
                                      </span>
                                      {c.name}
                                    </span>
                                    <small className="reference">{c.reference}</small>
                                  </td>
                                  <td>{date(c.paid_on)}</td>
                                  <td className="amount">{money(c.amount)}</td>
                                  <td>
                                    <span className={c.voided_at ? 'badge neutral' : 'badge'}>
                                      {c.voided_at ? 'Annulée' : 'Enregistrée'}
                                    </span>
                                  </td>
                                  {canManage && (
                                    <td>
                                      {!c.voided_at && campaign?.active && (
                                        <button
                                          className="text-button"
                                          onClick={() => {
                                            setVoidId(c.id);
                                            open('void');
                                          }}
                                        >
                                          Annuler
                                        </button>
                                      )}
                                    </td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="contributions-empty-filter">
                          <Filter size={32} className="muted" />
                          <h3>Aucune cotisation ne correspond à vos filtres</h3>
                          <p>Essayez de modifier la séance, la période ou le membre sélectionné.</p>
                          <button
                            type="button"
                            className="btn-clear-all-filters"
                            style={{ margin: '8px auto', display: 'inline-flex' }}
                            onClick={resetFilters}
                          >
                            <RotateCcw size={13} /> Effacer les filtres et tout afficher
                          </button>
                        </div>
                      )
                    ) : (
                      <div className="empty">
                        <Coins size={29} />
                        <h3>Aucune cotisation pour le moment</h3>
                        <p>Les versements enregistrés apparaîtront ici.</p>
                      </div>
                    )}
                    <Pager page={page} total={contributionTotal} onChange={setPage} />
                  </section>
                </>
                )
              )}

              {/* Cockpit 360° Plateforme Super Admin */}
              {tab === 'cockpit' && superCockpit && (
                <>
                  <div className="cockpit-grid">
                    <div className="cockpit-card">
                      <span className="cockpit-number">{superCockpit.total_groups}</span>
                      <span className="cockpit-title">Groupements actifs</span>
                    </div>
                    <div className="cockpit-card">
                      <span className="cockpit-number">{superCockpit.total_members}</span>
                      <span className="cockpit-title">Membres inscrites</span>
                    </div>
                    <div className="cockpit-card">
                      <span className="cockpit-number">{superCockpit.total_campaigns}</span>
                      <span className="cockpit-title">Campagnes créées</span>
                    </div>
                    <div className="cockpit-card">
                      <span className="cockpit-number">{money(superCockpit.total_collected)}</span>
                      <span className="cockpit-title">Total épargne consolidée</span>
                    </div>
                  </div>

                  <section className="panel">
                    <div className="section-heading">
                      <div>
                        <h2>État consolidé des caisses</h2>
                        <p className="muted">Vue financière consolidée de toutes les campagnes</p>
                      </div>
                    </div>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Campagne</th>
                            <th>Total collecté</th>
                            <th>Total versé / sorties</th>
                            <th>Solde en caisse</th>
                          </tr>
                        </thead>
                        <tbody>
                          {superCockpit.cashboxes.map((b: CashboxState) => (
                            <tr key={b.campaign_id}>
                              <td>
                                <strong>{b.campaign_name}</strong>
                              </td>
                              <td>{money(b.total_collected)}</td>
                              <td>{money(b.total_paid_out)}</td>
                              <td>
                                <strong style={{ color: 'var(--green)' }}>
                                  {money(b.balance)}
                                </strong>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </>
              )}

              {tab === 'campaigns' && (
                <>
                  <section className="panel">
                    <div className="section-heading">
                      <div>
                        <h2>Campagnes actives du groupement</h2>
                        <p className="muted">Une période, un rythme et des projets partagés.</p>
                      </div>
                      {(superAdmin || canManage) && Boolean(groupId) && (
                        <button className="primary" onClick={() => open('campaign')}>
                          <Plus size={17} />
                          Créer une campagne
                        </button>
                      )}
                    </div>
                    {!activeCampaigns.length && (
                      <div className="empty" style={{ margin: '24px 0' }}>
                        <FolderHeart size={36} />
                        <p>Aucune campagne active enregistrée pour ce groupement.</p>
                        {(superAdmin || canManage) && Boolean(groupId) && (
                          <button
                            className="primary"
                            onClick={() => open('campaign')}
                            style={{ marginTop: 12 }}
                          >
                            <Plus size={16} />
                            Créer une campagne
                          </button>
                        )}
                      </div>
                    )}
                    {activeCampaigns.length > 0 && (
                      <div className="table-scroll">
                        <table className="campaigns-table">
                          <thead>
                            <tr>
                              <th>Campagne</th>
                              <th>Membres</th>
                              <th>Suivi & Métriques</th>
                              <th>Période & Fréquence</th>
                              <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeCampaigns.map((c) => (
                              <tr
                                key={c.id}
                                className={
                                  campaignId === c.id
                                    ? 'campaign-row selected-row'
                                    : 'campaign-row'
                                }
                              >
                                <td>
                                  <div className="campaign-cell-main">
                                    <div className="campaign-name-line">
                                      <strong>{c.name}</strong>
                                    </div>
                                    <div className="campaign-tags">
                                      <span
                                        className={
                                          c.type_code === 'TONTINE' ||
                                          c.type_name?.toLowerCase().includes('tontine')
                                            ? 'badge-tontine'
                                            : 'badge-epargne'
                                        }
                                      >
                                        {c.type_name}
                                      </span>
                                      {c.event_name && (
                                        <span className="badge-event">{c.event_name}</span>
                                      )}
                                      <span
                                        className="metric-label"
                                        style={{ fontSize: 11, alignSelf: 'center' }}
                                      >
                                        {c.standard_amount
                                          ? `Standard : ${money(c.standard_amount)}`
                                          : 'Libre'}
                                      </span>
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <div className="members-cell">
                                    <div className="member-count-box">
                                      <Users size={14} />
                                      <span>
                                        {c.member_count ?? 0} membre
                                        {(c.member_count ?? 0) > 1 ? 's' : ''}
                                      </span>
                                    </div>
                                    {(canManage || superAdmin) && (
                                      <button
                                        type="button"
                                        className="btn-add-member-mini"
                                        title="Ajouter un membre à la campagne"
                                        onClick={() => {
                                          setCampaignId(c.id);
                                          open('participant');
                                        }}
                                      >
                                        <UserPlus size={12} />
                                        <span>Ajouter un membre</span>
                                      </button>
                                    )}
                                  </div>
                                </td>
                                <td>
                                  <div className="campaign-metrics">
                                    {c.type_code === 'TONTINE' ||
                                    c.type_name?.toLowerCase().includes('tontine') ? (
                                      <>
                                        <span
                                          className="metric-pill highlight"
                                          title="Nombre de retraits déjà payés"
                                        >
                                          <Check size={12} />
                                          <span>
                                            <strong>{c.payouts_count ?? 0}</strong> retrait
                                            {(c.payouts_count ?? 0) > 1 ? 's' : ''} payé
                                            {(c.payouts_count ?? 0) > 1 ? 's' : ''}
                                          </span>
                                        </span>
                                        <span
                                          className="metric-pill amber"
                                          title="Nombre de personnes restantes"
                                        >
                                          <Users size={12} />
                                          <span>
                                            <strong>{c.remaining_count ?? 0}</strong> restante
                                            {(c.remaining_count ?? 0) > 1 ? 's' : ''}
                                          </span>
                                        </span>
                                        <span
                                          className="metric-pill"
                                          title="Délai de cotisation / Échéance"
                                        >
                                          <Calendar size={12} />
                                          <span className="metric-label">Délai :</span>
                                          <strong>
                                            {c.next_due_date
                                              ? date(c.next_due_date)
                                              : c.due_day
                                                ? `Le ${c.due_day} du mois`
                                                : 'Selon calendrier'}
                                          </strong>
                                        </span>
                                      </>
                                    ) : (
                                      <>
                                        <span
                                          className="metric-pill highlight"
                                          title="Nombre de séances effectuées"
                                        >
                                          <CalendarCheck size={12} />
                                          <span>
                                            <strong>{c.session_count ?? 0}</strong> séance
                                            {(c.session_count ?? 0) > 1 ? 's' : ''}
                                          </span>
                                        </span>
                                        <span className="metric-pill" title="Montant total collecté">
                                          <Coins size={12} />
                                          <span className="metric-label">Collecté :</span>
                                          <strong>{money(c.collected_amount ?? '0')}</strong>
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </td>
                                <td>
                                  <div className="campaign-period-info">
                                    <span className="date-range">
                                      {date(c.start_date)} → {date(c.end_date)}
                                    </span>
                                    <span className="muted">
                                      {days[c.weekday]} · toutes les {c.interval_weeks} sem.
                                    </span>
                                    {c.due_day && (
                                      <span className="muted">Échéance le {c.due_day}</span>
                                    )}
                                  </div>
                                </td>
                                <td>
                                  <div className="row-actions">
                                    <button
                                      type="button"
                                      className={
                                        campaignId === c.id ? 'primary-btn-sm' : 'secondary-btn-sm'
                                      }
                                      onClick={() => {
                                        setCampaignId(c.id);
                                        setPage(1);
                                        setParticipantPage(1);
                                      }}
                                    >
                                      {campaignId === c.id ? 'Sélectionnée' : 'Sélectionner'}
                                    </button>
                                    {canManage && (
                                      <button
                                        type="button"
                                        className="secondary-btn-sm"
                                        onClick={() => {
                                          setCampaignId(c.id);
                                          open('grace');
                                        }}
                                      >
                                        Délai de grâce
                                      </button>
                                    )}
                                    {(superAdmin || canManage) && (
                                      <button
                                        type="button"
                                        className="danger-text-btn"
                                        disabled={busy}
                                        title="Désactiver et archiver cette campagne"
                                        onClick={() =>
                                          action(
                                            () =>
                                              api
                                                .PATCH(
                                                  '/api/v1/groupements/{groupId}/campaigns/{id}/activation',
                                                  {
                                                    params: { path: { groupId, id: c.id } },
                                                    body: { active: false },
                                                  },
                                                )
                                                .then(unwrap),
                                            'Campagne désactivée et archivée.',
                                          )
                                        }
                                      >
                                        Désactiver
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <Pager page={campaignPage} total={campaignTotal} onChange={setCampaignPage} />
                  </section>
                  {campaign && (
                    <section className="panel" style={{ marginTop: 20 }}>
                      <div className="campaign-subtabs-nav">
                        <button
                          type="button"
                          className={
                            campaignDetailTab === 'participants'
                              ? 'campaign-subtab-btn selected'
                              : 'campaign-subtab-btn'
                          }
                          onClick={() => setCampaignDetailTab('participants')}
                        >
                          <Users size={15} />
                          <span>1. Participantes et forfaits</span>
                        </button>
                        <button
                          type="button"
                          className={
                            campaignDetailTab === 'sessions'
                              ? 'campaign-subtab-btn selected'
                              : 'campaign-subtab-btn'
                          }
                          onClick={() => setCampaignDetailTab('sessions')}
                        >
                          <CalendarCheck size={15} />
                          <span>2. Sessions</span>
                        </button>
                      </div>

                      {campaignDetailTab === 'participants' && (
                        <>
                          <div className="section-heading">
                            <div>
                              <h2>
                                {canManage || superAdmin
                                  ? 'Participantes et forfaits'
                                  : 'Ma participation'}
                              </h2>
                              <p className="muted">
                                {campaign.name} · {campaign.type_name}
                              </p>
                            </div>
                            {canManage && campaign.active && (
                              <button className="secondary" onClick={() => open('participant')}>
                                <Plus size={17} />
                                Configurer une participation
                              </button>
                            )}
                          </div>

                          <div className="table-scroll">
                            {campaign.type_code === 'TONTINE' ||
                            campaign.type_name?.toLowerCase().includes('tontine') ? (
                              <table>
                                <thead>
                                  <tr>
                                    <th>Membres</th>
                                    <th>Nbre de Mois cotisé</th>
                                    <th>Récupéré</th>
                                    <th>Période de Récupération</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {!participants.length ? (
                                    <tr>
                                      <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                                        <Users size={28} style={{ display: 'block', margin: '0 auto 8px', color: '#94a3b8' }} />
                                        Aucune participation enregistrée pour cette campagne.
                                      </td>
                                    </tr>
                                  ) : (
                                    participants.map((p) => (
                                      <tr key={p.id}>
                                        <td>
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                            <strong>{p.name}</strong>
                                            <small className="muted">
                                              {p.forfait ? `Forfait : ${money(p.forfait)}` : 'Montant libre'}
                                            </small>
                                          </div>
                                        </td>
                                        <td>
                                          <span className="metric-pill highlight">
                                            <CalendarCheck size={12} />
                                            <strong>{p.months_contributed_count ?? 0}</strong> mois
                                          </span>
                                        </td>
                                        <td>
                                          {p.has_received_payout ? (
                                            <span className="badge-pill-success" title="Paiement du tour déjà perçu">
                                              <Check size={12} />
                                              <span>Oui {p.payout_amount ? `(${money(p.payout_amount)})` : ''}</span>
                                            </span>
                                          ) : (
                                            <span className="badge-pill-amber" title="En attente de son tour de tontine">
                                              <Clock size={12} />
                                              <span>En attente</span>
                                            </span>
                                          )}
                                        </td>
                                        <td>
                                          <span className="metric-pill" style={{ fontWeight: 600 }}>
                                            <Calendar size={12} />
                                            {p.recovery_period
                                              ? date(p.recovery_period)
                                              : p.round_number
                                                ? `Tour n°${p.round_number}`
                                                : 'À planifier'}
                                          </span>
                                        </td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            ) : (
                              <table>
                                <thead>
                                  <tr>
                                    <th>Membres</th>
                                    <th>Nbre Session</th>
                                    <th>Montant Cotisation</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {!participants.length ? (
                                    <tr>
                                      <td colSpan={3} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                                        <Users size={28} style={{ display: 'block', margin: '0 auto 8px', color: '#94a3b8' }} />
                                        Aucune participation enregistrée pour cette campagne.
                                      </td>
                                    </tr>
                                  ) : (
                                    participants.map((p) => (
                                      <tr key={p.id}>
                                        <td>
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                            <strong>{p.name}</strong>
                                            <small className="muted">
                                              {p.forfait ? `Forfait : ${money(p.forfait)}` : 'Montant libre'}
                                            </small>
                                          </div>
                                        </td>
                                        <td>
                                          <span className="metric-pill highlight">
                                            <CalendarCheck size={12} />
                                            <strong>{p.sessions_contributed_count ?? 0}</strong> séance
                                            {(p.sessions_contributed_count ?? 0) > 1 ? 's' : ''}
                                          </span>
                                        </td>
                                        <td>
                                          <span style={{ fontSize: 13, fontWeight: 700, color: '#166534' }}>
                                            {money(p.total_contributed_amount ?? '0')}
                                          </span>
                                        </td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            )}
                          </div>

                          <Pager
                            page={participantPage}
                            total={participantTotal}
                            limit={100}
                            onChange={setParticipantPage}
                          />
                        </>
                      )}

                      {campaignDetailTab === 'sessions' && (
                        <>
                          <div className="section-heading">
                            <div>
                              <h2>Cahier des Sessions de cotisation</h2>
                              <p className="muted">
                                Séances et montants récupérés pour {campaign.name}
                              </p>
                            </div>
                          </div>

                            <div className="table-scroll">
                              <table>
                                <thead>
                                  <tr>
                                    <th>Date</th>
                                    <th>Montant récupéré</th>
                                    <th>Nbre Membre ayant de cotisation</th>
                                    <th style={{ textAlign: 'right' }}>Détails</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {sessions.length === 0 ? (
                                    <tr>
                                      <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                                        <CalendarCheck size={28} style={{ display: 'block', margin: '0 auto 8px', color: '#94a3b8' }} />
                                        Aucune session enregistrée pour cette campagne.
                                      </td>
                                    </tr>
                                  ) : (
                                    sessions.map((s) => {
                                      const isExpanded = expandedSessionDate === s.session_date;
                                    const distinctMembers = s.members_count ?? s.count;
                                    return (
                                      <>
                                        <tr key={s.session_date}>
                                          <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                              <Calendar size={15} color="#64748b" />
                                              <strong>{date(s.session_date)}</strong>
                                            </div>
                                          </td>
                                          <td>
                                            <strong style={{ color: '#166534', fontSize: 14 }}>
                                              {money(s.total_amount)}
                                            </strong>
                                          </td>
                                          <td>
                                            <span className="metric-pill highlight">
                                              <Users size={12} />
                                              <strong>{distinctMembers}</strong> membre
                                              {distinctMembers > 1 ? 's' : ''}
                                            </span>
                                          </td>
                                          <td style={{ textAlign: 'right' }}>
                                            <button
                                              type="button"
                                              className="session-expand-btn"
                                              onClick={() =>
                                                setExpandedSessionDate(isExpanded ? null : s.session_date)
                                              }
                                            >
                                              <span>{isExpanded ? 'Masquer' : 'Détails'}</span>
                                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                            </button>
                                          </td>
                                        </tr>
                                        {isExpanded && (
                                          <tr key={`${s.session_date}-details`} className="session-details-row">
                                            <td
                                              colSpan={4}
                                              style={{ background: '#f8fafc', padding: '14px 18px', borderTop: 'none' }}
                                            >
                                              <div
                                                style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: '#334155' }}
                                              >
                                                Cotisations enregistrées pour la séance du {date(s.session_date)} (
                                                {s.contributions.length}) :
                                              </div>
                                              <div className="session-contributions-grid">
                                                {s.contributions.map((c) => (
                                                  <div key={c.contribution_id} className="session-contrib-card">
                                                    <span className="session-contrib-name">{c.member_name}</span>
                                                    <span className="session-contrib-amount">{money(c.amount)}</span>
                                                    <span className="session-contrib-ref">Réf : {c.reference}</span>
                                                  </div>
                                                ))}
                                              </div>
                                            </td>
                                          </tr>
                                        )}
                                      </>
                                    );
                                  })
                                )}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )}
                    </section>
                  )}
                </>
              )}

              {tab === 'members' && (
                <section className="panel">
                  <div className="section-heading">
                    <div>
                      <h2>
                        {canManage || superAdmin ? 'Les femmes du groupement' : 'Mon adhésion'}
                      </h2>
                      <p className="muted">
                        {canManage || superAdmin
                          ? 'Gérez les membres, fonctions et accès sécurisés.'
                          : 'Vos informations dans ce groupement.'}
                      </p>
                    </div>
                    {(canManage || superAdmin) && (
                      <button className="primary" onClick={() => open('member')}>
                        <Plus size={17} />
                        Ajouter une membre
                      </button>
                    )}
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Nom</th>
                          <th>Téléphone</th>
                          <th>Fonction</th>
                          <th>Adresse</th>
                          <th>État</th>
                          {(canManage || superAdmin) && <th>Actions</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {members.map((m) => (
                          <tr key={m.id}>
                            <td className="member-cell">
                              <span className="round-avatar small">{m.name.slice(0, 1)}</span>
                              <div>
                                <strong>{m.name}</strong>
                                <small style={{ display: 'block', color: 'var(--muted)' }}>
                                  Sexe : {m.gender === 'F' ? 'Femme' : 'Homme'}
                                </small>
                              </div>
                            </td>
                            <td>{m.phone || 'Non renseigné'}</td>
                            <td>
                              <span
                                className={
                                  m.role === 'ADMIN' ? 'badge-function bureau' : 'badge-function'
                                }
                              >
                                {m.function_name ||
                                  (m.role === 'ADMIN' ? 'Administratrice' : 'Membre simple')}
                              </span>
                            </td>
                            <td>{m.address || '—'}</td>
                            <td>
                              {m.is_blocked ? (
                                <span className="badge-blocked">Bloquée</span>
                              ) : (
                                <span className="badge">{m.active ? 'Active' : 'Inactive'}</span>
                              )}
                            </td>
                            {(canManage || superAdmin) && (
                              <td>
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <button
                                    type="button"
                                    className="text-button"
                                    title="Code QR de la membre"
                                    onClick={() =>
                                      setQrModal({
                                        title: `Carte Membre · ${m.name}`,
                                        subtitle: `${group?.name || ''} · ${m.phone || 'Sans téléphone'}`,
                                        data: `ALF:MEMBER:${groupId}:${m.id}:${m.phone || ''}`,
                                      })
                                    }
                                  >
                                    <QrCode size={15} />
                                    QR
                                  </button>
                                  <button
                                    type="button"
                                    className="text-button"
                                    title="Réinitialiser code PIN"
                                    onClick={() => {
                                      setResetPinMember({ id: m.id, name: m.name });
                                      open('reset-pin');
                                    }}
                                  >
                                    <KeyRound size={15} />
                                    PIN
                                  </button>
                                  <button
                                    type="button"
                                    className="text-button"
                                    onClick={() =>
                                      action(
                                        () =>
                                          api
                                            .PATCH(
                                              '/api/v1/groupements/{groupId}/members/{memberId}/block',
                                              {
                                                params: { path: { groupId, memberId: m.id } },
                                                body: { blocked: !m.is_blocked },
                                              },
                                            )
                                            .then(unwrap),
                                        m.is_blocked ? 'Membre débloquée.' : 'Membre bloquée.',
                                      )
                                    }
                                  >
                                    {m.is_blocked ? 'Débloquer' : 'Bloquer'}
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!members.length && (
                    <div className="empty">
                      <Users size={32} />
                      <p>Aucune membre enregistrée.</p>
                    </div>
                  )}
                  <Pager page={page} total={memberTotal} onChange={setPage} />
                </section>
              )}

              {tab === 'types' && (
                <>
                  <section className="panel">
                    <div className="section-heading">
                      <div>
                        <h2>Catalogue des événements</h2>
                        <p className="muted">
                          Événements gérés par l’administration (Ramadan, Tabaski, Rentrée,
                          Solidarité…)
                        </p>
                      </div>
                      {superAdmin && (
                        <button className="primary" onClick={() => open('event')}>
                          <Plus size={16} />
                          Créer un événement
                        </button>
                      )}
                    </div>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Nom</th>
                            <th>Code</th>
                            <th>Description</th>
                            {superAdmin && <th>Actions</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {events.map((e) => (
                            <tr key={e.id}>
                              <td>
                                <strong>{e.name}</strong>
                              </td>
                              <td>
                                <span className="badge-code">{e.code}</span>
                              </td>
                              <td>{e.description || '—'}</td>
                              {superAdmin && (
                                <td>
                                  <div style={{ display: 'flex', gap: 6 }}>
                                    <button
                                      type="button"
                                      className="text-button"
                                      style={{ padding: '4px 8px', fontSize: 12 }}
                                      onClick={() => {
                                        setEditEvent(e);
                                        open('edit-event');
                                      }}
                                    >
                                      <Edit2 size={13} />
                                      Modifier
                                    </button>
                                    <button
                                      type="button"
                                      className="text-button"
                                      style={{ padding: '4px 8px', fontSize: 12, color: '#dc2626' }}
                                      onClick={() => handleDeleteEvent(e)}
                                    >
                                      <Trash2 size={13} />
                                      Supprimer
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section className="panel" style={{ marginTop: 24 }}>
                    <div className="section-heading">
                      <div>
                        <h2>Catalogue des types de campagne</h2>
                        <p className="muted">
                          Modèles d’épargne pris en charge : Avec Épargne, Tontine rotative, Caisse
                          de solidarité.
                        </p>
                      </div>
                      {superAdmin && (
                        <button className="primary" onClick={() => open('type')}>
                          <Plus size={16} />
                          Créer un type de campagne
                        </button>
                      )}
                    </div>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Nom</th>
                            <th>Code</th>
                            <th>Version des règles</th>
                            {superAdmin && <th>Actions</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {types.map((t) => (
                            <tr key={t.id}>
                              <td>
                                <strong>{t.name}</strong>
                              </td>
                              <td>
                                <span className="badge-code">{t.code}</span>
                              </td>
                              <td>Modèle standard v{t.rule_version}</td>
                              {superAdmin && (
                                <td>
                                  <div style={{ display: 'flex', gap: 6 }}>
                                    <button
                                      type="button"
                                      className="text-button"
                                      style={{ padding: '4px 8px', fontSize: 12 }}
                                      onClick={() => {
                                        setEditType(t);
                                        open('edit-type');
                                      }}
                                    >
                                      <Edit2 size={13} />
                                      Modifier
                                    </button>
                                    <button
                                      type="button"
                                      className="text-button"
                                      style={{ padding: '4px 8px', fontSize: 12, color: '#dc2626' }}
                                      onClick={() => handleDeleteType(t)}
                                    >
                                      <Trash2 size={13} />
                                      Supprimer
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </>
              )}

              {tab === 'archives' && (
                <>
                  {/* Section 1: Campagnes fermées du groupement */}
                  <div className="archive-section">
                    <div className="archive-header">
                      <div>
                        <h3>
                          <FolderHeart size={18} color="#64748b" />
                          Campagnes fermées / archivées
                        </h3>
                        <p className="muted" style={{ margin: '2px 0 0', fontSize: 13 }}>
                          Campagnes closes pour le groupement actif (
                          {group?.name || 'aucun groupement sélectionné'}).
                        </p>
                      </div>
                    </div>

                    {!archivedCampaigns.length ? (
                      <div className="empty-sub">
                        <p>Aucune campagne fermée pour ce groupement.</p>
                      </div>
                    ) : (
                      <div className="table-scroll">
                        <table className="campaigns-table">
                          <thead>
                            <tr>
                              <th>Campagne</th>
                              <th>Membres</th>
                              <th>Montant collecté</th>
                              <th>Période</th>
                              <th>Statut</th>
                              <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {archivedCampaigns.map((c) => (
                              <tr key={c.id} className="campaign-row">
                                <td>
                                  <div className="campaign-cell-main">
                                    <div className="campaign-name-line">
                                      <strong>{c.name}</strong>
                                    </div>
                                    <div className="campaign-tags">
                                      <span className="badge neutral">{c.type_name}</span>
                                      {c.event_name && (
                                        <span className="badge-event">{c.event_name}</span>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <div className="member-count-box">
                                    <Users size={14} />
                                    <span>
                                      {c.member_count ?? 0} membre
                                      {(c.member_count ?? 0) > 1 ? 's' : ''}
                                    </span>
                                  </div>
                                </td>
                                <td>
                                  <strong>{money(c.collected_amount ?? '0')}</strong>
                                </td>
                                <td>
                                  <div className="campaign-period-info">
                                    <span className="date-range">
                                      {date(c.start_date)} → {date(c.end_date)}
                                    </span>
                                  </div>
                                </td>
                                <td>
                                  <span className="badge neutral">Fermée</span>
                                </td>
                                <td>
                                  <div className="row-actions">
                                    {(superAdmin || canManage) && (
                                      <button
                                        type="button"
                                        className="secondary-btn-sm"
                                        disabled={busy}
                                        onClick={() =>
                                          action(
                                            () =>
                                              api
                                                .PATCH(
                                                  '/api/v1/groupements/{groupId}/campaigns/{id}/activation',
                                                  {
                                                    params: { path: { groupId, id: c.id } },
                                                    body: { active: true },
                                                  },
                                                )
                                                .then(unwrap),
                                            'Campagne activée.',
                                          )
                                        }
                                      >
                                        Activer
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Section 2: Groupements inactifs (Super Admin) */}
                  {superAdmin && (
                    <div className="archive-section" style={{ marginTop: 24 }}>
                      <div className="archive-header">
                        <div>
                          <h3>
                            <Users size={18} color="#64748b" />
                            Groupements inactifs
                          </h3>
                          <p className="muted" style={{ margin: '2px 0 0', fontSize: 13 }}>
                            Groupements archivés ou inactifs sur la plateforme.
                          </p>
                        </div>
                      </div>

                      {!archivedGroups.length ? (
                        <div className="empty-sub">
                          <p>Aucun groupement inactif.</p>
                        </div>
                      ) : (
                        <div className="table-scroll">
                          <table>
                            <thead>
                              <tr>
                                <th>Groupement</th>
                                <th>Adresse</th>
                                <th>Téléphone</th>
                                <th>Responsable</th>
                                <th>Statut</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {archivedGroups.map((g) => (
                                <tr key={g.id}>
                                  <td>
                                    <strong>{g.name}</strong>
                                  </td>
                                  <td>{g.address}</td>
                                  <td>{g.phone}</td>
                                  <td>{g.responsible || '—'}</td>
                                  <td>
                                    <span className="badge neutral">Inactif</span>
                                  </td>
                                  <td>
                                    <div className="row-actions">
                                      <button
                                        type="button"
                                        className="primary-btn-sm"
                                        disabled={busy}
                                        onClick={() =>
                                          action(
                                            () =>
                                              api
                                                .PATCH(
                                                  '/api/v1/groupements/{groupId}/activation',
                                                  {
                                                    params: { path: { groupId: g.id } },
                                                    body: { active: true },
                                                  },
                                                )
                                                .then(unwrap),
                                            'Groupement réactivé avec succès.',
                                          )
                                        }
                                      >
                                        Réactiver
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}
          <footer className="page-footer">
            <Leaf size={14} />
            AvecLesFemmes<span>Chaque femme, chaque projet, chaque contribution.</span>
          </footer>
        </div>
      </main>

      {/* Modal QR Code */}
      {qrModal && (
        <QrModal
          title={qrModal.title}
          subtitle={qrModal.subtitle}
          data={qrModal.data}
          onClose={() => setQrModal(null)}
        />
      )}

      {dialog && (
        <Dialog
          title={
            {
              group: 'Créer un groupement',
              member: 'Ajouter une membre',
              type: 'Créer un type de campagne',
              'edit-type': 'Modifier le type de campagne',
              event: 'Créer un événement',
              'edit-event': 'Modifier l’événement',
              campaign: 'Créer une campagne',
              participant: 'Configurer une participation',
              contribution: 'Enregistrer une cotisation',
              grace: 'Accorder un délai de grâce',
              'reset-pin': `Réinitialiser le PIN de ${resetPinMember?.name || 'la membre'}`,
              void: 'Annuler une cotisation',
            }[dialog] || ''
          }
          subtitle={
            {
              group: 'Enregistrez un groupement d’épargne solidaire.',
              member: 'Ajoutez une participante et définissez sa fonction statutaire.',
              type: 'Créez un nouveau modèle de règles d’épargne solidaire.',
              'edit-type': 'Mettez à jour le nom ou le code du type de campagne.',
              event: 'Ajoutez un événement au catalogue de la plateforme.',
              'edit-event': 'Mettez à jour les informations de cet événement.',
              campaign: 'Paramétrez une campagne d’épargne ou tontine rotative.',
              participant: 'Inscrivez une membre et définissez son forfait.',
              contribution: 'Saisie de versement en séance pour la participante sélectionnée.',
              grace: 'Délai de grâce individuel accordé avec motif d’audit.',
              'reset-pin': 'Définissez un nouveau code secret à 4 chiffres.',
              void: 'Annulation exceptionnelle d’une cotisation erronée.',
            }[dialog]
          }
          wide={dialog === 'campaign' || dialog === 'member' || dialog === 'group'}
          busy={busy}
          onClose={() => setDialog('')}
        >
          <form onSubmit={submit}>
            <fieldset disabled={busy}>
              {dialog === 'group' && (
                <>
                  <Field label="Nom du groupement">
                    <input
                      name="name"
                      required
                      minLength={2}
                      maxLength={120}
                      placeholder="Ex: Les Femmes de Grand Yoff"
                    />
                  </Field>
                  <div className="form-grid">
                    <Field label="Adresse">
                      <input
                        name="address"
                        required
                        minLength={2}
                        maxLength={250}
                        placeholder="Ex: Grand Yoff, Dakar"
                      />
                    </Field>
                    <Field label="Téléphone">
                      <input name="phone" type="tel" required placeholder="Ex: +221771234567" />
                    </Field>
                  </div>

                  <div className="assignment-section">
                    <div className="assignment-section-header">
                      <h4>
                        <span>🏷️</span> Types de campagne autorisés
                      </h4>
                      <span className="badge-soft">{types.length} disponibles</span>
                    </div>
                    <p className="assignment-section-desc">
                      Sélectionnez les modèles de campagne que ce groupement aura le droit
                      d’activer.
                    </p>
                    <div className="assignment-grid">
                      {types.map((t) => (
                        <label key={t.id} className="assignment-card">
                          <input
                            type="checkbox"
                            name="typeIds"
                            value={t.id}
                            defaultChecked
                            className="assignment-checkbox"
                          />
                          <div className="assignment-card-body">
                            <div className="assignment-card-title">
                              <strong>{t.name}</strong>
                              <span className="badge-code">{t.code}</span>
                            </div>
                            <span className="assignment-card-sub">
                              Modèle standard v{t.rule_version}
                            </span>
                          </div>
                        </label>
                      ))}
                      {types.length === 0 && (
                        <p className="assignment-card-sub">Aucun type de campagne disponible.</p>
                      )}
                    </div>
                  </div>

                  <div className="assignment-section">
                    <div className="assignment-section-header">
                      <h4>
                        <span>📅</span> Événements applicables
                      </h4>
                      <span className="badge-soft">{events.length} disponibles</span>
                    </div>
                    <p className="assignment-section-desc">
                      Sélectionnez les événements du catalogue applicables aux campagnes du
                      groupement.
                    </p>
                    <div className="assignment-grid">
                      {events.map((ev) => (
                        <label key={ev.id} className="assignment-card">
                          <input
                            type="checkbox"
                            name="eventIds"
                            value={ev.id}
                            defaultChecked
                            className="assignment-checkbox"
                          />
                          <div className="assignment-card-body">
                            <div className="assignment-card-title">
                              <strong>{ev.name}</strong>
                              <span className="badge-code">{ev.code}</span>
                            </div>
                            {ev.description && (
                              <span className="assignment-card-sub">{ev.description}</span>
                            )}
                          </div>
                        </label>
                      ))}
                      {events.length === 0 && (
                        <p className="assignment-card-sub">Aucun événement disponible.</p>
                      )}
                    </div>
                  </div>
                </>
              )}
              {dialog === 'member' && (
                <>
                  <Field label="Nom complet">
                    <input
                      name="name"
                      required
                      minLength={2}
                      maxLength={120}
                      placeholder="Ex: Aminata Diallo"
                    />
                  </Field>
                  <div className="form-grid">
                    <Field label="Téléphone avec indicatif">
                      <input name="phone" type="tel" placeholder="+221771234567" />
                    </Field>
                    <Field label="Sexe">
                      <select name="gender" defaultValue="F">
                        <option value="F">Femme (F)</option>
                        <option value="M">Homme (M)</option>
                      </select>
                    </Field>
                  </div>
                  <div className="form-grid">
                    <Field label="Adresse">
                      <input name="address" placeholder="Quartier, Ville" maxLength={250} />
                    </Field>
                    <Field label="Fonction dans le groupement">
                      <select name="functionId">
                        {functions.map((fn) => (
                          <option key={fn.id} value={fn.id}>
                            {fn.name} {fn.can_be_admin ? '★ (Bureau)' : ''}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <Field label="Code PIN secret (4 chiffres)">
                    <input
                      name="pin"
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]{4}"
                      maxLength={4}
                      placeholder="Ex: 1234"
                    />
                  </Field>
                  <div className="dialog-info-pill">
                    <KeyRound size={16} />
                    <span>
                      Ce code PIN permettra à la membre de se connecter immédiatement sur son
                      mobile.
                    </span>
                  </div>
                  <details style={{ marginTop: 8, marginBottom: 14 }}>
                    <summary
                      style={{
                        cursor: 'pointer',
                        fontWeight: 600,
                        color: '#314737',
                        fontSize: 13,
                      }}
                    >
                      Accès classique par identifiant (Optionnel)
                    </summary>
                    <div
                      style={{
                        marginTop: 10,
                        padding: 12,
                        background: '#f8faf7',
                        borderRadius: 8,
                        border: '1px solid #e1ebe0',
                      }}
                    >
                      <Field label="Identifiant (optionnel)">
                        <input
                          name="login"
                          pattern="[a-zA-Z0-9._-]{3,80}"
                          autoComplete="off"
                          placeholder="Ex: aminata.diallo"
                        />
                      </Field>
                      <Field label="Mot de passe initial (optionnel)">
                        <input
                          name="password"
                          type="password"
                          minLength={4}
                          maxLength={128}
                          autoComplete="new-password"
                          placeholder="••••••••"
                        />
                      </Field>
                    </div>
                  </details>
                  {(superAdmin || admin) && (
                    <label className="checkbox">
                      <input type="checkbox" name="admin" />
                      Attribuer l’administration du groupement (Rôle ADMIN)
                    </label>
                  )}
                </>
              )}
              {dialog === 'reset-pin' && (
                <>
                  <Field label="Nouveau Code PIN à 4 chiffres">
                    <input
                      name="pin"
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]{4}"
                      maxLength={4}
                      placeholder="••••"
                      required
                    />
                  </Field>
                  <div className="dialog-info-pill">
                    <KeyRound size={16} />
                    <span>
                      Ce code PIN permettra à la membre de se connecter immédiatement avec son
                      numéro de téléphone.
                    </span>
                  </div>
                </>
              )}
              {dialog === 'event' && (
                <>
                  <Field label="Nom de l’événement">
                    <input name="name" required minLength={2} placeholder="Ex: Rentrée scolaire" />
                  </Field>
                  <Field label="Code unique en majuscules">
                    <input
                      name="code"
                      required
                      pattern="[A-Z][A-Z0-9_]{1,39}"
                      placeholder="Ex: RENTREE"
                    />
                  </Field>
                  <Field label="Description">
                    <input
                      name="description"
                      placeholder="Frais d’inscription, fournitures scolaires..."
                      maxLength={250}
                    />
                  </Field>
                </>
              )}
              {dialog === 'edit-event' && editEvent && (
                <>
                  <Field label="Nom de l’événement">
                    <input
                      name="name"
                      required
                      minLength={2}
                      defaultValue={editEvent.name}
                      placeholder="Ex: Rentrée scolaire"
                    />
                  </Field>
                  <Field label="Code unique en majuscules">
                    <input
                      name="code"
                      required
                      pattern="[A-Z][A-Z0-9_]{1,39}"
                      defaultValue={editEvent.code}
                      placeholder="Ex: RENTREE"
                    />
                  </Field>
                  <Field label="Description">
                    <input
                      name="description"
                      defaultValue={editEvent.description || ''}
                      placeholder="Frais d’inscription, fournitures scolaires..."
                      maxLength={250}
                    />
                  </Field>
                </>
              )}
              {dialog === 'type' && (
                <>
                  <Field label="Nom du type">
                    <input name="name" required minLength={2} placeholder="Ex: Tontine rotative" />
                  </Field>
                  <Field label="Code unique en majuscules">
                    <input
                      name="code"
                      required
                      pattern="[A-Z][A-Z0-9_]{1,39}"
                      placeholder="Ex: TONTINE"
                    />
                  </Field>
                  <div className="dialog-info-pill">
                    <Sparkles size={16} />
                    <span>Ce type utilisera les règles et le moteur de calcul Avec Épargne.</span>
                  </div>
                </>
              )}
              {dialog === 'edit-type' && editType && (
                <>
                  <Field label="Nom du type">
                    <input
                      name="name"
                      required
                      minLength={2}
                      defaultValue={editType.name}
                      placeholder="Ex: Tontine rotative"
                    />
                  </Field>
                  <Field label="Code unique en majuscules">
                    <input
                      name="code"
                      required
                      pattern="[A-Z][A-Z0-9_]{1,39}"
                      defaultValue={editType.code}
                      placeholder="Ex: TONTINE"
                    />
                  </Field>
                  <div className="dialog-info-pill">
                    <Sparkles size={16} />
                    <span>Modèle standard v{editType.rule_version}</span>
                  </div>
                </>
              )}
              {dialog === 'campaign' && (() => {
                const activeType =
                  types.find((t) => t.id === (campaignTypeId || types[0]?.id)) || types[0];
                const isTontine =
                  activeType?.code === 'TONTINE' ||
                  (activeType?.name || '').toLowerCase().includes('tontine');

                return (
                  <>
                    <div className="form-grid">
                      <Field label="Nom de la campagne">
                        <input
                          name="name"
                          required
                          minLength={2}
                          placeholder="Ex: Épargne solidaire 2026"
                        />
                      </Field>
                      <Field label="Type de campagne">
                        <select
                          name="typeId"
                          required
                          value={campaignTypeId || types[0]?.id || ''}
                          onChange={(e) => setCampaignTypeId(e.target.value)}
                        >
                          {types.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>

                    <div className="dialog-info-pill" style={{ marginBottom: 14 }}>
                      <Sparkles size={16} />
                      <span>
                        {isTontine
                          ? 'Type Tontine Rotative : Paramétrez les échéances mensuelles et la fréquence de rotation.'
                          : 'Type Épargne : Définissez le forfait standard, les dates de campagne et le rythme de cotisation.'}
                      </span>
                    </div>

                    <div className="form-grid">
                      <Field label="Événement associé">
                        <select name="eventId">
                          <option value="">(Optionnel) Aucun événement particulier</option>
                          {events.map((ev) => (
                            <option key={ev.id} value={ev.id}>
                              {ev.name} ({ev.code})
                            </option>
                          ))}
                        </select>
                      </Field>
                      {!isTontine ? (
                        <Field label="Montant standard / forfait (FCFA)">
                          <input type="number" name="standardAmount" min="1" placeholder="Ex: 5000" />
                        </Field>
                      ) : (
                        <Field label="Jour d'échéance du mois (Option C)">
                          <input
                            type="number"
                            name="dueDay"
                            min="1"
                            max="31"
                            placeholder="Ex: 5 pour le 5 du mois"
                          />
                        </Field>
                      )}
                    </div>

                    {!isTontine ? (
                      <>
                        <div className="form-grid">
                          <Field label="Date de début">
                            <input type="date" name="startDate" required />
                          </Field>
                          <Field label="Date de fin">
                            <input type="date" name="endDate" required />
                          </Field>
                        </div>
                        <div className="form-grid">
                          <Field label="Jour de cotisation hebdomadaire">
                            <select name="weekday" defaultValue="2">
                              {days.map((d, i) => (
                                <option key={d} value={i}>
                                  {d}
                                </option>
                              ))}
                            </select>
                          </Field>
                          <Field label="Intervalle en semaines">
                            <input
                              type="number"
                              name="intervalWeeks"
                              min="1"
                              max="52"
                              defaultValue="1"
                              required
                            />
                          </Field>
                        </div>
                      </>
                    ) : (
                      <div className="form-grid">
                        <Field label="Intervalle de rotation (si Tontine rotative)">
                          <select name="rotationInterval" defaultValue="MONTHLY">
                            <option value="WEEKLY">Hebdomadaire (7 jours)</option>
                            <option value="BIWEEKLY">Bimensuel (14 jours)</option>
                            <option value="MONTHLY">Mensuel (Par défaut)</option>
                          </select>
                        </Field>
                        <div />
                      </div>
                    )}

                    <label className="checkbox" style={{ marginTop: 8 }}>
                      <input type="checkbox" name="isMandatory" />
                      Souscription obligatoire pour les membres du groupement
                    </label>
                  </>
                );
              })()}
              {dialog === 'grace' && (
                <>
                  <Field label="Membre bénéficiaire">
                    <select name="membershipId" required defaultValue={graceMemberId}>
                      {participants.map((p) => (
                        <option key={p.membership_id} value={p.membership_id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="form-grid">
                    <Field label="Date d’échéance normale">
                      <input
                        type="date"
                        name="periodDate"
                        defaultValue={new Date().toISOString().slice(0, 10)}
                        required
                      />
                    </Field>
                    <Field label="Nouvelle date limite accordée">
                      <input type="date" name="extendedDeadline" required />
                    </Field>
                  </div>
                  <Field label="Motif du délai de grâce">
                    <input
                      name="reason"
                      placeholder="Ex: Déplacement, imprévu familial..."
                      maxLength={250}
                    />
                  </Field>
                </>
              )}
              {dialog === 'participant' && (
                <>
                  <Field label="Membre du groupement">
                    <select name="membershipId" required>
                      {memberOptions.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} {m.phone ? `(${m.phone})` : ''}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {optionTotal > 100 && (
                    <Pager
                      page={optionPage}
                      total={optionTotal}
                      limit={100}
                      onChange={setOptionPage}
                    />
                  )}
                  <Field label="Montant forfaitaire par échéance (FCFA)">
                    <input
                      type="number"
                      name="forfait"
                      min="1"
                      placeholder={
                        campaign?.standard_amount
                          ? `Standard : ${money(campaign.standard_amount)}`
                          : 'Montant libre si vide'
                      }
                    />
                  </Field>
                  <label className="checkbox">
                    <input type="checkbox" name="isRandom" />
                    Cotisation aléatoire (Montant libre à chaque séance)
                  </label>
                </>
              )}
              {dialog === 'contribution' && (
                <>
                  <Field label="Participante">
                    <select
                      name="participationId"
                      required
                      onChange={(e) => {
                        const chosen = participants.find((p) => p.id === e.target.value);
                        if (chosen?.forfait) {
                          setKeypadAmount(String(chosen.forfait));
                        }
                      }}
                    >
                      {participants.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} · {p.forfait ? money(p.forfait) : 'Libre'}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="form-grid">
                    <Field label="Montant réellement versé en FCFA">
                      <input
                        type="number"
                        name="amount"
                        min="1"
                        required
                        placeholder="Ex: 5000"
                        value={keypadAmount}
                        onChange={(e) => setKeypadAmount(e.target.value)}
                      />
                    </Field>
                    <Field label="Date du versement">
                      <input
                        type="date"
                        name="paidOn"
                        defaultValue={new Date().toISOString().slice(0, 10)}
                        required
                      />
                    </Field>
                  </div>

                  {/* Pavé tactile géant et raccourcis rapides */}
                  <NumericKeypad
                    amount={keypadAmount}
                    onChange={setKeypadAmount}
                    onAddQuick={(add) => {
                      const cur = Number(keypadAmount) || 0;
                      setKeypadAmount(String(cur + add));
                    }}
                  />
                  <div style={{ textAlign: 'center', marginTop: 10, fontSize: 12, color: '#0f766e', fontWeight: 600 }}>
                    <ShieldCheck size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                    Frais AvecLesFemmes = 0% · Calebasse 100% Solidaire
                  </div>
                </>
              )}
              {dialog === 'void' && (
                <>
                  <div className="alert" style={{ marginBottom: 14 }}>
                    <AlertTriangle size={16} />
                    <span>Cette annulation est définitive et corrigera l’état de caisse.</span>
                  </div>
                  <Field label="Motif de l’annulation">
                    <textarea
                      name="reason"
                      required
                      minLength={5}
                      maxLength={250}
                      placeholder="Erreur de saisie, versement doublon…"
                    />
                  </Field>
                </>
              )}
              <div className="dialog-actions">
                <button type="button" className="secondary" onClick={() => setDialog('')}>
                  Annuler
                </button>
                <button
                  className="primary"
                  type="submit"
                  disabled={!online || (dialog === 'contribution' && !participants.length)}
                >
                  {busy
                    ? 'Enregistrement…'
                    : dialog === 'void'
                      ? 'Confirmer l’annulation'
                      : 'Enregistrer'}
                </button>
              </div>
            </fieldset>
          </form>
        </Dialog>
      )}

      {scannerOpen && (
        <CameraScannerOverlay
          onClose={() => setScannerOpen(false)}
          onScan={(_scanned) => {
            setScannerOpen(false);
            setNotice('Code QR scanné avec succès.');
            if (canManage) {
              open('contribution');
            }
          }}
        />
      )}
    </div>
  );
}
