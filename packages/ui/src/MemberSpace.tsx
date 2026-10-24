import { useEffect, useRef, useState } from 'react';
import {
  Eye,
  EyeOff,
  ArrowRight,
  History,
  Plus,
  Coins,
  Calendar,
  ChevronRight,
  Check,
  QrCode,
  Phone,
} from 'lucide-react';
import { api, type components } from '@aveclesfemmes/api-client';
import { campaignColors } from './CampaignVisuals';
import { CompactIdentity, DayActionCard, MoneyVisibility } from './PwaLayout';
import { MemberHistory } from './MemberHistory';
import { CampaignChoiceCard, CampaignShortcut } from './CampaignNavigation';
import { Dialog } from './Dialog';
import { confirmedPayment, usePwaFeedback } from './PwaFeedback';
import { usePwaSecurity } from './PwaSecurity';
import { AppearanceSettings } from './Appearance';
type S = components['schemas'];
type Campaign = S['MemberPortalCampaignView'];
type Status = S['MemberPortalStatusView'];
const date = (v: string) =>
  new Date(v.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('fr-SN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
const money = (v: string) => new Intl.NumberFormat('fr-SN').format(BigInt(v)) + ' FCFA';
const savings = (c: Campaign) =>
  /avec|epargne/.test(
    `${c.type_code} ${c.type_name}`
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase(),
  );
async function unwrap<T>(r: { data?: T; error?: unknown; response: Response }): Promise<T> {
  if (!r.response.ok)
    throw new Error((r.error as any)?.message || 'Le service est indisponible. Réessayez.');
  return r.data as T;
}
export function MemberSpace({
  tab,
  name,
  login,
  group,
  visible,
  onVisibility,
  onTab,
  onQr,
  onEditingChange,
  online,
}: {
  tab: string;
  name: string;
  login: string;
  group?: S['GroupView'];
  visible: boolean;
  onVisibility: () => void;
  onTab: (t: string) => void;
  onQr: () => void;
  onEditingChange: (editing: boolean) => void;
  online: boolean;
}) {
  const receiptFocus = useRef<HTMLElement | null>(null);
  const security = usePwaSecurity();
  const feedback = usePwaFeedback();
  const canDraft = !!security?.offlineDrafts;
  useEffect(() => {
    const update = () => setRefresh((n) => n + 1);
    window.addEventListener('alf:refresh', update);
    return () => window.removeEventListener('alf:refresh', update);
  }, []);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]),
    [campaignId, setCampaignId] = useState('');
  const [status, setStatus] = useState<Status | null>(null),
    [statusError, setStatusError] = useState('');
  const [refresh, setRefresh] = useState(0),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<S['ContributionView'][]>([]),
    [total, setTotal] = useState(0),
    [page, setPage] = useState(1),
    [paymentsLoading, setPaymentsLoading] = useState(false);
  const [session, setSession] = useState(''),
    [roundFilter, setRoundFilter] = useState(''),
    [roundLimit, setRoundLimit] = useState(5);
  const [more, setMore] = useState(false),
    [configureCampaigns, setConfigureCampaigns] = useState(false),
    [pay, setPay] = useState(false),
    [amount, setAmount] = useState(''),
    [busy, setBusy] = useState(false),
    [payError, setPayError] = useState(''),
    [review, setReview] = useState(false);
  const [shortcutIds, setShortcutIds] = useState<string[]>([]),
    [shortcutLoading, setShortcutLoading] = useState(true),
    [shortcutSaving, setShortcutSaving] = useState(false),
    [shortcutError, setShortcutError] = useState('');
  const shortcutInFlight = useRef(false);
  const key = useRef(''),
    inFlight = useRef(false);
  const campaign = campaigns.find((c) => c.id === campaignId),
    isSavings = !!campaign && savings(campaign);
  const amountText = (v: string) => (visible ? money(v) : '•••••• FCFA');
  const currentRound = status?.rounds.find(
    (r) => r.expected_date <= status.today && r.period_end > status.today,
  );
  const periodLabel = !status
    ? 'Vérification de la période'
    : isSavings
      ? `Séance du ${date(status.today)}`
      : currentRound
        ? `Tour ${currentRound.round_number} · ${currentRound.beneficiary_name ? 'Bénéficiaire : ' + currentRound.beneficiary_name : 'Tirage en attente'}`
        : 'Tour de cotisation';

  useEffect(() => {
    onEditingChange(pay || more || configureCampaigns || busy || shortcutSaving);
    return () => onEditingChange(false);
  }, [pay, more, configureCampaigns, busy, shortcutSaving, onEditingChange]);
  useEffect(() => {
    if (!group?.id) return;
    let active = true;
    setLoading(true);
    setError('');
    (async () => {
      const items: Campaign[] = [];
      let p = 1,
        count = 0;
      do {
        const r = await api
          .GET('/api/v1/groupements/{groupId}/member/campaigns', {
            params: { path: { groupId: group.id }, query: { page: p, limit: 100 } },
          })
          .then(unwrap);
        if (!r.items.length) break;
        items.push(...r.items);
        count = r.total;
        p++;
      } while (items.length < count && active);
      if (active) {
        setCampaigns(items);
        setCampaignId((id) =>
          items.some((c) => c.id === id) ? id : items.find(savings)?.id || items[0]?.id || '',
        );
      }
    })()
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [group?.id, refresh]);
  useEffect(() => {
    if (!group?.id) return;
    let active = true;
    setShortcutLoading(true);
    setShortcutError('');
    api
      .GET('/api/v1/groupements/{groupId}/member/campaigns/shortcuts', {
        params: { path: { groupId: group.id } },
      })
      .then(unwrap)
      .then((r) => {
        if (active) setShortcutIds(r.campaignIds);
      })
      .catch((e) => active && setShortcutError(e.message))
      .finally(() => active && setShortcutLoading(false));
    return () => {
      active = false;
    };
  }, [group?.id, refresh]);
  async function toggleShortcut(id: string) {
    if (!group || shortcutInFlight.current || shortcutLoading) return;
    const previous = shortcutIds,
      next = previous.includes(id) ? previous.filter((x) => x !== id) : [...previous, id];
    if (next.length > 6) {
      setShortcutError('Choisissez au maximum six campagnes pour l’accueil.');
      return;
    }
    shortcutInFlight.current = true;
    setShortcutSaving(true);
    setShortcutError('');
    setShortcutIds(next);
    try {
      const r = await api
        .PUT('/api/v1/groupements/{groupId}/member/campaigns/shortcuts', {
          params: { path: { groupId: group.id } },
          body: { campaignIds: next },
        })
        .then(unwrap);
      setShortcutIds(r.campaignIds);
      feedback.notify(
        next.includes(id) ? 'Campagne ajoutée à l’accueil.' : 'Campagne retirée de l’accueil.',
        'success',
      );
    } catch (e) {
      setShortcutIds(previous);
      setShortcutError((e as Error).message);
      feedback.notify((e as Error).message, 'error');
    } finally {
      shortcutInFlight.current = false;
      setShortcutSaving(false);
    }
  }
  useEffect(() => {
    if (!group?.id || !campaignId) {
      setStatus(null);
      return;
    }
    let active = true;
    setStatus(null);
    setStatusError('');
    const check = () =>
      api
        .GET('/api/v1/groupements/{groupId}/member/campaigns/{campaignId}', {
          params: { path: { groupId: group.id, campaignId } },
        })
        .then(unwrap)
        .then((r) => {
          if (active) {
            setStatus(r);
            setStatusError('');
          }
        })
        .catch((e) => {
          if (active) {
            setStatus(null);
            setStatusError(e.message);
          }
        });
    void check();
    const timer = window.setInterval(check, 60000);
    window.addEventListener('focus', check);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener('focus', check);
    };
  }, [group?.id, campaignId, refresh]);
  useEffect(() => {
    if (!group?.id || !campaignId) {
      setPayments([]);
      return;
    }
    let active = true;
    setPaymentsLoading(true);
    setError('');
    api
      .GET('/api/v1/groupements/{groupId}/campaigns/{campaignId}/contributions', {
        params: {
          path: { groupId: group.id, campaignId },
          query: { scope: 'personal', page, limit: 5, paidOn: session || undefined },
        },
      })
      .then(unwrap)
      .then((r) => {
        if (active) {
          setPayments((old) =>
            page === 1
              ? r.items
              : [...old, ...r.items.filter((c) => !old.some((p) => p.id === c.id))],
          );
          setTotal(r.total);
        }
      })
      .catch((e) => active && setError(e.message))
      .finally(() => active && setPaymentsLoading(false));
    return () => {
      active = false;
    };
  }, [group?.id, campaignId, session, page, refresh]);
  function choose(id: string) {
    if (busy || pay) return;
    setCampaignId(id);
    setPage(1);
    setSession('');
    setRoundFilter('');
    setRoundLimit(5);
    setPayments([]);
    setMore(false);
  }
  function startPay() {
    if (!status?.can_pay || !campaign || (!online && !canDraft)) return;
    receiptFocus.current = document.activeElement as HTMLElement | null;
    key.current = crypto.randomUUID();
    setAmount(!campaign.is_random && campaign.forfait ? campaign.forfait : '');
    setPayError('');
    setReview(false);
    setPay(true);
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (inFlight.current || !group || !campaign || !status?.can_pay || (!online && !canDraft))
      return;
    if (!review) {
      setReview(true);
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setPayError('');
    try {
      const receipt = await api
        .POST('/api/v1/groupements/{groupId}/campaigns/{campaignId}/contributions/self', {
          params: { path: { groupId: group.id, campaignId } },
          body: { amount: Number(amount), idempotencyKey: key.current, paidOn: status.today },
        })
        .then(unwrap)
        .then(confirmedPayment);
      setStatus((s) =>
        s
          ? {
              ...s,
              can_pay: false,
              already_paid: true,
              reason: 'Versement déjà effectué pour cette séance ou ce tour.',
            }
          : s,
      );
      setPay(false);
      feedback.notify('Votre versement a été enregistré.', 'success');
      feedback.showReceipt({
        contribution: receipt,
        returnFocus: receiptFocus.current,
        member: name,
        campaign: campaign.name,
        group: group.name,
        type: campaign.type_name,
        personal: true,
      });
      setPage(1);
      setPayments([]);
      setRefresh((r) => r + 1);
    } catch (e) {
      setPayError((e as Error).message);
      feedback.notify(
        (e as Error).message,
        /Saisie conservée|Confirmation annulée/.test((e as Error).message) ? 'info' : 'error',
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  const shortcutList = campaigns.filter((c) => shortcutIds.includes(c.id));
  const extraCampaigns = campaigns.filter((c) => !shortcutIds.includes(c.id));
  const unpaidCount = (c: Campaign) => c.unpaid_count ?? c.arrears_count;
  const icons = () => (
    <div className="wave-actions-grid" aria-label="Mes campagnes actives">
      {shortcutList.map((c) => (
        <CampaignShortcut
          key={c.id}
          campaign={c}
          selected={campaignId === c.id}
          unpaid={unpaidCount(c)}
          unpaidLabel={`${unpaidCount(c)} ${savings(c) ? 'séance(s) non cotisée(s)' : 'tour(s) non cotisé(s)'}`}
          onChoose={() => choose(c.id)}
        />
      ))}
      {
        <>
          <button
            type="button"
            className="wave-action-circle-item"
            onClick={() => onTab('payments')}
            aria-label="Historique de mes versements"
          >
            <span className="wave-action-circle wave-circle-mint">
              <History size={25} />
            </span>
            <span className="wave-action-label">Historique</span>
          </button>
          <button
            type="button"
            className="wave-action-circle-item"
            onClick={() => setMore(true)}
            aria-label="Plus de campagnes"
          >
            <span className="wave-action-circle wave-circle-slate">
              <Plus size={25} />
            </span>
            <span className="wave-action-label">Plus</span>
          </button>
        </>
      }
    </div>
  );
  const paymentCards = (
    <section className="panel member-payment-list" aria-label="Mes versements d’épargne">
      <h2>Mes derniers versements</h2>
      <label className="field">
        <span>Filtrer par séance</span>
        <select
          value={session}
          onChange={(e) => {
            setSession(e.target.value);
            setPage(1);
            setPayments([]);
          }}
        >
          <option value="">Toutes les séances</option>
          {Array.from(
            new Set([...(status?.sessions || []), ...payments.map((p) => p.paid_on.slice(0, 10))]),
          )
            .sort()
            .reverse()
            .map((d) => (
              <option key={d} value={d}>
                Séance du {date(d)}
              </option>
            ))}
        </select>
      </label>
      {payments.map((p) => (
        <details className="savings-session member-payment-card" key={p.id}>
          <summary className="session-card-summary compact-summary">
            <span className="session-card-icon">
              <Coins size={22} />
            </span>
            <span className="compact-session-body">
              <strong className="compact-card-line">
                {amountText(p.amount)} · {p.voided_at ? 'Annulé' : 'Versé'}
              </strong>
              <span className="compact-card-line">Versé le {date(p.paid_on)}</span>
              <span className="compact-card-line">Séance du {date(p.paid_on)}</span>
            </span>
            <ChevronRight className="session-card-chevron" size={20} />
          </summary>
          <p className="member-payment-reference">
            Référence : {p.reference}
            {p.voided_at ? ' · Hors total' : ''}
          </p>
        </details>
      ))}
      {paymentsLoading && <p role="status">Chargement des versements…</p>}
      {!paymentsLoading && !error && !payments.length && <p>Aucun versement pour cette séance.</p>}
      {payments.length < total && (
        <button
          className="text-button"
          disabled={paymentsLoading || !!error}
          onClick={() => setPage((p) => p + 1)}
        >
          Voir plus de versements
        </button>
      )}
      {payments.length > 5 && (
        <button
          className="text-button"
          onClick={() => {
            setPage(1);
            setPayments((p) => p.slice(0, 5));
          }}
        >
          Voir moins
        </button>
      )}
    </section>
  );
  const filteredRounds = (status?.rounds || []).filter(
    (r) => !roundFilter || String(r.round_number) === roundFilter,
  );
  const tontineCards = (
    <>
      <section className="panel">
        <h2>Derniers tours</h2>
        <label className="field">
          <span>Filtrer par tour</span>
          <select
            value={roundFilter}
            onChange={(e) => {
              setRoundFilter(e.target.value);
              setRoundLimit(5);
            }}
          >
            <option value="">Tous les tours passés</option>
            {status?.rounds.map((r) => (
              <option key={r.round_number} value={r.round_number}>
                Tour {r.round_number} · {date(r.expected_date)}
              </option>
            ))}
          </select>
        </label>
        {filteredRounds.slice(0, roundLimit).map((r) => (
          <details className="savings-session member-round-card" key={r.round_number}>
            <summary className="session-card-summary compact-summary">
              <span className="session-card-icon">
                <Calendar size={22} />
              </span>
              <span className="compact-session-body">
                <strong className="compact-card-line">
                  Tour {r.round_number} · {date(r.expected_date)}
                </strong>
                <span className="compact-card-line" title={r.beneficiary_name || ''}>
                  {r.paid ? 'Encaissé par' : r.drawn ? 'À reverser à' : 'Tirage en attente'}
                  {r.beneficiary_name ? ` : ${r.beneficiary_name}` : ''}
                </span>
                <span className="compact-card-line">
                  Mon versement : {amountText(r.my_paid_amount)}
                </span>
              </span>
              <ChevronRight className="session-card-chevron" size={20} />
            </summary>
            <p className="member-payment-reference">
              Bénéficiaire : {r.beneficiary_name || 'Non désignée'} ·{' '}
              {r.paid ? 'Reversement effectué' : 'Reversement non effectué'}
            </p>
          </details>
        ))}
        {!filteredRounds.length && <p>Aucun tour passé à afficher.</p>}
        {filteredRounds.length > roundLimit && (
          <button className="text-button" onClick={() => setRoundLimit((n) => n + 5)}>
            Voir plus de tours
          </button>
        )}
        {roundLimit > 5 && (
          <button className="text-button" onClick={() => setRoundLimit(5)}>
            Voir moins
          </button>
        )}
      </section>
    </>
  );
  return (
    <div className="member-space member-portal">
      {error && (
        <div role="alert" className="notice error">
          {error}
          <button className="text-button" onClick={() => setRefresh((r) => r + 1)}>
            Réessayer
          </button>
        </div>
      )}
      {loading && !campaigns.length && <p role="status">Chargement de mes campagnes…</p>}
      {tab === 'overview' && (
        <>
          <div className="pwa-action-home">
            <CompactIdentity
              group={group?.name || 'Mon groupement'}
              person={name}
              cardLabel="Présenter mon QR"
              onCard={onQr}
            />
            {shortcutLoading ? <p role="status">Chargement des campagnes d’accueil…</p> : icons()}
            {shortcutError && <p role="alert">{shortcutError}</p>}
            {campaign && (
              <DayActionCard
                title={campaign.name}
                type={campaign.type_name}
                visible={visible}
                onVisibility={onVisibility}
                state={
                  !online
                    ? 'Hors connexion'
                    : statusError
                      ? 'Indisponible'
                      : !status
                        ? 'Vérification…'
                        : status.already_paid
                          ? 'Déjà versé'
                          : status.can_pay
                            ? 'Ouverte'
                            : 'En attente'
                }
                period={periodLabel}
              >
                {isSavings ? (
                  <div
                    className="pwa-day-total"
                    role="region"
                    aria-label="Montant collecté pour cette épargne"
                  >
                    <span>Mon montant collecté</span>
                    <strong>{status ? amountText(status.total_paid) : '—'}</strong>
                  </div>
                ) : (
                  <div className="pwa-day-metrics" role="region" aria-label="Suivi de la tontine">
                    <div>
                      <span>Bénéficiaires servis</span>
                      <strong>{status?.payouts_count ?? '—'}</strong>
                    </div>
                    <div>
                      <span>Mois restants</span>
                      <strong>{status?.remaining_months ?? '—'}</strong>
                    </div>
                    <div>
                      <span>Mon versement</span>
                      <strong>{status?.already_paid ? 'Effectué' : 'À faire'}</strong>
                    </div>
                  </div>
                )}
                <p className="pwa-day-reason" role={statusError ? 'alert' : 'status'}>
                  {!online
                    ? canDraft
                      ? 'Saisie hors ligne : en attente de synchronisation et de validation.'
                      : 'Reconnectez-vous pour préparer le mode hors ligne.'
                    : statusError || status?.reason || 'Vérification de la séance ou du tour…'}
                  {statusError && (
                    <button className="text-button" onClick={() => setRefresh((r) => r + 1)}>
                      Réessayer
                    </button>
                  )}
                </p>
                <button
                  type="button"
                  className="pwa-main-action"
                  disabled={(!online && !canDraft) || !status?.can_pay || loading || busy}
                  onClick={(event) => {
                    event.currentTarget.focus();
                    startPay();
                  }}
                >
                  <span>Faire un versement</span>
                  <ArrowRight size={21} />
                </button>
              </DayActionCard>
            )}
          </div>
          {!loading && !campaigns.length && <p>Vous ne participez à aucune campagne active.</p>}
        </>
      )}
      {tab === 'campaigns' && (
        <>
          <h2 className="pwa-section-title">À l’accueil</h2>
          <p>Les campagnes sélectionnées pour votre accueil.</p>
          <button type="button" className="secondary" onClick={() => setConfigureCampaigns(true)}>
            Choisir mes campagnes
          </button>
          {shortcutLoading && <p role="status">Chargement des campagnes sélectionnées…</p>}
          {shortcutError && <p role="alert">{shortcutError}</p>}
          <div className="member-campaign-options">
            {shortcutList.map((c) => (
              <CampaignChoiceCard
                key={c.id}
                campaign={c}
                selected={campaignId === c.id}
                detail={`Montant collecté : ${amountText(c.total_paid)}`}
                onChoose={() => {
                  choose(c.id);
                  onTab('overview');
                }}
              />
            ))}
          </div>
          {!loading && !shortcutLoading && !shortcutList.length && (
            <p>
              Aucune campagne sélectionnée. Retrouvez les autres dans Plus ou choisissez vos
              campagnes.
            </p>
          )}
        </>
      )}
      {tab === 'overview' && campaign && (
        <div className="campaign-information" style={campaignColors(campaign.type_name)}>
          {isSavings ? paymentCards : tontineCards}
        </div>
      )}
      {tab === 'payments' && group && (
        <MemberHistory
          groupId={group.id}
          visible={visible}
          onVisibility={onVisibility}
          refresh={refresh}
        />
      )}
      {tab === 'members' && (
        <>
          <section className="member-info-card">
            <h2>Mon adhésion</h2>
            <dl>
              <dt>Nom</dt>
              <dd>{name}</dd>
              <dt>Identifiant</dt>
              <dd>{login}</dd>
              <dt>Groupement</dt>
              <dd>{group?.name}</dd>
            </dl>
            <p>
              Pour corriger vos informations ou récupérer votre accès, contactez votre
              administratrice de groupement.
            </p>
            {group?.phone && (
              <a className="text-button" href={`tel:${group.phone}`}>
                <Phone size={18} />
                {group.phone}
              </a>
            )}
          </section>
          <section
            className="member-info-card pwa-account-actions"
            aria-label="Préférences et carte"
          >
            <button className="secondary" onClick={onQr}>
              <QrCode size={20} /> Présenter ma carte
            </button>
            <button className="secondary" onClick={onVisibility}>
              {visible ? <EyeOff size={20} /> : <Eye size={20} />}
              {visible ? 'Masquer les montants' : 'Afficher les montants'}
            </button>
            <button className="secondary" onClick={() => setConfigureCampaigns(true)}>
              Choisir mes campagnes
            </button>
          </section>
          <AppearanceSettings />
        </>
      )}
      {more && (
        <Dialog
          title="Autres campagnes en cours"
          onClose={() => setMore(false)}
          busy={shortcutSaving}
        >
          <p>Choisissez une campagne pour la consulter ou affichez-la sur l’accueil.</p>
          <p role="status">{shortcutIds.length}/6 campagnes sur l’accueil.</p>
          {shortcutIds.length >= 6 && (
            <p>Retirez une campagne dans Choisir mes campagnes pour libérer une place.</p>
          )}
          {shortcutError && <p role="alert">{shortcutError}</p>}
          <div className="member-campaign-options">
            {extraCampaigns.map((c) => (
              <CampaignChoiceCard
                key={c.id}
                campaign={c}
                selected={campaignId === c.id}
                disabled={shortcutSaving}
                detail={`Montant collecté : ${amountText(c.total_paid)}`}
                onChoose={() => choose(c.id)}
                home={{
                  checked: false,
                  disabled: shortcutLoading || shortcutSaving || shortcutIds.length >= 6,
                  onChange: () => void toggleShortcut(c.id),
                }}
              />
            ))}
          </div>
          {!extraCampaigns.length && <p>Toutes vos campagnes actives sont sur l’accueil.</p>}
          <button
            className="text-button"
            disabled={shortcutSaving}
            onClick={() => {
              setMore(false);
              setConfigureCampaigns(true);
            }}
          >
            Choisir les campagnes d’accueil
          </button>
        </Dialog>
      )}
      {configureCampaigns && (
        <Dialog
          title="Choisir mes campagnes"
          onClose={() => setConfigureCampaigns(false)}
          busy={shortcutSaving}
        >
          <p>Cochez jusqu’à six campagnes pour l’accueil. Les autres restent dans Plus.</p>
          {shortcutError && <p role="alert">{shortcutError}</p>}
          <p role="status">{shortcutIds.length}/6 campagnes sur l’accueil.</p>
          <div className="member-campaign-options">
            {campaigns.map((c) => (
              <CampaignChoiceCard
                key={c.id}
                campaign={c}
                selected={campaignId === c.id}
                disabled={shortcutSaving}
                detail={`Montant collecté : ${amountText(c.total_paid)}`}
                onChoose={() => {
                  setConfigureCampaigns(false);
                  choose(c.id);
                  onTab('overview');
                }}
                home={{
                  checked: shortcutIds.includes(c.id),
                  disabled:
                    shortcutLoading ||
                    shortcutSaving ||
                    (!shortcutIds.includes(c.id) && shortcutIds.length >= 6),
                  onChange: () => void toggleShortcut(c.id),
                }}
              />
            ))}
          </div>
          {!loading && !campaigns.length && <p>Aucune campagne active inscrite.</p>}
        </Dialog>
      )}
      {pay && campaign && (
        <Dialog
          title={review ? 'Vérifier mon versement' : 'Faire un versement'}
          subtitle={campaign.name}
          onClose={() => setPay(false)}
          busy={busy}
        >
          <form onSubmit={submit}>
            {review && (
              <dl className="pwa-payment-review">
                <div>
                  <dt>Membre</dt>
                  <dd>{name}</dd>
                </div>
                <div>
                  <dt>Campagne</dt>
                  <dd>{campaign.name}</dd>
                </div>
                <div>
                  <dt>Période</dt>
                  <dd>{periodLabel}</dd>
                </div>
                <div>
                  <dt>Montant</dt>
                  <dd>{money(amount)}</dd>
                </div>
              </dl>
            )}
            {!review && (
              <>
                <p>
                  {isSavings ? 'Séance du' : 'Tour en cours ·'}{' '}
                  {date(status?.today || new Date().toISOString().slice(0, 10))}
                </p>
                <p>Un seul versement valide est autorisé pour cette séance ou ce tour.</p>
                <label className="field">
                  <span>Montant à verser (FCFA)</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="1000000000000"
                    step="1"
                    required
                    readOnly={!campaign.is_random && !!campaign.forfait}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={busy}
                  />
                </label>
              </>
            )}
            {!online && (
              <p role="alert">
                Hors ligne : cette saisie restera en attente jusqu’à sa validation par le serveur.
              </p>
            )}
            {payError && <p role="alert">{payError}</p>}
            {!status?.can_pay && (
              <p role="status">{statusError || status?.reason || 'Vérification en cours…'}</p>
            )}
            <div className="form-actions">
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => (review ? setReview(false) : setPay(false))}
              >
                {review ? 'Modifier' : 'Annuler'}
              </button>
              <button
                className="primary"
                disabled={busy || (!online && !canDraft) || !status?.can_pay}
              >
                {busy
                  ? 'Enregistrement…'
                  : review
                    ? 'Confirmer mon versement'
                    : 'Vérifier mon versement'}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
