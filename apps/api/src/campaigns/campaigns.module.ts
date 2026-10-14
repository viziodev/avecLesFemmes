import {
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { Actor, Database, SqlClient } from '../database/database.module';
import { AuthRequest } from '../auth/auth.module';
import {
  ActivationDto,
  CampaignPage,
  CampaignView,
  CreateCampaignDto,
  DashboardView,
  PageDto,
  ParticipationDto,
  ParticipationPage,
  ParticipationView,
  validDate,
  ScopeDto,
  ScopedPageDto,
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
@Injectable()
export class CampaignsService {
  constructor(private readonly db: Database) {}
  list(actor: Actor, groupId: string, page: PageDto) {
    return this.db.run(actor, async (c) => {
      await requireGroup(c, groupId);
      const count = await c.query('SELECT count(*) FROM campaigns WHERE group_id=$1', [groupId]);
      const r = await c.query(
        'SELECT x.*,x.start_date::text,x.end_date::text,t.name type_name FROM campaigns x JOIN campaign_types t ON t.id=x.type_id WHERE x.group_id=$1 ORDER BY x.created_at DESC,x.id LIMIT $2 OFFSET $3',
        [groupId, page.limit, (page.page - 1) * page.limit],
      );
      return { items: r.rows, total: Number(count.rows[0].count) };
    });
  }
  create(actor: Actor, groupId: string, input: CreateCampaignDto) {
    if (!validDate(input.startDate) || !validDate(input.endDate) || input.endDate < input.startDate)
      throw new BadRequestException('Période de campagne invalide.');
    return this.db.run(actor, async (c) => {
      await requireGroup(c, groupId, true);
      const type = await c.query('SELECT * FROM campaign_types WHERE id=$1', [input.typeId]);
      if (!type.rows[0]) throw new NotFoundException('Type introuvable.');
      const id = randomUUID();
      const r = await c.query(
        'INSERT INTO campaigns(id,group_id,type_id,name,start_date,end_date,weekday,interval_weeks,rule_version) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *,start_date::text,end_date::text',
        [
          id,
          groupId,
          input.typeId,
          input.name,
          input.startDate,
          input.endDate,
          input.weekday,
          input.intervalWeeks,
          type.rows[0].rule_version,
        ],
      );
      await audit(c, actor, groupId, 'CAMPAIGN_CREATED', id);
      return { ...r.rows[0], type_name: type.rows[0].name };
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
        'SELECT p.id,p.membership_id,m.name,p.forfait::text FROM participations p JOIN memberships m ON m.id=p.membership_id WHERE p.campaign_id=$1 AND (NOT $4::boolean OR app_owns_membership(p.membership_id)) ORDER BY m.name,p.id LIMIT $2 OFFSET $3',
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
      const r = await c.query(
        'INSERT INTO participations(id,group_id,campaign_id,membership_id,forfait) VALUES($1,$2,$3,$4,$5) ON CONFLICT(campaign_id,membership_id) DO UPDATE SET forfait=excluded.forfait RETURNING id,membership_id,forfait::text',
        [randomUUID(), groupId, id, input.membershipId, input.forfait ?? null],
      );
      await audit(c, actor, groupId, 'PARTICIPATION_CONFIGURED', r.rows[0].id, {
        forfait: input.forfait ?? null,
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
        'SELECT coalesce(sum(amount),0)::text total,count(*)::text payments FROM contributions WHERE campaign_id=$1 AND voided_at IS NULL AND (NOT $2::boolean OR app_owns_participation(participation_id))',
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
  @Patch(':id/activation') @ApiOperation({ operationId: 'activateCampaign' }) activate(
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
}
@Module({ controllers: [CampaignsController], providers: [CampaignsService] })
export class CampaignsModule {}
