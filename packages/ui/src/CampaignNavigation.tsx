import { ChevronRight, FolderHeart, Leaf, Users } from 'lucide-react';
import { campaignColors } from './CampaignVisuals';

const campaignIcon = (type = '') =>
  /tontine/i.test(type) ? Users : /avec|épargne|epargne/i.test(type) ? Leaf : FolderHeart;

type CampaignIdentity = { id: string; name: string; type_name?: string };
export function CampaignHomeToggle({
  campaign,
  checked,
  disabled,
  onChange,
}: {
  campaign: CampaignIdentity;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="checkbox campaign-home-toggle">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-label={`Afficher ${campaign.name} sur l’accueil`}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>Afficher sur l’accueil</span>
    </label>
  );
}
export function CampaignChoiceCard({
  campaign,
  detail,
  selected,
  disabled,
  onChoose,
  home,
}: {
  campaign: CampaignIdentity;
  detail?: string;
  selected?: boolean;
  disabled?: boolean;
  onChoose: () => void;
  home?: { checked: boolean; disabled: boolean; onChange: (checked: boolean) => void };
}) {
  const Icon = campaignIcon(campaign.type_name);
  return (
    <article className="member-campaign-option" style={campaignColors(campaign.type_name || '')}>
      <button
        type="button"
        title={campaign.name}
        className={`member-campaign-option-main overview-campaign-shortcut ${selected ? 'selected' : ''}`}
        aria-label={`Choisir la campagne ${campaign.name}`}
        aria-pressed={!!selected}
        disabled={disabled}
        onClick={onChoose}
      >
        <Icon size={24} />
        <span>
          <strong>{campaign.name}</strong>
          <small>{campaign.type_name}</small>
          {detail && <small>{detail}</small>}
        </span>
        <ChevronRight size={20} />
      </button>
      {home && <CampaignHomeToggle campaign={campaign} {...home} />}
    </article>
  );
}
export function CampaignShortcut({
  campaign,
  selected,
  onChoose,
  unpaid = 0,
  unpaidLabel,
}: {
  campaign: CampaignIdentity;
  selected: boolean;
  onChoose: () => void;
  unpaid?: number;
  unpaidLabel?: string;
}) {
  const type = campaign.type_name || '';
  const Icon = campaignIcon(type);
  const label = /tontine/i.test(type)
    ? 'Tontine'
    : /avec|épargne|epargne/i.test(type)
      ? 'Épargne'
      : type;
  return (
    <button
      type="button"
      title={campaign.name}
      className={`wave-action-circle-item overview-campaign-shortcut ${selected ? 'selected' : ''}`}
      style={campaignColors(type)}
      aria-pressed={selected}
      aria-label={`Choisir la campagne ${campaign.name}`}
      onClick={onChoose}
    >
      <span className="wave-action-circle">
        <Icon size={24} />
        {unpaid > 0 && (
          <span className="member-arrears-badge" aria-label={unpaidLabel}>
            {unpaid}
          </span>
        )}
      </span>
      <span className="wave-action-label">{label || campaign.name}</span>
      <small className="campaign-short-name">{campaign.name}</small>
      <span className="overview-campaign-status">{selected ? 'Choisie' : 'Choisir'}</span>
    </button>
  );
}
