import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  IsIn,
  IsArray,
  ArrayMaxSize,
  ArrayUnique,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class PageDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page: number = 1;

  @ApiPropertyOptional({ default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 25;
}

export class ScopeDto {
  @ApiPropertyOptional({ enum: ['personal', 'group'] })
  @IsOptional()
  @IsIn(['personal', 'group'])
  scope?: 'personal' | 'group';
}

export class ScopedPageDto extends PageDto {
  @ApiPropertyOptional() @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) from?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) to?: string;
  @ApiPropertyOptional({ enum: ['valid', 'voided'] })
  @IsOptional()
  @IsIn(['valid', 'voided'])
  status?: 'valid' | 'voided';
  @ApiPropertyOptional({ description: 'Recherche par nom ou téléphone, avant pagination' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @ApiPropertyOptional({ description: 'Date exacte du versement, YYYY-MM-DD' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  paidOn?: string;

  @ApiPropertyOptional({ enum: ['personal', 'group'] })
  @IsOptional()
  @IsIn(['personal', 'group'])
  scope?: 'personal' | 'group';

  @ApiPropertyOptional({ enum: ['date', 'session', 'period', 'member'] })
  @IsOptional()
  @IsIn(['date', 'session', 'period', 'member'])
  sort?: 'date' | 'session' | 'period' | 'member';
}

export class CreateGroupDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(250) address!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  responsible?: string;
  @ApiProperty() @IsString() @Matches(/^\+?[\d ()-]{7,25}$/) phone!: string;
  @ApiPropertyOptional({ type: [String], description: 'IDs des types de campagne autorisés' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  typeIds?: string[];
  @ApiPropertyOptional({ type: [String], description: 'IDs des événements autorisés' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  eventIds?: string[];
}

export class CreateMemberDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(/^\+[1-9]\d{7,14}$/) phone?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9._-]{3,80}$/)
  login?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(12) @MaxLength(128) password?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(250) address?: string;
  @ApiPropertyOptional({ enum: ['F', 'M'], default: 'F' })
  @IsOptional()
  @IsIn(['F', 'M'])
  gender?: 'F' | 'M' = 'F';
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() functionId?: string;
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() admin: boolean = false;
}

export class UpdateMemberDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(/^\+[1-9]\d{7,14}$/) phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(250) address?: string;
  @ApiPropertyOptional({ enum: ['F', 'M'] }) @IsOptional() @IsIn(['F', 'M']) gender?: 'F' | 'M';
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() functionId?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() admin?: boolean;
}

export class BlockMemberDto {
  @ApiProperty() @IsBoolean() blocked!: boolean;
}

export class ResetPinDto {}

export class PinLoginDto {
  @ApiProperty() @IsString() @Matches(/^\+[1-9]\d{7,14}$/) phone!: string;
  @ApiProperty() @IsString() @Matches(/^\d{4}$/) pin!: string;
}

export class CreateTypeDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @ApiProperty() @IsString() @Matches(/^[A-Z][A-Z0-9_]{1,39}$/) code!: string;
}

export class UpdateTypeDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(/^[A-Z][A-Z0-9_]{1,39}$/) code?: string;
}

export class CreateCampaignEventDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @ApiProperty() @IsString() @Matches(/^[A-Z][A-Z0-9_]{1,39}$/) code!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(250) description?: string;
}

export class UpdateCampaignEventDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(/^[A-Z][A-Z0-9_]{1,39}$/) code?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(250) description?: string;
}

export class GroupEventItemDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() eventId!: string;
  @ApiProperty({ default: false }) @IsBoolean() isMandatory!: boolean;
  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000000000000)
  defaultAmount?: number;
}

export class ConfigureGroupEventsDto {
  @ApiProperty({ type: [GroupEventItemDto] })
  events!: GroupEventItemDto[];
}

export class ConfigureGroupFunctionsDto {
  @ApiProperty({ type: [String] })
  functionIds!: string[];
}

export class ConfigureGroupTypesDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  typeIds!: string[];
}

export class CreateCampaignDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() typeId!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) endDate?: string;
  @ApiPropertyOptional({ minimum: 0, maximum: 6 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  weekday?: number;
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(52)
  intervalWeeks?: number = 1;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() eventId?: string;
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() isMandatory?: boolean;
  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000000000000)
  standardAmount?: number;
  @ApiPropertyOptional({ enum: ['WEEKLY', 'BIWEEKLY', 'MONTHLY'] })
  @IsOptional()
  @IsIn(['WEEKLY', 'BIWEEKLY', 'MONTHLY'])
  rotationInterval?: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  @ApiPropertyOptional({
    minimum: 1,
    maximum: 4,
    description: 'Rang du jour de semaine dans le mois ; exige MONTHLY.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  monthlyWeek?: number;
  @ApiPropertyOptional({ minimum: 1, maximum: 31 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  dueDay?: number;
}

export class ActivationDto {
  @ApiProperty() @IsBoolean() active!: boolean;
}

export class ParticipationDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() membershipId!: string;
  @ApiPropertyOptional({ type: Number, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000000000000)
  forfait?: number | null;
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isRandom?: boolean;
  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsInt()
  @Min(1)
  roundNumber?: number;
}

export class ContributionDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() participationId!: string;
  @ApiProperty() @IsInt() @Min(1) @Max(1000000000000) amount!: number;
  @ApiProperty() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) paidOn!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() idempotencyKey!: string;
}

export class SelfContributionDto {
  @ApiPropertyOptional({
    description:
      'Date de la séance ou du tour choisi pour éviter de déplacer une saisie hors ligne.',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  paidOn?: string;
  @ApiProperty() @IsInt() @Min(1) @Max(1000000000000) amount!: number;
  @ApiProperty({ format: 'uuid' }) @IsUUID() idempotencyKey!: string;
}
export class VoidDto {
  @ApiProperty() @IsString() @MinLength(5) @MaxLength(250) reason!: string;
}

export class CreateGracePeriodDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() membershipId!: string;
  @ApiProperty() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) periodDate!: string;
  @ApiProperty() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) extendedDeadline!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(250) reason?: string;
}

export class TontineRoundOrderDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) roundNumber!: number;
  @ApiProperty({ format: 'uuid' }) @IsUUID() beneficiaryId!: string;
  @ApiProperty() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) expectedDate!: string;
  @ApiProperty() @IsInt() @Min(1) payoutAmount!: number;
}

export class TontineReorderDto {
  @ApiProperty({ type: [TontineRoundOrderDto] })
  rounds!: TontineRoundOrderDto[];
}

export class ActorView {
  @ApiPropertyOptional() hasSecretCode?: boolean;
  @ApiProperty() id!: string;
  @ApiProperty() login!: string;
  @ApiProperty() name!: string;
  @ApiProperty() isSuper!: boolean;
}

export class GroupView {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() address!: string;
  @ApiProperty() responsible!: string;
  @ApiProperty() phone!: string;
  @ApiProperty() member_count!: string;
  @ApiProperty() campaign_count!: string;
  @ApiProperty({ enum: ['ADMIN', 'MEMBER', 'SUPER'] }) my_role!: 'ADMIN' | 'MEMBER' | 'SUPER';
  @ApiPropertyOptional({ default: true }) active?: boolean;
}

export class GroupFunctionView {
  @ApiProperty() id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty() can_be_admin!: boolean;
  @ApiProperty() is_default!: boolean;
}

export class CampaignEventView {
  @ApiProperty() id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() description?: string;
  @ApiProperty() active!: boolean;
}

export class GroupEventView {
  @ApiProperty() event_id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() description?: string;
  @ApiProperty() is_mandatory!: boolean;
  @ApiPropertyOptional({ type: String, nullable: true }) default_amount!: string | null;
}

export class MemberCampaignView {
  @ApiProperty() campaign_id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() type_name!: string;
  @ApiProperty() type_code!: string;
  @ApiProperty() active!: boolean;
  @ApiProperty() is_savings!: boolean;
  @ApiProperty() paid_amount!: string;
}

export class MemberView {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) phone!: string | null;
  @ApiProperty({ enum: ['ADMIN', 'MEMBER'] }) role!: 'ADMIN' | 'MEMBER';
  @ApiProperty() active!: boolean;
  @ApiPropertyOptional({ type: String, nullable: true }) address!: string | null;
  @ApiProperty({ enum: ['F', 'M'] }) gender!: 'F' | 'M';
  @ApiPropertyOptional({ type: String, nullable: true }) function_id!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) function_name!: string | null;
  @ApiProperty() is_blocked!: boolean;
  @ApiPropertyOptional({ type: [MemberCampaignView] }) campaigns?: MemberCampaignView[];
}

export class TypeView {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() code!: string;
  @ApiProperty() rule_version!: number;
}

export class CampaignView {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() start_date!: string;
  @ApiProperty() end_date!: string;
  @ApiProperty() weekday!: number;
  @ApiProperty() interval_weeks!: number;
  @ApiProperty() active!: boolean;
  @ApiProperty() type_name!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) event_id!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) event_name!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) event_code!: string | null;
  @ApiProperty() is_mandatory!: boolean;
  @ApiPropertyOptional({ type: String, nullable: true }) standard_amount!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) rotation_interval!: string | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) monthly_week?: number | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) due_day!: number | null;
  @ApiPropertyOptional({ type: String, nullable: true }) type_code?: string | null;
  @ApiPropertyOptional({ type: Number }) member_count?: number;
  @ApiPropertyOptional({ type: String }) collected_amount?: string;
  @ApiPropertyOptional({ type: Number }) session_count?: number;
  @ApiPropertyOptional({ type: Number }) payouts_count?: number;
  @ApiPropertyOptional({ type: Number }) remaining_count?: number;
  @ApiPropertyOptional({ type: String, nullable: true }) next_due_date?: string | null;
}

export class ParticipationView {
  @ApiProperty() id!: string;
  @ApiProperty() membership_id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) forfait!: string | null;
  @ApiProperty() is_random!: boolean;
  @ApiPropertyOptional({ type: Number, nullable: true }) round_number!: number | null;
  @ApiPropertyOptional({ type: Number }) months_contributed_count?: number;
  @ApiPropertyOptional({ type: Number }) sessions_contributed_count?: number;
  @ApiPropertyOptional({ type: String }) total_contributed_amount?: string;
  @ApiPropertyOptional({ type: Boolean, nullable: true }) has_received_payout?: boolean | null;
  @ApiPropertyOptional({ type: String, nullable: true }) recovery_period?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) payout_amount?: string | null;
}

export class MemberQrDto {
  @ApiProperty() @IsString() @MaxLength(500) code!: string;
}

export class ContributionView {
  @ApiPropertyOptional() created_at?: string;
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() participation_id!: string;
  @ApiProperty() amount!: string;
  @ApiProperty() paid_on!: string;
  @ApiProperty() reference!: string;
  @ApiProperty({ type: String, nullable: true }) voided_at!: string | null;
}

export class DashboardView {
  @ApiProperty() total!: string;
  @ApiProperty() payments!: string;
  @ApiProperty() participants!: string;
  @ApiProperty() personal!: boolean;
  @ApiProperty() updatedAt!: string;
}

export class SessionMemberContributionView {
  @ApiProperty() contribution_id!: string;
  @ApiProperty() member_id!: string;
  @ApiProperty() member_name!: string;
  @ApiProperty() amount!: string;
  @ApiProperty() reference!: string;
  @ApiPropertyOptional() paid_on?: string;
}

export class TontineRoundView {
  @ApiProperty({ type: String, nullable: true }) drawn_at!: string | null;
  @ApiPropertyOptional() contributed_count?: number;
  @ApiPropertyOptional() unpaid_count?: number;

  @ApiProperty() id!: string;
  @ApiProperty() round_number!: number;
  @ApiProperty({ type: String, nullable: true }) beneficiary_id!: string | null;
  @ApiProperty({ type: String, nullable: true }) beneficiary_name!: string | null;
  @ApiProperty() expected_date!: string;
  @ApiProperty() payout_amount!: string;
  @ApiProperty() paid!: boolean;
  @ApiProperty({ type: String, nullable: true }) paid_at!: string | null;
  @ApiPropertyOptional() total_collected_amount?: string;
  @ApiPropertyOptional({ type: [SessionMemberContributionView] })
  contributions?: SessionMemberContributionView[];
}

export class GracePeriodView {
  @ApiProperty() id!: string;
  @ApiProperty() membership_id!: string;
  @ApiProperty() member_name!: string;
  @ApiProperty() period_date!: string;
  @ApiProperty() extended_deadline!: string;
  @ApiPropertyOptional() reason?: string;
  @ApiProperty() created_at!: string;
}

export class SessionAttendanceView {
  @ApiProperty() member_id!: string;
  @ApiProperty() member_name!: string;
  @ApiProperty() paid_amount!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) expected_amount!: string | null;
  @ApiProperty() contributed!: boolean;
  @ApiPropertyOptional({ type: String, nullable: true }) grace_deadline?: string | null;
  @ApiPropertyOptional() absent?: boolean;
  @ApiPropertyOptional() can_grant_grace?: boolean;
  @ApiPropertyOptional() is_beneficiary?: boolean;
}

export class TontineStatusView {
  @ApiProperty() today!: string;
  @ApiProperty({ type: Number, nullable: true }) round_number!: number | null;
  @ApiProperty({ type: String, nullable: true }) round_date!: string | null;
  @ApiProperty() scheduled!: boolean;
  @ApiProperty() drawn!: boolean;
  @ApiProperty() can_draw!: boolean;
  @ApiProperty() can_collect!: boolean;
  @ApiProperty({ type: String, nullable: true }) beneficiary_name!: string | null;
}

export class TontineMembersQueryDto extends PageDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) q?: string;
  @ApiPropertyOptional({ enum: ['all', 'paid', 'unpaid'] })
  @IsOptional()
  @IsIn(['all', 'paid', 'unpaid'])
  state?: 'all' | 'paid' | 'unpaid';
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) roundNumber?: number;
}

export class TontineMembersPage {
  @ApiProperty({ type: [SessionAttendanceView] }) items!: SessionAttendanceView[];
  @ApiProperty() total!: number;
  @ApiProperty() contributed_count!: number;
  @ApiProperty() unpaid_count!: number;
  @ApiProperty() period_start!: string;
  @ApiProperty({ description: 'Borne de fin exclue' }) period_end!: string;
}

export class CampaignSessionView {
  @ApiPropertyOptional() expected_amount?: string;
  @ApiPropertyOptional() free_members_count?: number;
  @ApiPropertyOptional({ type: [SessionAttendanceView] }) members?: SessionAttendanceView[];
  @ApiProperty() session_date!: string;
  @ApiProperty() total_amount!: string;
  @ApiProperty() count!: number;
  @ApiPropertyOptional({ type: Number }) members_count?: number;
  @ApiProperty({ type: [SessionMemberContributionView] })
  contributions!: SessionMemberContributionView[];
}

export class CashboxStateView {
  @ApiProperty() campaign_id!: string;
  @ApiProperty() campaign_name!: string;
  @ApiProperty() total_collected!: string;
  @ApiProperty() total_paid_out!: string;
  @ApiProperty() balance!: string;
}

export class SuperDashboardView {
  @ApiProperty() total_groups!: number;
  @ApiProperty() total_members!: number;
  @ApiProperty() total_campaigns!: number;
  @ApiProperty() total_collected!: string;
  @ApiProperty({ type: [CashboxStateView] }) cashboxes!: CashboxStateView[];
}

export class GroupPage {
  @ApiProperty({ type: [GroupView] }) items!: GroupView[];
  @ApiProperty() total!: number;
}

export class MemberPage {
  @ApiProperty({ type: [MemberView] }) items!: MemberView[];
  @ApiProperty() total!: number;
}

export class CampaignPage {
  @ApiProperty({ type: [CampaignView] }) items!: CampaignView[];
  @ApiProperty() total!: number;
}

export class ParticipationPage {
  @ApiProperty({ type: [ParticipationView] }) items!: ParticipationView[];
  @ApiProperty() total!: number;
}

export class ContributionPage {
  @ApiProperty({ type: [ContributionView] }) items!: ContributionView[];
  @ApiProperty() total!: number;
}

export function validDate(value: string) {
  const date = new Date(value + 'T00:00:00Z');
  return !isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export class SavingsSessionStatusView {
  @ApiProperty() today!: string;
  @ApiProperty() scheduled!: boolean;
  @ApiProperty() opened!: boolean;
  @ApiProperty() can_collect!: boolean;
}

export class CampaignShortcutsDto {
  @ApiProperty({ type: [String], maxItems: 6 })
  @IsArray()
  @ArrayMaxSize(6)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  campaignIds!: string[];
}
export class EligibleMembersQueryDto extends PageDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) q?: string;
}
export class EligibleMemberView {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) phone!: string | null;
}
export class EligibleMemberPage {
  @ApiProperty({ type: [EligibleMemberView] }) items!: EligibleMemberView[];
  @ApiProperty() total!: number;
}

export class MemberPortalCampaignView extends CampaignView {
  @ApiProperty() participation_id!: string;
  @ApiProperty({ type: String, nullable: true }) forfait!: string | null;
  @ApiProperty() is_random!: boolean;
  @ApiProperty() total_paid!: string;
  @ApiProperty() arrears_count!: number;
  @ApiPropertyOptional() unpaid_count?: number;
}
export class MemberPortalCampaignPage {
  @ApiProperty({ type: [MemberPortalCampaignView] }) items!: MemberPortalCampaignView[];
  @ApiProperty() total!: number;
}
export class MemberPortalRoundView {
  @ApiProperty() round_number!: number;
  @ApiProperty() expected_date!: string;
  @ApiProperty() period_end!: string;
  @ApiProperty({ type: String, nullable: true }) beneficiary_name!: string | null;
  @ApiProperty() paid!: boolean;
  @ApiProperty() drawn!: boolean;
  @ApiProperty() my_paid_amount!: string;
}
export class MemberPortalStatusView {
  @ApiProperty() today!: string;
  @ApiProperty() can_pay!: boolean;
  @ApiProperty() already_paid!: boolean;
  @ApiProperty() reason!: string;
  @ApiProperty() total_paid!: string;
  @ApiProperty({ type: [String] }) sessions!: string[];
  @ApiProperty({ type: [MemberPortalRoundView] }) rounds!: MemberPortalRoundView[];
  @ApiProperty() payouts_count!: number;
  @ApiProperty() remaining_months!: number;
}

const splitFilter = ({ value }: { value: unknown }) =>
  (Array.isArray(value) ? value : [value])
    .flatMap((v) => String(v).split(','))
    .map((v) => v.trim())
    .filter(Boolean);
export class MemberHistoryQueryDto extends PageDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @Transform(splitFilter)
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  campaignIds?: string[];
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @Transform(splitFilter)
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  typeIds?: string[];
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @Transform(splitFilter)
  @IsArray()
  @ArrayMaxSize(100)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { each: true })
  sessions?: string[];
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @Transform(splitFilter)
  @IsArray()
  @ArrayMaxSize(100)
  @Matches(/^[0-9a-fA-F-]{36}:[1-9]\d{0,5}$/, { each: true })
  rounds?: string[];
}
export class MemberShortcutsView {
  @ApiProperty({ type: [String] }) campaignIds!: string[];
}
export class MemberHistoryCampaignView {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() active!: boolean;
  @ApiProperty() type_id!: string;
  @ApiProperty() type_name!: string;
  @ApiProperty() type_code!: string;
}
export class MemberHistoryRoundOption {
  @ApiProperty() key!: string;
  @ApiProperty() campaign_id!: string;
  @ApiProperty() campaign_name!: string;
  @ApiProperty() round_number!: number;
  @ApiProperty() expected_date!: string;
}
export class MemberHistoryOptionsView {
  @ApiProperty({ type: [MemberHistoryCampaignView] }) campaigns!: MemberHistoryCampaignView[];
  @ApiProperty({ type: [String] }) sessions!: string[];
  @ApiProperty({ type: [MemberHistoryRoundOption] }) rounds!: MemberHistoryRoundOption[];
}
export class MemberHistoryContributionView extends ContributionView {
  @ApiProperty() campaign_id!: string;
  @ApiProperty() campaign_name!: string;
  @ApiProperty() campaign_active!: boolean;
  @ApiProperty() type_id!: string;
  @ApiProperty() type_name!: string;
  @ApiProperty() type_code!: string;
  @ApiProperty({ type: String, nullable: true }) session_date!: string | null;
  @ApiProperty({ type: Number, nullable: true }) round_number!: number | null;
}
export class MemberHistoryPage {
  @ApiProperty({ type: [MemberHistoryContributionView] }) items!: MemberHistoryContributionView[];
  @ApiProperty() total!: number;
  @ApiProperty() total_paid!: string;
}
