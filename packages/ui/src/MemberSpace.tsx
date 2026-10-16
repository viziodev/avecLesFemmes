import { useState } from 'react';
import { Eye, EyeOff, QrCode, ArrowRight } from 'lucide-react';
import type { components } from '@aveclesfemmes/api-client';

type S = components['schemas'];
const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const date = (value: string) =>
  new Date(value.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('fr-SN');
const money = (value: string) => `${new Intl.NumberFormat('fr-SN').format(BigInt(value))} FCFA`;

export function MemberSpace({
  tab,
  name,
  login,
  groupName,
  campaigns,
  campaignId,
  dashboard,
  participants,
  contributions,
  total,
  page,
  campaignPage,
  campaignTotal,
  visible,
  onVisibility,
  onTab,
  onCampaign,
  onPage,
  onCampaignPage,
  onQr,
}: {
  tab: string;
  name: string;
  login: string;
  groupName: string;
  campaigns: S['CampaignView'][];
  campaignId: string;
  dashboard: S['DashboardView'] | null;
  participants: S['ParticipationView'][];
  contributions: S['ContributionView'][];
  total: number;
  page: number;
  campaignPage: number;
  campaignTotal: number;
  visible: boolean;
  onVisibility: () => void;
  onTab: (tab: string) => void;
  onCampaign: (id: string) => void;
  onPage: (page: number) => void;
  onCampaignPage: (page: number) => void;
  onQr: () => void;
}) {
  const [status, setStatus] = useState('all');
  const campaign = campaigns.find((c) => c.id === campaignId);
  const ended = (c: S['CampaignView']) =>
    c.end_date.slice(0, 10) < new Date().toISOString().slice(0, 10);
  const stateLabel = (c: S['CampaignView']) =>
    !c.active ? 'Désactivée' : ended(c) ? 'Terminée' : 'Active';
  const personal = dashboard?.personal === true;
  const amount = (value: string) => (visible ? money(value) : '•••••• FCFA');
  const pager = (current: number, count: number, change: (p: number) => void) => (
    <div className="pager">
      <span>
        Page {current} · {count} résultat{count > 1 ? 's' : ''}
      </span>
      <button className="secondary" disabled={current === 1} onClick={() => change(current - 1)}>
        Précédente
      </button>
      <button
        className="secondary"
        disabled={current * 25 >= count}
        onClick={() => change(current + 1)}
      >
        Suivante
      </button>
    </div>
  );
  const select = (
    <label className="field">
      <span>Campagne suivie</span>
      <select
        aria-label="Campagne suivie"
        value={campaignId}
        onChange={(e) => onCampaign(e.target.value)}
      >
        {!campaigns.length && <option value="">Aucune campagne</option>}
        {campaigns.map((c) => (
          <option value={c.id} key={c.id}>
            {c.name}
            {stateLabel(c) !== 'Active' ? ` · ${stateLabel(c)}` : ''}
          </option>
        ))}
      </select>
    </label>
  );
  const list = campaigns.filter(
    (c) =>
      status === 'all' || (status === 'active' ? c.active && !ended(c) : !c.active || ended(c)),
  );
  return (
    <div className="member-space">
      <div className="member-privacy">
        <button className="secondary" onClick={onVisibility} aria-pressed={!visible}>
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
          {visible ? 'Masquer les montants' : 'Afficher les montants'}
        </button>
      </div>
      {tab === 'overview' && (
        <>
          <section className="member-balance-card">
            <p>Bonjour {name}</p>
            <h2>Mon montant versé</h2>
            <strong>{personal ? amount(dashboard.total) : '—'}</strong>
            <p>{campaign?.name || 'Sélectionnez une campagne'}</p>
            <small>
              Cotisations valides de cette campagne. Ce montant n’est pas un solde à retirer.
            </small>
          </section>
          <div className="member-main-actions">
            <button className="primary" onClick={onQr}>
              <QrCode size={22} />
              Présenter mon QR
            </button>
            <button className="secondary" onClick={() => onTab('payments')}>
              Mes versements
              <ArrowRight size={18} />
            </button>
          </div>
          {select}
          {campaignTotal > 25 && pager(campaignPage, campaignTotal, onCampaignPage)}
          <section className="member-info-card">
            <h2>Ma participation</h2>
            {!campaign ? (
              <p>Aucune campagne disponible pour ce groupement.</p>
            ) : !personal ? (
              <p>Chargement de ma participation…</p>
            ) : participants.length ? (
              <>
                <p>
                  {!campaign?.active
                    ? 'Campagne désactivée : vos versements restent consultables.'
                    : ended(campaign)
                      ? 'Période de campagne terminée : vos versements restent consultables.'
                      : campaign.rotation_interval
                        ? `Rythme de la tontine : ${{ WEEKLY: 'hebdomadaire', BIWEEKLY: 'toutes les deux semaines', MONTHLY: 'mensuel' }[campaign.rotation_interval] || campaign.rotation_interval}. Consultez votre administratrice pour la prochaine séance.`
                        : `Échéance habituelle : ${days[campaign?.weekday || 0]}, toutes les ${campaign?.interval_weeks || 1} semaine(s).`}
                </p>
                <p>
                  {participants[0].forfait ? (
                    <>Forfait : {amount(participants[0].forfait)}</>
                  ) : (
                    'Montant libre à chaque cotisation.'
                  )}
                </p>
                <p>{dashboard.payments} versement(s) enregistré(s).</p>
              </>
            ) : (
              <p>Vous n’êtes pas inscrite à cette campagne. Contactez votre administratrice.</p>
            )}
          </section>
        </>
      )}
      {tab === 'campaigns' && (
        <>
          <p>
            Campagnes de mon groupement. Sélectionnez une campagne pour consulter votre
            participation.
          </p>
          <label className="field">
            <span>État des campagnes de cette page</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">Toutes</option>
              <option value="active">Actives</option>
              <option value="inactive">Terminées ou désactivées</option>
            </select>
          </label>
          <div className="member-card-list">
            {list.map((c) => (
              <article className="member-info-card" key={c.id}>
                <span className="badge neutral">{stateLabel(c)}</span>
                <h2>{c.name}</h2>
                <p>{c.event_name || c.type_name}</p>
                <p>
                  Du {date(c.start_date)} au {date(c.end_date)}
                </p>
                <button
                  className="secondary"
                  onClick={() => {
                    onCampaign(c.id);
                    onTab('overview');
                  }}
                >
                  Ma participation
                  <ArrowRight size={18} />
                </button>
              </article>
            ))}
          </div>
          {!list.length && <p>Aucune campagne pour cet état sur cette page.</p>}
          {pager(campaignPage, campaignTotal, onCampaignPage)}
        </>
      )}
      {tab === 'payments' && (
        <>
          {select}
          {campaignTotal > 25 && pager(campaignPage, campaignTotal, onCampaignPage)}
          <p>
            Mes versements pour {campaign?.name || 'la campagne sélectionnée'}, du plus récent au
            plus ancien.
          </p>
          {!campaign ? (
            <p>Aucune campagne disponible.</p>
          ) : !personal ? (
            <p role="status">Chargement de mes versements…</p>
          ) : (
            <>
              {!contributions.length && (
                <section className="member-info-card">
                  <h2>Aucun versement sur cette page</h2>
                  <p>Les cotisations enregistrées par votre administratrice apparaîtront ici.</p>
                </section>
              )}
              <div className="member-card-list">
                {contributions.map((c) => (
                  <article className="member-info-card" key={c.id}>
                    <div className="member-payment-heading">
                      <strong>{amount(c.amount)}</strong>
                      <span className={`badge ${c.voided_at ? 'neutral' : ''}`}>
                        {c.voided_at ? 'Annulé' : 'Enregistré'}
                      </span>
                    </div>
                    <p>Versé le {date(c.paid_on)}</p>
                    <small>Référence : {c.reference}</small>
                    {c.voided_at && <p>Ce versement n’est pas compté dans votre montant versé.</p>}
                  </article>
                ))}
              </div>
              {pager(page, total, onPage)}
            </>
          )}
        </>
      )}
      {tab === 'members' && (
        <section className="member-info-card">
          <h2>Mon adhésion</h2>
          <dl>
            <dt>Nom</dt>
            <dd>{name}</dd>
            <dt>Identifiant</dt>
            <dd>{login}</dd>
            <dt>Groupement</dt>
            <dd>{groupName}</dd>
          </dl>
          <button className="primary" onClick={onQr}>
            <QrCode size={20} />
            Présenter mon QR
          </button>
          <p>
            Pour corriger vos informations ou récupérer votre accès, contactez votre administratrice
            de groupement.
          </p>
        </section>
      )}
    </div>
  );
}
