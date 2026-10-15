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
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(12) @MaxLength(128) password?: string;
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() admin: boolean = false;
}
export class CreateTypeDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @ApiProperty() @IsString() @Matches(/^[A-Z][A-Z0-9_]{1,39}$/) code!: string;
}
export class CreateCampaignDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() typeId!: string;
  @ApiProperty() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) startDate!: string;
  @ApiProperty() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) endDate!: string;
  @ApiProperty({ minimum: 0, maximum: 6 }) @IsInt() @Min(0) @Max(6) weekday!: number;
  @ApiProperty({ default: 1 }) @IsInt() @Min(1) @Max(52) intervalWeeks: number = 1;
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
export class MemberView {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) phone!: string | null;
  @ApiProperty({ enum: ['ADMIN', 'MEMBER'] }) role!: 'ADMIN' | 'MEMBER';
  @ApiProperty() active!: boolean;
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
}
export class ParticipationView {
  @ApiProperty() id!: string;
  @ApiProperty() membership_id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) forfait!: string | null;
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
