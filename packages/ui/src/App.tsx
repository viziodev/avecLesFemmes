import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  Coins,
  Download,
  FolderHeart,
  LayoutDashboard,
  Leaf,
  LogOut,
  Plus,
  ShieldCheck,
  Users,
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
  onClose,
  children,
  busy,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  busy: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="dialog-heading">
        <h2>{title}</h2>
        <button className="icon-button" onClick={onClose} disabled={busy} aria-label="Fermer">
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <Leaf size={23} />
      </span>
      <span>
        AvecLes<span className="brand-emphasis">Femmes</span>
        <small>L’épargne qui nous rassemble</small>
      </span>
    </div>
  );
}
function Login({ portal, onLogin }: { portal: 'super' | 'member'; onLogin: (a: Actor) => void }) {
  const [mode, setMode] = useState<'password' | 'phone'>('password');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [phone, setPhone] = useState('');
  const [sent, setSent] = useState(false);
  const [localCode, setLocalCode] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    const v = values(e);
    setError('');
    setBusy(true);
    try {
      if (mode === 'password') {
        onLogin(
          await unwrap(
            await api.POST('/api/v1/auth/login', {
              body: { login: v.login, password: v.password },
            }),
          ),
        );
      } else if (!sent) {
        const response = await unwrap(
          await api.POST('/api/v1/auth/otp/request', { body: { phone: v.phone } }),
        );
        setPhone(v.phone);
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
          <button
            className={mode === 'password' ? 'selected' : ''}
            onClick={() => {
              setMode('password');
              setError('');
            }}
          >
            Identifiant
          </button>
          <button
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
            {mode === 'password' ? (
              <>
                <Field label="Identifiant">
                  <input
                    name="login"
                    autoComplete="username"
                    placeholder="Votre identifiant"
                    required
                  />
                </Field>
                <Field label="Mot de passe">
                  <input
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="Votre mot de passe"
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
  const group = groups.find((g) => g.id === groupId);
  const admin = group?.my_role === 'ADMIN';
  const superAdmin = actor?.isSuper && portal === 'super';
  const campaign = campaigns.find((c) => c.id === campaignId);
  const canManage = admin && !personalMode;
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
        .GET('/api/v1/groupements', { params: { query: { page: groupPage, limit: 25 } } })
        .then(unwrap),
      api.GET('/api/v1/campaign-types').then(unwrap),
    ])
      .then(([g, t]) => {
        if (active) {
          setGroups(g.items);
          setGroupTotal(g.total);
          setTypes(t);
          setGroupId((id) => (g.items.some((x) => x.id === id) ? id : g.items[0]?.id || ''));
        }
      })
      .catch((e) => active && setLoadError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [actor, refresh, groupPage]);
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
          setCampaignId((id) => (r.items.some((c) => c.id === id) ? id : r.items[0]?.id || ''));
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
      return;
    }
    let active = true;
    setDashboard(null);
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
            query: { page, limit: 25, scope: personalMode ? 'personal' : 'group' },
          },
        })
        .then(unwrap),
    ])
      .then(([d, p, c]) => {
        if (active) {
          setDashboard(d);
          setParticipants(p.items);
          setParticipantTotal(p.total);
          setContributions(c.items);
          setContributionTotal(c.total);
        }
      })
      .catch((e) => active && setLoadError(e.message));
    return () => {
      active = false;
    };
  }, [actor, groupId, campaignId, page, participantPage, refresh, personalMode]);
  const selectGroup = useCallback(
    (id: string) => {
      if (id === groupId) return;
      setGroupId(id);
      setCampaignId('');
      setCampaigns([]);
      setMembers([]);
      setDashboard(null);
      setParticipants([]);
      setContributions([]);
      setPage(1);
      setCampaignPage(1);
      setParticipantPage(1);
      setTab('overview');
    },
    [groupId],
  );
  function open(name: string) {
    idempotency.current = crypto.randomUUID();
    setOptionPage(1);
    setDialog(name);
  }
  async function action(task: () => Promise<unknown>, message: string) {
    if (busy) return;
    setBusy(true);
    try {
      await task();
      setNotice(message);
      setDialog('');
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
    if (dialog === 'group')
      await action(
        () =>
          api
            .POST('/api/v1/groupements', {
              body: {
                name: v.name,
                address: v.address,
                responsible: v.responsible,
                phone: v.phone,
              },
            })
            .then(unwrap),
        'Groupement créé.',
      );
    if (dialog === 'member')
      await action(
        () =>
          api
            .POST('/api/v1/groupements/{groupId}/members', {
              params: { path: { groupId } },
              body: {
                name: v.name,
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
    if (dialog === 'campaign')
      await action(
        () =>
          api
            .POST('/api/v1/groupements/{groupId}/campaigns', {
              params: { path: { groupId } },
              body: {
                name: v.name,
                typeId: v.typeId,
                startDate: v.startDate,
                endDate: v.endDate,
                weekday: Number(v.weekday),
                intervalWeeks: Number(v.intervalWeeks),
              },
            })
            .then(unwrap),
        'Campagne créée. Ajoutez maintenant ses participantes.',
      );
    if (dialog === 'participant')
      await action(
        () =>
          api
            .POST('/api/v1/groupements/{groupId}/campaigns/{id}/participants', {
              params: { path: campaignPath },
              body: { membershipId: v.membershipId, forfait: v.forfait ? Number(v.forfait) : null },
            })
            .then(unwrap),
        'Participation et forfait enregistrés.',
      );
    if (dialog === 'contribution')
      await action(
        () =>
          api
            .POST('/api/v1/groupements/{groupId}/campaigns/{campaignId}/contributions', {
              params: { path: { groupId, campaignId } },
              body: {
                participationId: v.participationId,
                amount: Number(v.amount),
                paidOn: v.paidOn,
                idempotencyKey: idempotency.current,
              },
            })
            .then(unwrap),
        'Cotisation enregistrée.',
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
        ? 'Les campagnes'
        : tab === 'types'
          ? 'Types de campagne'
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
            ...(superAdmin ? [['types', 'Types de campagne', Coins]] : []),
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
            {superAdmin && tab !== 'types' && (
              <button className="primary" onClick={() => open('group')}>
                <Plus size={18} />
                Créer un groupement
              </button>
            )}
            {superAdmin && tab === 'types' && (
              <button className="primary" onClick={() => open('type')}>
                <Plus size={18} />
                Créer un type
              </button>
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
          {tab !== 'types' && (
            <div className="group-selector">
              <span className="group-symbol">
                <Users size={22} />
              </span>
              <div>
                <label htmlFor="group-select">
                  {superAdmin ? 'Groupement suivi' : 'Votre groupement'}
                </label>
                <select
                  id="group-select"
                  value={groupId}
                  onChange={(e) => selectGroup(e.target.value)}
                >
                  {!groups.length && (
                    <option value="">{loading ? 'Chargement…' : 'Aucun groupement'}</option>
                  )}
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
              <span className="group-address">{group?.address}</span>
              {groupTotal > 25 && (
                <Pager page={groupPage} total={groupTotal} onChange={setGroupPage} />
              )}
              <ChevronDown size={17} />
            </div>
          )}
          {!groupId && tab !== 'types' && !loading ? (
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
                <>
                  <section className="welcome-panel">
                    <div>
                      <span className="eyebrow">CHAQUE CONTRIBUTION COMPTE</span>
                      <h2>
                        Ensemble, les projets
                        <br />
                        prennent vie.
                      </h2>
                      <p>
                        {group?.name} ·{' '}
                        {superAdmin
                          ? 'Consultation des campagnes'
                          : admin
                            ? 'Gestion du groupement et épargne personnelle'
                            : 'Votre épargne, en toute clarté'}
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
                      {!campaigns.length && <option value="">Aucune campagne</option>}
                      {campaigns.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
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
                  <section className="panel">
                    <div className="section-heading">
                      <div>
                        <h2>
                          {dashboard?.personal ? 'Mes versements' : 'Historique des cotisations'}
                        </h2>
                        <p className="muted">{campaign?.name || 'Aucune campagne sélectionnée'}</p>
                      </div>
                      {canManage && campaign?.active && (
                        <button
                          className="primary"
                          disabled={!online || busy}
                          onClick={() => open('contribution')}
                        >
                          <Plus size={17} />
                          Enregistrer une cotisation
                        </button>
                      )}
                    </div>
                    {contributions.length ? (
                      <div className="table-scroll">
                        <table className="contribution-table">
                          <thead>
                            <tr>
                              <th>Membre</th>
                              <th>Date</th>
                              <th>Montant</th>
                              <th>État</th>
                              {canManage && <th>Action</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {contributions.map((c) => (
                              <tr key={c.id}>
                                <td>
                                  <span className="member-cell">
                                    <span className="round-avatar small">{c.name.slice(0, 1)}</span>
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
                      <div className="empty">
                        <Coins size={29} />
                        <h3>Aucune cotisation pour le moment</h3>
                        <p>Les versements enregistrés apparaîtront ici.</p>
                      </div>
                    )}
                    <Pager page={page} total={contributionTotal} onChange={setPage} />
                  </section>
                </>
              )}
              {tab === 'campaigns' && (
                <>
                  <section className="panel">
                    <div className="section-heading">
                      <div>
                        <h2>Campagnes du groupement</h2>
                        <p className="muted">Une période, un rythme et des projets partagés.</p>
                      </div>
                      {canManage && (
                        <button className="primary" onClick={() => open('campaign')}>
                          <Plus size={17} />
                          Créer une campagne
                        </button>
                      )}
                    </div>
                    <div className="campaign-grid">
                      {campaigns.map((c) => (
                        <article
                          className={
                            campaignId === c.id ? 'campaign-card selected-card' : 'campaign-card'
                          }
                          key={c.id}
                        >
                          <div className="card-top">
                            <span className="stat-icon">
                              <FolderHeart size={21} />
                            </span>
                            <span className={c.active ? 'badge' : 'badge neutral'}>
                              {c.active ? 'Active' : 'Désactivée'}
                            </span>
                          </div>
                          <h3>{c.name}</h3>
                          <p>{c.type_name}</p>
                          <div className="card-period">
                            {date(c.start_date)} → {date(c.end_date)}
                          </div>
                          <small>
                            {days[c.weekday]} · toutes les {c.interval_weeks} semaine(s)
                          </small>
                          <div className="card-actions">
                            <button
                              className="text-button"
                              onClick={() => {
                                setCampaignId(c.id);
                                setPage(1);
                                setParticipantPage(1);
                              }}
                            >
                              Sélectionner
                              <ChevronRight size={15} />
                            </button>
                            {superAdmin && (
                              <button
                                className="text-button"
                                disabled={busy}
                                onClick={() =>
                                  action(
                                    () =>
                                      api
                                        .PATCH(
                                          '/api/v1/groupements/{groupId}/campaigns/{id}/activation',
                                          {
                                            params: { path: { groupId, id: c.id } },
                                            body: { active: !c.active },
                                          },
                                        )
                                        .then(unwrap),
                                    'État de la campagne mis à jour.',
                                  )
                                }
                              >
                                {c.active ? 'Désactiver' : 'Activer'}
                              </button>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                    {!campaigns.length && (
                      <div className="empty">
                        <FolderHeart size={32} />
                        <h3>Aucune campagne</h3>
                        <p>
                          {admin
                            ? 'Créez une campagne pour organiser la collecte.'
                            : 'Les campagnes de votre groupement apparaîtront ici.'}
                        </p>
                      </div>
                    )}
                    <Pager page={campaignPage} total={campaignTotal} onChange={setCampaignPage} />
                  </section>
                  {campaign && (
                    <section className="panel">
                      <div className="section-heading">
                        <div>
                          <h2>
                            {canManage || superAdmin
                              ? 'Participantes et forfaits'
                              : 'Ma participation'}
                          </h2>
                          <p className="muted">{campaign.name}</p>
                        </div>
                        {canManage && campaign.active && (
                          <button className="secondary" onClick={() => open('participant')}>
                            <Plus size={17} />
                            Configurer une participation
                          </button>
                        )}
                      </div>
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Membre</th>
                              <th>Forfait par échéance</th>
                            </tr>
                          </thead>
                          <tbody>
                            {participants.map((p) => (
                              <tr key={p.id}>
                                <td>{p.name}</td>
                                <td>{p.forfait ? money(p.forfait) : 'Montant libre'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {!participants.length && (
                        <div className="empty">
                          <p>Aucune participation enregistrée.</p>
                        </div>
                      )}
                      <Pager
                        page={participantPage}
                        total={participantTotal}
                        limit={100}
                        onChange={setParticipantPage}
                      />
                      <button
                        className="text-button"
                        onClick={() => {
                          setTab('overview');
                          setPage(1);
                        }}
                      >
                        Consulter les versements
                        <ArrowRight size={16} />
                      </button>
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
                          ? 'Gérez les membres et leurs accès.'
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
                          <th>Rôle</th>
                          <th>État</th>
                        </tr>
                      </thead>
                      <tbody>
                        {members.map((m) => (
                          <tr key={m.id}>
                            <td className="member-cell">
                              <span className="round-avatar small">{m.name.slice(0, 1)}</span>
                              {m.name}
                            </td>
                            <td>{m.phone || 'Non renseigné'}</td>
                            <td>{m.role === 'ADMIN' ? 'Administratrice et membre' : 'Membre'}</td>
                            <td>
                              <span className="badge">{m.active ? 'Active' : 'Inactive'}</span>
                            </td>
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
                <section className="panel">
                  <div className="section-heading">
                    <div>
                      <h2>Catalogue des types</h2>
                      <p className="muted">
                        Le premier incrément prend en charge les règles Avec Épargne.
                      </p>
                    </div>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Nom</th>
                          <th>Code</th>
                          <th>Version des règles</th>
                        </tr>
                      </thead>
                      <tbody>
                        {types.map((t) => (
                          <tr key={t.id}>
                            <td>{t.name}</td>
                            <td>{t.code}</td>
                            <td>{t.rule_version}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </>
          )}
          <footer className="page-footer">
            <Leaf size={14} />
            AvecLesFemmes<span>Chaque femme, chaque projet, chaque contribution.</span>
          </footer>
        </div>
      </main>
      {dialog && (
        <Dialog
          title={
            {
              group: 'Créer un groupement',
              member: 'Ajouter une membre',
              type: 'Créer un type Avec',
              campaign: 'Créer une campagne',
              participant: 'Configurer une participation',
              contribution: 'Enregistrer une cotisation',
              void: 'Annuler une cotisation',
            }[dialog] || ''
          }
          busy={busy}
          onClose={() => setDialog('')}
        >
          <form onSubmit={submit}>
            <fieldset disabled={busy}>
              {dialog === 'group' && (
                <>
                  <Field label="Nom du groupement">
                    <input name="name" required minLength={2} maxLength={120} />
                  </Field>
                  <Field label="Adresse">
                    <input name="address" required minLength={2} maxLength={250} />
                  </Field>
                  <Field label="Responsable">
                    <input name="responsible" required minLength={2} maxLength={120} />
                  </Field>
                  <Field label="Téléphone">
                    <input name="phone" type="tel" required />
                  </Field>
                </>
              )}
              {dialog === 'member' && (
                <>
                  <Field label="Nom complet">
                    <input name="name" required minLength={2} maxLength={120} />
                  </Field>
                  <Field label="Téléphone avec indicatif">
                    <input name="phone" type="tel" placeholder="+221771234567" />
                  </Field>
                  <h3>Accès à l’espace membre</h3>
                  <p className="muted">
                    Facultatif. Pour créer un compte, renseignez un identifiant et un mot de passe
                    ou un téléphone.
                  </p>
                  <Field label="Identifiant">
                    <input name="login" pattern="[a-zA-Z0-9._-]{3,80}" autoComplete="off" />
                  </Field>
                  <Field label="Mot de passe initial">
                    <input
                      name="password"
                      type="password"
                      minLength={12}
                      maxLength={128}
                      autoComplete="new-password"
                    />
                  </Field>
                  {superAdmin && (
                    <label className="checkbox">
                      <input type="checkbox" name="admin" />
                      Attribuer l’administration du groupement
                    </label>
                  )}
                </>
              )}
              {dialog === 'type' && (
                <>
                  <Field label="Nom du type">
                    <input name="name" required minLength={2} />
                  </Field>
                  <Field label="Code unique en majuscules">
                    <input name="code" required pattern="[A-Z][A-Z0-9_]{1,39}" />
                  </Field>
                  <p className="muted">Ce type utilisera les règles Avec Épargne.</p>
                </>
              )}
              {dialog === 'campaign' && (
                <>
                  <Field label="Nom de la campagne">
                    <input name="name" required minLength={2} />
                  </Field>
                  <Field label="Type de campagne">
                    <select name="typeId" required>
                      {types.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="form-grid">
                    <Field label="Date de début">
                      <input type="date" name="startDate" required />
                    </Field>
                    <Field label="Date de fin">
                      <input type="date" name="endDate" required />
                    </Field>
                  </div>
                  <Field label="Jour de cotisation">
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
                </>
              )}
              {dialog === 'participant' && (
                <>
                  <Field label="Membre du groupement">
                    <select name="membershipId" required>
                      {memberOptions.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
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
                  <Field label="Forfait par échéance en FCFA">
                    <input
                      name="forfait"
                      type="number"
                      min="1"
                      max="1000000000000"
                      step="1"
                      placeholder="Laisser vide pour un montant libre"
                    />
                  </Field>
                  <p className="muted">
                    Une participation existante sera mise à jour. L’historique des modifications est
                    conservé.
                  </p>
                </>
              )}
              {dialog === 'contribution' && (
                <>
                  <Field label="Participante">
                    <select name="participationId" required>
                      {participants.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} · {p.forfait ? money(p.forfait) : 'montant libre'}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {participantTotal > 100 && (
                    <Pager
                      page={participantPage}
                      total={participantTotal}
                      limit={100}
                      onChange={setParticipantPage}
                    />
                  )}
                  <Field label="Montant réellement versé en FCFA">
                    <input
                      name="amount"
                      type="number"
                      min="1"
                      max="1000000000000"
                      step="1"
                      required
                    />
                  </Field>
                  <Field label="Date du versement">
                    <input
                      name="paidOn"
                      type="date"
                      min={campaign?.start_date}
                      max={new Date().toISOString().slice(0, 10)}
                      defaultValue={new Date().toISOString().slice(0, 10)}
                      required
                    />
                  </Field>
                  {!participants.length && (
                    <p role="alert">
                      Configurez d’abord une participation dans l’onglet Campagnes.
                    </p>
                  )}
                </>
              )}
              {dialog === 'void' && (
                <>
                  <p>
                    L’annulation conserve la trace du versement. Vous pourrez ensuite saisir une
                    nouvelle cotisation.
                  </p>
                  <Field label="Motif de l’annulation">
                    <textarea name="reason" required minLength={5} maxLength={250} />
                  </Field>
                </>
              )}
              <div className="dialog-actions">
                <button type="button" className="secondary" onClick={() => setDialog('')}>
                  Fermer
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
                  <Check size={17} />
                </button>
              </div>
            </fieldset>
          </form>
        </Dialog>
      )}
    </div>
  );
}
