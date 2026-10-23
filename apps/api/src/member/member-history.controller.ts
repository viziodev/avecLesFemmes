import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Database, SqlClient } from '../database/database.module';
import { AuthRequest } from '../auth/auth.module';
import { requireGroup } from '../common/access';
import { memberCalendars } from '../common/member-rotation';
import { savingsToday } from '../common/savings-schedule';
import {
  MemberHistoryOptionsView,
  MemberHistoryPage,
  MemberHistoryQueryDto,
  validDate,
} from '../common/dto';
const isSavings = (x: any) =>
  /avec|epargne/.test(
    `${x.type_code} ${x.type_name}`
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase(),
  );
async function context(c: SqlClient, groupId: string, userId: string) {
  const rows = await c.query(
    `SELECT x.id,x.name,x.active,x.type_id,t.name type_name,t.code type_code,x.start_date::text,x.rotation_interval,x.weekday,x.monthly_week,p.id participation_id
  FROM participations p JOIN memberships m ON m.id=p.membership_id JOIN campaigns x ON x.id=p.campaign_id JOIN campaign_types t ON t.id=x.type_id
  WHERE p.group_id=$1 AND m.user_id=$2 AND m.active AND NOT m.is_blocked ORDER BY x.created_at DESC,x.id`,
    [groupId, userId],
  );
  const calendars = await memberCalendars(c, rows.rows);
  const periods = rows.rows.flatMap((campaign: any) =>
    (calendars.get(campaign.id) || []).map((r) => ({
      ...r,
      key: `${campaign.id}:${r.round_number}`,
      campaign_id: campaign.id,
      campaign_name: campaign.name,
    })),
  );
  return {
    campaigns: rows.rows,
    periods,
    savingsIds: rows.rows.filter(isSavings).map((x: any) => x.id),
  };
}
@ApiTags('Espace membre')
@Controller('groupements/:groupId/member/history')
export class MemberHistoryController {
  constructor(private readonly db: Database) {}
  @Get('options')
  @ApiOperation({ operationId: 'memberHistoryOptions' })
  @ApiOkResponse({ type: MemberHistoryOptionsView })
  options(@Req() req: AuthRequest, @Param('groupId', ParseUUIDPipe) groupId: string) {
    return this.db.run(req.actor, async (c) => {
      await requireGroup(c, groupId);
      const data = await context(c, groupId, req.actor.id);
      const sessions = await c.query(
        `SELECT DISTINCT session_date::text AS session_date FROM (
        SELECT ss.session_date AS session_date FROM savings_sessions ss JOIN participations p ON p.campaign_id=ss.campaign_id JOIN memberships m ON m.id=p.membership_id
         WHERE ss.group_id=$1 AND ss.campaign_id=ANY($3::uuid[]) AND m.user_id=$2 AND m.active AND NOT m.is_blocked
        UNION SELECT cb.paid_on AS session_date FROM contributions cb JOIN participations p ON p.id=cb.participation_id JOIN memberships m ON m.id=p.membership_id
         WHERE cb.group_id=$1 AND cb.campaign_id=ANY($3::uuid[]) AND m.user_id=$2 AND m.active AND NOT m.is_blocked
      ) s WHERE session_date <= $4::date ORDER BY session_date DESC`,
        [groupId, req.actor.id, data.savingsIds, savingsToday()],
      );
      return {
        campaigns: data.campaigns.map(
          ({ id, name, active, type_id, type_name, type_code }: any) => ({
            id,
            name,
            active,
            type_id,
            type_name,
            type_code,
          }),
        ),
        sessions: sessions.rows.map((s: any) => s.session_date),
        rounds: data.periods
          .filter((r) => r.expected_date <= savingsToday())
          .sort((a, b) => b.expected_date.localeCompare(a.expected_date))
          .map(({ key, campaign_id, campaign_name, round_number, expected_date }) => ({
            key,
            campaign_id,
            campaign_name,
            round_number,
            expected_date,
          })),
      };
    });
  }
  @Get()
  @ApiOperation({ operationId: 'memberHistory' })
  @ApiOkResponse({ type: MemberHistoryPage })
  list(
    @Req() req: AuthRequest,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Query() page: MemberHistoryQueryDto,
  ) {
    if (page.sessions?.some((d) => !validDate(d)))
      throw new BadRequestException('Séance invalide.');
    return this.db.run(req.actor, async (c) => {
      await requireGroup(c, groupId);
      const data = await context(c, groupId, req.actor.id);
      const params = [
        groupId,
        req.actor.id,
        JSON.stringify(data.periods),
        page.campaignIds || [],
        page.typeIds || [],
        page.sessions || [],
        page.rounds || [],
        data.savingsIds,
      ];
      const from = `WITH periods AS (SELECT * FROM jsonb_to_recordset($3::jsonb) AS r(campaign_id uuid,key text,round_number int,expected_date date,period_end date))
      SELECT_FIELDS FROM contributions cb JOIN participations p ON p.id=cb.participation_id JOIN memberships m ON m.id=p.membership_id JOIN campaigns x ON x.id=cb.campaign_id JOIN campaign_types t ON t.id=x.type_id
      LEFT JOIN periods r ON r.campaign_id=x.id AND cb.paid_on>=r.expected_date AND cb.paid_on<r.period_end
      WHERE cb.group_id=$1 AND m.user_id=$2 AND m.active AND NOT m.is_blocked
      AND (cardinality($4::uuid[])=0 OR x.id=ANY($4::uuid[]))
      AND (cardinality($5::uuid[])=0 OR t.id=ANY($5::uuid[]))
      AND ((cardinality($6::date[])=0 AND cardinality($7::text[])=0) OR (x.id=ANY($8::uuid[]) AND cb.paid_on=ANY($6::date[])) OR r.key=ANY($7::text[]))`;
      const count = await c.query(
        from.replace(
          'SELECT_FIELDS',
          'SELECT count(*)::int total,coalesce(sum(cb.amount) FILTER(WHERE cb.voided_at IS NULL),0)::text total_paid',
        ),
        params,
      );
      const result = await c.query(
        from.replace(
          'SELECT_FIELDS',
          `SELECT cb.id,cb.created_at::text,cb.participation_id,m.name,cb.amount::text,cb.paid_on::text,cb.reference,cb.voided_at::text,
      x.id campaign_id,x.name campaign_name,x.active campaign_active,t.id type_id,t.name type_name,t.code type_code,
      CASE WHEN x.id=ANY($8::uuid[]) THEN cb.paid_on::text ELSE NULL END session_date,r.round_number`,
        ) + ` ORDER BY cb.paid_on DESC,cb.created_at DESC,cb.id LIMIT $9 OFFSET $10`,
        [...params, page.limit, (page.page - 1) * page.limit],
      );
      return { items: result.rows, ...count.rows[0] };
    });
  }
}
