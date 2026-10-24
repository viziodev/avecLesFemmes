import { useEffect, useState } from 'react';
import { Coins, ChevronRight, Filter, RotateCcw } from 'lucide-react';
import { api, type components } from '@aveclesfemmes/api-client';
import { campaignColors } from './CampaignVisuals';
import { MoneyVisibility } from './PwaLayout';
type S = components['schemas'];
type Filters = { campaignIds: string[]; typeIds: string[]; sessions: string[]; rounds: string[] };
const empty = (): Filters => ({ campaignIds: [], typeIds: [], sessions: [], rounds: [] });
const date = (v: string) =>
  new Date(v.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('fr-SN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
async function unwrap<T>(r: { data?: T; error?: unknown; response: Response }): Promise<T> {
  if (!r.response.ok)
    throw new Error((r.error as any)?.message || 'Historique indisponible. Réessayez.');
  return r.data as T;
}
export function MemberHistory({
  groupId,
  visible,
  refresh,
  onVisibility,
}: {
  groupId: string;
  visible: boolean;
  refresh: number;
  onVisibility: () => void;
}) {
  const [options, setOptions] = useState<S['MemberHistoryOptionsView'] | null>(null),
    [filters, setFilters] = useState<Filters>(empty);
  const [items, setItems] = useState<S['MemberHistoryContributionView'][]>([]),
    [total, setTotal] = useState(0),
    [totalPaid, setTotalPaid] = useState('0'),
    [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [optionsError, setOptionsError] = useState(''),
    [retry, setRetry] = useState(0),
    [search, setSearch] = useState('');
  useEffect(() => {
    let active = true;
    setOptionsError('');
    api
      .GET('/api/v1/groupements/{groupId}/member/history/options', {
        params: { path: { groupId } },
      })
      .then(unwrap)
      .then((r) => active && setOptions(r))
      .catch((e) => active && setOptionsError(e.message));
    return () => {
      active = false;
    };
  }, [groupId, refresh, retry]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api
      .GET('/api/v1/groupements/{groupId}/member/history', {
        params: { path: { groupId }, query: { page, limit: 5, ...filters } },
      })
      .then(unwrap)
      .then((r) => {
        if (active) {
          setItems((old) =>
            page === 1
              ? r.items
              : [...old, ...r.items.filter((x) => !old.some((p) => p.id === x.id))],
          );
          setTotal(r.total);
          setTotalPaid(r.total_paid);
        }
      })
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [groupId, filters, page, refresh, retry]);
  function toggle(key: keyof Filters, id: string) {
    setFilters((old) => ({
      ...old,
      [key]: old[key].includes(id) ? old[key].filter((x) => x !== id) : [...old[key], id],
    }));
    setPage(1);
    setItems([]);
  }
  const amount = (v: string) =>
    visible ? new Intl.NumberFormat('fr-SN').format(BigInt(v)) + ' FCFA' : '•••••• FCFA';
  const norm = (v: string) =>
    v
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  const types = Array.from(
    new Map(
      (options?.campaigns || []).map((c) => [c.type_id, { id: c.type_id, label: c.type_name }]),
    ).values(),
  );
  const groups: { key: keyof Filters; title: string; entries: { id: string; label: string }[] }[] =
    [
      { key: 'typeIds', title: 'Types de cotisation', entries: types },
      {
        key: 'campaignIds',
        title: 'Campagnes',
        entries: (options?.campaigns || []).map((c) => ({
          id: c.id,
          label: c.name + (c.active ? '' : ' · Archivée'),
        })),
      },
      {
        key: 'sessions',
        title: 'Séances d’épargne',
        entries: (options?.sessions || []).map((d) => ({ id: d, label: 'Séance du ' + date(d) })),
      },
      {
        key: 'rounds',
        title: 'Tours de tontine',
        entries: (options?.rounds || []).map((r) => ({
          id: r.key,
          label: `${r.campaign_name} · Tour ${r.round_number} · ${date(r.expected_date)}`,
        })),
      },
    ];
  const count = Object.values(filters).reduce((n, ids) => n + ids.length, 0);
  return (
    <section className="panel member-global-history" aria-label="Historique de mes versements">
      <div className="pwa-list-heading">
        <h2>Historique personnel</h2>
        <MoneyVisibility visible={visible} onChange={onVisibility} />
      </div>
      <p>
        Les cinq derniers versements, y compris ceux des campagnes archivées. Voir plus pour les
        précédents.
      </p>
      <details className="member-history-filters">
        <summary>
          <Filter size={18} /> Filtres {count ? `(${count})` : ''}
        </summary>
        <p>
          Plusieurs choix sont possibles. Les types et campagnes se combinent ; les séances et tours
          choisis constituent un ensemble de périodes.
        </p>
        <label className="field">
          <span>Rechercher dans les filtres</span>
          <input
            type="search"
            value={search}
            maxLength={120}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        {!options && !optionsError && <p role="status">Chargement des filtres…</p>}
        {groups.map((g) => (
          <details className="member-history-filter-group" key={g.key}>
            <summary>
              {g.title}
              {filters[g.key].length ? ` (${filters[g.key].length})` : ''}
            </summary>
            <div className="member-history-choices" role="group" aria-label={g.title}>
              {g.entries
                .filter((e) => norm(e.label).includes(norm(search)))
                .map((e) => (
                  <label className="checkbox" key={e.id}>
                    <input
                      type="checkbox"
                      checked={filters[g.key].includes(e.id)}
                      disabled={!filters[g.key].includes(e.id) && filters[g.key].length >= 100}
                      onChange={() => toggle(g.key, e.id)}
                    />
                    <span>{e.label}</span>
                  </label>
                ))}
              {!g.entries.filter((e) => norm(e.label).includes(norm(search))).length && (
                <p>Aucun choix disponible.</p>
              )}
            </div>
          </details>
        ))}
        <button
          type="button"
          className="text-button"
          onClick={() => {
            setFilters(empty());
            setSearch('');
            setPage(1);
            setItems([]);
          }}
          disabled={!count}
        >
          <RotateCcw size={16} /> Effacer les filtres
        </button>
      </details>
      {(error || optionsError) && (
        <p role="alert">
          {error || optionsError}{' '}
          <button className="text-button" onClick={() => setRetry((n) => n + 1)}>
            Réessayer
          </button>
        </p>
      )}
      <p className="member-history-summary" aria-live="polite">
        {loading
          ? 'Chargement des versements…'
          : `${total} versement(s) · Montant collecté : ${amount(totalPaid)}`}
      </p>
      <div className="member-history-results">
        {items.map((p) => (
          <details
            key={p.id}
            className="savings-session member-payment-card"
            style={campaignColors(p.type_name)}
          >
            <summary className="session-card-summary compact-summary">
              <span className="session-card-icon">
                <Coins size={22} />
              </span>
              <span className="compact-session-body">
                <strong className="compact-card-line" title={p.campaign_name}>
                  {p.campaign_name}
                  {!p.campaign_active ? ' · Archivée' : ''}
                </strong>
                <span className="compact-card-line">
                  {amount(p.amount)} · {date(p.paid_on)}
                  {p.voided_at ? ' · Annulé' : ''}
                </span>
                <span className="compact-card-line">
                  {p.round_number
                    ? `Tour ${p.round_number} · ${p.type_name}`
                    : p.session_date
                      ? `Séance du ${date(p.session_date)}`
                      : p.type_name}
                </span>
              </span>
              <ChevronRight className="session-card-chevron" size={20} />
            </summary>
            <p className="member-payment-reference">
              {p.campaign_name} · {p.type_name}
              <br />
              Référence : {p.reference}
              {p.voided_at ? ' · Versement annulé, hors total' : ''}
            </p>
          </details>
        ))}
      </div>
      {!loading && !error && !items.length && <p>Aucun versement ne correspond aux filtres.</p>}
      {items.length < total && (
        <button
          className="text-button"
          disabled={loading || !!error}
          onClick={() => setPage((p) => p + 1)}
        >
          Voir plus de versements
        </button>
      )}
    </section>
  );
}
