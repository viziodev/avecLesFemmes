import { memberCalendars } from '../common/member-rotation';
import { memberRotation } from '../common/member-rotation';
import {
  BadRequestException,
  Body,
  Put,
  Controller,
  Get,
  Module,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MemberHistoryController } from './member-history.controller';
import { Database } from '../database/database.module';
import { AuthRequest } from '../auth/auth.module';
import { requireGroup } from '../common/access';
import { findCampaign } from '../campaigns/campaigns.module';
import { isTontine } from '../common/tontine-schedule';
import { savingsToday, savingsType, scheduledSavingsDay } from '../common/savings-schedule';
import {
  CampaignShortcutsDto,
  MemberShortcutsView,
  MemberPortalCampaignPage,
  MemberPortalStatusView,
  PageDto,
} from '../common/dto';

@ApiTags('Espace membre')
@Controller('groupements/:groupId/member/campaigns')
export class MemberController {
  constructor(private readonly db: Database) {}
  @Get()
  @ApiOperation({ operationId: 'memberCampaigns' })
  @ApiOkResponse({ type: MemberPortalCampaignPage })
  list(
    @Req() req: AuthRequest,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Query() page: PageDto,
  ) {
    return this.db.run(req.actor, async (c) => {
      await requireGroup(c, groupId);
      const filter = `p.group_id=$1 AND m.user_id=$2 AND m.active AND NOT m.is_blocked AND x.active`;
      const count = await c.query(
        `SELECT count(*) FROM participations p JOIN memberships m ON m.id=p.membership_id JOIN campaigns x ON x.id=p.campaign_id WHERE ${filter}`,
        [groupId, req.actor.id],
      );
      const r = await c.query(
        `SELECT x.id,x.name,x.start_date::text,x.end_date::text,x.weekday,x.monthly_week,x.interval_weeks,x.active,t.name type_name,t.code type_code,x.rotation_interval,x.is_mandatory,x.standard_amount::text,
        p.id participation_id,p.forfait::text,p.is_random,p.created_at::date::text enrolled_on,
        (SELECT coalesce(sum(cb.amount),0)::text FROM contributions cb WHERE cb.participation_id=p.id AND cb.voided_at IS NULL) total_paid,
        (SELECT count(*)::int FROM savings_sessions ss WHERE ss.campaign_id=x.id AND ss.session_date >= p.created_at::date AND ss.session_date < $3::date
         AND NOT EXISTS(SELECT 1 FROM contributions cb WHERE cb.participation_id=p.id AND cb.paid_on=ss.session_date AND cb.voided_at IS NULL)) arrears_count,
        (SELECT count(*)::int FROM savings_sessions ss WHERE ss.campaign_id=x.id AND ss.session_date >= p.created_at::date AND ss.session_date <= $3::date
         AND NOT EXISTS(SELECT 1 FROM contributions cb WHERE cb.participation_id=p.id AND cb.paid_on=ss.session_date AND cb.voided_at IS NULL)) unpaid_count
        FROM participations p JOIN memberships m ON m.id=p.membership_id JOIN campaigns x ON x.id=p.campaign_id JOIN campaign_types t ON t.id=x.type_id
        WHERE ${filter} ORDER BY x.created_at DESC,x.id LIMIT $4 OFFSET $5`,
        [groupId, req.actor.id, savingsToday(), page.limit, (page.page - 1) * page.limit],
      );
      const calendars = await memberCalendars(c, r.rows);
      const paid = calendars.size
        ? await c.query(
            'SELECT participation_id,paid_on::text FROM contributions WHERE participation_id=ANY($1::uuid[]) AND voided_at IS NULL',
            [r.rows.filter((x: any) => calendars.has(x.id)).map((x: any) => x.participation_id)],
          )
        : { rows: [] };
      const items = r.rows.map(({ enrolled_on, ...row }: any) => ({
        ...row,
        unpaid_count: calendars.has(row.id)
          ? calendars
              .get(row.id)!
              .filter(
                (round) =>
                  round.drawn &&
                  round.expected_date >= enrolled_on &&
                  round.expected_date <= savingsToday() &&
                  !paid.rows.some(
                    (p: any) =>
                      p.participation_id === row.participation_id &&
                      p.paid_on >= round.expected_date &&
                      p.paid_on < round.period_end,
                  ),
              ).length
          : row.unpaid_count,
      }));
      return { items, total: Number(count.rows[0].count) };
    });
  }
  @Get('shortcuts')
  @ApiOperation({ operationId: 'memberShortcuts' })
  @ApiOkResponse({ type: MemberShortcutsView })
  shortcuts(@Req() req: AuthRequest, @Param('groupId', ParseUUIDPipe) groupId: string) {
    return this.preference(req, groupId);
  }
  @Put('shortcuts')
  @ApiOperation({ operationId: 'saveMemberShortcuts' })
  @ApiOkResponse({ type: MemberShortcutsView })
  saveShortcuts(
    @Req() req: AuthRequest,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() input: CampaignShortcutsDto,
  ) {
    return this.preference(req, groupId, input);
  }
  private preference(req: AuthRequest, groupId: string, input?: CampaignShortcutsDto) {
    return this.db.run(req.actor, async (c) => {
      await requireGroup(c, groupId);
      const active = await c.query(
        'SELECT x.id FROM campaigns x JOIN participations p ON p.campaign_id=x.id JOIN memberships m ON m.id=p.membership_id WHERE x.group_id=$1 AND x.active AND m.user_id=$2 AND m.active AND NOT m.is_blocked ORDER BY x.created_at DESC,x.id',
        [groupId, req.actor.id],
      );
      if (input) {
        if (input.campaignIds.some((id) => !active.rows.some((r: any) => r.id === id)))
          throw new BadRequestException('Sélectionnez uniquement vos campagnes actives inscrites.');
        await c.query(
          'INSERT INTO member_campaign_shortcut_preferences(user_id,group_id,campaign_ids) VALUES($1,$2,$3::uuid[]) ON CONFLICT(user_id,group_id) DO UPDATE SET campaign_ids=excluded.campaign_ids,updated_at=now()',
          [req.actor.id, groupId, input.campaignIds],
        );
      }
      const saved = await c.query(
        'SELECT campaign_ids FROM member_campaign_shortcut_preferences WHERE user_id=$1 AND group_id=$2',
        [req.actor.id, groupId],
      );
      const ids = saved.rows[0]?.campaign_ids ?? active.rows.slice(0, 6).map((r: any) => r.id);
      return { campaignIds: ids.filter((id: string) => active.rows.some((r: any) => r.id === id)) };
    });
  }
  @Get(':campaignId')
  @ApiOperation({ operationId: 'memberCampaignStatus' })
  @ApiOkResponse({ type: MemberPortalStatusView })
  status(
    @Req() req: AuthRequest,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
  ) {
    return this.db.run(req.actor, async (c) => {
      await requireGroup(c, groupId);
      const campaign = await findCampaign(c, groupId, campaignId);
      const own = await c.query(
        'SELECT p.id FROM participations p JOIN memberships m ON m.id=p.membership_id WHERE p.campaign_id=$1 AND m.user_id=$2 AND m.active AND NOT m.is_blocked',
        [campaignId, req.actor.id],
      );
      if (!own.rows[0]) throw new BadRequestException('Vous ne participez pas à cette campagne.');
      const today = savingsToday();
      const payments = await c.query(
        'SELECT paid_on::text,amount::text FROM contributions WHERE participation_id=$1 AND voided_at IS NULL',
        [own.rows[0].id],
      );
      const sessions = await c.query(
        'SELECT session_date::text FROM savings_sessions WHERE campaign_id=$1 AND session_date <= $2::date ORDER BY session_date DESC',
        [campaignId, today],
      );
      const savings = await savingsType(c, campaign.type_id);
      const tontine = await isTontine(c, campaign.type_id);
      const rounds = tontine ? await memberRotation(c, campaign) : [];
      for (const r of rounds)
        r.my_paid_amount = payments.rows
          .filter((p: any) => p.paid_on >= r.expected_date && p.paid_on < r.period_end)
          .reduce((s: bigint, p: any) => s + BigInt(p.amount), 0n)
          .toString();
      const period = rounds.find((r) => today >= r.expected_date && today < r.period_end);
      const already_paid = savings
        ? payments.rows.some((p: any) => p.paid_on === today)
        : !!period && period.my_paid_amount !== '0';
      const active =
        campaign.active &&
        today >= new Date(campaign.start_date).toISOString().slice(0, 10) &&
        today <= new Date(campaign.end_date).toISOString().slice(0, 10);
      const launched = savings
        ? scheduledSavingsDay(campaign, today) &&
          sessions.rows.some((s: any) => s.session_date === today)
        : tontine && !!period?.drawn;
      const end = rounds.at(-1)?.period_end;
      let remaining_months = 0;
      if (end && end > today) {
        const a = new Date(today + 'T12:00:00Z'),
          b = new Date(end + 'T12:00:00Z');
        remaining_months =
          (b.getUTCFullYear() - a.getUTCFullYear()) * 12 +
          b.getUTCMonth() -
          a.getUTCMonth() +
          (b.getUTCDate() > a.getUTCDate() ? 1 : 0);
      }
      return {
        today,
        can_pay: !!active && !!launched && !already_paid,
        already_paid,
        reason: already_paid
          ? 'Versement déjà effectué pour cette séance ou ce tour.'
          : !active
            ? 'Campagne hors période ou archivée.'
            : !launched
              ? savings
                ? 'La séance d’épargne du jour n’est pas ouverte.'
                : 'Le tour en cours attend son tirage.'
              : 'Versement disponible.',
        total_paid: payments.rows
          .reduce((s: bigint, p: any) => s + BigInt(p.amount), 0n)
          .toString(),
        sessions: sessions.rows.map((s: any) => s.session_date),
        rounds: rounds
          .filter((r) => r.expected_date <= today)
          .sort((a, b) => b.expected_date.localeCompare(a.expected_date)),
        payouts_count: rounds.filter((r) => r.paid).length,
        remaining_months,
      };
    });
  }
}
@Module({ controllers: [MemberController, MemberHistoryController] })
export class MemberModule {}
