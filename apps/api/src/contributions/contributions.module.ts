import { memberRotation } from '../common/member-rotation';
import { isTontine, tontinePeriod } from '../common/tontine-schedule';
import { savingsToday, scheduledSavingsDay, savingsType } from '../common/savings-schedule';
import {
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { Actor, Database } from '../database/database.module';
import { AuthRequest } from '../auth/auth.module';
import { digest } from '../auth/password';
import { audit, requireGroup } from '../common/access';
import {
  ContributionDto,
  SelfContributionDto,
  ContributionPage,
  ContributionView,
  ScopedPageDto,
  VoidDto,
  validDate,
} from '../common/dto';
import { findCampaign } from '../campaigns/campaigns.module';
@Injectable()
export class ContributionsService {
  constructor(private readonly db: Database) {}
  list(actor: Actor, groupId: string, campaignId: string, page: ScopedPageDto) {
    if (page.paidOn && !validDate(page.paidOn))
      throw new BadRequestException('Date de versement invalide.');
    if (
      [page.from, page.to].some((d) => d && !validDate(d)) ||
      (page.from && page.to && page.from > page.to)
    )
      throw new BadRequestException('Période de recherche invalide.');
    return this.db.run(actor, async (c) => {
      await requireGroup(c, groupId);
      await findCampaign(c, groupId, campaignId);
      const personal = page.scope === 'personal';
      const search = (page.q || '').trim();
      const paidOn = page.paidOn || null;
      const count = await c.query(
        `SELECT count(*) FROM contributions x JOIN participations p ON p.id=x.participation_id JOIN memberships m ON m.id=p.membership_id WHERE x.campaign_id=$1 AND (NOT $2::boolean OR app_owns_participation(x.participation_id)) AND (strpos(lower(m.name),lower($3))>0 OR strpos(coalesce(m.phone,''),$3)>0) AND ($4::date IS NULL OR x.paid_on=$4::date) AND ($5::date IS NULL OR x.paid_on >= $5::date) AND ($6::date IS NULL OR x.paid_on <= $6::date) AND ($7::text IS NULL OR (x.voided_at IS NOT NULL)=($7='voided'))`,
        [
          campaignId,
          personal,
          search,
          paidOn,
          page.from || null,
          page.to || null,
          page.status || null,
        ],
      );
      let orderBy = 'x.paid_on DESC, x.created_at DESC, x.id';
      if (page.sort === 'member') {
        orderBy = 'm.name ASC, x.paid_on DESC, x.id';
      } else if (page.sort === 'session' || page.sort === 'period') {
        orderBy = 'x.paid_on DESC, m.name ASC, x.id';
      }
      const r = await c.query(
        `SELECT x.created_at::text,x.id,m.name,x.participation_id,x.amount::text,x.paid_on::text,x.reference,x.voided_at::text FROM contributions x JOIN participations p ON p.id=x.participation_id JOIN memberships m ON m.id=p.membership_id WHERE x.campaign_id=$1 AND (NOT $4::boolean OR app_owns_participation(x.participation_id)) AND (strpos(lower(m.name),lower($5))>0 OR strpos(coalesce(m.phone,''),$5)>0) AND ($6::date IS NULL OR x.paid_on=$6::date) AND ($7::date IS NULL OR x.paid_on >= $7::date) AND ($8::date IS NULL OR x.paid_on <= $8::date) AND ($9::text IS NULL OR (x.voided_at IS NOT NULL)=($9='voided')) ORDER BY ${orderBy} LIMIT $2 OFFSET $3`,
        [
          campaignId,
          page.limit,
          (page.page - 1) * page.limit,
          personal,
          search,
          paidOn,
          page.from || null,
          page.to || null,
          page.status || null,
        ],
      );
      return { items: r.rows, total: Number(count.rows[0].count) };
    });
  }
  record(actor: Actor, groupId: string, campaignId: string, input: ContributionDto, self = false) {
    if (!validDate(input.paidOn) || input.paidOn > new Date().toISOString().slice(0, 10))
      throw new BadRequestException('Date de versement invalide ou future.');
    return this.db.run(actor, async (c) => {
      await requireGroup(c, groupId, !self);
      if (self) {
        const own = await c.query(
          'SELECT p.id FROM participations p JOIN memberships m ON m.id=p.membership_id WHERE p.campaign_id=$1 AND p.group_id=$2 AND m.user_id=$3 AND m.active AND NOT m.is_blocked',
          [campaignId, groupId, actor.id],
        );
        if (!own.rows[0]) throw new ForbiddenException('Participation personnelle active requise.');
        input = { ...input, participationId: own.rows[0].id };
      }
      // Sérialise les saisies de la campagne et l’activation, pas celles des autres groupements.
      if (self) await c.query('SELECT app_lock_member_campaign($1)', [campaignId]);
      const campaign = await findCampaign(c, groupId, campaignId, !self);
      const hash = digest(
        JSON.stringify({
          campaignId,
          participationId: input.participationId,
          amount: input.amount,
          ...(self ? { mode: 'self' } : { paidOn: input.paidOn }),
        }),
      );
      const existing = await c.query(
        'SELECT x.created_at,x.id,x.participation_id,x.amount::text,x.paid_on::text,x.reference,x.voided_at::text,x.request_hash,m.name FROM contributions x JOIN participations p ON p.id=x.participation_id JOIN memberships m ON m.id=p.membership_id WHERE x.group_id=$1 AND x.idempotency_key=$2',
        [groupId, input.idempotencyKey],
      );
      if (existing.rows[0]) {
        if (existing.rows[0].request_hash !== hash)
          throw new ConflictException('Cette référence de saisie correspond à un autre versement.');
        const { request_hash, ...view } = existing.rows[0];
        return view;
      }
      if (self && input.paidOn !== savingsToday())
        throw new BadRequestException(
          'La date de cette saisie hors ligne est passée. Elle ne peut pas être reportée automatiquement sur une autre séance ou un autre tour.',
        );
      if (!campaign.active) throw new BadRequestException('Campagne désactivée.');
      const start = new Date(campaign.start_date).toISOString().slice(0, 10);
      const end = new Date(campaign.end_date).toISOString().slice(0, 10);
      if (input.paidOn < start || input.paidOn > end)
        throw new BadRequestException('Le versement doit appartenir à la période de campagne.');
      let periodStart = input.paidOn,
        periodEnd = input.paidOn;
      const savings = await savingsType(c, campaign.type_id);
      const tontine = await isTontine(c, campaign.type_id);
      if (self && !savings && !tontine)
        throw new BadRequestException(
          'Versement personnel disponible pour l’épargne et la tontine.',
        );
      if (savings) {
        const today = savingsToday();
        if (input.paidOn !== today || !scheduledSavingsDay(campaign, today))
          throw new BadRequestException(
            'L’encaissement d’épargne est autorisé uniquement le jour de la séance prévue.',
          );
        const session = await c.query(
          'SELECT id FROM savings_sessions WHERE campaign_id=$1 AND session_date=$2',
          [campaignId, today],
        );
        if (!session.rows[0])
          throw new BadRequestException(
            'Ouvrez la séance d’épargne avant d’enregistrer une cotisation.',
          );
      }
      if (tontine) {
        const today = savingsToday();
        let period = await tontinePeriod(c, campaign, today);
        if (self) {
          period = (await memberRotation(c, campaign)).find(
            (r: any) => today >= r.expected_date && today < r.period_end,
          );
        }
        if (input.paidOn !== today || !period)
          throw new BadRequestException(
            'Encaissement autorisé à la date du jour dans le tour en cours.',
          );
        periodStart = period.expected_date;
        periodEnd = period.period_end;
        const draw = await c.query(
          'SELECT drawn_at FROM tontine_rounds WHERE campaign_id=$1 AND round_number=$2',
          [campaignId, period.round_number],
        );
        if (!draw.rows[0]?.drawn_at)
          throw new BadRequestException('Effectuez le tirage du tour avant d’encaisser.');
      }
      if (self) {
        const duplicate = await c.query(
          'SELECT id FROM contributions WHERE participation_id=$1 AND voided_at IS NULL AND paid_on >= $2::date AND paid_on <= $3::date AND ($2::date=$3::date OR paid_on < $3::date) LIMIT 1',
          [input.participationId, periodStart, periodEnd],
        );
        if (duplicate.rows.length)
          throw new ConflictException('Vous avez déjà versé pour cette séance ou ce tour.');
      }
      const participant = await c.query(
        'SELECT p.id,p.forfait::text,p.is_random,m.name,m.is_blocked FROM participations p JOIN memberships m ON m.id=p.membership_id WHERE p.id=$1 AND p.campaign_id=$2 AND p.group_id=$3 AND m.active',
        [input.participationId, campaignId, groupId],
      );
      if (!participant.rows[0]) throw new NotFoundException('Participation introuvable.');
      if (participant.rows[0].is_blocked)
        throw new ForbiddenException('Ce membre est actuellement bloqué.');
      if (
        !participant.rows[0].is_random &&
        participant.rows[0].forfait != null &&
        BigInt(input.amount) !== BigInt(participant.rows[0].forfait)
      )
        throw new BadRequestException(
          'Le montant de cette cotisation est fixe : respectez le forfait du membre.',
        );
      const id = randomUUID();
      const r = await c.query(
        'INSERT INTO contributions(id,group_id,campaign_id,participation_id,amount,paid_on,created_by,reference,idempotency_key,request_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING created_at,id,participation_id,amount::text,paid_on::text,reference,voided_at::text',
        [
          id,
          groupId,
          campaignId,
          input.participationId,
          input.amount,
          input.paidOn,
          actor.id,
          `AV-${id}`,
          input.idempotencyKey,
          hash,
        ],
      );
      await audit(
        c,
        actor,
        groupId,
        self ? 'MEMBER_CONTRIBUTION_RECORDED' : 'CONTRIBUTION_RECORDED',
        id,
        {
          amount: input.amount,
          campaignId,
        },
      );
      return { ...r.rows[0], name: participant.rows[0].name };
    });
  }
  void(actor: Actor, groupId: string, campaignId: string, id: string, input: VoidDto) {
    return this.db.run(actor, async (c) => {
      await requireGroup(c, groupId, true);
      const campaign = await findCampaign(c, groupId, campaignId, true);
      if (!campaign.active)
        throw new BadRequestException('Réactivez la campagne avant une correction.');
      const r = await c.query(
        'SELECT * FROM contributions WHERE id=$1 AND group_id=$2 AND campaign_id=$3 FOR UPDATE',
        [id, groupId, campaignId],
      );
      if (!r.rows[0]) throw new NotFoundException('Cotisation introuvable.');
      if (r.rows[0].voided_at) throw new ConflictException('Cotisation déjà annulée.');
      await c.query(
        'UPDATE contributions SET voided_at=now(),voided_by=$1,void_reason=$2 WHERE id=$3',
        [actor.id, input.reason, id],
      );
      await audit(c, actor, groupId, 'CONTRIBUTION_VOIDED', id, { reason: input.reason });
      return { id, voided: true };
    });
  }
}
@ApiTags('Cotisations')
@Controller('groupements/:groupId/campaigns/:campaignId/contributions')
export class ContributionsController {
  constructor(private readonly service: ContributionsService) {}
  @Get()
  @ApiOperation({ operationId: 'listContributions' })
  @ApiOkResponse({ type: ContributionPage })
  list(
    @Req() r: AuthRequest,
    @Param('groupId', ParseUUIDPipe) g: string,
    @Param('campaignId', ParseUUIDPipe) camp: string,
    @Query() p: ScopedPageDto,
  ) {
    return this.service.list(r.actor, g, camp, p);
  }
  @Post()
  @ApiOperation({ operationId: 'recordContribution' })
  @ApiCreatedResponse({ type: ContributionView })
  record(
    @Req() r: AuthRequest,
    @Param('groupId', ParseUUIDPipe) g: string,
    @Param('campaignId', ParseUUIDPipe) camp: string,
    @Body() input: ContributionDto,
  ) {
    return this.service.record(r.actor, g, camp, input);
  }
  @Post('self')
  @ApiOperation({ operationId: 'recordSelfContribution' })
  @ApiCreatedResponse({ type: ContributionView })
  self(
    @Req() r: AuthRequest,
    @Param('groupId', ParseUUIDPipe) g: string,
    @Param('campaignId', ParseUUIDPipe) camp: string,
    @Body() input: SelfContributionDto,
  ) {
    return this.service.record(
      r.actor,
      g,
      camp,
      { ...input, participationId: '', paidOn: input.paidOn || savingsToday() },
      true,
    );
  }
  @Post(':id/void') @ApiOperation({ operationId: 'voidContribution' }) void(
    @Req() r: AuthRequest,
    @Param('groupId', ParseUUIDPipe) g: string,
    @Param('campaignId', ParseUUIDPipe) camp: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: VoidDto,
  ) {
    return this.service.void(r.actor, g, camp, id, input);
  }
}
@Module({
  controllers: [ContributionsController],
  providers: [ContributionsService],
  exports: [ContributionsService],
})
export class ContributionsModule {}
