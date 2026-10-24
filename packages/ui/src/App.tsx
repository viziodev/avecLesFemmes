import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from 'react';
import QRCode from 'qrcode';
import { QrScanner } from './QrScanner';
import { confirmedAction } from './confirmed-action';
import { campaignColors, VectorQrView } from './CampaignVisuals';
import { Dialog } from './Dialog';
import { MemberSpace } from './MemberSpace';
import { CompactIdentity, DayActionCard, useMoneyVisibility, usePwaNavigation } from './PwaLayout';
import { AppearanceProvider, AppearanceSettings } from './Appearance';
import { PwaSecurity, usePwaSecurity } from './PwaSecurity';
import { confirmedPayment, PwaFeedbackProvider, usePwaFeedback } from './PwaFeedback';
import { PaletteProvider, PlatformColors, useGroupPalette } from './Palette';
import { PwaLogin } from './PwaLogin';
import { CampaignChoiceCard, CampaignHomeToggle, CampaignShortcut } from './CampaignNavigation';
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  BarChart3,
  Calendar,
  CalendarCheck,
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
const meetingLabel = (c: {
  weekday: number;
  interval_weeks: number;
  rotation_interval?: string | null;
  monthly_week?: number | null;
}) =>
  c.rotation_interval === 'MONTHLY'
    ? c.monthly_week
      ? `${['Premier', 'Deuxième', 'Troisième', 'Quatrième'][c.monthly_week - 1]} ${days[c.weekday].toLowerCase()} du mois`
      : 'Chaque mois, à la date de début'
    : `${days[c.weekday]} · toutes les ${c.rotation_interval === 'BIWEEKLY' ? 2 : c.interval_weeks} semaine(s)`;
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
  const feedback = usePwaFeedback();
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
    feedback.notify('Téléchargement du QR code demandé.', 'success');
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

type ContributionState = 'all' | 'paid' | 'unpaid';
function MemberStateFilter({
  value,
  onChange,
  label,
}: {
  value: ContributionState;
  onChange: (v: ContributionState) => void;
  label: string;
}) {
  return (
    <label className="member-state-filter">
      État de cotisation
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value as ContributionState)}
      >
        <option value="all">Tous</option>
        <option value="paid">Cotisé</option>
        <option value="unpaid">Pas cotisé</option>
      </select>
    </label>
  );
}
function AttendanceList({
  members,
  day,
  onGrace,
}: {
  members: S['SessionAttendanceView'][];
  day: string;
  onGrace?: (member: S['SessionAttendanceView']) => void;
}) {
  return (
    <ul className="session-attendance">
      {members.map((member) => (
        <li
          key={member.member_id}
          className={
            member.contributed
              ? 'contributed'
              : member.absent && !member.is_beneficiary
                ? 'not-contributed member-absent'
                : 'not-contributed'
          }
        >
          <div className="session-entry-main">
            <strong>{member.member_name}</strong>
            <strong className="session-entry-amount">{money(member.paid_amount)}</strong>
          </div>
          <div className="session-entry-meta">
            <span>{date(day)}</span>
            <span className="session-entry-status">
              {member.contributed
                ? 'A cotisé'
                : member.absent && !member.is_beneficiary
                  ? 'Absent · délai expiré'
                  : 'N’a pas cotisé'}
            </span>
          </div>
          <small>
            Attendu :{' '}
            {member.expected_amount == null ? 'Montant libre' : money(member.expected_amount)}
          </small>
          {member.is_beneficiary && (
            <small className="round-beneficiary-badge">Bénéficiaire du tour</small>
          )}
          {!member.is_beneficiary && !member.contributed && member.grace_deadline && (
            <small className={member.absent ? 'grace-expired' : 'grace-active'}>
              Délai de grâce : jusqu’au {date(member.grace_deadline)} inclus
            </small>
          )}
          {onGrace && !member.is_beneficiary && member.can_grant_grace && (
            <button className="member-grace-button" onClick={() => onGrace(member)}>
              <Clock size={16} aria-hidden="true" />
              {member.grace_deadline ? 'Prolonger le délai' : 'Accorder un délai'}
            </button>
          )}
          {member.contributed &&
            member.expected_amount != null &&
            BigInt(member.paid_amount) < BigInt(member.expected_amount) && (
              <small>Versement partiel</small>
            )}
        </li>
      ))}
    </ul>
  );
}

function SearchableMemberSelect({
  items,
  total,
  page,
  query,
  value,
  loading,
  error,
  onQuery,
  onSelect,
  onPage,
}: {
  items: S['EligibleMemberView'][];
  total: number;
  page: number;
  query: string;
  value: string;
  loading: boolean;
  error: string;
  onQuery: (query: string) => void;
  onSelect: (id: string) => void;
  onPage: (page: number) => void;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [opened, setOpened] = useState(false);
  const [selectedName, setSelectedName] = useState('');
  const [active, setActive] = useState(0);
  useEffect(() => {
    setActive(0);
  }, [items, query, page]);
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpened(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);
  function choose(member: S['EligibleMemberView']) {
    setSelectedName(member.name);
    onSelect(member.id);
    input.current?.focus();
    setOpened(false);
  }
  return (
    <div className="searchable-member-select" ref={root}>
      <label htmlFor={id}>Membre du groupement</label>
      <div className="searchable-member-input">
        <Search size={18} aria-hidden="true" />
        <input
          ref={input}
          id={id}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={opened}
          aria-controls={id + '-options'}
          aria-activedescendant={
            opened && !loading && items[active] ? id + '-option-' + active : undefined
          }
          autoComplete="off"
          maxLength={120}
          placeholder="Choisir ou rechercher un membre"
          value={value ? selectedName : query}
          required
          onFocus={() => setOpened(true)}
          onChange={(e) => {
            onQuery(e.target.value);
            setOpened(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              setOpened(true);
              setActive((n) =>
                Math.max(0, Math.min(items.length - 1, n + (e.key === 'ArrowDown' ? 1 : -1))),
              );
            }
            if (e.key === 'Enter' && opened) {
              e.preventDefault();
              if (!loading && items[active]) choose(items[active]);
            }
            if (e.key === 'Escape' && opened) {
              e.preventDefault();
              e.stopPropagation();
              setOpened(false);
            }
          }}
        />
        <button
          type="button"
          className="icon-button"
          aria-label="Afficher les membres non inscrits"
          aria-expanded={opened}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setOpened(!opened);
            if (!opened) input.current?.focus();
          }}
        >
          <ChevronDown size={19} />
        </button>
      </div>
      <input type="hidden" name="membershipId" value={value} />
      {opened && (
        <div className="searchable-member-popup">
          {loading && <p role="status">Chargement des membres…</p>}
          {error && <p role="alert">{error}</p>}
          <ul
            role="listbox"
            id={id + '-options'}
            aria-label="Membres non inscrits"
            aria-busy={loading}
          >
            {!loading &&
              items.map((member, index) => (
                <li
                  key={member.id}
                  id={id + '-option-' + index}
                  role="option"
                  aria-selected={value === member.id}
                  className={active === index ? 'active' : ''}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(member)}
                >
                  <strong>{member.name}</strong>
                  {member.phone && <small>{member.phone}</small>}
                </li>
              ))}
          </ul>
          {!loading && !error && !items.length && (
            <p role="status">Aucun membre non inscrit ne correspond à la recherche.</p>
          )}
          {total > 25 && <Pager page={page} total={total} onChange={onPage} />}
        </div>
      )}
    </div>
  );
}

function TontineRoundAttendance({
  groupId,
  campaignId,
  round,
  refresh,
  onEditingChange,
}: {
  groupId: string;
  campaignId: string;
  round: TontineRound;
  refresh: number;
  onEditingChange: (editing: boolean) => void;
}) {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<ContributionState>('all');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<S['TontineMembersPage'] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const selectedNumber = round.round_number;
  const [graceMember, setGraceMember] = useState<S['SessionAttendanceView'] | null>(null);
  const feedback = usePwaFeedback();
  const [graceBusy, setGraceBusy] = useState(false);
  const [graceError, setGraceError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!graceMember) return;
    onEditingChange(true);
    return () => onEditingChange(false);
  }, [graceMember, onEditingChange]);
  async function grantGrace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!graceMember || graceBusy || !navigator.onLine) return;
    const values = new FormData(event.currentTarget);
    setGraceBusy(true);
    setGraceError('');
    try {
      await api
        .POST('/api/v1/groupements/{groupId}/campaigns/{id}/grace-periods', {
          params: { path: { groupId, id: campaignId } },
          body: {
            membershipId: graceMember.member_id,
            periodDate: round.expected_date,
            extendedDeadline: String(values.get('deadline')),
            reason: String(values.get('reason') || ''),
          },
        })
        .then(unwrap);
      setGraceMember(null);
      feedback.notify('Délai de grâce enregistré.', 'success');
      setRevision((v) => v + 1);
    } catch (e) {
      setGraceError((e as Error).message);
      feedback.notify((e as Error).message, 'error');
    } finally {
      setGraceBusy(false);
    }
  }
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setData(null);
    api
      .GET('/api/v1/groupements/{groupId}/campaigns/{id}/tontine/members', {
        params: {
          path: { groupId, id: campaignId },
          query: { page, limit: 25, q: query, state, roundNumber: selectedNumber },
        },
      })
      .then(unwrap)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [groupId, campaignId, page, query, state, selectedNumber, refresh, revision]);
  return (
    <div className="tontine-round-attendance">
      {data && (
        <>
          <p className="muted">
            Du {date(data.period_start)} au{' '}
            {date(new Date(Date.parse(data.period_end + 'T12:00:00Z') - 86400000).toISOString())}
          </p>
          <p className="member-status-counts">
            <span>{data.contributed_count} membre(s) ayant cotisé</span>
            <span className="unpaid-count">{data.unpaid_count} membre(s) n’ayant pas cotisé</span>
          </p>
        </>
      )}
      <div className="session-member-filter">
        <label htmlFor={`tontine-member-${selectedNumber}`}>Rechercher un membre</label>
        <div className="session-member-search">
          <Search size={18} aria-hidden="true" />
          <input
            id={`tontine-member-${selectedNumber}`}
            aria-label={`Rechercher un membre du tour ${selectedNumber}`}
            type="search"
            maxLength={120}
            placeholder="Nom du membre"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <MemberStateFilter
          label={`État de cotisation du tour ${selectedNumber}`}
          value={state}
          onChange={(v) => {
            setState(v);
            setPage(1);
          }}
        />
      </div>
      {loading && <p role="status">Chargement des membres…</p>}
      {error && <p role="alert">{error}</p>}
      {data && (
        <>
          <AttendanceList
            members={data.items}
            day={data.period_start}
            onGrace={(member) => {
              setGraceError('');
              setGraceMember(member);
            }}
          />
          {!data.items.length && (
            <p className="session-search-empty">Aucun membre pour ces critères.</p>
          )}
          <Pager page={page} total={data.total} onChange={setPage} />
        </>
      )}
      {graceMember && data && (
        <Dialog
          title="Délai de grâce"
          subtitle={`Tour ${selectedNumber} · ${date(round.expected_date)}`}
          busy={graceBusy}
          onClose={() => setGraceMember(null)}
        >
          <form onSubmit={grantGrace}>
            <p>
              <strong>{graceMember.member_name}</strong>
            </p>
            <p className="muted">
              Le membre sera indiqué absent après cette date s’il n’a pas cotisé. Le délai doit se
              terminer avant le prochain tour.
            </p>
            <label>
              Nouvelle date limite
              <input
                type="date"
                name="deadline"
                required
                min={
                  graceMember.grace_deadline &&
                  graceMember.grace_deadline >= new Date().toISOString().slice(0, 10)
                    ? new Date(Date.parse(graceMember.grace_deadline + 'T12:00:00Z') + 86400000)
                        .toISOString()
                        .slice(0, 10)
                    : new Date().toISOString().slice(0, 10)
                }
                max={new Date(Date.parse(data.period_end + 'T12:00:00Z') - 86400000)
                  .toISOString()
                  .slice(0, 10)}
              />
            </label>
            <label>
              Motif (facultatif)
              <textarea name="reason" maxLength={250} />
            </label>
            {graceError && <p role="alert">{graceError}</p>}
            <div className="dialog-actions">
              <button type="button" disabled={graceBusy} onClick={() => setGraceMember(null)}>
                Annuler
              </button>
              <button className="primary" disabled={graceBusy || !navigator.onLine}>
                {graceBusy ? 'Enregistrement…' : 'Accorder le délai'}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}

function CompactSessionHeader({
  title,
  amount,
  expected,
  note,
  unpaid,
  noteClass = '',
}: {
  title: string;
  amount: string;
  expected?: string;
  note: string;
  unpaid?: number;
  noteClass?: string;
}) {
  return (
    <>
      <span className="session-card-icon" aria-hidden="true">
        <CalendarCheck size={23} />
      </span>
      <span className="session-card-body compact-session-body">
        <span className="compact-card-line">
          <strong className="session-date-heading" title={title}>
            {title}
          </strong>
          {unpaid !== undefined && (
            <small className="unpaid-count" title={`${unpaid} membre(s) n’ayant pas cotisé`}>
              {unpaid} non cotisé(s)
            </small>
          )}
        </span>
        <span className="compact-card-line compact-card-amounts">
          <span title={`Versé : ${money(amount)}`}>
            Versé <b>{money(amount)}</b>
          </span>
          <span title={`Attendu : ${expected === undefined ? 'Non disponible' : money(expected)}`}>
            Attendu <b>{expected === undefined ? 'N/D' : money(expected)}</b>
          </span>
        </span>
        <span className={`compact-card-line compact-card-note ${noteClass}`} title={note}>
          {note}
        </span>
      </span>
      <ArrowRight className="session-card-arrow" size={21} aria-hidden="true" />
    </>
  );
}

function TontineRoundCards({
  rounds,
  groupId,
  campaignId,
  refresh,
  status,
  busy,
  online,
  onDraw,
  onPay,
  onEditingChange,
}: {
  rounds: TontineRound[];
  groupId: string;
  campaignId: string;
  refresh: number;
  status: S['TontineStatusView'] | null;
  busy: boolean;
  online: boolean;
  onDraw: () => void;
  onPay: (number: number) => void;
  onEditingChange: (editing: boolean) => void;
}) {
  const [visible, setVisible] = useState(3);
  const [opened, setOpened] = useState<Record<number, boolean>>({});
  const today = status?.today || new Date().toISOString().slice(0, 10);
  const current = rounds.find(
    (r) => r.round_number === status?.round_number && r.expected_date <= today,
  );
  const past = rounds
    .filter((r) => r.expected_date < today && r.round_number !== current?.round_number)
    .sort(
      (a, b) => b.expected_date.localeCompare(a.expected_date) || b.round_number - a.round_number,
    );
  const displayed = [...(current ? [current] : []), ...past.slice(0, visible)];
  return (
    <section className="panel savings-sessions tontine-round-cards" aria-label="Tours de tontine">
      <h2>Tours de tontine</h2>
      <p className="muted">
        Un tirage par tour, le jour prévu. La bénéficiaire est désignée avant l’encaissement.
      </p>
      {!rounds.length && <p>Inscrivez au moins deux membres pour préparer les tours.</p>}
      {displayed.map((round) => (
        <Fragment key={round.round_number}>
          {round === current && (
            <h3 className="round-section-title">
              {round.expected_date === today ? 'Tour du jour' : 'Tour en cours'}
            </h3>
          )}
          {round === past[0] && <h3 className="round-section-title">Tours passés</h3>}
          <details
            className="savings-session"
            key={round.round_number}
            open={!!opened[round.round_number]}
            onToggle={(e) => {
              const value = e.currentTarget.open;
              setOpened((current) =>
                current[round.round_number] === value
                  ? current
                  : { ...current, [round.round_number]: value },
              );
            }}
          >
            <summary className="session-card-summary compact-summary">
              <CompactSessionHeader
                title={`Tour ${round.round_number} · ${date(round.expected_date)}`}
                amount={round.total_collected_amount || '0'}
                expected={round.payout_amount}
                note={
                  round.beneficiary_name
                    ? `Bénéficiaire : ${round.beneficiary_name}`
                    : 'Bénéficiaire à tirer'
                }
                noteClass="round-beneficiary"
                unpaid={round.unpaid_count}
              />
            </summary>
            {opened[round.round_number] && (
              <>
                <dl className="compact-expanded-info">
                  <div>
                    <dt>Tour</dt>
                    <dd>
                      {round.round_number} · {date(round.expected_date)}
                    </dd>
                  </div>
                  <div>
                    <dt>Bénéficiaire</dt>
                    <dd>{round.beneficiary_name || 'À tirer'}</dd>
                  </div>
                  <div>
                    <dt>Montant versé</dt>
                    <dd>{money(round.total_collected_amount || '0')}</dd>
                  </div>
                  <div>
                    <dt>Montant attendu</dt>
                    <dd>{money(round.payout_amount)}</dd>
                  </div>
                  <div>
                    <dt>État</dt>
                    <dd>
                      {round.paid
                        ? 'Cagnotte reversée'
                        : round.beneficiary_name
                          ? 'Tirage effectué'
                          : 'Tirage à effectuer'}
                    </dd>
                  </div>
                </dl>
                {!round.beneficiary_name && round.round_number === status?.round_number && (
                  <button
                    type="button"
                    className="session-draw-button"
                    disabled={busy || !online || !status.can_draw}
                    onClick={onDraw}
                  >
                    Tirer la bénéficiaire du tour {round.round_number}
                  </button>
                )}
                {round.beneficiary_name && !round.paid && (
                  <button
                    type="button"
                    className="session-draw-button"
                    disabled={
                      busy ||
                      !online ||
                      round.expected_date > today ||
                      BigInt(round.total_collected_amount || '0') < BigInt(round.payout_amount)
                    }
                    onClick={() => onPay(round.round_number)}
                  >
                    Reverser la cagnotte à {round.beneficiary_name}
                  </button>
                )}
                <TontineRoundAttendance
                  groupId={groupId}
                  campaignId={campaignId}
                  round={round}
                  refresh={refresh}
                  onEditingChange={onEditingChange}
                />
              </>
            )}
          </details>
        </Fragment>
      ))}
      {current && !past.length && <p className="muted">Aucun tour passé.</p>}
      {!displayed.length && rounds.length > 0 && (
        <p className="muted">Aucun tour commencé. Le tirage sera disponible le jour prévu.</p>
      )}
      {visible < past.length && (
        <button
          className="session-more-link"
          aria-label="Voir plus de tours"
          onClick={() => setVisible((n) => n + 3)}
        >
          Voir plus
        </button>
      )}
      {visible > 3 && (
        <button
          className="session-more-link"
          aria-label="Voir moins de tours"
          onClick={() => setVisible(3)}
        >
          Voir moins
        </button>
      )}
    </section>
  );
}

function SavingsSessions({
  sessions,
  error,
  loading,
  onRetry,
}: {
  sessions: CampaignSession[];
  error: string;
  loading: boolean;
  onRetry: () => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [queries, setQueries] = useState<Record<string, string>>({});
  const [visibleCount, setVisibleCount] = useState(5);
  const [states, setStates] = useState<Record<string, ContributionState>>({});
  const sorted = [...sessions].sort((a, b) => b.session_date.localeCompare(a.session_date));
  const normalizeName = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('fr')
      .trim();
  return (
    <section className="panel savings-sessions" aria-label="Cahiers de séance d’épargne">
      <h2>Cahiers de séance</h2>
      <p className="muted">
        Du plus récent au plus ancien. Montant attendu indicatif, calculé avec les participantes et
        forfaits actuels. Les montants libres ne sont pas inclus.
      </p>
      {loading && <p role="status">Chargement des séances…</p>}
      {error && (
        <p role="alert">
          {error}{' '}
          <button className="text-button" onClick={onRetry}>
            Réessayer les séances
          </button>
        </p>
      )}
      {!loading && !error && !sessions.length && <p>Aucune séance enregistrée.</p>}
      {sorted.slice(0, visibleCount).map((session) => {
        const day = session.session_date;
        const query = queries[day] || '';
        const searching = !!query.trim();
        const members = session.members || [];
        const contributors = members
          .filter((m) => m.contributed)
          .sort((a, b) => {
            const order = (id: string) => {
              const index = session.contributions.findIndex((c) => c.member_id === id);
              return index < 0 ? Number.MAX_SAFE_INTEGER : index;
            };
            return order(a.member_id) - order(b.member_id);
          });
        const state = states[day] || 'all';
        const filtered = [...contributors, ...members.filter((m) => !m.contributed)].filter(
          (m) =>
            (!searching || normalizeName(m.member_name).includes(normalizeName(query))) &&
            (state === 'all' || m.contributed === (state === 'paid')),
        );
        const displayed = searching || expanded[day] ? filtered : filtered.slice(0, 5);
        return (
          <details className="savings-session" key={day}>
            <summary className="session-card-summary compact-summary">
              <CompactSessionHeader
                title={date(day)}
                amount={session.total_amount}
                expected={session.expected_amount}
                note={`${session.members_count ?? session.count} cotisé(s)${session.free_members_count ? ` · ${session.free_members_count} montant(s) libre(s)` : ''}`}
                unpaid={session.members ? members.filter((m) => !m.contributed).length : undefined}
              />
            </summary>
            <dl className="compact-expanded-info">
              <div>
                <dt>Séance</dt>
                <dd>{date(day)}</dd>
              </div>
              <div>
                <dt>Montant versé</dt>
                <dd>{money(session.total_amount)}</dd>
              </div>
              <div>
                <dt>Montant attendu</dt>
                <dd>
                  {session.expected_amount === undefined
                    ? 'Non disponible'
                    : money(session.expected_amount)}
                </dd>
              </div>
            </dl>
            {session.members && (
              <div className="session-member-filter">
                <label htmlFor={`session-member-${day}`}>Rechercher un membre</label>
                <div className="session-member-search">
                  <Search size={18} aria-hidden="true" />
                  <input
                    id={`session-member-${day}`}
                    type="search"
                    placeholder="Nom du membre"
                    maxLength={120}
                    aria-label={`Rechercher un membre dans la séance du ${date(day)}`}
                    value={query}
                    onChange={(e) =>
                      setQueries((current) => ({ ...current, [day]: e.target.value }))
                    }
                  />
                  {query && (
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="Effacer la recherche de cette séance"
                      onClick={() => setQueries((current) => ({ ...current, [day]: '' }))}
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
                <MemberStateFilter
                  label={`État de cotisation dans la séance du ${date(day)}`}
                  value={state}
                  onChange={(v) => {
                    setStates((current) => ({ ...current, [day]: v }));
                    setExpanded((current) => ({ ...current, [day]: false }));
                  }}
                />
                {(searching || state !== 'all') && (
                  <p role="status">{filtered.length} membre(s) trouvé(s)</p>
                )}
              </div>
            )}
            <AttendanceList members={displayed} day={day} />
            {session.members && !displayed.length && (
              <p className="session-search-empty">
                Aucun membre ne correspond à ces critères dans cette séance.
              </p>
            )}
            {!searching && (filtered.length > 5 || expanded[day]) && (
              <button
                type="button"
                className="session-more-link"
                aria-expanded={!!expanded[day]}
                onClick={() => setExpanded((current) => ({ ...current, [day]: !current[day] }))}
              >
                {expanded[day] ? 'Voir moins' : 'Voir plus'}
              </button>
            )}
            {!session.members && <p>Détail des participantes indisponible.</p>}
          </details>
        );
      })}
      {sorted.length > 5 && (
        <div className="session-pagination">
          <span className="muted" role="status">
            {Math.min(visibleCount, sorted.length)} séances sur {sorted.length}
          </span>
          {visibleCount < sorted.length && (
            <button
              type="button"
              className="session-more-link"
              aria-label="Voir plus de séances"
              onClick={() => setVisibleCount((count) => count + 5)}
            >
              Voir plus <ChevronDown size={16} aria-hidden="true" />
            </button>
          )}
          {visibleCount > 5 && (
            <button
              type="button"
              className="session-more-link"
              aria-label="Voir moins de séances"
              onClick={() => setVisibleCount(5)}
            >
              Voir moins
            </button>
          )}
        </div>
      )}
    </section>
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

function WaveChiffresView({
  totalAmount,
  contributionsCount,
  campaignName,
  onBack,
}: {
  totalAmount: string | number;
  contributionsCount: number;
  campaignName: string;
  onBack: () => void;
}) {
  return (
    <div className="wave-chiffres-screen">
      <div className="wave-top-header">
        <button type="button" className="wave-header-btn" aria-label="Retour" onClick={onBack}>
          <ArrowLeft size={20} />
        </button>
        <span className="wave-header-title">Chiffres de la campagne</span>
      </div>
      <p>{campaignName} · Depuis le début de la campagne</p>
      <div className="wave-balance-hero">
        <span className="wave-balance-eyebrow">Total des cotisations enregistrées</span>
        <span className="wave-balance-amount">{money(totalAmount)}</span>
      </div>
      <div className="wave-summary-card">
        <p>
          {contributionsCount} versement{contributionsCount > 1 ? 's' : ''} valide
          {contributionsCount > 1 ? 's' : ''}
        </p>
        <p>Ce total ne représente pas le solde disponible après les reversements.</p>
      </div>
    </div>
  );
}

function WaveSettingsView({
  groupId,
  announceVoice,
  onToggleVoice,
  actorLogin,
  actorName,
  groupPhone,
  onOpenQr,
  onGoCampaigns,
  onGoMembers,
  onGoArchives,
  onLogout,
  onBack,
}: {
  groupId: string;
  announceVoice: boolean;
  onToggleVoice: () => void;
  actorLogin: string;
  actorName: string;
  groupPhone?: string;
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
        <button type="button" className="wave-header-btn" aria-label="Retour" onClick={onBack}>
          <ArrowLeft size={20} />
        </button>
        <span className="wave-header-title">Paramètres</span>
        <div style={{ width: 42 }} />
      </div>

      <div className="wave-settings-group">
        <AppearanceSettings />
        {groupId && <PlatformColors />}
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
                aria-label="Annoncer les paiements"
                checked={announceVoice}
                onChange={onToggleVoice}
              />
              <span className="wave-switch-slider" />
            </label>
          </div>
          <div className="wave-settings-hint">
            Pour entendre les paiements à voix haute, activez les notifications, désactivez le mode
            silencieux et augmentez le volume.
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
            <ChevronRight size={18} color="var(--text-secondary, #94a3b8)" />
          </button>
          <button type="button" className="wave-settings-row" onClick={onGoCampaigns}>
            <div className="wave-settings-row-left">
              <span className="wave-settings-row-icon">
                <FolderHeart size={19} />
              </span>
              <span>Gérer les campagnes & forfaits</span>
            </div>
            <ChevronRight size={18} color="var(--text-secondary, #94a3b8)" />
          </button>
          <button type="button" className="wave-settings-row" onClick={onGoMembers}>
            <div className="wave-settings-row-left">
              <span className="wave-settings-row-icon">
                <Users size={19} />
              </span>
              <span>Documents & Liste des membres</span>
            </div>
            <ChevronRight size={18} color="var(--text-secondary, #94a3b8)" />
          </button>
          <button type="button" className="wave-settings-row" onClick={onGoArchives}>
            <div className="wave-settings-row-left">
              <span className="wave-settings-row-icon">
                <Archive size={19} />
              </span>
              <span>Archives & Clôtures</span>
            </div>
            <ChevronRight size={18} color="var(--text-secondary, #94a3b8)" />
          </button>
        </div>
      </div>

      <section className="member-info-card pwa-settings-identity">
        <h2>Mon compte</h2>
        <strong>{actorName}</strong>
        <p>Identifiant : {actorLogin}</p>
        <p>Pour vos accès et vos informations, contactez la responsable de votre groupement.</p>
        {groupPhone && (
          <a className="secondary" href={`tel:${groupPhone}`}>
            <Phone size={18} />
            {groupPhone}
          </a>
        )}
      </section>
      <div className="wave-settings-group">
        <div className="wave-settings-card">
          <button
            type="button"
            className="wave-settings-row"
            onClick={onLogout}
            style={{ color: 'var(--danger-text, #dc2626)' }}
          >
            <div className="wave-settings-row-left">
              <span
                className="wave-settings-row-icon"
                style={{ color: 'var(--danger-text, #dc2626)' }}
              >
                <LogOut size={19} />
              </span>
              <div>
                <strong>Se déconnecter</strong>
                <div style={{ fontSize: 12, color: 'var(--text-secondary, #64748b)' }}>
                  ({actorLogin})
                </div>
              </div>
            </div>
            <ChevronRight size={18} color="var(--text-secondary, #94a3b8)" />
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

function Login(props: { portal: 'super' | 'member'; onLogin: (a: Actor) => void }) {
  return props.portal === 'member' ? (
    <PwaLogin onLogin={props.onLogin} />
  ) : (
    <LegacyLogin {...props} />
  );
}

function LegacyLogin({
  portal,
  onLogin,
}: {
  portal: 'super' | 'member';
  onLogin: (a: Actor) => void;
}) {
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
            💡 Cliquez sur <strong>« Remplir »</strong> pour renseigner automatiquement le
            formulaire sans saisie manuelle.
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
                      {copiedKey === 'superadmin-login' ? (
                        <Check size={12} color="var(--positive-text, #1c4b28)" />
                      ) : (
                        <Copy size={12} />
                      )}
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
                      {copiedKey === 'superadmin-phone' ? (
                        <Check size={12} color="var(--positive-text, #1c4b28)" />
                      ) : (
                        <Copy size={12} />
                      )}
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
                        {copiedKey === 'admin-ndeye-login' ? (
                          <Check size={12} color="var(--positive-text, #1c4b28)" />
                        ) : (
                          <Copy size={12} />
                        )}
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
                        {copiedKey === 'admin-ndeye-phone' ? (
                          <Check size={12} color="var(--positive-text, #1c4b28)" />
                        ) : (
                          <Copy size={12} />
                        )}
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
                        {copiedKey === 'membre-awa-login' ? (
                          <Check size={12} color="var(--positive-text, #1c4b28)" />
                        ) : (
                          <Copy size={12} />
                        )}
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
                        {copiedKey === 'membre-awa-phone' ? (
                          <Check size={12} color="var(--positive-text, #1c4b28)" />
                        ) : (
                          <Copy size={12} />
                        )}
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
                {copiedKey === 'password-val' ? (
                  <Check size={13} color="var(--positive-text, #1c4b28)" />
                ) : (
                  <Copy size={13} />
                )}
              </button>
            </div>
            {copiedKey === 'password-val' && (
              <span
                style={{ fontSize: 10, color: 'var(--positive-text, #1c4b28)', fontWeight: 600 }}
              >
                Copié !
              </span>
            )}
          </div>

          <div className="login-demo-footer">
            {portal === 'super' ? (
              <span>
                💡 Vous souhaitez tester l’espace membre ou groupement ? Rendez-vous sur la{' '}
                <strong>PWA Membre</strong> (port 8086 ou 5174) avec les comptes{' '}
                <code>admin.ndeye</code> ou <code>membre.awa</code>.
              </span>
            ) : (
              <span>
                💡 Vous êtes Super Administrateur ? Rendez-vous sur la{' '}
                <strong>Console Super Admin</strong> (port 8085 ou 5173) avec le compte{' '}
                <code>superadmin</code>.
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

type AppProps = {
  portal: 'super' | 'member';
  onUpdateSafetyChange?: (safe: boolean) => void;
};

export function App(props: AppProps) {
  return (
    <PaletteProvider>
      {props.portal === 'member' ? (
        <AppearanceProvider>
          <PwaFeedbackProvider>
            <PwaSecurity>
              <AppContent {...props} />
            </PwaSecurity>
          </PwaFeedbackProvider>
        </AppearanceProvider>
      ) : (
        <AppContent {...props} />
      )}
    </PaletteProvider>
  );
}

function AppContent({ portal, onUpdateSafetyChange }: AppProps) {
  const receiptFocus = useRef<HTMLElement | null>(null);
  const security = usePwaSecurity();
  const feedback = usePwaFeedback();
  const [actor, setActor] = useState<Actor | null>(null);
  const [checking, setChecking] = useState(true);
  const [sessionError, setSessionError] = useState(false);
  const [sessionAttempt, setSessionAttempt] = useState(0);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupTotal, setGroupTotal] = useState(0);
  const [groupPage, setGroupPage] = useState(1);
  const [groupId, setGroupId] = useState('');
  useGroupPalette(portal === 'member' ? groupId : null);
  const [tab, setTab] = useState('overview');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [groupCampaigns, setGroupCampaigns] = useState<{ groupId: string; items: Campaign[] }>({
    groupId: '',
    items: [],
  });
  const [campaignTotal, setCampaignTotal] = useState(0);
  const [campaignId, setCampaignId] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [memberTotal, setMemberTotal] = useState(0);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [participantTotal, setParticipantTotal] = useState(0);
  const [memberOptions, setMemberOptions] = useState<S['EligibleMemberView'][]>([]);
  const [eligibleQuery, setEligibleQuery] = useState('');
  const [eligibleLoading, setEligibleLoading] = useState(false);
  const [eligibleError, setEligibleError] = useState('');
  const [eligibleChoice, setEligibleChoice] = useState('');
  const [freeContribution, setFreeContribution] = useState(false);
  const [shortcutPrefs, setShortcutPrefs] = useState<{ groupId: string; ids: string[] }>({
    groupId: '',
    ids: [],
  });
  const [shortcutLoading, setShortcutLoading] = useState(true);
  const [shortcutSaving, setShortcutSaving] = useState(false);
  const [shortcutError, setShortcutError] = useState('');
  const [optionTotal, setOptionTotal] = useState(0);
  const [optionPage, setOptionPage] = useState(1);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [contributionTotal, setContributionTotal] = useState(0);
  const [dashboard, setDashboard] = useState<S['DashboardView'] | null>(null);
  const [types, setTypes] = useState<S['TypeView'][]>([]);
  const [functions, setFunctions] = useState<GroupFunction[]>([]);
  const [events, setEvents] = useState<CampaignEvent[]>([]);
  const [cashbox, setCashbox] = useState<CashboxState | null>(null);
  const [savingsStatus, setSavingsStatus] = useState<
    (S['SavingsSessionStatusView'] & { campaignId: string }) | null
  >(null);
  const [sessions, setSessions] = useState<CampaignSession[]>([]);
  const [sessionsError, setSessionsError] = useState('');
  const [savingsStatusError, setSavingsStatusError] = useState('');
  const [tontineStatusError, setTontineStatusError] = useState('');
  const [tontineRounds, setTontineRounds] = useState<TontineRound[]>([]);
  const [gracePeriods, setGracePeriods] = useState<GracePeriod[]>([]);
  const [superCockpit, setSuperCockpit] = useState<SuperDashboard | null>(null);
  const [qrModal, setQrModal] = useState<{ title: string; subtitle?: string; data: string } | null>(
    null,
  );
  const [resetPinMember, setResetPinMember] = useState<{ id: string; name: string } | null>(null);
  const [graceMemberId, setGraceMemberId] = useState('');
  const [editEvent, setEditEvent] = useState<CampaignEvent | null>(null);
  const [editType, setEditType] = useState<S['TypeView'] | null>(null);
  const [groupSearch, setGroupSearch] = useState('');
  const [groupDropdownOpen, setGroupDropdownOpen] = useState(false);
  const [groupDetailsOpen, setGroupDetailsOpen] = useState(false);
  const [campaignTypeId, setCampaignTypeId] = useState('');
  const [campaignFrequency, setCampaignFrequency] = useState('');
  const [campaignListType, setCampaignListType] = useState('');
  const [showUnselectedCampaigns, setShowUnselectedCampaigns] = useState(false);
  const [campaignListPage, setCampaignListPage] = useState(1);
  const [campaignDetailTab, setCampaignDetailTab] = useState<'participants' | 'sessions'>(
    'participants',
  );
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
  const [campaignMore, setCampaignMore] = useState(false);
  const [roundGraceEditing, setRoundGraceEditing] = useState(false);
  const [voidId, setVoidId] = useState('');
  const [notice, setNoticeState] = useState('');
  const setNotice = useCallback(
    (message: string) => {
      if (portal === 'member') feedback.notify(message);
      else setNoticeState(message);
    },
    [portal, feedback.notify],
  );
  const [actionError, setActionError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(navigator.onLine && !security?.offline);
  useEffect(() => {
    if (security) setOnline(navigator.onLine && !security.offline);
  }, [security?.offline]);
  const [update, setUpdate] = useState(false);
  const idempotency = useRef(crypto.randomUUID());
  const [personalMode, setPersonalMode] = useState(false);
  const [mobileLayout, setMobileLayout] = useState(
    () => window.matchMedia('(max-width: 760px)').matches,
  );
  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)');
    const changed = () => setMobileLayout(media.matches);
    media.addEventListener('change', changed);
    return () => media.removeEventListener('change', changed);
  }, []);

  // Wave UX / UI States
  const [showBalance, setShowBalance] = useMoneyVisibility();
  const [adminSubView, setAdminSubView] = useState<'dashboard' | 'chiffres' | 'settings'>(
    'dashboard',
  );
  usePwaNavigation({ tab, personalMode, adminSubView }, portal === 'member' && !!actor, (page) => {
    setTab(page.tab);
    setPersonalMode(page.personalMode);
    setAdminSubView(page.adminSubView);
  });
  const [announceVoice, setAnnounceVoice] = useState(true);
  const [memberQuery, setMemberQuery] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyQuery, setHistoryQuery] = useState('');
  const [historyDate, setHistoryDate] = useState('');
  const [historyFrom, setHistoryFrom] = useState('');
  const [historyTo, setHistoryTo] = useState('');
  const [historyStatus, setHistoryStatus] = useState<'' | 'valid' | 'voided'>('');
  const [scanning, setScanning] = useState(false);
  const [scannedPayer, setScannedPayer] = useState<Participant | null>(null);
  const [payerQuery, setPayerQuery] = useState('');
  const [payerPage, setPayerPage] = useState(1);
  const [payerOptions, setPayerOptions] = useState<Participant[]>([]);
  const [payerTotal, setPayerTotal] = useState(0);
  const [payerLoading, setPayerLoading] = useState(false);
  const [payerId, setPayerId] = useState('');
  const [contributionReview, setContributionReview] = useState<{
    participationId: string;
    name: string;
    amount: number;
    paidOn: string;
  } | null>(null);
  const actionInFlight = useRef(false);
  const [keypadAmount, setKeypadAmount] = useState('');

  useEffect(() => {
    // Login, dialogs and asynchronous mutations must finish before a reload.
    onUpdateSafetyChange?.(
      !!actor &&
        !checking &&
        !loading &&
        !busy &&
        !dialog &&
        !resetPinMember &&
        !editEvent &&
        !editType &&
        !qrModal &&
        !campaignMore &&
        !roundGraceEditing &&
        !shortcutSaving &&
        !security?.busy,
    );
    return () => onUpdateSafetyChange?.(false);
  }, [
    actor,
    checking,
    loading,
    busy,
    dialog,
    resetPinMember,
    editEvent,
    editType,
    qrModal,
    campaignMore,
    roundGraceEditing,
    shortcutSaving,
    onUpdateSafetyChange,
    security?.busy,
  ]);

  const group = groups.find((g) => g.id === groupId);
  const admin = group?.my_role === 'ADMIN';
  const superAdmin = actor?.isSuper && portal === 'super';
  const availableCampaigns = groupCampaigns.groupId === groupId ? groupCampaigns.items : [];
  const availableActiveCampaigns = availableCampaigns.filter((c) => c.active !== false);
  const shortcutIds = shortcutPrefs.groupId === groupId ? shortcutPrefs.ids : [];
  const shortcutCampaigns = availableActiveCampaigns.filter((c) => shortcutIds.includes(c.id));
  const extraCampaigns = availableActiveCampaigns.filter((c) => !shortcutIds.includes(c.id));
  const campaign = availableCampaigns.find((c) => c.id === campaignId);
  const canManage = admin && !personalMode;
  const memberView = !superAdmin && (!admin || personalMode);

  const activeGroups = groups.filter((g) => g.active !== false);
  const archivedGroups = groups.filter((g) => g.active === false);
  const activeCampaigns = campaigns.filter((c) => c.active !== false);
  const archivedCampaigns = campaigns.filter((c) => !c.active);

  const campaignTypeKey = (c: Campaign) => c.type_code || c.type_name || 'Autre';
  const campaignListTypes = [
    ...new Map(
      availableActiveCampaigns.map((c) => [campaignTypeKey(c), c.type_name || 'Autre']),
    ).entries(),
  ];
  const typeCampaigns = availableActiveCampaigns.filter(
    (c) => !campaignListType || campaignTypeKey(c) === campaignListType,
  );
  const hiddenCampaignCount = typeCampaigns.filter((c) => !shortcutIds.includes(c.id)).length;
  const filteredCampaignCards = typeCampaigns.filter(
    (c) => showUnselectedCampaigns || shortcutIds.includes(c.id),
  );
  const visibleCampaignCards = filteredCampaignCards.slice(
    (campaignListPage - 1) * 25,
    campaignListPage * 25,
  );
  useEffect(() => {
    setCampaignListType('');
    setShowUnselectedCampaigns(false);
    setCampaignListPage(1);
  }, [groupId]);
  const isSavingsCampaign = /avec|épargne|epargne/i.test(campaign?.type_name || '');
  const isTontineCampaign = !!campaign?.type_name?.toLowerCase().includes('tontine');

  useEffect(() => {
    if (!actor || !groupId || !admin || superAdmin) return;
    let active = true;
    setShortcutLoading(true);
    setShortcutError('');
    api
      .GET('/api/v1/groupements/{groupId}/campaigns/shortcuts', { params: { path: { groupId } } })
      .then(unwrap)
      .then((result) => {
        if (active) setShortcutPrefs({ groupId, ids: result.campaignIds });
      })
      .catch((e) => {
        if (active) setShortcutError(e.message);
      })
      .finally(() => {
        if (active) setShortcutLoading(false);
      });
    return () => {
      active = false;
    };
  }, [actor?.id, groupId, admin, superAdmin, refresh]);
  async function toggleShortcut(id: string, checked: boolean) {
    if (shortcutSaving || shortcutLoading || !online) return;
    const ids = shortcutIds.filter((id) => availableActiveCampaigns.some((c) => c.id === id));
    const next = checked ? [...ids, id] : ids.filter((value) => value !== id);
    if (next.length > 6) {
      setShortcutError('Six raccourcis maximum. Retirez une campagne pour en choisir une autre.');
      return;
    }
    setShortcutSaving(true);
    setShortcutError('');
    setShortcutPrefs({ groupId, ids: next });
    try {
      const result = await api
        .PUT('/api/v1/groupements/{groupId}/campaigns/shortcuts', {
          params: { path: { groupId } },
          body: { campaignIds: next },
        })
        .then(unwrap);
      setShortcutPrefs({ groupId, ids: result.campaignIds });
      feedback.notify(
        checked ? 'Campagne ajoutée à l’accueil.' : 'Campagne retirée de l’accueil.',
        'success',
      );
    } catch (e) {
      setShortcutPrefs({ groupId, ids });
      setShortcutError((e as Error).message);
      feedback.notify((e as Error).message, 'error');
    } finally {
      setShortcutSaving(false);
    }
  }
  const currentPayer = payerOptions.find((p) => p.id === payerId);
  const fixedPayment = !!currentPayer?.forfait && !currentPayer.is_random;

  useEffect(() => {
    if (dialog === 'participant')
      setFreeContribution(!campaign?.standard_amount && !isTontineCampaign);
  }, [dialog, campaignId, campaign?.standard_amount, isTontineCampaign]);
  const [tontineStatus, setTontineStatus] = useState<
    (S['TontineStatusView'] & { campaignId: string }) | null
  >(null);
  const tontineReady = tontineStatus?.campaignId === campaignId && tontineStatus.can_collect;
  useEffect(() => {
    if (!actor || !groupId || !campaignId || !isTontineCampaign) {
      setTontineStatus(null);
      return;
    }
    let active = true;
    setTontineStatus(null);
    setTontineStatusError('');
    const check = () =>
      api
        .GET('/api/v1/groupements/{groupId}/campaigns/{id}/tontine/status', {
          params: { path: { groupId, id: campaignId } },
        })
        .then(unwrap)
        .then((result) => {
          if (active) {
            setTontineStatus({ ...result, campaignId });
            setTontineStatusError('');
          }
        })
        .catch((e) => {
          if (active) {
            setTontineStatus(null);
            setTontineStatusError(e.message);
          }
        });
    void check();
    const timer = window.setInterval(check, 60000);
    window.addEventListener('focus', check);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', check);
    };
  }, [actor, groupId, campaignId, isTontineCampaign, refresh]);

  const savingsReady = savingsStatus?.campaignId === campaignId && savingsStatus.can_collect;
  useEffect(() => {
    if (!actor || !groupId || !campaignId || !isSavingsCampaign) {
      setSavingsStatus(null);
      return;
    }
    let active = true;
    setSavingsStatus(null);
    setSavingsStatusError('');
    const update = () =>
      api
        .GET('/api/v1/groupements/{groupId}/campaigns/{id}/savings-session', {
          params: { path: { groupId, id: campaignId } },
        })
        .then(unwrap)
        .then((status) => {
          if (active) {
            setSavingsStatus({ ...status, campaignId });
            setSavingsStatusError('');
          }
        })
        .catch((e) => {
          if (active) {
            setSavingsStatus(null);
            setSavingsStatusError(e.message);
          }
        });
    void update();
    const timer = window.setInterval(update, 60000);
    window.addEventListener('focus', update);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', update);
    };
  }, [actor, groupId, campaignId, isSavingsCampaign, refresh]);

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
  const filteredContributions = contributions;

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
    let active = true;
    setChecking(true);
    setSessionError(false);
    api
      .GET('/api/v1/auth/me')
      .then((r) => {
        if (!active) return;
        if (r.response.ok) setActor(r.data || null);
        else if (r.response.status !== 401) setSessionError(true);
      })
      .catch(() => {
        if (active) setSessionError(true);
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [sessionAttempt]);

  useEffect(() => {
    const on = () => setOnline(true),
      off = () => setOnline(false),
      u = () => setUpdate(true);
    const state = (e: Event) => setOnline(!(e as CustomEvent).detail.offline);
    const reload = () => setRefresh((n) => n + 1);
    window.addEventListener('alf:network', state);
    window.addEventListener('alf:refresh', reload);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    window.addEventListener('pwa-update', u);
    return () => {
      window.removeEventListener('alf:network', state);
      window.removeEventListener('alf:refresh', reload);
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      window.removeEventListener('pwa-update', u);
    };
  }, []);

  useEffect(() => {
    if (!sessionError) return;
    const retry = () => setSessionAttempt((n) => n + 1);
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [sessionError]);

  useEffect(() => {
    if (!dialog && !busy && !resetPinMember && !editEvent && !editType) return;
    const protectDraft = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', protectDraft);
    return () => window.removeEventListener('beforeunload', protectDraft);
  }, [dialog, busy, resetPinMember, editEvent, editType]);

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
              : (!superAdmin ? activeItems.find((x) => x.my_role === 'ADMIN')?.id : undefined) ||
                activeItems[0]?.id ||
                g.items[0]?.id ||
                '';
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
      .then(async (r) => {
        const all = [...r.items];
        // Include campaigns beyond the current management page in the home selector.
        for (let page = 1; page <= Math.ceil(r.total / 25); page++) {
          if (!active) return;
          if (page === campaignPage) continue;
          const result = await api
            .GET('/api/v1/groupements/{groupId}/campaigns', {
              params: { path: { groupId }, query: { page, limit: 25 } },
            })
            .then(unwrap);
          all.push(...result.items);
        }
        if (active) {
          setCampaigns(r.items);
          setCampaignTotal(r.total);
          setGroupCampaigns({ groupId, items: all });
          setCampaignId((id) => {
            const activeItems = all.filter((c) => c.active !== false);
            const savings = activeItems.find((c) => {
              const type = (c.type_name || '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase();
              return /\bavec\b|epargne/.test(type);
            });
            return all.some((c) => c.id === id) ? id : savings?.id || activeItems[0]?.id || '';
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
          query: {
            page,
            limit: 25,
            scope: personalMode ? 'personal' : 'group',
            q: memberView ? undefined : memberQuery,
          },
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
  }, [actor, groupId, page, refresh, personalMode, memberView, memberQuery]);

  useEffect(() => {
    if (dialog !== 'participant' || !groupId || !campaignId) return;
    let active = true;
    setEligibleLoading(true);
    setEligibleError('');
    setMemberOptions([]);
    setOptionTotal(0);
    api
      .GET('/api/v1/groupements/{groupId}/campaigns/{id}/eligible-members', {
        params: {
          path: { groupId, id: campaignId },
          query: { page: optionPage, limit: 25, q: eligibleQuery },
        },
      })
      .then(unwrap)
      .then((result) => {
        if (active) {
          setMemberOptions(result.items);
          setOptionTotal(result.total);
        }
      })
      .catch((e) => {
        if (active) setEligibleError(e.message);
      })
      .finally(() => {
        if (active) setEligibleLoading(false);
      });
    return () => {
      active = false;
    };
  }, [dialog, groupId, campaignId, optionPage, eligibleQuery]);

  useEffect(() => {
    if (memberView) return;
    if (!actor || !groupId || !campaignId) {
      setHistoryLoading(false);
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
    setHistoryLoading(true);
    setLoadError('');
    setDashboard(null);
    setCashbox(null);
    setContributions([]);
    setParticipants([]);
    setSessions([]);
    setSessionsError('');
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
            query: {
              page,
              limit: 25,
              scope: personalMode ? 'personal' : 'group',
              sort: memberView ? 'date' : contributionSort,
              q: memberView ? undefined : historyQuery,
              paidOn: memberView ? undefined : historyDate || undefined,
              from: memberView ? undefined : historyFrom || undefined,
              to: memberView ? undefined : historyTo || undefined,
              status: memberView ? undefined : historyStatus || undefined,
            },
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
        .catch((e) => {
          if (active) setSessionsError(e.message);
          return [];
        }),
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
          setCashbox(cb);
          if (sess) setSessions(sess);
          if (tr) setTontineRounds(tr);
          if (gp) setGracePeriods(gp);
        }
      })
      .catch((e) => active && setLoadError(e.message))
      .finally(() => {
        if (active) setHistoryLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    actor,
    groupId,
    campaignId,
    page,
    participantPage,
    refresh,
    personalMode,
    contributionSort,
    memberView,
    historyQuery,
    historyDate,
    historyFrom,
    historyTo,
    historyStatus,
  ]);

  useEffect(() => {
    if (dialog !== 'contribution' || !groupId || !campaignId) return;
    let active = true;
    setPayerLoading(true);
    setPayerOptions([]);
    const timer = setTimeout(() => {
      api
        .GET('/api/v1/groupements/{groupId}/campaigns/{id}/participants', {
          params: {
            path: { groupId, id: campaignId },
            query: { page: payerPage, limit: 25, q: payerQuery, scope: 'group' },
          },
        })
        .then(unwrap)
        .then((r) => {
          if (active) {
            setPayerOptions(
              scannedPayer
                ? [scannedPayer, ...r.items.filter((p) => p.id !== scannedPayer.id)]
                : r.items,
            );
            setPayerTotal(r.total);
          }
        })
        .catch((error) => {
          if (active) setActionError(error.message);
        })
        .finally(() => {
          if (active) setPayerLoading(false);
        });
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [dialog, groupId, campaignId, payerQuery, payerPage, scannedPayer]);

  const resetFilters = useCallback(() => {
    setHistoryQuery('');
    setHistoryDate('');
    setHistoryFrom('');
    setHistoryTo('');
    setHistoryStatus('');
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

  function drawCurrentTontine() {
    return action(async () => {
      await api
        .POST('/api/v1/groupements/{groupId}/campaigns/{id}/tontine/draw', {
          params: { path: { groupId, id: campaignId } },
        })
        .then(unwrap);
      const status = await api
        .GET('/api/v1/groupements/{groupId}/campaigns/{id}/tontine/status', {
          params: { path: { groupId, id: campaignId } },
        })
        .then(unwrap);
      setTontineStatus({ ...status, campaignId });
    }, 'Bénéficiaire du tour désignée. Vous pouvez encaisser.');
  }
  function open(name: string) {
    if (name === 'contribution' && isTontineCampaign && !tontineReady) {
      setNotice('Effectuez le tirage du tour avant d’encaisser.');
      return;
    }
    if (name === 'contribution' && isSavingsCampaign && !savingsReady) {
      setNotice('Ouvrez la séance le jour prévu avant d’encaisser une épargne.');
      return;
    }
    setActionError('');
    idempotency.current = crypto.randomUUID();
    setOptionPage(1);
    if (name === 'participant') {
      setEligibleQuery('');
      setEligibleChoice('');
      setFreeContribution(!campaign?.standard_amount && !isTontineCampaign);
      setMemberOptions([]);
      setEligibleError('');
    }
    if (name === 'campaign') {
      setCampaignTypeId(types[0]?.id || '');
      setCampaignFrequency('');
    }
    if (name === 'contribution') {
      receiptFocus.current = document.activeElement as HTMLElement | null;
      setKeypadAmount('');
      setScannedPayer(null);
      setPayerQuery('');
      setPayerPage(1);
      setPayerId('');
      setContributionReview(null);
    }
    setDialog(name);
  }

  async function action(task: () => Promise<unknown>, message: string) {
    if (actionInFlight.current) return false;
    if (!navigator.onLine && !security) {
      setActionError(
        'Vous êtes hors connexion. Gardez cette fenêtre ouverte puis confirmez au retour du réseau. Aucun envoi automatique ne sera effectué.',
      );
      return false;
    }
    actionInFlight.current = true;
    setActionError('');
    setBusy(true);
    try {
      return await confirmedAction(
        task,
        () => {
          if (portal === 'member') feedback.notify(message, 'success');
          else setNotice(message);
          setDialog('');
          setResetPinMember(null);
          setRefresh((n) => n + 1);
        },
        (error) => {
          const message =
            error instanceof TypeError
              ? 'Connexion interrompue : enregistrement non confirmé. Gardez cette fenêtre ouverte et réessayez la même saisie au retour du réseau ; la protection contre les doublons reste active.'
              : error instanceof Error
                ? error.message
                : 'Enregistrement non confirmé. Vérifiez avant de réessayer.';
          setActionError(message);
          if (portal === 'member')
            feedback.notify(
              message,
              /Saisie conservée|Confirmation annulée/.test(message) ? 'info' : 'error',
            );
          else setNotice(message);
        },
      );
    } finally {
      actionInFlight.current = false;
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
                startDate: isRotative ? v.startDate || todayStr : v.startDate,
                endDate: isRotative ? v.endDate || nextYearStr : v.endDate,
                weekday: isRotative ? (v.weekday ? Number(v.weekday) : 2) : Number(v.weekday || 2),
                intervalWeeks: isRotative
                  ? v.intervalWeeks
                    ? Number(v.intervalWeeks)
                    : 1
                  : Number(v.intervalWeeks || 1),
                isMandatory: v.isMandatory === 'on',
                eventId: v.eventId || undefined,
                standardAmount: v.standardAmount ? Number(v.standardAmount) : undefined,
                rotationInterval:
                  v.rotationInterval === 'MONTHLY'
                    ? 'MONTHLY'
                    : isRotative
                      ? (v.rotationInterval as 'WEEKLY' | 'BIWEEKLY') || 'MONTHLY'
                      : undefined,
                monthlyWeek:
                  v.rotationInterval === 'MONTHLY' && v.monthlyWeek
                    ? Number(v.monthlyWeek)
                    : undefined,
                dueDay: isRotative && v.dueDay ? Number(v.dueDay) : undefined,
              },
            })
            .then(unwrap),
        'Campagne créée. Ajoutez maintenant ses participantes.',
      );
    }

    if (dialog === 'participant') {
      if (
        eligibleLoading ||
        !eligibleChoice ||
        !memberOptions.some((m) => m.id === eligibleChoice)
      ) {
        setActionError('Choisissez un membre non inscrit dans les résultats.');
        return;
      }
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
        'Membre ajouté à la campagne.',
      );
    }

    if (dialog === 'contribution') {
      if (!contributionReview) {
        const selected = payerOptions.find((p) => p.id === v.participationId);
        if (!selected || payerLoading) {
          setActionError('Choisissez une participante dans les résultats.');
          return;
        }
        setContributionReview({
          participationId: selected.id,
          name: selected.name,
          amount: Number(v.amount),
          paidOn: v.paidOn,
        });
        setActionError('');
        return;
      }
      const pId = contributionReview.participationId;
      const participantName = contributionReview.name;
      const contribAmount = contributionReview.amount;
      let recorded: Contribution | null = null;
      const saved = await action(async () => {
        recorded = await api
          .POST('/api/v1/groupements/{groupId}/campaigns/{campaignId}/contributions', {
            params: { path: { groupId, campaignId } },
            body: {
              participationId: pId,
              amount: contribAmount,
              paidOn: contributionReview.paidOn,
              idempotencyKey: idempotency.current,
            },
          })
          .then(unwrap);
      }, 'Cotisation enregistrée.');
      if (saved && recorded && portal === 'member')
        feedback.showReceipt({
          contribution: recorded,
          returnFocus: receiptFocus.current,
          member: participantName,
          campaign: campaign?.name || 'Campagne',
          group: group?.name,
          type: campaign?.type_name || '',
        });
      if (saved && announceVoice && typeof window !== 'undefined' && 'speechSynthesis' in window) {
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
              body: {},
            })
            .then(unwrap),
        'Code révoqué. La membre doit se reconnecter avec son mot de passe initial.',
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

  if (!actor && sessionError)
    return (
      <div className="splash">
        <Brand />
        <p role="alert">Connexion au serveur impossible. Votre session n’a pas pu être vérifiée.</p>
        <button className="primary" onClick={() => setSessionAttempt((n) => n + 1)}>
          Réessayer la connexion
        </button>
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
    tab === 'history'
      ? 'Historique des cotisations'
      : tab === 'more'
        ? 'Gestion du groupement'
        : memberView
          ? tab === 'campaigns'
            ? 'Mes campagnes'
            : tab === 'payments'
              ? 'Mes versements'
              : tab === 'more'
                ? 'Gestion du groupement'
                : tab === 'members'
                  ? 'Mon compte'
                  : 'Mon groupement'
          : tab === 'members'
            ? 'Les membres'
            : tab === 'campaigns'
              ? 'Les campagnes actives'
              : tab === 'appearance'
                ? 'Apparence de l’application'
                : tab === 'types'
                  ? 'Types de campagne'
                  : tab === 'cockpit'
                    ? 'Cockpit Plateforme 360°'
                    : tab === 'archives'
                      ? 'Archives (Groupements inactifs & Campagnes fermées)'
                      : superAdmin
                        ? 'Vue d’ensemble'
                        : 'Mon groupement';

  return (
    <div className={`app-shell ${superAdmin ? '' : 'pwa-shell pwa-action-layout'}`}>
      <aside className="sidebar">
        <Brand />
        <div className="space-label">
          {superAdmin ? 'PILOTAGE DE LA PLATEFORME' : 'MON GROUPEMENT'}
        </div>
        <nav aria-label="Navigation principale">
          {(memberView
            ? [
                ['overview', 'Accueil', LayoutDashboard],
                ['campaigns', 'Mes campagnes', FolderHeart],
                ['payments', 'Mes versements', Coins],
                ['members', 'Mon compte', Users],
              ]
            : canManage
              ? [
                  ['overview', 'Accueil', LayoutDashboard],
                  ['campaigns', 'Campagnes', FolderHeart],
                  ['members', 'Membres', Users],
                  ['more', 'Plus', Settings],
                ]
              : [
                  ['overview', 'Vue d’ensemble', LayoutDashboard],
                  ['campaigns', 'Campagnes', FolderHeart],
                  ['members', 'Membres', Users],
                  ...(superAdmin
                    ? [
                        ['cockpit', 'Cockpit 360°', Sparkles],
                        ['types', 'Types & Événements', Coins],
                        ['appearance', 'Apparence', Settings],
                      ]
                    : []),
                  ...(superAdmin || admin ? [['archives', 'Archives', Archive]] : []),
                ]
          ).map(([key, label, Icon]) => {
            const I = Icon as typeof Users;
            return (
              <button
                key={key as string}
                aria-label={label as string}
                className={tab === key ? 'nav-item active' : 'nav-item'}
                aria-current={tab === key ? 'page' : undefined}
                onClick={() => {
                  if (key === 'encaisser') {
                    if (campaign?.active) open('contribution');
                    else {
                      setTab('campaigns');
                      setNotice('Sélectionnez une campagne active pour encaisser.');
                    }
                    return;
                  }
                  setTab(key as string);
                  setAdminSubView('dashboard');
                  setPage(1);
                  window.scrollTo({ top: 0 });
                }}
              >
                <I size={19} />
                <span className="nav-label-desktop">{label as string}</span>
                <span className="nav-label-mobile">
                  {key === 'overview'
                    ? 'Accueil'
                    : key === 'members' && !admin
                      ? 'Compte'
                      : memberView && key === 'payments'
                        ? 'Versements'
                        : memberView && key === 'campaigns'
                          ? 'Campagnes'
                          : memberView && key === 'members'
                            ? 'Compte'
                            : (label as string)}
                </span>
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
            {superAdmin &&
              tab !== 'types' &&
              tab !== 'cockpit' &&
              tab !== 'archives' &&
              tab !== 'appearance' && (
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
              Hors connexion : données synchronisées précédemment. Les versements saisis sont
              chiffrés sur cet appareil et restent en attente de validation. Le mode d’envoi au
              retour de la connexion se règle dans « Saisies en attente ».
            </div>
          )}
          {update && (
            <div className="alert">
              Une nouvelle version est disponible. Elle sera appliquée automatiquement dès la fin de
              votre saisie ou de l’opération en cours.
            </div>
          )}
          {notice && (
            <div className="toast" role="status">
              <Info size={18} />
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
          {admin && (tab === 'more' || (personalMode && tab === 'members')) && (
            <div className="view-switch">
              <span>Votre espace</span>
              <button
                aria-label="Gestion du groupement"
                className={!personalMode ? 'selected' : ''}
                onClick={() => {
                  setPersonalMode(false);
                  setTab('overview');
                  setAdminSubView('dashboard');
                  setDashboard(null);
                  setContributions([]);
                  setPage(1);
                }}
              >
                Gestion
              </button>
              <button
                aria-label="Mon épargne personnelle"
                className={personalMode ? 'selected' : ''}
                onClick={() => {
                  setPersonalMode(true);
                  setTab('overview');
                  setAdminSubView('dashboard');
                  setDashboard(null);
                  setContributions([]);
                  setContributionSort('date');
                  setPage(1);
                }}
              >
                Personnel
              </button>
            </div>
          )}
          {tab !== 'appearance' &&
            tab !== 'types' &&
            tab !== 'cockpit' &&
            (superAdmin || (tab !== 'overview' && tab !== 'history')) &&
            (!superAdmin ? (
              <section className="pwa-group-identity" aria-label="Informations du groupement">
                <Users size={22} aria-hidden="true" />
                <div>
                  <strong title={group?.name}>{group?.name || 'Mon groupement'}</strong>
                  <span>
                    {group?.phone || 'Téléphone non renseigné'} · {group?.member_count ?? 0}{' '}
                    membre(s)
                  </span>
                </div>
              </section>
            ) : (
              <section
                className={`group-context ${groupDetailsOpen ? 'expanded' : ''}`}
                aria-label="Contexte du groupement"
              >
                {!superAdmin && (
                  <button
                    className="group-context-toggle"
                    type="button"
                    aria-expanded={groupDetailsOpen}
                    aria-controls="group-context-details"
                    onClick={() => setGroupDetailsOpen(!groupDetailsOpen)}
                  >
                    <Users size={18} />
                    <span>{group?.name || 'Choisir un groupement'}</span>
                    <ChevronDown size={18} />
                  </button>
                )}
                <div id="group-context-details" className="group-context-details">
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
                                    (group &&
                                      groupSearch.trim().toLowerCase() ===
                                        group.name.toLowerCase()) ||
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
                                (group &&
                                  groupSearch.trim().toLowerCase() === group.name.toLowerCase()) ||
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
                          <option value="">
                            {loading ? 'Chargement…' : 'Aucun groupement actif'}
                          </option>
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
                </div>
              </section>
            ))}
          {superAdmin && tab === 'appearance' ? (
            <PlatformColors />
          ) : !groupId &&
            tab !== 'types' &&
            tab !== 'cockpit' &&
            tab !== 'archives' &&
            tab !== 'appearance' &&
            !loading ? (
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
          ) : memberView ? (
            <MemberSpace
              key={groupId}
              tab={tab}
              name={actor.name}
              login={actor.login}
              group={group}
              visible={showBalance}
              onVisibility={() => setShowBalance(!showBalance)}
              onTab={(value) => {
                setTab(value);
                window.scrollTo({ top: 0 });
              }}
              onEditingChange={setRoundGraceEditing}
              onQr={() =>
                setQrModal({
                  title: `Carte Membre · ${actor.name}`,
                  subtitle: `${group?.name} · ${actor.login} · ${group?.phone || ''} · ${group?.address || ''}`,
                  data: `ALF:MEMBER:${groupId}:${actor.id}:${actor.login}`,
                })
              }
              online={online}
            />
          ) : (
            <>
              {tab === 'more' && canManage && (
                <section className="member-card-list" aria-label="Gestion du groupement">
                  <section className="member-info-card">
                    <h2>{actor.name}</h2>
                    <p>Identifiant : {actor.login}</p>
                    <p>{group?.name}</p>
                    <button
                      className="secondary"
                      onClick={() =>
                        setQrModal({
                          title: `Carte Membre · ${actor.name}`,
                          subtitle: `${group?.name} · ${actor.login}`,
                          data: `ALF:MEMBER:${groupId}:${actor.id}:${actor.login}`,
                        })
                      }
                    >
                      <QrCode size={18} />
                      Ma carte de membre
                    </button>
                  </section>
                  <h2>Gérer mon groupement</h2>
                  <button className="secondary" onClick={() => open('member')}>
                    <UserPlus size={18} /> Ajouter un membre
                  </button>
                  <button
                    className="secondary"
                    onClick={() => {
                      setTab('overview');
                      setAdminSubView('chiffres');
                    }}
                  >
                    <BarChart3 size={18} /> Chiffres
                  </button>
                  <button className="secondary" onClick={() => setTab('archives')}>
                    Archives
                  </button>
                  <button
                    className="secondary"
                    onClick={() => {
                      setTab('overview');
                      setAdminSubView('settings');
                    }}
                  >
                    Paramètres du groupement
                  </button>
                  <AppearanceSettings />
                </section>
              )}
              {((tab === 'history' && canManage) || (tab === 'overview' && superAdmin)) && (
                <div
                  className="campaign-information"
                  style={campaignColors(campaign?.type_name || '')}
                >
                  <button type="button" className="secondary" onClick={() => setTab('overview')}>
                    <ArrowLeft size={18} /> Retour à l’accueil
                  </button>
                  {/* Historique des cotisations */}
                  {!superAdmin ? (
                    <section
                      className="collection-history"
                      aria-label="Historique des encaissements"
                    >
                      <h2>
                        {historyDate
                          ? `Séance du ${date(historyDate)}`
                          : 'Historique des encaissements'}
                      </h2>
                      <p className="muted">{campaign?.name}</p>
                      <div className="history-search-row">
                        <Search size={20} />
                        <input
                          aria-label="Rechercher un versement par nom ou téléphone"
                          placeholder="Rechercher une membre"
                          type="search"
                          value={historyQuery}
                          onChange={(e) => {
                            setHistoryQuery(e.target.value);
                            setPage(1);
                          }}
                        />
                        <button
                          type="button"
                          className="text-button"
                          aria-label="Actualiser l’historique"
                          onClick={() => setRefresh((n) => n + 1)}
                        >
                          <RotateCcw size={20} />
                        </button>
                      </div>
                      <label className="sr-only" htmlFor="history-status">
                        État des encaissements
                      </label>
                      <select
                        id="history-status"
                        value={historyStatus}
                        onChange={(e) => {
                          setHistoryStatus(e.target.value as typeof historyStatus);
                          setPage(1);
                        }}
                      >
                        <option value="">Tous les encaissements</option>
                        <option value="valid">Enregistrés</option>
                        <option value="voided">Annulés</option>
                      </select>
                      {!historyDate && (
                        <div className="history-date-range">
                          <Field label="Du">
                            <input
                              type="date"
                              value={historyFrom}
                              max={historyTo || undefined}
                              onChange={(e) => {
                                setHistoryFrom(e.target.value);
                                setPage(1);
                              }}
                            />
                          </Field>
                          <Field label="Au">
                            <input
                              type="date"
                              value={historyTo}
                              min={historyFrom || undefined}
                              onChange={(e) => {
                                setHistoryTo(e.target.value);
                                setPage(1);
                              }}
                            />
                          </Field>
                        </div>
                      )}
                      {(historyDate ||
                        historyFrom ||
                        historyTo ||
                        historyQuery ||
                        historyStatus) && (
                        <button
                          className="text-button"
                          onClick={() => {
                            resetFilters();
                            setPage(1);
                          }}
                        >
                          Effacer les filtres
                        </button>
                      )}
                      <p className="muted" role="status">
                        {historyLoading
                          ? 'Chargement des encaissements…'
                          : `${contributionTotal} encaissement(s)`}
                      </p>
                      {[...new Set(contributions.map((c) => c.paid_on))]
                        .sort((a, b) => b.localeCompare(a))
                        .map((day) => (
                          <section className="history-day" key={day}>
                            <h3>{date(day)}</h3>
                            <ul>
                              {contributions
                                .filter((c) => c.paid_on === day)
                                .map((c) => (
                                  <li key={c.id} className={c.voided_at ? 'history-voided' : ''}>
                                    <div className="history-payment-main">
                                      <strong>{c.name}</strong>
                                      <strong>
                                        {c.voided_at ? '' : '+ '}
                                        {money(c.amount)}
                                      </strong>
                                    </div>
                                    <div className="history-payment-meta">
                                      <span>
                                        {c.voided_at ? 'Annulé' : 'Encaissement enregistré'}
                                      </span>
                                      <time>
                                        {c.created_at
                                          ? new Date(c.created_at).toLocaleTimeString('fr-SN', {
                                              hour: '2-digit',
                                              minute: '2-digit',
                                              timeZone: 'Africa/Dakar',
                                            })
                                          : ''}
                                      </time>
                                    </div>
                                    <small>Réf. {c.reference}</small>
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
                                  </li>
                                ))}
                            </ul>
                          </section>
                        ))}
                      {!historyLoading && !loadError && !contributions.length && (
                        <p className="empty">Aucun encaissement pour ces critères.</p>
                      )}
                      <Pager page={page} total={contributionTotal} onChange={setPage} />
                    </section>
                  ) : (
                    <section className="panel" style={{ marginTop: 20 }}>
                      <div className="section-heading">
                        <div>
                          <h2>
                            {dashboard?.personal ? 'Mes versements' : 'Historique des cotisations'}
                          </h2>
                          <p className="muted">
                            {campaign?.name || 'Aucune campagne sélectionnée'}
                          </p>
                        </div>
                        {canManage && campaign?.active && (
                          <button
                            className="secondary"
                            disabled={(!online && !security?.offlineDrafts) || busy}
                            onClick={(event) => {
                              event.currentTarget.focus();
                              open('contribution');
                            }}
                          >
                            <Plus size={17} />
                            Encaisser
                          </button>
                        )}
                      </div>

                      {dashboard?.personal && (
                        <Field label="Campagne de l’historique">
                          <select
                            value={campaignId}
                            onChange={(e) => {
                              setCampaignId(e.target.value);
                              setPage(1);
                              resetFilters();
                            }}
                          >
                            {activeCampaigns.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                                {c.event_name ? ` · ${c.event_name}` : ''}
                              </option>
                            ))}
                          </select>
                        </Field>
                      )}

                      {!dashboard?.personal && (
                        <div className="form-grid admin-search">
                          <Field label="Rechercher un versement par nom ou téléphone">
                            <input
                              type="search"
                              maxLength={120}
                              value={historyQuery}
                              onChange={(e) => {
                                setHistoryQuery(e.target.value);
                                setPage(1);
                              }}
                            />
                          </Field>
                          <Field label="Date du versement recherchée">
                            <input
                              type="date"
                              value={historyDate}
                              onChange={(e) => {
                                setHistoryDate(e.target.value);
                                setPage(1);
                              }}
                            />
                          </Field>
                          {(historyQuery || historyDate) && (
                            <button
                              className="secondary"
                              onClick={() => {
                                resetFilters();
                                setPage(1);
                              }}
                            >
                              Effacer les filtres
                            </button>
                          )}
                          <p>Recherche dans tout l’historique de la campagne, avant pagination.</p>
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
                          {sortedContributions.length} cotisation
                          {sortedContributions.length > 1 ? 's' : ''}
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
                                      setContributionSort(
                                        contributionSort === 'date' ? 'session' : 'date',
                                      );
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
                                    <td data-label="Date">{date(c.paid_on)}</td>
                                    <td data-label="Montant" className="amount">
                                      {money(c.amount)}
                                    </td>
                                    <td data-label="État">
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
                            <p>
                              Essayez de modifier la séance, la période ou le membre sélectionné.
                            </p>
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
                  )}
                </div>
              )}
              {tab === 'overview' &&
                (adminSubView === 'chiffres' ? (
                  <WaveChiffresView
                    totalAmount={dashboard?.total || 0}
                    contributionsCount={Number(dashboard?.payments || 0)}
                    campaignName={campaign?.name || 'Aucune campagne sélectionnée'}
                    onBack={() => setAdminSubView('dashboard')}
                  />
                ) : adminSubView === 'settings' ? (
                  <WaveSettingsView
                    groupId={groupId}
                    announceVoice={announceVoice}
                    onToggleVoice={() => {
                      setAnnounceVoice(!announceVoice);
                      feedback.notify(
                        announceVoice ? 'Annonce vocale désactivée.' : 'Annonce vocale activée.',
                        'info',
                      );
                    }}
                    actorLogin={actor?.login || actor?.name || ''}
                    actorName={actor.name}
                    groupPhone={group?.phone}
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
                          <p>{group?.name} · Consultation des campagnes</p>
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
                    ) : (
                      <div
                        className="pwa-action-home"
                        style={campaignColors(campaign?.type_name || '')}
                      >
                        <CompactIdentity
                          group={group?.name || 'Mon groupement'}
                          person={`${actor.name} · responsable`}
                          cardLabel="Afficher le QR du groupement"
                          onCard={() => {
                            if (group)
                              setQrModal({
                                title: `Groupement · ${group.name}`,
                                subtitle: `${group.phone} · ${group.address} · ${group.member_count} membre(s)`,
                                data: `ALF:GROUP:${group.id}:${group.name}`,
                              });
                          }}
                        />
                        <div className="wave-actions-grid">
                          {shortcutCampaigns.map((item) => (
                            <CampaignShortcut
                              key={item.id}
                              campaign={item}
                              selected={campaignId === item.id}
                              onChoose={() => {
                                if (campaignId === item.id) return;
                                setDashboard(null);
                                setCashbox(null);
                                setCampaignId(item.id);
                                resetFilters();
                                setParticipantPage(1);
                                setPage(1);
                                setPayerId('');
                                setKeypadAmount('');
                              }}
                            />
                          ))}
                          <button
                            type="button"
                            className="wave-action-circle-item"
                            aria-label="Historique des cotisations"
                            onClick={() => {
                              setPage(1);
                              setTab('history');
                              window.scrollTo({ top: 0 });
                            }}
                          >
                            <span className="wave-action-circle wave-circle-slate">
                              <Clock size={24} />
                            </span>
                            <span className="wave-action-label">Historique</span>
                          </button>
                          {canManage && (
                            <button
                              type="button"
                              className="wave-action-circle-item"
                              aria-label="Plus de campagnes"
                              onClick={() => setCampaignMore(true)}
                            >
                              <span className="wave-action-circle wave-circle-slate">
                                <Plus size={24} />
                              </span>
                              <span className="wave-action-label">Plus</span>
                            </button>
                          )}
                        </div>
                        {campaignMore && (
                          <Dialog
                            title="Autres campagnes en cours"
                            onClose={() => setCampaignMore(false)}
                            busy={shortcutSaving}
                          >
                            <p>
                              Choisissez une campagne pour la consulter ou affichez-la sur
                              l’accueil.
                            </p>
                            <p role="status">{shortcutIds.length}/6 campagnes sur l’accueil.</p>
                            {shortcutIds.length >= 6 && (
                              <p>Retirez une campagne dans Campagnes pour libérer une place.</p>
                            )}
                            {shortcutError && <p role="alert">{shortcutError}</p>}
                            {!extraCampaigns.length && (
                              <p>Toutes vos campagnes actives sont sur l’accueil.</p>
                            )}
                            <div className="member-campaign-options">
                              {extraCampaigns.map((item) => (
                                <CampaignChoiceCard
                                  key={item.id}
                                  campaign={item}
                                  selected={campaignId === item.id}
                                  disabled={shortcutSaving}
                                  detail="Dans Plus"
                                  onChoose={() => {
                                    setCampaignMore(false);
                                    if (campaignId === item.id) return;
                                    setDashboard(null);
                                    setCashbox(null);
                                    setCampaignId(item.id);
                                    resetFilters();
                                    setParticipantPage(1);
                                    setPage(1);
                                    setPayerId('');
                                    setKeypadAmount('');
                                  }}
                                  home={{
                                    checked: false,
                                    disabled:
                                      shortcutLoading ||
                                      shortcutSaving ||
                                      !online ||
                                      shortcutIds.length >= 6,
                                    onChange: (checked) => void toggleShortcut(item.id, checked),
                                  }}
                                />
                              ))}
                            </div>
                          </Dialog>
                        )}
                        {campaign && (
                          <DayActionCard
                            title={campaign.name}
                            type={campaign.type_name}
                            visible={showBalance}
                            onVisibility={() => setShowBalance(!showBalance)}
                            state={
                              !online
                                ? 'Hors connexion'
                                : isSavingsCampaign
                                  ? savingsStatusError
                                    ? 'Indisponible'
                                    : savingsStatus?.campaignId !== campaignId
                                      ? 'Vérification…'
                                      : savingsReady
                                        ? 'Ouverte'
                                        : savingsStatus.scheduled
                                          ? 'À ouvrir'
                                          : 'À venir'
                                  : isTontineCampaign
                                    ? tontineStatusError
                                      ? 'Indisponible'
                                      : tontineStatus?.campaignId !== campaignId
                                        ? 'Vérification…'
                                        : tontineReady
                                          ? 'Tirage effectué'
                                          : tontineStatus.can_draw
                                            ? 'À tirer'
                                            : 'En attente'
                                    : 'En cours'
                            }
                            period={
                              isSavingsCampaign
                                ? savingsStatus?.campaignId === campaignId
                                  ? `Séance du ${date(savingsStatus.today)}`
                                  : 'Séance du jour'
                                : isTontineCampaign
                                  ? tontineStatus?.round_number
                                    ? `Tour ${tontineStatus.round_number}${tontineStatus.round_date ? ' · ' + date(tontineStatus.round_date) : ''}${tontineStatus.beneficiary_name ? ' · Bénéficiaire : ' + tontineStatus.beneficiary_name : ''}`
                                    : 'Tour du jour'
                                  : 'Campagne active'
                            }
                          >
                            <div
                              className={`pwa-day-metrics ${isTontineCampaign ? 'three' : ''}`}
                              aria-label="Montants de la campagne"
                            >
                              <div>
                                <span>
                                  {isTontineCampaign ? 'À cotiser / membre' : 'Total disponible'}
                                </span>
                                <strong>
                                  {showBalance
                                    ? isTontineCampaign
                                      ? campaign.standard_amount
                                        ? money(campaign.standard_amount)
                                        : 'Selon forfait'
                                      : cashbox
                                        ? money(cashbox.balance)
                                        : '—'
                                    : '•••••• FCFA'}
                                </strong>
                              </div>
                              <div>
                                <span>
                                  {isSavingsCampaign ? 'Total collecté' : 'Total encaissé'}
                                </span>
                                <strong>
                                  {showBalance
                                    ? cashbox
                                      ? money(cashbox.total_collected)
                                      : '—'
                                    : '•••••• FCFA'}
                                </strong>
                              </div>
                              {isTontineCampaign && (
                                <div>
                                  <span>Total reversé</span>
                                  <strong>
                                    {showBalance
                                      ? cashbox
                                        ? money(cashbox.total_paid_out)
                                        : '—'
                                      : '•••••• FCFA'}
                                  </strong>
                                </div>
                              )}
                            </div>
                            {(isSavingsCampaign ? savingsStatusError : tontineStatusError) && (
                              <p role="alert">
                                {isSavingsCampaign ? savingsStatusError : tontineStatusError}{' '}
                                <button
                                  className="text-button"
                                  onClick={() => setRefresh((r) => r + 1)}
                                >
                                  Réessayer la période
                                </button>
                              </p>
                            )}

                            {canManage &&
                              campaign?.active &&
                              isSavingsCampaign &&
                              !savingsReady && (
                                <div className="wave-giant-cta-wrapper">
                                  <button
                                    type="button"
                                    className="wave-giant-cta"
                                    disabled={
                                      !online ||
                                      busy ||
                                      savingsStatus?.campaignId !== campaignId ||
                                      !savingsStatus?.scheduled
                                    }
                                    onClick={() =>
                                      action(async () => {
                                        const status = await api
                                          .POST(
                                            '/api/v1/groupements/{groupId}/campaigns/{id}/savings-session',
                                            { params: { path: { groupId, id: campaignId } } },
                                          )
                                          .then(unwrap);
                                        setSavingsStatus({ ...status, campaignId });
                                      }, 'Séance d’épargne ouverte.')
                                    }
                                  >
                                    <CalendarCheck size={28} /> Ouvrir la séance d’épargne
                                  </button>
                                  <p className="session-opening-hint" role="status">
                                    {savingsStatus?.campaignId !== campaignId
                                      ? 'Vérification de la séance…'
                                      : !savingsStatus.scheduled
                                        ? `Ouverture : ${meetingLabel(campaign)}, pendant la période de campagne.`
                                        : 'La séance du jour sera créée automatiquement.'}
                                  </p>
                                </div>
                              )}
                            {canManage &&
                              campaign?.active &&
                              isTontineCampaign &&
                              !tontineReady && (
                                <div className="wave-giant-cta-wrapper">
                                  <button
                                    type="button"
                                    className="wave-giant-cta"
                                    disabled={
                                      !online ||
                                      busy ||
                                      tontineStatus?.campaignId !== campaignId ||
                                      !tontineStatus?.can_draw
                                    }
                                    onClick={drawCurrentTontine}
                                  >
                                    <Shuffle size={26} /> Tirer la bénéficiaire du tour{' '}
                                    {tontineStatus?.round_number || ''}
                                  </button>
                                  <p className="session-opening-hint">
                                    {tontineStatus?.campaignId !== campaignId
                                      ? 'Vérification du tour…'
                                      : tontineStatus.can_draw
                                        ? 'Le tirage désignera la personne qui recevra la cagnotte de ce tour.'
                                        : 'Le tirage est disponible uniquement le jour prévu pour ce tour.'}
                                  </p>
                                </div>
                              )}
                            {canManage &&
                              campaign?.active &&
                              (!isSavingsCampaign || savingsReady) &&
                              (!isTontineCampaign || tontineReady) && (
                                <div className="wave-giant-cta-wrapper collection-split">
                                  <button
                                    type="button"
                                    className="collection-scan"
                                    aria-label="Scanner le QR d’une membre"
                                    disabled={!online || busy}
                                    onClick={() => setScanning(true)}
                                  >
                                    <QrCode size={32} />
                                  </button>
                                  <button
                                    type="button"
                                    className="wave-giant-cta"
                                    aria-label="Enregistrer une cotisation"
                                    disabled={(!online && !security?.offlineDrafts) || busy}
                                    onClick={(event) => {
                                      event.currentTarget.focus();
                                      open('contribution');
                                    }}
                                  >
                                    <span className="wave-giant-cta-text">
                                      {isSavingsCampaign
                                        ? 'Encaisser épargne'
                                        : 'Encaisser un membre'}
                                      <small>{campaign?.name}</small>
                                    </span>
                                    <span className="overview-cta-arrow" aria-hidden="true">
                                      →
                                    </span>
                                  </button>
                                  {isTontineCampaign && tontineStatus?.beneficiary_name && (
                                    <p className="session-opening-hint">
                                      Tour {tontineStatus.round_number} · Bénéficiaire :{' '}
                                      <strong>{tontineStatus.beneficiary_name}</strong>
                                    </p>
                                  )}
                                </div>
                              )}
                          </DayActionCard>
                        )}
                        {!campaign && (
                          <p>Aucune campagne active. Retrouvez vos campagnes dans Campagnes.</p>
                        )}
                      </div>
                    )}

                    <div
                      className={canManage ? 'campaign-information' : undefined}
                      style={canManage ? campaignColors(campaign?.type_name || '') : undefined}
                    >
                      {canManage && isSavingsCampaign && (
                        <SavingsSessions
                          key={campaignId}
                          sessions={sessions}
                          error={sessionsError}
                          loading={historyLoading}
                          onRetry={() => setRefresh((r) => r + 1)}
                        />
                      )}
                      {!canManage && (
                        <>
                          <div className="section-heading">
                            <h2>{dashboard?.personal ? 'Mon épargne' : 'Suivi de campagne'}</h2>
                            {superAdmin && (
                              <select
                                aria-label="Campagne suivie"
                                value={campaignId}
                                onChange={(e) => {
                                  setCampaignId(e.target.value);
                                  setPage(1);
                                }}
                              >
                                {!availableActiveCampaigns.length && (
                                  <option value="">Aucune campagne active</option>
                                )}
                                {availableActiveCampaigns.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name} {c.event_name ? `(${c.event_name})` : ''}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                          {campaignTotal > 25 && (
                            <Pager
                              page={campaignPage}
                              total={campaignTotal}
                              onChange={setCampaignPage}
                            />
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
                                {dashboard?.personal
                                  ? 'Ma participation'
                                  : 'Participantes inscrites'}
                              </span>
                              <strong>{dashboard?.participants || '—'}</strong>
                              <small>
                                {campaign
                                  ? meetingLabel(campaign)
                                  : 'Ajoutez une campagne pour commencer'}
                              </small>
                            </article>
                          </div>
                          {dashboard && (
                            <p className="updated">
                              Actualisé le {new Date(dashboard.updatedAt).toLocaleString('fr-SN')}
                            </p>
                          )}
                        </>
                      )}
                      {canManage && isTontineCampaign && (
                        <TontineRoundCards
                          key={campaignId}
                          rounds={tontineRounds}
                          groupId={groupId}
                          campaignId={campaignId}
                          refresh={refresh}
                          status={tontineStatus?.campaignId === campaignId ? tontineStatus : null}
                          busy={busy}
                          online={online}
                          onDraw={drawCurrentTontine}
                          onPay={(number) =>
                            action(
                              () =>
                                api
                                  .PATCH(
                                    '/api/v1/groupements/{groupId}/campaigns/{id}/tontine/rounds/{roundNumber}/pay',
                                    {
                                      params: {
                                        path: { groupId, id: campaignId, roundNumber: number },
                                      },
                                    },
                                  )
                                  .then(unwrap),
                              'Cagnotte reversée.',
                            )
                          }
                          onEditingChange={setRoundGraceEditing}
                        />
                      )}
                    </div>
                  </>
                ))}

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
                    {!(superAdmin ? activeCampaigns.length : availableActiveCampaigns.length) && (
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
                    {(superAdmin ? activeCampaigns.length : availableActiveCampaigns.length) > 0 &&
                      (superAdmin ? (
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
                                          <span
                                            className="metric-pill"
                                            title="Montant total collecté"
                                          >
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
                                      <span className="muted">{meetingLabel(c)}</span>
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
                                          campaignId === c.id
                                            ? 'primary-btn-sm'
                                            : 'secondary-btn-sm'
                                        }
                                        onClick={() => {
                                          setCampaignId(c.id);
                                          setPage(1);
                                          setParticipantPage(1);
                                        }}
                                      >
                                        {campaignId === c.id ? 'Sélectionnée' : 'Sélectionner'}
                                      </button>

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
                      ) : (
                        <div className="campaign-card-list" aria-label="Campagnes actives">
                          <p className="muted">
                            Cochez jusqu’à six campagnes pour les afficher sur l’accueil. Les autres
                            restent dans Plus.
                          </p>
                          <Field label="Filtrer les campagnes par type">
                            <select
                              value={campaignListType}
                              onChange={(e) => {
                                setCampaignListType(e.target.value);
                                setShowUnselectedCampaigns(false);
                                setCampaignListPage(1);
                              }}
                            >
                              <option value="">Tous les types</option>
                              {campaignListTypes.map(([code, name]) => (
                                <option key={code} value={code}>
                                  {name}
                                </option>
                              ))}
                            </select>
                          </Field>
                          {shortcutError && <p role="alert">{shortcutError}</p>}
                          {!shortcutLoading && !filteredCampaignCards.length && (
                            <p>Aucune campagne sélectionnée pour ce type.</p>
                          )}
                          {visibleCampaignCards.map((c) => (
                            <article key={c.id} className="campaign-card-entry">
                              <details
                                className={`savings-session campaign-list-card ${shortcutIds.includes(c.id) ? 'selected-campaign-card' : ''}`}
                                style={campaignColors(c.type_name || '')}
                              >
                                <summary
                                  className="session-card-summary campaign-card-summary"
                                  onClick={() => {
                                    if (campaignId !== c.id) {
                                      setCampaignId(c.id);
                                      setPage(1);
                                      setParticipantPage(1);
                                    }
                                  }}
                                >
                                  <span className="session-card-icon" aria-hidden="true">
                                    <FolderHeart size={24} />
                                  </span>
                                  <span className="session-card-body compact-campaign-body">
                                    <strong
                                      className="compact-card-line campaign-card-name"
                                      title={c.name}
                                    >
                                      {c.name}
                                    </strong>
                                    <span
                                      className="compact-card-line"
                                      title={`${c.type_name} · ${meetingLabel(c)}`}
                                    >
                                      {c.type_name} ·{' '}
                                      {shortcutIds.includes(c.id) ? 'Raccourci' : 'Dans Plus'}
                                    </span>
                                    <span
                                      className="compact-card-line"
                                      title={`${date(c.start_date)} → ${date(c.end_date)}`}
                                    >
                                      {date(c.start_date)} → {date(c.end_date)}
                                    </span>
                                    <span
                                      className="compact-card-line"
                                      title={`${c.member_count ?? 0} membre(s) · Collecté : ${money(c.collected_amount || '0')}`}
                                    >
                                      {c.member_count ?? 0} membre(s) · Collecté :{' '}
                                      {money(c.collected_amount || '0')}
                                    </span>
                                  </span>
                                  <ArrowRight
                                    className="session-card-arrow"
                                    size={21}
                                    aria-hidden="true"
                                  />
                                </summary>
                                <dl className="compact-expanded-info">
                                  <div>
                                    <dt>Campagne</dt>
                                    <dd>{c.name}</dd>
                                  </div>
                                  <div>
                                    <dt>Type</dt>
                                    <dd>{c.type_name}</dd>
                                  </div>
                                  {c.event_name && (
                                    <div>
                                      <dt>Événement</dt>
                                      <dd>{c.event_name}</dd>
                                    </div>
                                  )}
                                  <div>
                                    <dt>Période</dt>
                                    <dd>
                                      {date(c.start_date)} → {date(c.end_date)}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt>Fréquence</dt>
                                    <dd>{meetingLabel(c)}</dd>
                                  </div>
                                  {c.due_day && (
                                    <div>
                                      <dt>Échéance</dt>
                                      <dd>Le {c.due_day} du mois</dd>
                                    </div>
                                  )}
                                  <div>
                                    <dt>Montant à cotiser</dt>
                                    <dd>
                                      {c.standard_amount
                                        ? money(c.standard_amount)
                                        : 'Montant libre'}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt>Collecté</dt>
                                    <dd>{money(c.collected_amount || '0')}</dd>
                                  </div>
                                  <div>
                                    <dt>Membres</dt>
                                    <dd>{c.member_count ?? 0}</dd>
                                  </div>
                                  {c.type_code === 'TONTINE' ||
                                  /tontine/i.test(c.type_name || '') ? (
                                    <>
                                      <div>
                                        <dt>Reversements effectués</dt>
                                        <dd>{c.payouts_count ?? 0}</dd>
                                      </div>
                                      <div>
                                        <dt>Bénéficiaires restantes</dt>
                                        <dd>{c.remaining_count ?? 0}</dd>
                                      </div>
                                      {c.next_due_date && (
                                        <div>
                                          <dt>Prochaine échéance</dt>
                                          <dd>{date(c.next_due_date)}</dd>
                                        </div>
                                      )}
                                    </>
                                  ) : (
                                    <div>
                                      <dt>Séances</dt>
                                      <dd>{c.session_count ?? 0}</dd>
                                    </div>
                                  )}
                                </dl>
                                <div className="campaign-card-actions">
                                  {canManage && (
                                    <>
                                      <button
                                        type="button"
                                        className="danger-text-btn"
                                        disabled={busy}
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
                                    </>
                                  )}
                                </div>
                              </details>
                              <div className="campaign-card-quick-actions">
                                <CampaignHomeToggle
                                  campaign={c}
                                  checked={shortcutIds.includes(c.id)}
                                  disabled={
                                    shortcutLoading ||
                                    shortcutSaving ||
                                    !online ||
                                    (!shortcutIds.includes(c.id) && shortcutIds.length >= 6)
                                  }
                                  onChange={(checked) => void toggleShortcut(c.id, checked)}
                                />
                                {canManage && (
                                  <button
                                    type="button"
                                    className="secondary-btn-sm"
                                    onClick={() => {
                                      setCampaignId(c.id);
                                      open('participant');
                                    }}
                                  >
                                    <UserPlus size={16} />
                                    Ajouter un membre
                                  </button>
                                )}
                              </div>
                            </article>
                          ))}
                          {(hiddenCampaignCount > 0 || showUnselectedCampaigns) && (
                            <button
                              type="button"
                              className="session-more-link"
                              aria-label={
                                showUnselectedCampaigns
                                  ? 'Voir moins de campagnes'
                                  : 'Voir plus de campagnes'
                              }
                              aria-expanded={showUnselectedCampaigns}
                              onClick={() => {
                                setShowUnselectedCampaigns((value) => !value);
                                setCampaignListPage(1);
                              }}
                            >
                              {showUnselectedCampaigns
                                ? 'Voir moins'
                                : `Voir plus (${hiddenCampaignCount} non sélectionnée${hiddenCampaignCount > 1 ? 's' : ''})`}
                            </button>
                          )}
                        </div>
                      ))}
                    {superAdmin ? (
                      <Pager page={campaignPage} total={campaignTotal} onChange={setCampaignPage} />
                    ) : (
                      <Pager
                        page={campaignListPage}
                        total={filteredCampaignCards.length}
                        onChange={setCampaignListPage}
                      />
                    )}
                  </section>
                  {superAdmin && campaign && (
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
                              <table
                                className="mobile-detail-table"
                                aria-label="Participantes de la tontine"
                              >
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
                                      <td
                                        colSpan={4}
                                        style={{
                                          textAlign: 'center',
                                          padding: '2rem',
                                          color: 'var(--text-secondary, #64748b)',
                                        }}
                                      >
                                        <Users
                                          size={28}
                                          style={{
                                            display: 'block',
                                            margin: '0 auto 8px',
                                            color: 'var(--text-secondary, #94a3b8)',
                                          }}
                                        />
                                        Aucune participation enregistrée pour cette campagne.
                                      </td>
                                    </tr>
                                  ) : (
                                    participants.map((p) => (
                                      <tr key={p.id}>
                                        <td data-label="Membre">
                                          <div
                                            style={{
                                              display: 'flex',
                                              flexDirection: 'column',
                                              gap: 2,
                                            }}
                                          >
                                            <strong>{p.name}</strong>
                                            <small className="muted">
                                              {p.forfait
                                                ? `Forfait : ${money(p.forfait)}`
                                                : 'Montant libre'}
                                            </small>
                                          </div>
                                        </td>
                                        <td data-label="Mois cotisés">
                                          <span className="metric-pill highlight">
                                            <CalendarCheck size={12} />
                                            <strong>{p.months_contributed_count ?? 0}</strong> mois
                                          </span>
                                        </td>
                                        <td data-label="Cagnotte reçue">
                                          {p.has_received_payout ? (
                                            <span
                                              className="badge-pill-success"
                                              title="Paiement du tour déjà perçu"
                                            >
                                              <Check size={12} />
                                              <span>
                                                Oui{' '}
                                                {p.payout_amount
                                                  ? `(${money(p.payout_amount)})`
                                                  : ''}
                                              </span>
                                            </span>
                                          ) : (
                                            <span
                                              className="badge-pill-amber"
                                              title="En attente de son tour de tontine"
                                            >
                                              <Clock size={12} />
                                              <span>En attente</span>
                                            </span>
                                          )}
                                        </td>
                                        <td data-label="Période de réception">
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
                              <table
                                className="mobile-detail-table"
                                aria-label="Participantes de l’épargne"
                              >
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
                                      <td
                                        colSpan={3}
                                        style={{
                                          textAlign: 'center',
                                          padding: '2rem',
                                          color: 'var(--text-secondary, #64748b)',
                                        }}
                                      >
                                        <Users
                                          size={28}
                                          style={{
                                            display: 'block',
                                            margin: '0 auto 8px',
                                            color: 'var(--text-secondary, #94a3b8)',
                                          }}
                                        />
                                        Aucune participation enregistrée pour cette campagne.
                                      </td>
                                    </tr>
                                  ) : (
                                    participants.map((p) => (
                                      <tr key={p.id}>
                                        <td data-label="Membre">
                                          <div
                                            style={{
                                              display: 'flex',
                                              flexDirection: 'column',
                                              gap: 2,
                                            }}
                                          >
                                            <strong>{p.name}</strong>
                                            <small className="muted">
                                              {p.forfait
                                                ? `Forfait : ${money(p.forfait)}`
                                                : 'Montant libre'}
                                            </small>
                                          </div>
                                        </td>
                                        <td data-label="Séances cotisées">
                                          <span className="metric-pill highlight">
                                            <CalendarCheck size={12} />
                                            <strong>
                                              {p.sessions_contributed_count ?? 0}
                                            </strong>{' '}
                                            séance
                                            {(p.sessions_contributed_count ?? 0) > 1 ? 's' : ''}
                                          </span>
                                        </td>
                                        <td data-label="Montant versé">
                                          <span
                                            style={{
                                              fontSize: 13,
                                              fontWeight: 700,
                                              color: 'var(--positive-text, #166534)',
                                            }}
                                          >
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
                            <table
                              className="mobile-detail-table"
                              aria-label="Séances de cotisation"
                            >
                              <thead>
                                <tr>
                                  <th>Date</th>
                                  <th>Montant collecté</th>
                                  <th>Membres ayant cotisé</th>
                                  <th style={{ textAlign: 'right' }}>Détails</th>
                                </tr>
                              </thead>
                              <tbody>
                                {sessions.length === 0 ? (
                                  <tr>
                                    <td
                                      colSpan={4}
                                      style={{
                                        textAlign: 'center',
                                        padding: '2rem',
                                        color: 'var(--text-secondary, #64748b)',
                                      }}
                                    >
                                      <CalendarCheck
                                        size={28}
                                        style={{
                                          display: 'block',
                                          margin: '0 auto 8px',
                                          color: 'var(--text-secondary, #94a3b8)',
                                        }}
                                      />
                                      Aucune session enregistrée pour cette campagne.
                                    </td>
                                  </tr>
                                ) : (
                                  sessions.map((s) => {
                                    const isExpanded = expandedSessionDate === s.session_date;
                                    const distinctMembers = s.members_count ?? s.count;
                                    return (
                                      <Fragment key={s.session_date}>
                                        <tr key={s.session_date}>
                                          <td data-label="Date">
                                            <div
                                              style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 8,
                                              }}
                                            >
                                              <Calendar
                                                size={15}
                                                color="var(--text-secondary, #64748b)"
                                              />
                                              <strong>{date(s.session_date)}</strong>
                                            </div>
                                          </td>
                                          <td data-label="Montant collecté">
                                            <strong
                                              style={{
                                                color: 'var(--positive-text, #166534)',
                                                fontSize: 14,
                                              }}
                                            >
                                              {money(s.total_amount)}
                                            </strong>
                                          </td>
                                          <td data-label="Membres ayant cotisé">
                                            <span className="metric-pill highlight">
                                              <Users size={12} />
                                              <strong>{distinctMembers}</strong> membre
                                              {distinctMembers > 1 ? 's' : ''}
                                            </span>
                                          </td>
                                          <td data-label="Actions" style={{ textAlign: 'right' }}>
                                            <button
                                              type="button"
                                              className="session-expand-btn"
                                              aria-expanded={isExpanded}
                                              aria-label={`${isExpanded ? 'Masquer' : 'Afficher'} les cotisations du ${date(s.session_date)}`}
                                              aria-controls={`session-details-${s.session_date}`}
                                              onClick={() =>
                                                setExpandedSessionDate(
                                                  isExpanded ? null : s.session_date,
                                                )
                                              }
                                            >
                                              <span>{isExpanded ? 'Masquer' : 'Détails'}</span>
                                              {isExpanded ? (
                                                <ChevronUp size={14} />
                                              ) : (
                                                <ChevronDown size={14} />
                                              )}
                                            </button>
                                          </td>
                                        </tr>
                                        {isExpanded && (
                                          <tr
                                            key={`${s.session_date}-details`}
                                            id={`session-details-${s.session_date}`}
                                            className="session-details-row"
                                          >
                                            <td
                                              colSpan={4}
                                              style={{
                                                background: 'var(--surface-soft, #f8fafc)',
                                                padding: '14px 18px',
                                                borderTop: 'none',
                                              }}
                                            >
                                              <div
                                                style={{
                                                  fontSize: 12,
                                                  fontWeight: 700,
                                                  marginBottom: 8,
                                                  color: 'var(--text-primary, #334155)',
                                                }}
                                              >
                                                Cotisations enregistrées pour la séance du{' '}
                                                {date(s.session_date)} ({s.contributions.length}) :
                                              </div>
                                              <div className="session-contributions-grid">
                                                {s.contributions.map((c) => (
                                                  <div
                                                    key={c.contribution_id}
                                                    className="session-contrib-card"
                                                  >
                                                    <span className="session-contrib-name">
                                                      {c.member_name}
                                                    </span>
                                                    <span className="session-contrib-amount">
                                                      {money(c.amount)}
                                                    </span>
                                                    <span className="session-contrib-ref">
                                                      Réf : {c.reference}
                                                    </span>
                                                  </div>
                                                ))}
                                              </div>
                                            </td>
                                          </tr>
                                        )}
                                      </Fragment>
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
                <section className="panel admin-member-list">
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
                  <Field label="Rechercher une membre par nom ou téléphone">
                    <input
                      type="search"
                      maxLength={120}
                      value={memberQuery}
                      onChange={(e) => {
                        setMemberQuery(e.target.value);
                        setPage(1);
                      }}
                    />
                  </Field>
                  {superAdmin ? (
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
                              <td data-label="Téléphone">{m.phone || 'Non renseigné'}</td>
                              <td data-label="Fonction">
                                <span
                                  className={
                                    m.role === 'ADMIN' ? 'badge-function bureau' : 'badge-function'
                                  }
                                >
                                  {m.function_name ||
                                    (m.role === 'ADMIN' ? 'Administratrice' : 'Membre simple')}
                                </span>
                              </td>
                              <td data-label="Adresse">{m.address || '—'}</td>
                              <td data-label="État">
                                {m.is_blocked ? (
                                  <span className="badge-blocked">Bloquée</span>
                                ) : (
                                  <span className="badge">{m.active ? 'Active' : 'Inactive'}</span>
                                )}
                              </td>
                              {(canManage || superAdmin) && (
                                <td data-label="Actions">
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
                                    {superAdmin && (
                                      <button
                                        type="button"
                                        className="text-button"
                                        title="Révoquer le code secret"
                                        onClick={() => {
                                          setResetPinMember({ id: m.id, name: m.name });
                                          open('reset-pin');
                                        }}
                                      >
                                        <KeyRound size={15} />
                                        Révoquer
                                      </button>
                                    )}
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
                  ) : (
                    <div className="member-cards" aria-label="Membres du groupement">
                      {members.map((m) => {
                        const registrations = m.campaigns || [];
                        const summary =
                          registrations
                            .map(
                              (c) => `${c.name}${c.is_savings ? ` : ${money(c.paid_amount)}` : ''}`,
                            )
                            .join(' · ') || 'Aucune campagne';
                        const identity = `${m.phone || 'Téléphone non renseigné'} · ${m.function_name || (m.role === 'ADMIN' ? 'Administratrice' : 'Membre')}`;
                        return (
                          <details
                            className="savings-session member-list-card"
                            key={m.id}
                            style={campaignColors('Avec Épargne')}
                          >
                            <summary className="session-card-summary compact-summary">
                              <span className="session-card-icon" aria-hidden="true">
                                <Users size={23} />
                              </span>
                              <span className="session-card-body compact-session-body">
                                <span className="compact-card-line">
                                  <strong className="session-date-heading" title={m.name}>
                                    {m.name}
                                  </strong>
                                  <small className={m.is_blocked ? 'unpaid-count' : ''}>
                                    {m.is_blocked ? 'Bloquée' : m.active ? 'Active' : 'Inactive'}
                                  </small>
                                </span>
                                <span
                                  className="compact-card-line compact-card-note"
                                  title={identity}
                                >
                                  {identity}
                                </span>
                                <span
                                  className="compact-card-line compact-card-note"
                                  title={summary}
                                >
                                  {summary}
                                </span>
                              </span>
                              <ArrowRight
                                className="session-card-arrow"
                                size={21}
                                aria-hidden="true"
                              />
                            </summary>
                            <dl className="compact-expanded-info">
                              <div>
                                <dt>Membre</dt>
                                <dd>{m.name}</dd>
                              </div>
                              <div>
                                <dt>Téléphone</dt>
                                <dd>{m.phone || 'Non renseigné'}</dd>
                              </div>
                              <div>
                                <dt>Fonction</dt>
                                <dd>
                                  {m.function_name ||
                                    (m.role === 'ADMIN' ? 'Administratrice' : 'Membre')}
                                </dd>
                              </div>
                              <div>
                                <dt>Adresse</dt>
                                <dd>{m.address || 'Non renseignée'}</dd>
                              </div>
                              <div>
                                <dt>Sexe</dt>
                                <dd>{m.gender === 'F' ? 'Femme' : 'Homme'}</dd>
                              </div>
                            </dl>
                            <section
                              className="member-campaigns"
                              aria-label={`Campagnes de ${m.name}`}
                            >
                              <h3>Campagnes inscrites</h3>
                              {!registrations.length && <p>Aucune campagne.</p>}
                              <ul>
                                {registrations.map((c) => (
                                  <li key={c.campaign_id} style={campaignColors(c.type_name)}>
                                    <strong>{c.name}</strong>
                                    <span>
                                      {c.type_name}
                                      {!c.active ? ' · Archivée' : ''}
                                    </span>
                                    {c.is_savings && (
                                      <span className="member-campaign-amount">
                                        Versé : {money(c.paid_amount)}
                                      </span>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </section>
                            {canManage && (
                              <div className="campaign-card-actions">
                                <button
                                  type="button"
                                  className="secondary-btn-sm"
                                  aria-label={`Afficher le QR de ${m.name}`}
                                  onClick={() =>
                                    setQrModal({
                                      title: `Carte Membre · ${m.name}`,
                                      subtitle: `${group?.name || ''} · ${m.phone || 'Sans téléphone'}`,
                                      data: `ALF:MEMBER:${groupId}:${m.id}:${m.phone || ''}`,
                                    })
                                  }
                                >
                                  <QrCode size={17} />
                                  QR
                                </button>
                                {superAdmin && (
                                  <button
                                    type="button"
                                    className="secondary-btn-sm"
                                    aria-label={`Révoquer le code secret de ${m.name}`}
                                    onClick={() => {
                                      setResetPinMember({ id: m.id, name: m.name });
                                      open('reset-pin');
                                    }}
                                  >
                                    <KeyRound size={17} />
                                    Révoquer
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="secondary-btn-sm"
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
                            )}
                          </details>
                        );
                      })}
                    </div>
                  )}
                  {!members.length && (
                    <div className="empty">
                      <Users size={32} />
                      <p>Aucune membre trouvée pour cette recherche.</p>
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
                                      style={{
                                        padding: '4px 8px',
                                        fontSize: 12,
                                        color: 'var(--danger-text, #dc2626)',
                                      }}
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
                                      style={{
                                        padding: '4px 8px',
                                        fontSize: 12,
                                        color: 'var(--danger-text, #dc2626)',
                                      }}
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
                          <FolderHeart size={18} color="var(--text-secondary, #64748b)" />
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
                            <Users size={18} color="var(--text-secondary, #64748b)" />
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
                                                .PATCH('/api/v1/groupements/{groupId}/activation', {
                                                  params: { path: { groupId: g.id } },
                                                  body: { active: true },
                                                })
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

      {scanning && (
        <Dialog title="Scanner une carte membre" onClose={() => setScanning(false)}>
          <QrScanner
            onScan={async (code) => {
              const selected = await api
                .POST('/api/v1/groupements/{groupId}/campaigns/{id}/resolve-member-qr', {
                  params: { path: { groupId, id: campaignId } },
                  body: { code },
                })
                .then(unwrap);
              setScanning(false);
              open('contribution');
              setScannedPayer(selected);
              setPayerOptions([selected]);
              setPayerId(selected.id);
              setKeypadAmount(selected.forfait || '');
            }}
          />
        </Dialog>
      )}
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
              participant: 'Ajouter un membre à la campagne',
              contribution: 'Enregistrer une cotisation',
              grace: 'Accorder un délai de grâce',
              'reset-pin': `Révoquer le code de ${resetPinMember?.name || 'la membre'}`,
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
              participant: 'Choisissez un membre non inscrit et son mode de cotisation.',
              contribution: 'Saisie de versement en séance pour la participante sélectionnée.',
              grace: 'Délai de grâce individuel accordé avec motif d’audit.',
              'reset-pin':
                'Le mot de passe initial est conservé. Toutes les sessions et tous les appareils de ce compte seront révoqués.',
              void: 'Annulation exceptionnelle d’une cotisation erronée.',
            }[dialog]
          }
          wide={dialog === 'campaign' || dialog === 'member' || dialog === 'group'}
          busy={busy}
          onClose={() => setDialog('')}
        >
          <form onSubmit={submit}>
            {actionError && (
              <div className="alert" role="alert">
                {actionError}
              </div>
            )}
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
                  <p>
                    Pour créer un accès, renseignez un mot de passe initial d’au moins 12
                    caractères. La membre choisira elle-même son code secret après sa première
                    connexion.
                  </p>
                  <details style={{ marginTop: 8, marginBottom: 14 }}>
                    <summary
                      style={{
                        cursor: 'pointer',
                        fontWeight: 600,
                        color: 'var(--text-primary, #314737)',
                        fontSize: 13,
                      }}
                    >
                      Accès classique par identifiant (Optionnel)
                    </summary>
                    <div
                      style={{
                        marginTop: 10,
                        padding: 12,
                        background: 'var(--surface-soft, #f8faf7)',
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
                          minLength={12}
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
                <p>
                  La membre devra utiliser son mot de passe initial pour autoriser à nouveau son
                  appareil et choisir un nouveau code secret.
                </p>
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
              {dialog === 'campaign' &&
                (() => {
                  const activeType =
                    types.find((t) => t.id === (campaignTypeId || types[0]?.id)) || types[0];
                  const isTontine =
                    activeType?.code === 'TONTINE' ||
                    (activeType?.name || '').toLowerCase().includes('tontine');
                  const frequency = campaignFrequency || (isTontine ? 'MONTHLY' : 'WEEKLY');

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
                            onChange={(e) => {
                              setCampaignTypeId(e.target.value);
                              setCampaignFrequency('');
                            }}
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
                        {
                          <Field label="Montant standard / forfait (FCFA)">
                            <input
                              type="number"
                              name="standardAmount"
                              min="1"
                              required={isTontine}
                              placeholder="Ex: 5000"
                            />
                          </Field>
                        }
                        {isTontine && (
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

                      <div className="form-grid">
                        <Field label="Date de début">
                          <input type="date" name="startDate" required />
                        </Field>
                        <Field label="Date de fin">
                          <input type="date" name="endDate" required />
                        </Field>
                        <Field label="Fréquence de cotisation">
                          <select
                            name="rotationInterval"
                            value={frequency}
                            onChange={(e) => setCampaignFrequency(e.target.value)}
                          >
                            <option value="WEEKLY">Hebdomadaire</option>
                            {isTontine && (
                              <option value="BIWEEKLY">Toutes les deux semaines</option>
                            )}
                            <option value="MONTHLY">Mensuelle</option>
                          </select>
                        </Field>
                        <Field label="Jour de rencontre">
                          <select name="weekday" defaultValue="0">
                            {days.map((d, i) => (
                              <option key={d} value={i}>
                                {d}
                              </option>
                            ))}
                          </select>
                        </Field>
                        {frequency === 'MONTHLY' && (
                          <Field label="Rencontre dans le mois">
                            <select name="monthlyWeek" defaultValue="1">
                              {[1, 2, 3, 4].map((n) => (
                                <option key={n} value={n}>
                                  {['Premier', 'Deuxième', 'Troisième', 'Quatrième'][n - 1]} jour de
                                  semaine choisi
                                </option>
                              ))}
                            </select>
                          </Field>
                        )}
                        {!isTontine && frequency !== 'MONTHLY' && (
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
                        )}
                      </div>

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
                      <option value="" disabled>
                        Choisir une participante
                      </option>
                      {participants
                        .filter(
                          (p) =>
                            !isTontineCampaign ||
                            p.membership_id !==
                              tontineRounds.find(
                                (r) => r.round_number === tontineStatus?.round_number,
                              )?.beneficiary_id,
                        )
                        .map((p) => (
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
                        defaultValue={
                          isTontineCampaign
                            ? tontineStatus?.round_date || ''
                            : new Date().toISOString().slice(0, 10)
                        }
                        readOnly={isTontineCampaign}
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
                  <p>
                    <strong>{campaign?.name}</strong>
                  </p>
                  <SearchableMemberSelect
                    items={memberOptions}
                    total={optionTotal}
                    page={optionPage}
                    query={eligibleQuery}
                    value={eligibleChoice}
                    loading={eligibleLoading}
                    error={eligibleError}
                    onQuery={(value) => {
                      setEligibleQuery(value);
                      setEligibleChoice('');
                      setOptionPage(1);
                    }}
                    onSelect={setEligibleChoice}
                    onPage={(page) => {
                      setOptionPage(page);
                      setEligibleChoice('');
                    }}
                  />
                  {!isTontineCampaign && (
                    <Field label="Mode de cotisation">
                      <select
                        value={freeContribution ? 'free' : 'fixed'}
                        onChange={(e) => setFreeContribution(e.target.value === 'free')}
                      >
                        <option value="fixed" disabled={!campaign?.standard_amount}>
                          Fixe
                        </option>
                        <option value="free">Libre</option>
                      </select>
                    </Field>
                  )}
                  <input
                    type="hidden"
                    name="isRandom"
                    value={!isTontineCampaign && freeContribution ? 'on' : ''}
                  />
                  {isTontineCampaign || !freeContribution ? (
                    <>
                      <Field label="Montant à cotiser (FCFA)">
                        <input
                          name="forfait"
                          type="number"
                          readOnly
                          value={campaign?.standard_amount || ''}
                          aria-describedby="enrollment-amount-help"
                          required
                        />
                      </Field>
                      <p id="enrollment-amount-help" className="muted">
                        {isTontineCampaign
                          ? 'Montant commun à tous les membres de la tontine.'
                          : 'Montant fixe défini lors de la création de la campagne.'}
                      </p>
                    </>
                  ) : (
                    <p className="dialog-info-pill">
                      Montant libre : le membre choisira son montant à chaque cotisation.
                    </p>
                  )}
                  {!campaign?.standard_amount && (isTontineCampaign || !freeContribution) && (
                    <p role="alert">
                      Cette campagne ne possède pas de montant standard. Choisissez Libre pour
                      l’épargne ou créez une campagne avec un montant défini.
                    </p>
                  )}
                </>
              )}
              {dialog === 'contribution' && (
                <>
                  <p>
                    <strong>Campagne : {campaign?.name}</strong>
                  </p>
                  <p>
                    {contributionReview
                      ? 'Étape 2 sur 2 · Vérifier et confirmer'
                      : 'Étape 1 sur 2 · Membre et versement'}
                  </p>
                  <div hidden={!!contributionReview}>
                    <Field label="Campagne de l’encaissement">
                      <select
                        value={campaignId}
                        onChange={(e) => {
                          setCampaignId(e.target.value);
                          setPayerId('');
                          setPayerQuery('');
                          setPayerPage(1);
                          setKeypadAmount('');
                          setActionError('');
                        }}
                      >
                        {availableActiveCampaigns.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Rechercher une participante par nom ou téléphone">
                      <input
                        type="search"
                        maxLength={120}
                        value={payerQuery}
                        onChange={(e) => {
                          setPayerQuery(e.target.value);
                          setPayerPage(1);
                          setPayerId('');
                          setKeypadAmount('');
                        }}
                      />
                    </Field>
                    {payerLoading && <p role="status">Recherche des participantes…</p>}

                    <Field label="Participante">
                      <select
                        name="participationId"
                        value={payerId}
                        disabled={payerLoading}
                        required
                        onChange={(e) => {
                          setPayerId(e.target.value);
                          const chosen = payerOptions.find((p) => p.id === e.target.value);
                          setKeypadAmount(chosen?.forfait ? String(chosen.forfait) : '');
                        }}
                      >
                        <option value="" disabled>
                          Choisir une participante
                        </option>
                        {payerOptions.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} · {p.forfait ? money(p.forfait) : 'Libre'}
                          </option>
                        ))}
                      </select>
                    </Field>
                    {!payerLoading && !payerOptions.length && (
                      <p>Aucune participante trouvée. Vérifiez son inscription à cette campagne.</p>
                    )}
                    {payerTotal > 25 && (
                      <Pager
                        page={payerPage}
                        total={payerTotal}
                        onChange={(p) => {
                          setPayerPage(p);
                          setPayerId('');
                          setKeypadAmount('');
                        }}
                      />
                    )}
                    <div className="form-grid">
                      <Field label="Montant réellement versé en FCFA">
                        <input
                          type="number"
                          name="amount"
                          readOnly={fixedPayment}
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
                          key={campaignId + (savingsStatus?.today || '')}
                          readOnly={isSavingsCampaign || isTontineCampaign}
                          defaultValue={
                            isTontineCampaign
                              ? tontineStatus?.today
                              : isSavingsCampaign
                                ? savingsStatus?.today
                                : new Date().toISOString().slice(0, 10)
                          }
                          required
                        />
                      </Field>
                    </div>

                    {/* Pavé tactile géant et raccourcis rapides */}
                    {!fixedPayment && (
                      <NumericKeypad
                        amount={keypadAmount}
                        onChange={setKeypadAmount}
                        onAddQuick={(add) => {
                          const cur = Number(keypadAmount) || 0;
                          setKeypadAmount(String(cur + add));
                        }}
                      />
                    )}
                    {fixedPayment && (
                      <p className="muted">Montant fixe : {money(currentPayer!.forfait!)}.</p>
                    )}
                  </div>
                  {contributionReview && (
                    <section
                      className="member-info-card"
                      aria-label="Récapitulatif de la cotisation"
                    >
                      <h3>Confirmer le versement reçu</h3>
                      <dl>
                        <dt>Membre</dt>
                        <dd>{contributionReview.name}</dd>
                        <dt>Montant</dt>
                        <dd>{money(contributionReview.amount)}</dd>
                        <dt>Date</dt>
                        <dd>{date(contributionReview.paidOn)}</dd>
                      </dl>
                      <p>Vérifiez ces informations avec la membre avant de confirmer.</p>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => setContributionReview(null)}
                      >
                        Modifier la saisie
                      </button>
                    </section>
                  )}
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
                  disabled={
                    (!online && !(dialog === 'contribution' && security?.offlineDrafts)) ||
                    (dialog === 'contribution' && (!payerId || payerLoading)) ||
                    (dialog === 'participant' &&
                      (eligibleLoading ||
                        !eligibleChoice ||
                        ((isTontineCampaign || !freeContribution) && !campaign?.standard_amount)))
                  }
                >
                  {busy
                    ? 'Enregistrement…'
                    : dialog === 'contribution'
                      ? contributionReview
                        ? 'Confirmer la cotisation'
                        : 'Vérifier la cotisation'
                      : dialog === 'void'
                        ? 'Confirmer l’annulation'
                        : 'Enregistrer'}
                </button>
              </div>
            </fieldset>
          </form>
        </Dialog>
      )}
    </div>
  );
}
