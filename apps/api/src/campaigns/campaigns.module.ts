import {
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { Actor, Database, SqlClient } from '../database/database.module';
import { AuthRequest } from '../auth/auth.module';
import {
  ActivationDto,
  CampaignPage,
  CampaignSessionView,
  CampaignView,
  CashboxStateView,
  CreateCampaignDto,
  CreateGracePeriodDto,
  DashboardView,
  GracePeriodView,
  PageDto,
  ParticipationDto,
  ParticipationPage,
  ParticipationView,
  ScopeDto,
  ScopedPageDto,
  SuperDashboardView,
  TontineReorderDto,
  TontineRoundView,
  validDate,
} from '../common/dto';
import { audit, requireGroup, requireSuper } from '../common/access';

export async function findCampaign(c: SqlClient, groupId: string, id: string, lock = false) {
  const r = await c.query(
    `SELECT * FROM campaigns WHERE group_id=$1 AND id=$2${lock ? ' FOR UPDATE' : ''}`,
    [groupId, id],
  );
  if (!r.rows[0]) throw new NotFoundException('Campagne introuvable.');
  return r.rows[0];
}

function addInterval(baseDate: string, index: number, interval?: string | null): string {
  const d = new Date(baseDate + 'T12:00:00Z');
  const safeInterval = interval || 'MONTHLY';
  if (safeInterval === 'WEEKLY') {
    d.setUTCDate(d.getUTCDate() + index * 7);
  } else if (safeInterval === 'BIWEEKLY') {
    d.setUTCDate(d.getUTCDate() + index * 14);
  } else {
    d.setUTCMonth(d.getUTCMonth() + index);
  }
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class CampaignsService {
  constructor(private readonly db: Database) {}

  list(actor: Actor, groupId: string, page: PageDto) {
    return this.db.run(actor, async (c) => {
      await requireGroup(c, groupId);
      const count = await c.query('SELECT count(*) FROM campaigns WHERE group_id=$1', [groupId]);
      const r = await c.query(
        `SELECT x.*, x.start_date::text, x.end_date::text, t.name type_name, t.code type_code,
                e.id event_id, e.name event_name, e.code event_code,
                x.standard_amount::text standard_amount,
                (SELECT count(*) FROM participations p WHERE p.campaign_id=x.id)::int member_count,
                (SELECT coalesce(sum(c.amount),0) FROM contributions c WHERE c.campaign_id=x.id AND c.voided_at IS NULL)::text collected_amount,
                (SELECT count(DISTINCT c.paid_on) FROM contributions c WHERE c.campaign_id=x.id AND c.voided_at IS NULL)::int session_count,
                (SELECT count(*) FROM tontine_rounds tr WHERE tr.campaign_id=x.id AND tr.paid=true)::int payouts_count,
                (SELECT count(*) FROM tontine_rounds tr WHERE tr.campaign_id=x.id AND tr.paid=false)::int remaining_count,
                (SELECT min(tr.expected_date::text) FROM tontine_rounds tr WHERE tr.campaign_id=x.id AND tr.paid=false) next_due_date
         FROM campaigns x
         JOIN campaign_types t ON t.id=x.type_id
         LEFT JOIN campaign_events e ON e.id=x.event_id
         WHERE x.group_id=$1
         ORDER BY x.created_at DESC, x.id LIMIT $2 OFFSET $3`,
        [groupId, page.limit, (page.page - 1) * page.limit],
      );
      return { items: r.rows, total: Number(count.rows[0].count) };
    });
  }

  create(actor: Actor, groupId: string, input: CreateCampaignDto) {
    const today = new Date();
    const startDate = input.startDate || today.toISOString().slice(0, 10);
    let endDate = input.endDate;
    if (!endDate) {
      const nextYear = new Date(today);
      nextYear.setFullYear(today.getFullYear() + 1);
      endDate = nextYear.toISOString().slice(0, 10);
    }
    if (!validDate(startDate) || !validDate(endDate) || endDate < startDate)
      throw new BadRequestException('Période de campagne invalide.');
    const weekday = input.weekday !== undefined ? input.weekday : 2;
    const intervalWeeks = input.intervalWeeks !== undefined ? input.intervalWeeks : 1;

    return this.db.run(actor, async (c) => {
      await requireGroup(c, groupId, true);
      const type = await c.query('SELECT * FROM campaign_types WHERE id=$1', [input.typeId]);
      if (!type.rows[0]) throw new NotFoundException('Type introuvable.');

      let eventId = input.eventId;
      if (!eventId) {
        const ev = await c.query("SELECT id FROM campaign_events WHERE code='AVEC' LIMIT 1");
        eventId = ev.rows[0]?.id;
      }

      const id = randomUUID();
      const r = await c.query(
        `INSERT INTO campaigns(
           id, group_id, type_id, name, start_date, end_date, weekday, interval_weeks, rule_version,
           event_id, is_mandatory, standard_amount, rotation_interval, due_day
         ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         RETURNING *, start_date::text, end_date::text, standard_amount::text`,
        [
          id,
          groupId,
          input.typeId,
          input.name,
          startDate,
          endDate,
          weekday,
          intervalWeeks,
          type.rows[0].rule_version,
          eventId || null,
          input.isMandatory ?? false,
          input.standardAmount || null,
          input.rotationInterval || null,
          input.dueDay || null,
        ],
      );

      const evInfo = eventId
        ? await c.query('SELECT name, code FROM campaign_events WHERE id=$1', [eventId])
        : { rows: [] };

      await audit(c, actor, groupId, 'CAMPAIGN_CREATED', id, {
        standardAmount: input.standardAmount,
        eventId,
      });

      return {
        ...r.rows[0],
        type_name: type.rows[0].name,
        event_id: eventId || null,
        event_name: evInfo.rows[0]?.name || null,
        event_code: evInfo.rows[0]?.code || null,
      };
    });
  }

  activate(actor: Actor, groupId: string, id: string, input: ActivationDto) {
    requireSuper(actor);
    return this.db.run(actor, async (c) => {
      await requireGroup(c, groupId);
      await findCampaign(c, groupId, id);
      await c.query('SELECT set_campaign_activation($1,$2)', [id, input.active]);
      await audit(c, actor, groupId, 'CAMPAIGN_ACTIVATION', id, { active: input.active });
      return { id, active: input.active };
    });
  }

  participants(actor: Actor, groupId: string, id: string, page: ScopedPageDto) {
    return this.db.run(actor, async (c) => {
      await requireGroup(c, groupId);
      await findCampaign(c, groupId, id);
      const personal = page.scope === 'personal';
      const count = await c.query(
        'SELECT count(*) FROM participations WHERE campaign_id=$1 AND (NOT $2::boolean OR app_owns_membership(membership_id))',
        [id, personal],
      );
      const r = await c.query(
        `SELECT p.id, p.membership_id, m.name, p.forfait::text, p.is_random, p.round_number
         FROM participations p
         JOIN memberships m ON m.id=p.membership_id
         WHERE p.campaign_id=$1 AND (NOT $4::boolean OR app_owns_membership(p.membership_id))
         ORDER BY m.name, p.id LIMIT $2 OFFSET $3`,
        [id, page.limit, (page.page - 1) * page.limit, personal],
      );
      return { items: r.rows, total: Number(count.rows[0].count) };
    });
  }

  participate(actor: Actor, groupId: string, id: string, input: ParticipationDto) {
    return this.db.run(actor, async (c) => {
      await requireGroup(c, groupId, true);
      const campaign = await findCampaign(c, groupId, id, true);
      if (!campaign.active) throw new BadRequestException('Campagne désactivée.');

      const member = await c.query(
        'SELECT * FROM memberships WHERE id=$1 AND group_id=$2 AND active',
        [input.membershipId, groupId],
      );
      if (!member.rows[0]) throw new NotFoundException('Membre introuvable.');
      if (member.rows[0].is_blocked)
        throw new ForbiddenException('Ce membre est actuellement bloqué.');

      const isRandom = input.isRandom ?? false;
      const forfait = isRandom ? null : (input.forfait ?? campaign.standard_amount ?? null);

      const r = await c.query(
        `INSERT INTO participations(id, group_id, campaign_id, membership_id, forfait, is_random, round_number)
         VALUES($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT(campaign_id, membership_id)
         DO UPDATE SET forfait=excluded.forfait, is_random=excluded.is_random, round_number=excluded.round_number
         RETURNING id, membership_id, forfait::text, is_random, round_number`,
        [
          randomUUID(),
          groupId,
          id,
          input.membershipId,
          forfait,
          isRandom,
          input.roundNumber || null,
        ],
      );

      await audit(c, actor, groupId, 'PARTICIPATION_CONFIGURED', r.rows[0].id, {
        forfait,
        isRandom,
        roundNumber: input.roundNumber || null,
      });

      return { ...r.rows[0], name: member.rows[0].name };
    });
  }

  dashboard(actor: Actor, groupId: string, id: string, input: ScopeDto) {
    return this.db.run(actor, async (c) => {
      await requireGroup(c, groupId);
      await findCampaign(c, groupId, id);
      const personal = input.scope === 'personal';
      const r = await c.query(
        'SELECT coalesce(sum(amount),0)::text total, count(*)::text payments FROM contributions WHERE campaign_id=$1 AND voided_at IS NULL AND (NOT $2::boolean OR app_owns_participation(participation_id))',
        [id, personal],
      );
      const participants = await c.query(
        'SELECT count(*)::text participants FROM participations WHERE campaign_id=$1 AND (NOT $2::boolean OR app_owns_membership(membership_id))',
        [id, personal],
      );
      const admin = await c.query('SELECT app_is_admin($1) admin', [groupId]);
      return {
        ...r.rows[0],
        participants: participants.rows[0].participants,
        personal: personal || (!actor.isSuper && !admin.rows[0].admin),
        updatedAt: new Date().toISOString(),
      };
    });
  }

  // Tontine Rotative - Tirage au sort et attribution des cagnottes
  generateTontineDraw(actor: Actor, groupId: string, campaignId: string) {
    return this.db.run(actor, async (c) => {
      await requireGroup(c, groupId, true);
      const camp = await findCampaign(c, groupId, campaignId, true);
      const standardAmount = Number(camp.standard_amount || 5000);

      // Récupérer les participantes de la campagne
      const parts = await c.query(
        `SELECT p.id as participation_id, p.membership_id, m.name
         FROM participations p
         JOIN memberships m ON m.id=p.membership_id
         WHERE p.campaign_id=$1 AND p.group_id=$2 AND m.active AND NOT m.is_blocked`,
        [campaignId, groupId],
      );

      if (parts.rows.length < 2)
        throw new BadRequestException(
          'Au moins 2 participantes requises pour un tirage de tontine.',
        );

      // Tirage au sort (Fisher-Yates shuffle)
      const shuffled = [...parts.rows];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      const payout = shuffled.length * standardAmount;
      const startDate = new Date(camp.start_date).toISOString().slice(0, 10);

      await c.query('DELETE FROM tontine_rounds WHERE campaign_id=$1', [campaignId]);

      const rounds: any[] = [];
      let lastDate = startDate;

      for (let i = 0; i < shuffled.length; i++) {
        const roundNumber = i + 1;
        const participant = shuffled[i];
        const expectedDate = addInterval(startDate, i, camp.rotation_interval);
        lastDate = expectedDate;
        const roundId = randomUUID();

        await c.query(
          `INSERT INTO tontine_rounds(id, campaign_id, group_id, round_number, beneficiary_id, expected_date, payout_amount)
           VALUES($1, $2, $3, $4, $5, $6, $7)`,
          [
            roundId,
            campaignId,
            groupId,
            roundNumber,
            participant.membership_id,
            expectedDate,
            payout,
          ],
        );

        await c.query('UPDATE participations SET round_number=$1 WHERE id=$2', [
          roundNumber,
          participant.participation_id,
        ]);

        rounds.push({
          id: roundId,
          round_number: roundNumber,
          beneficiary_id: participant.membership_id,
          beneficiary_name: participant.name,
          expected_date: expectedDate,
          payout_amount: payout.toString(),
          paid: false,
          paid_at: null,
        });
      }

      // Ajuster automatiquement la date de fin de la campagne
      await c.query('UPDATE campaigns SET end_date=$1 WHERE id=$2', [lastDate, campaignId]);
      await audit(c, actor, groupId, 'TONTINE_DRAW_GENERATED', campaignId, {
        roundsCount: rounds.length,
      });

      return rounds;
    });
  }

  listTontineRounds(actor: Actor, groupId: string, campaignId: string) {
    return this.db.run(actor, async (c) => {
      await requireGroup(c, groupId);
      const r = await c.query(
        `SELECT tr.id, tr.round_number, tr.beneficiary_id, m.name beneficiary_name,
                tr.expected_date::text, tr.payout_amount::text, tr.paid, tr.paid_at::text
         FROM tontine_rounds tr
         JOIN memberships m ON m.id=tr.beneficiary_id
         WHERE tr.campaign_id=$1
         ORDER BY tr.round_number`,
        [campaignId],
      );
      return r.rows;
    });
  }

  reorderTontineRounds(
    actor: Actor,
    groupId: string,
    campaignId: string,
    input: TontineReorderDto,
  ) {
    return this.db.run(actor, async (c) => {
      await requireGroup(c, groupId, true);
      for (const round of input.rounds) {
        await c.query(
          `UPDATE tontine_rounds
           SET beneficiary_id=$1, expected_date=$2, payout_amount=$3
           WHERE campaign_id=$4 AND round_number=$5`,
          [
            round.beneficiaryId,
            round.expectedDate,
            round.payoutAmount,
            campaignId,
            round.roundNumber,
          ],
        );
      }
      await audit(c, actor, groupId, 'TONTINE_ROUNDS_REORDERED', campaignId);
      return this.listTontineRounds(actor, groupId, campaignId);
    });
  }

  payTontineRound(actor: Actor, groupId: string, campaignId: string, roundNumber: number) {
    return this.db.run(actor, async (c) => {
      await requireGroup(c, groupId, true);
      const r = await c.query(
        `UPDATE tontine_rounds
         SET paid=true, paid_at=now(), paid_by=$1
         WHERE campaign_id=$2 AND round_number=$3
         RETURNING *`,
        [actor.id, campaignId, roundNumber],
      );
      if (!r.rows[0]) throw new NotFoundException('Tour de tontine introuvable.');
      await audit(c, actor, groupId, 'TONTINE_ROUND_PAID', r.rows[0].id, { roundNumber });
      return { ok: true, roundNumber, paid: true };
    });
  }

  // Délais de grâce
  createGracePeriod(
    actor: Actor,
    groupId: string,
    campaignId: string,
    input: CreateGracePeriodDto,
  ) {
    return this.db.run(actor, async (c) => {
      await requireGroup(c, groupId, true);
      const id = randomUUID();
      const r = await c.query(
        `INSERT INTO contribution_grace_periods(id, group_id, campaign_id, membership_id, period_date, extended_deadline, reason, granted_by)
         VALUES($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, membership_id, period_date::text, extended_deadline::text, reason, created_at::text`,
        [
          id,
          groupId,
          campaignId,
          input.membershipId,
          input.periodDate,
          input.extendedDeadline,
          input.reason || null,
          actor.id,
        ],
      );
      const member = await c.query('SELECT name FROM memberships WHERE id=$1', [
        input.membershipId,
      ]);
      await audit(c, actor, groupId, 'GRACE_PERIOD_GRANTED', id, input);
      return { ...r.rows[0], member_name: member.rows[0]?.name || '' };
    });
  }

  listGracePeriods(actor: Actor, groupId: string, campaignId: string) {
    return this.db.run(actor, async (c) => {
      await requireGroup(c, groupId);
      const r = await c.query(
        `SELECT gp.id, gp.membership_id, m.name member_name, gp.period_date::text, gp.extended_deadline::text, gp.reason, gp.created_at::text
         FROM contribution_grace_periods gp
         JOIN memberships m ON m.id=gp.membership_id
         WHERE gp.campaign_id=$1
         ORDER BY gp.period_date DESC`,
        [campaignId],
      );
      return r.rows;
    });
  }

  // Cahier de séance (Détails des séances avec total encaissé et cotisation par membre)
  sessions(actor: Actor, groupId: string, campaignId: string) {
    return this.db.run(actor, async (c) => {
      await requireGroup(c, groupId);
      const r = await c.query(
        `SELECT x.id contribution_id, x.paid_on::text, x.amount::text, x.reference, m.id member_id, m.name member_name
         FROM contributions x
         JOIN participations p ON p.id=x.participation_id
         JOIN memberships m ON m.id=p.membership_id
         WHERE x.campaign_id=$1 AND x.voided_at IS NULL
         ORDER BY x.paid_on DESC, x.created_at DESC`,
        [campaignId],
      );

      const map = new Map<string, { total: bigint; items: any[] }>();
      for (const row of r.rows) {
        let entry = map.get(row.paid_on);
        if (!entry) {
          entry = { total: 0n, items: [] };
          map.set(row.paid_on, entry);
        }
        entry.total += BigInt(row.amount);
        entry.items.push({
          contribution_id: row.contribution_id,
          member_id: row.member_id,
          member_name: row.member_name,
          amount: row.amount,
          reference: row.reference,
        });
      }

      const sessions: CampaignSessionView[] = [];
      for (const [date, val] of map.entries()) {
        sessions.push({
          session_date: date,
          total_amount: val.total.toString(),
          count: val.items.length,
          contributions: val.items,
        });
      }

      return sessions;
    });
  }

  // État de la caisse par campagne
  cashboxState(actor: Actor, groupId: string, campaignId: string) {
    return this.db.run(actor, async (c) => {
      await requireGroup(c, groupId);
      const camp = await findCampaign(c, groupId, campaignId);
      const collected = await c.query(
        'SELECT coalesce(sum(amount),0)::text total FROM contributions WHERE campaign_id=$1 AND voided_at IS NULL',
        [campaignId],
      );
      const paidOut = await c.query(
        'SELECT coalesce(sum(payout_amount),0)::text total FROM tontine_rounds WHERE campaign_id=$1 AND paid=true',
        [campaignId],
      );
      const totColl = BigInt(collected.rows[0].total);
      const totPaid = BigInt(paidOut.rows[0].total);
      const balance = (totColl - totPaid).toString();

      return {
        campaign_id: campaignId,
        campaign_name: camp.name,
        total_collected: totColl.toString(),
        total_paid_out: totPaid.toString(),
        balance,
      };
    });
  }

  // Cockpit 360° Super Admin
  superDashboard(actor: Actor) {
    requireSuper(actor);
    return this.db.run(actor, async (c) => {
      const gCount = await c.query('SELECT count(*) FROM groupements WHERE active');
      const mCount = await c.query('SELECT count(*) FROM memberships WHERE active');
      const cCount = await c.query('SELECT count(*) FROM campaigns WHERE active');
      const coll = await c.query(
        `SELECT coalesce(sum(c.amount),0)::text total
         FROM contributions c
         JOIN campaigns cp ON cp.id=c.campaign_id
         WHERE c.voided_at IS NULL AND cp.active`,
      );

      const boxes = await c.query(
        `SELECT x.id campaign_id, x.name campaign_name,
                coalesce(sum(cb.amount),0)::text total_collected,
                coalesce((SELECT sum(tr.payout_amount) FROM tontine_rounds tr WHERE tr.campaign_id=x.id AND tr.paid),0)::text total_paid_out
         FROM campaigns x
         LEFT JOIN contributions cb ON cb.campaign_id=x.id AND cb.voided_at IS NULL
         WHERE x.active
         GROUP BY x.id, x.name
         ORDER BY x.name`,
      );

      const cashboxes: CashboxStateView[] = boxes.rows.map((b: any) => {
        const c1 = BigInt(b.total_collected);
        const p1 = BigInt(b.total_paid_out);
        return {
          campaign_id: b.campaign_id,
          campaign_name: b.campaign_name,
          total_collected: c1.toString(),
          total_paid_out: p1.toString(),
          balance: (c1 - p1).toString(),
        };
      });

      return {
        total_groups: Number(gCount.rows[0].count),
        total_members: Number(mCount.rows[0].count),
        total_campaigns: Number(cCount.rows[0].count),
        total_collected: coll.rows[0].total,
        cashboxes,
      };
    });
  }
}

@ApiTags('Campagnes')
@Controller('groupements/:groupId/campaigns')
export class CampaignsController {
  constructor(private readonly service: CampaignsService) {}

  @Get()
  @ApiOperation({ operationId: 'listCampaigns' })
  @ApiOkResponse({ type: CampaignPage })
  list(@Req() r: AuthRequest, @Param('groupId', ParseUUIDPipe) g: string, @Query() p: PageDto) {
    return this.service.list(r.actor, g, p);
  }

  @Post()
  @ApiOperation({ operationId: 'createCampaign' })
  @ApiCreatedResponse({ type: CampaignView })
  create(
    @Req() r: AuthRequest,
    @Param('groupId', ParseUUIDPipe) g: string,
    @Body() input: CreateCampaignDto,
  ) {
    return this.service.create(r.actor, g, input);
  }

  @Patch(':id/activation')
  @ApiOperation({ operationId: 'activateCampaign' })
  activate(
    @Req() r: AuthRequest,
    @Param('groupId', ParseUUIDPipe) g: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: ActivationDto,
  ) {
    return this.service.activate(r.actor, g, id, input);
  }

  @Get(':id/participants')
  @ApiOperation({ operationId: 'listParticipants' })
  @ApiOkResponse({ type: ParticipationPage })
  participants(
    @Req() r: AuthRequest,
    @Param('groupId', ParseUUIDPipe) g: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() p: ScopedPageDto,
  ) {
    return this.service.participants(r.actor, g, id, p);
  }

  @Post(':id/participants')
  @ApiOperation({ operationId: 'configureParticipant' })
  @ApiCreatedResponse({ type: ParticipationView })
  participate(
    @Req() r: AuthRequest,
    @Param('groupId', ParseUUIDPipe) g: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: ParticipationDto,
  ) {
    return this.service.participate(r.actor, g, id, input);
  }

  @Get(':id/dashboard')
  @ApiOperation({ operationId: 'campaignDashboard' })
  @ApiOkResponse({ type: DashboardView })
  dashboard(
    @Req() r: AuthRequest,
    @Param('groupId', ParseUUIDPipe) g: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() input: ScopeDto,
  ) {
    return this.service.dashboard(r.actor, g, id, input);
  }

  @Post(':id/tontine/draw')
  @ApiOperation({ operationId: 'generateTontineDraw' })
  @ApiCreatedResponse({ type: [TontineRoundView] })
  generateTontineDraw(
    @Req() r: AuthRequest,
    @Param('groupId', ParseUUIDPipe) g: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.generateTontineDraw(r.actor, g, id);
  }

  @Get(':id/tontine/rounds')
  @ApiOperation({ operationId: 'listTontineRounds' })
  @ApiOkResponse({ type: [TontineRoundView] })
  listTontineRounds(
    @Req() r: AuthRequest,
    @Param('groupId', ParseUUIDPipe) g: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.listTontineRounds(r.actor, g, id);
  }

  @Put(':id/tontine/rounds')
  @ApiOperation({ operationId: 'reorderTontineRounds' })
  @ApiOkResponse({ type: [TontineRoundView] })
  reorderTontineRounds(
    @Req() r: AuthRequest,
    @Param('groupId', ParseUUIDPipe) g: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: TontineReorderDto,
  ) {
    return this.service.reorderTontineRounds(r.actor, g, id, input);
  }

  @Patch(':id/tontine/rounds/:roundNumber/pay')
  @ApiOperation({ operationId: 'payTontineRound' })
  @ApiOkResponse({ description: 'Cagnotte marquée comme versée' })
  payTontineRound(
    @Req() r: AuthRequest,
    @Param('groupId', ParseUUIDPipe) g: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('roundNumber', ParseIntPipe) roundNumber: number,
  ) {
    return this.service.payTontineRound(r.actor, g, id, roundNumber);
  }

  @Post(':id/grace-periods')
  @ApiOperation({ operationId: 'createGracePeriod' })
  @ApiCreatedResponse({ type: GracePeriodView })
  createGracePeriod(
    @Req() r: AuthRequest,
    @Param('groupId', ParseUUIDPipe) g: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: CreateGracePeriodDto,
  ) {
    return this.service.createGracePeriod(r.actor, g, id, input);
  }

  @Get(':id/grace-periods')
  @ApiOperation({ operationId: 'listGracePeriods' })
  @ApiOkResponse({ type: [GracePeriodView] })
  listGracePeriods(
    @Req() r: AuthRequest,
    @Param('groupId', ParseUUIDPipe) g: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.listGracePeriods(r.actor, g, id);
  }

  @Get(':id/sessions')
  @ApiOperation({ operationId: 'listCampaignSessions' })
  @ApiOkResponse({ type: [CampaignSessionView] })
  sessions(
    @Req() r: AuthRequest,
    @Param('groupId', ParseUUIDPipe) g: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.sessions(r.actor, g, id);
  }

  @Get(':id/cashbox')
  @ApiOperation({ operationId: 'campaignCashbox' })
  @ApiOkResponse({ type: CashboxStateView })
  cashbox(
    @Req() r: AuthRequest,
    @Param('groupId', ParseUUIDPipe) g: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.cashboxState(r.actor, g, id);
  }
}

@ApiTags('Super Administration')
@Controller('super-admin')
export class SuperAdminController {
  constructor(private readonly service: CampaignsService) {}

  @Get('dashboard')
  @ApiOperation({ operationId: 'superAdminDashboard' })
  @ApiOkResponse({ type: SuperDashboardView })
  dashboard(@Req() r: AuthRequest) {
    return this.service.superDashboard(r.actor);
  }
}

@Module({
  controllers: [CampaignsController, SuperAdminController],
  providers: [CampaignsService],
  exports: [CampaignsService],
})
export class CampaignsModule {}
