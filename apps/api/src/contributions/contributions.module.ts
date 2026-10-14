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
    return this.db.run(actor, async (c) => {
      await requireGroup(c, groupId);
      await findCampaign(c, groupId, campaignId);
      const personal = page.scope === 'personal';
      const count = await c.query(
        'SELECT count(*) FROM contributions WHERE campaign_id=$1 AND (NOT $2::boolean OR app_owns_participation(participation_id))',
        [campaignId, personal],
      );
      const r = await c.query(
        'SELECT x.id,m.name,x.participation_id,x.amount::text,x.paid_on::text,x.reference,x.voided_at::text FROM contributions x JOIN participations p ON p.id=x.participation_id JOIN memberships m ON m.id=p.membership_id WHERE x.campaign_id=$1 AND (NOT $4::boolean OR app_owns_participation(x.participation_id)) ORDER BY x.paid_on DESC,x.created_at DESC,x.id LIMIT $2 OFFSET $3',
        [campaignId, page.limit, (page.page - 1) * page.limit, personal],
      );
      return { items: r.rows, total: Number(count.rows[0].count) };
    });
  }
  record(actor: Actor, groupId: string, campaignId: string, input: ContributionDto) {
    if (!validDate(input.paidOn) || input.paidOn > new Date().toISOString().slice(0, 10))
      throw new BadRequestException('Date de versement invalide ou future.');
    return this.db.run(actor, async (c) => {
      await requireGroup(c, groupId, true);
      // Sérialise les saisies de la campagne et l’activation, pas celles des autres groupements.
      const campaign = await findCampaign(c, groupId, campaignId, true);
      const hash = digest(
        JSON.stringify({
          campaignId,
          participationId: input.participationId,
          amount: input.amount,
          paidOn: input.paidOn,
        }),
      );
      const existing = await c.query(
        'SELECT x.id,x.participation_id,x.amount::text,x.paid_on::text,x.reference,x.voided_at::text,x.request_hash,m.name FROM contributions x JOIN participations p ON p.id=x.participation_id JOIN memberships m ON m.id=p.membership_id WHERE x.group_id=$1 AND x.idempotency_key=$2',
        [groupId, input.idempotencyKey],
      );
      if (existing.rows[0]) {
        if (existing.rows[0].request_hash !== hash)
          throw new ConflictException('Cette référence de saisie correspond à un autre versement.');
        const { request_hash, ...view } = existing.rows[0];
        return view;
      }
      if (!campaign.active) throw new BadRequestException('Campagne désactivée.');
      const start = new Date(campaign.start_date).toISOString().slice(0, 10);
      const end = new Date(campaign.end_date).toISOString().slice(0, 10);
      if (input.paidOn < start || input.paidOn > end)
        throw new BadRequestException('Le versement doit appartenir à la période de campagne.');
      const participant = await c.query(
        'SELECT p.id,m.name FROM participations p JOIN memberships m ON m.id=p.membership_id WHERE p.id=$1 AND p.campaign_id=$2 AND p.group_id=$3 AND m.active',
        [input.participationId, campaignId, groupId],
      );
      if (!participant.rows[0]) throw new NotFoundException('Participation introuvable.');
      const id = randomUUID();
      const r = await c.query(
        'INSERT INTO contributions(id,group_id,campaign_id,participation_id,amount,paid_on,created_by,reference,idempotency_key,request_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id,participation_id,amount::text,paid_on::text,reference,voided_at::text',
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
      await audit(c, actor, groupId, 'CONTRIBUTION_RECORDED', id, {
        amount: input.amount,
        campaignId,
      });
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
@Module({ controllers: [ContributionsController], providers: [ContributionsService] })
export class ContributionsModule {}
