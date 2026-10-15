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
} from 'class-validator';
import { Type } from 'class-transformer';

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
  @ApiPropertyOptional({ enum: ['personal', 'group'] })
  @IsOptional()
  @IsIn(['personal', 'group'])
  scope?: 'personal' | 'group';
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
}

export class CreateMemberDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(/^\+[1-9]\d{7,14}$/) phone?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9._-]{3,80}$/)
  login?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(4) @MaxLength(128) password?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(/^\d{4}$/) pin?: string;
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

export class ResetPinDto {
  @ApiProperty() @IsString() @Matches(/^\d{4}$/) pin!: string;
}

export class PinLoginDto {
  @ApiProperty() @IsString() @Matches(/^\+[1-9]\d{7,14}$/) phone!: string;
  @ApiProperty() @IsString() @Matches(/^\d{4}$/) pin!: string;
}

export class CreateTypeDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @ApiProperty() @IsString() @Matches(/^[A-Z][A-Z0-9_]{1,39}$/) code!: string;
}

export class CreateCampaignEventDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @ApiProperty() @IsString() @Matches(/^[A-Z][A-Z0-9_]{1,39}$/) code!: string;
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

export class CreateCampaignDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() typeId!: string;
  @ApiProperty() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) startDate!: string;
  @ApiProperty() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) endDate!: string;
  @ApiProperty({ minimum: 0, maximum: 6 }) @IsInt() @Min(0) @Max(6) weekday!: number;
  @ApiProperty({ default: 1 }) @IsInt() @Min(1) @Max(52) intervalWeeks: number = 1;
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
  @ApiPropertyOptional({ type: Number, nullable: true }) due_day!: number | null;
}

export class ParticipationView {
  @ApiProperty() id!: string;
  @ApiProperty() membership_id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) forfait!: string | null;
  @ApiProperty() is_random!: boolean;
  @ApiPropertyOptional({ type: Number, nullable: true }) round_number!: number | null;
}

export class ContributionView {
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

export class TontineRoundView {
  @ApiProperty() id!: string;
  @ApiProperty() round_number!: number;
  @ApiProperty() beneficiary_id!: string;
  @ApiProperty() beneficiary_name!: string;
  @ApiProperty() expected_date!: string;
  @ApiProperty() payout_amount!: string;
  @ApiProperty() paid!: boolean;
  @ApiProperty({ type: String, nullable: true }) paid_at!: string | null;
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

export class SessionMemberContributionView {
  @ApiProperty() contribution_id!: string;
  @ApiProperty() member_id!: string;
  @ApiProperty() member_name!: string;
  @ApiProperty() amount!: string;
  @ApiProperty() reference!: string;
}

export class CampaignSessionView {
  @ApiProperty() session_date!: string;
  @ApiProperty() total_amount!: string;
  @ApiProperty() count!: number;
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
