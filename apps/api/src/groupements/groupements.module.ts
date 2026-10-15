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
  Put,
  Query,
  Req,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { Actor, Database } from '../database/database.module';
import { AuthRequest } from '../auth/auth.module';
import { hashPassword } from '../auth/password';
import {
  BlockMemberDto,
  CampaignEventView,
  ConfigureGroupEventsDto,
  ConfigureGroupFunctionsDto,
  CreateCampaignEventDto,
  CreateGroupDto,
  CreateMemberDto,
  CreateTypeDto,
  GroupEventView,
  GroupFunctionView,
  GroupPage,
  GroupView,
  MemberPage,
  MemberView,
  PageDto,
  ResetPinDto,
  ScopedPageDto,
  TypeView,
  UpdateMemberDto,
} from '../common/dto';
import { audit, requireGroup, requireSuper } from '../common/access';

@Injectable()
export class GroupementsService {
  constructor(private readonly db: Database) {}

  list(actor: Actor, page: PageDto) {
    return this.db.run(actor, async (c) => {
      const count = await c.query('SELECT count(*) FROM groupements');
      const r = await c.query(
        "SELECT g.*,CASE WHEN app_is_super() THEN 'SUPER' WHEN app_is_admin(g.id) THEN 'ADMIN' ELSE 'MEMBER' END my_role,(SELECT count(*) FROM memberships m WHERE m.group_id=g.id AND m.active)::text member_count,(SELECT count(*) FROM campaigns x WHERE x.group_id=g.id)::text campaign_count FROM groupements g ORDER BY g.created_at DESC,g.id LIMIT $1 OFFSET $2",
        [page.limit, (page.page - 1) * page.limit],
      );
      return { items: r.rows, total: Number(count.rows[0].count) };
    });
  }

  create(actor: Actor, input: CreateGroupDto) {
    requireSuper(actor);
    return this.db.run(actor, async (c) => {
      const id = randomUUID();
      const r = await c.query(
        'INSERT INTO groupements(id,name,address,responsible,phone) VALUES($1,$2,$3,$4,$5) RETURNING *',
        [id, input.name, input.address, input.responsible ?? '', input.phone],
      );
      // Rendre disponibles les fonctions et événements par défaut
      await c.query(
        'INSERT INTO groupment_functions(group_id, function_id) SELECT $1, id FROM group_functions ON CONFLICT DO NOTHING',
        [id],
      );
      await c.query(
        'INSERT INTO groupment_events(group_id, event_id, is_mandatory, default_amount) SELECT $1, id, false, 5000 FROM campaign_events ON CONFLICT DO NOTHING',
        [id],
      );
      await audit(c, actor, id, 'GROUP_CREATED', id);
      return { ...r.rows[0], my_role: 'SUPER', member_count: '0', campaign_count: '0' };
    });
  }

  members(actor: Actor, groupId: string, page: ScopedPageDto) {
    return this.db.run(actor, async (c) => {
      await requireGroup(c, groupId);
      const personal = page.scope === 'personal';
      const count = await c.query(
        'SELECT count(*) FROM memberships WHERE group_id=$1 AND (NOT $2::boolean OR app_owns_membership(id))',
        [groupId, personal],
      );
      const r = await c.query(
        `SELECT m.id,m.name,m.phone,m.role,m.active,m.address,m.gender,m.function_id,f.name function_name,m.is_blocked
         FROM memberships m
         LEFT JOIN group_functions f ON f.id=m.function_id
         WHERE m.group_id=$1 AND (NOT $4::boolean OR app_owns_membership(m.id))
         ORDER BY m.created_at DESC,m.id LIMIT $2 OFFSET $3`,
        [groupId, page.limit, (page.page - 1) * page.limit, personal],
      );
      return { items: r.rows, total: Number(count.rows[0].count) };
    });
  }

  addMember(actor: Actor, groupId: string, input: CreateMemberDto) {
    return this.db.run(actor, async (c) => {
      await requireGroup(c, groupId, !actor.isSuper);

      let functionId = input.functionId;
      if (!functionId) {
        const def = await c.query('SELECT id FROM group_functions WHERE is_default LIMIT 1');
        functionId = def.rows[0]?.id;
      }

      if (input.admin) {
        if (!actor.isSuper) {
          const fn = await c.query('SELECT can_be_admin FROM group_functions WHERE id=$1', [
            functionId,
          ]);
          if (!fn.rows[0]?.can_be_admin) {
            throw new ForbiddenException(
              'Cette fonction ne permet pas d’attribuer le rôle administrateur.',
            );
          }
        }
      }

      let userId: string | null = null;
      const credential = input.pin || input.password;
      const login = input.login || input.phone;

      if (credential) {
        userId = randomUUID();
        const userLogin = login || `membre.${userId.slice(0, 8)}`;
        await c.query(
          'INSERT INTO app_users(id,login,name,phone,password_hash) VALUES($1,$2,$3,$4,$5)',
          [userId, userLogin, input.name, input.phone || null, hashPassword(credential)],
        );
      } else if (input.login) {
        userId = randomUUID();
        await c.query(
          'INSERT INTO app_users(id,login,name,phone,password_hash) VALUES($1,$2,$3,$4,$5)',
          [userId, input.login, input.name, input.phone || null, null],
        );
      }

      const id = randomUUID();
      const r = await c.query(
        `INSERT INTO memberships(id,group_id,user_id,name,phone,role,address,gender,function_id,is_blocked)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING id,name,phone,role,active,address,gender,function_id,is_blocked`,
        [
          id,
          groupId,
          userId,
          input.name,
          input.phone || null,
          input.admin ? 'ADMIN' : 'MEMBER',
          input.address || null,
          input.gender || 'F',
          functionId,
          false,
        ],
      );

      const fnName = await c.query('SELECT name FROM group_functions WHERE id=$1', [functionId]);

      await audit(c, actor, groupId, 'MEMBER_ADDED', id, {
        role: input.admin ? 'ADMIN' : 'MEMBER',
        functionId,
      });

      return { ...r.rows[0], function_name: fnName.rows[0]?.name || null };
    });
  }

  updateMember(actor: Actor, groupId: string, memberId: string, input: UpdateMemberDto) {
    return this.db.run(actor, async (c) => {
      await requireGroup(c, groupId, true);
      const existing = await c.query('SELECT * FROM memberships WHERE id=$1 AND group_id=$2', [
        memberId,
        groupId,
      ]);
      if (!existing.rows[0]) throw new NotFoundException('Membre introuvable.');

      let role = existing.rows[0].role;
      let functionId =
        input.functionId !== undefined ? input.functionId : existing.rows[0].function_id;

      if (input.admin !== undefined) {
        if (input.admin) {
          if (!actor.isSuper) {
            const fn = await c.query('SELECT can_be_admin FROM group_functions WHERE id=$1', [
              functionId,
            ]);
            if (!fn.rows[0]?.can_be_admin) {
              throw new ForbiddenException(
                'Cette fonction ne permet pas d’attribuer le rôle administrateur.',
              );
            }
          }
          role = 'ADMIN';
        } else {
          role = 'MEMBER';
        }
      }

      const r = await c.query(
        `UPDATE memberships
         SET name=coalesce($1, name),
             phone=coalesce($2, phone),
             address=coalesce($3, address),
             gender=coalesce($4, gender),
             function_id=coalesce($5, function_id),
             role=$6
         WHERE id=$7 AND group_id=$8
         RETURNING id,name,phone,role,active,address,gender,function_id,is_blocked`,
        [
          input.name ?? null,
          input.phone ?? null,
          input.address ?? null,
          input.gender ?? null,
          functionId ?? null,
          role,
          memberId,
          groupId,
        ],
      );

      const fnName = await c.query('SELECT name FROM group_functions WHERE id=$1', [
        r.rows[0].function_id,
      ]);
      await audit(c, actor, groupId, 'MEMBER_UPDATED', memberId, input);
      return { ...r.rows[0], function_name: fnName.rows[0]?.name || null };
    });
  }

  blockMember(actor: Actor, groupId: string, memberId: string, input: BlockMemberDto) {
    return this.db.run(actor, async (c) => {
      await requireGroup(c, groupId, true);
      const r = await c.query(
        'UPDATE memberships SET is_blocked=$1 WHERE id=$2 AND group_id=$3 RETURNING id,name,is_blocked',
        [input.blocked, memberId, groupId],
      );
      if (!r.rows[0]) throw new NotFoundException('Membre introuvable.');
      await audit(
        c,
        actor,
        groupId,
        input.blocked ? 'MEMBER_BLOCKED' : 'MEMBER_UNBLOCKED',
        memberId,
      );
      return r.rows[0];
    });
  }

  resetPin(actor: Actor, groupId: string, memberId: string, input: ResetPinDto) {
    return this.db.run(actor, async (c) => {
      await requireGroup(c, groupId, true);
      const m = await c.query('SELECT * FROM memberships WHERE id=$1 AND group_id=$2', [
        memberId,
        groupId,
      ]);
      if (!m.rows[0]) throw new NotFoundException('Membre introuvable.');

      const member = m.rows[0];
      const newHash = hashPassword(input.pin);

      if (member.user_id) {
        await c.query(
          'UPDATE app_users SET password_hash=$1, failed_attempts=0, locked_until=NULL WHERE id=$2',
          [newHash, member.user_id],
        );
      } else {
        const userId = randomUUID();
        const login = member.phone || `membre.${memberId.slice(0, 8)}`;
        await c.query(
          'INSERT INTO app_users(id,login,name,phone,password_hash) VALUES($1,$2,$3,$4,$5)',
          [userId, login, member.name, member.phone, newHash],
        );
        await c.query('UPDATE memberships SET user_id=$1 WHERE id=$2', [userId, memberId]);
      }

      await audit(c, actor, groupId, 'MEMBER_PIN_RESET', memberId);
      return { id: memberId, pinReset: true };
    });
  }

  // Catalogue des fonctions
  platformFunctions(actor: Actor) {
    return this.db.run(
      actor,
      async (c) =>
        (await c.query('SELECT * FROM group_functions ORDER BY is_default DESC, name')).rows,
    );
  }

  groupFunctions(actor: Actor, groupId: string) {
    return this.db.run(actor, async (c) => {
      await requireGroup(c, groupId);
      const r = await c.query(
        `SELECT f.* FROM group_functions f
         JOIN groupment_functions gf ON gf.function_id=f.id
         WHERE gf.group_id=$1
         ORDER BY f.is_default DESC, f.name`,
        [groupId],
      );
      return r.rows;
    });
  }

  configureGroupFunctions(actor: Actor, groupId: string, input: ConfigureGroupFunctionsDto) {
    requireSuper(actor);
    return this.db.run(actor, async (c) => {
      await requireGroup(c, groupId);
      await c.query('DELETE FROM groupment_functions WHERE group_id=$1', [groupId]);
      for (const fnId of input.functionIds) {
        await c.query(
          'INSERT INTO groupment_functions(group_id, function_id) VALUES($1, $2) ON CONFLICT DO NOTHING',
          [groupId, fnId],
        );
      }
      await audit(c, actor, groupId, 'GROUP_FUNCTIONS_CONFIGURED', groupId, input);
      return { ok: true, count: input.functionIds.length };
    });
  }

  // Catalogue des événements
  platformEvents(actor: Actor) {
    return this.db.run(
      actor,
      async (c) => (await c.query('SELECT * FROM campaign_events WHERE active ORDER BY name')).rows,
    );
  }

  createCampaignEvent(actor: Actor, input: CreateCampaignEventDto) {
    requireSuper(actor);
    return this.db.run(actor, async (c) => {
      const id = randomUUID();
      const r = await c.query(
        'INSERT INTO campaign_events(id, code, name, description) VALUES($1, $2, $3, $4) RETURNING *',
        [id, input.code, input.name, input.description || null],
      );
      await audit(c, actor, null, 'CAMPAIGN_EVENT_CREATED', id);
      return r.rows[0];
    });
  }

  groupEvents(actor: Actor, groupId: string) {
    return this.db.run(actor, async (c) => {
      await requireGroup(c, groupId);
      const r = await c.query(
        `SELECT e.id as event_id, e.code, e.name, e.description, ge.is_mandatory, ge.default_amount::text
         FROM campaign_events e
         JOIN groupment_events ge ON ge.event_id=e.id
         WHERE ge.group_id=$1
         ORDER BY e.name`,
        [groupId],
      );
      return r.rows;
    });
  }

  configureGroupEvents(actor: Actor, groupId: string, input: ConfigureGroupEventsDto) {
    requireSuper(actor);
    return this.db.run(actor, async (c) => {
      await requireGroup(c, groupId);
      await c.query('DELETE FROM groupment_events WHERE group_id=$1', [groupId]);
      for (const ev of input.events) {
        await c.query(
          'INSERT INTO groupment_events(group_id, event_id, is_mandatory, default_amount) VALUES($1, $2, $3, $4)',
          [groupId, ev.eventId, ev.isMandatory, ev.defaultAmount || null],
        );
      }
      await audit(c, actor, groupId, 'GROUP_EVENTS_CONFIGURED', groupId, input);
      return { ok: true, count: input.events.length };
    });
  }

  types(actor: Actor) {
    return this.db.run(
      actor,
      async (c) => (await c.query('SELECT * FROM campaign_types ORDER BY name')).rows,
    );
  }

  createType(actor: Actor, input: CreateTypeDto) {
    requireSuper(actor);
    return this.db.run(actor, async (c) => {
      const id = randomUUID();
      const r = await c.query(
        'INSERT INTO campaign_types(id,name,code) VALUES($1,$2,$3) RETURNING *',
        [id, input.name, input.code],
      );
      await audit(c, actor, null, 'TYPE_CREATED', id);
      return r.rows[0];
    });
  }
}

@ApiTags('Groupements')
@Controller('groupements')
export class GroupementsController {
  constructor(private readonly service: GroupementsService) {}

  @Get() @ApiOperation({ operationId: 'listGroups' }) @ApiOkResponse({ type: GroupPage }) list(
    @Req() r: AuthRequest,
    @Query() p: PageDto,
  ) {
    return this.service.list(r.actor, p);
  }

  @Post()
  @ApiOperation({ operationId: 'createGroup' })
  @ApiCreatedResponse({ type: GroupView })
  create(@Req() r: AuthRequest, @Body() input: CreateGroupDto) {
    return this.service.create(r.actor, input);
  }

  @Get(':groupId/members')
  @ApiOperation({ operationId: 'listMembers' })
  @ApiOkResponse({ type: MemberPage })
  members(
    @Req() r: AuthRequest,
    @Param('groupId', ParseUUIDPipe) id: string,
    @Query() p: ScopedPageDto,
  ) {
    return this.service.members(r.actor, id, p);
  }

  @Post(':groupId/members')
  @ApiOperation({ operationId: 'createMember' })
  @ApiCreatedResponse({ type: MemberView })
  addMember(
    @Req() r: AuthRequest,
    @Param('groupId', ParseUUIDPipe) id: string,
    @Body() input: CreateMemberDto,
  ) {
    return this.service.addMember(r.actor, id, input);
  }

  @Patch(':groupId/members/:memberId')
  @ApiOperation({ operationId: 'updateMember' })
  @ApiOkResponse({ type: MemberView })
  updateMember(
    @Req() r: AuthRequest,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() input: UpdateMemberDto,
  ) {
    return this.service.updateMember(r.actor, groupId, memberId, input);
  }

  @Patch(':groupId/members/:memberId/block')
  @ApiOperation({ operationId: 'blockMember' })
  @ApiOkResponse({ description: 'Statut de blocage du membre mis à jour' })
  blockMember(
    @Req() r: AuthRequest,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() input: BlockMemberDto,
  ) {
    return this.service.blockMember(r.actor, groupId, memberId, input);
  }

  @Post(':groupId/members/:memberId/reset-pin')
  @ApiOperation({ operationId: 'resetMemberPin' })
  @ApiOkResponse({ description: 'Code PIN réinitialisé avec succès' })
  resetPin(
    @Req() r: AuthRequest,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() input: ResetPinDto,
  ) {
    return this.service.resetPin(r.actor, groupId, memberId, input);
  }

  @Get(':groupId/functions')
  @ApiOperation({ operationId: 'listGroupFunctions' })
  @ApiOkResponse({ type: [GroupFunctionView] })
  groupFunctions(@Req() r: AuthRequest, @Param('groupId', ParseUUIDPipe) groupId: string) {
    return this.service.groupFunctions(r.actor, groupId);
  }

  @Put(':groupId/functions')
  @ApiOperation({ operationId: 'configureGroupFunctions' })
  configureGroupFunctions(
    @Req() r: AuthRequest,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() input: ConfigureGroupFunctionsDto,
  ) {
    return this.service.configureGroupFunctions(r.actor, groupId, input);
  }

  @Get(':groupId/events')
  @ApiOperation({ operationId: 'listGroupEvents' })
  @ApiOkResponse({ type: [GroupEventView] })
  groupEvents(@Req() r: AuthRequest, @Param('groupId', ParseUUIDPipe) groupId: string) {
    return this.service.groupEvents(r.actor, groupId);
  }

  @Put(':groupId/events')
  @ApiOperation({ operationId: 'configureGroupEvents' })
  configureGroupEvents(
    @Req() r: AuthRequest,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() input: ConfigureGroupEventsDto,
  ) {
    return this.service.configureGroupEvents(r.actor, groupId, input);
  }
}

@ApiTags('Fonctions')
@Controller('group-functions')
export class GroupFunctionsController {
  constructor(private readonly service: GroupementsService) {}

  @Get()
  @ApiOperation({ operationId: 'listPlatformFunctions' })
  @ApiOkResponse({ type: [GroupFunctionView] })
  list(@Req() r: AuthRequest) {
    return this.service.platformFunctions(r.actor);
  }
}

@ApiTags('Événements')
@Controller('campaign-events')
export class CampaignEventsController {
  constructor(private readonly service: GroupementsService) {}

  @Get()
  @ApiOperation({ operationId: 'listPlatformEvents' })
  @ApiOkResponse({ type: [CampaignEventView] })
  list(@Req() r: AuthRequest) {
    return this.service.platformEvents(r.actor);
  }

  @Post()
  @ApiOperation({ operationId: 'createCampaignEvent' })
  @ApiCreatedResponse({ type: CampaignEventView })
  create(@Req() r: AuthRequest, @Body() input: CreateCampaignEventDto) {
    return this.service.createCampaignEvent(r.actor, input);
  }
}

@ApiTags('Types de campagne')
@Controller('campaign-types')
export class TypesController {
  constructor(private readonly service: GroupementsService) {}

  @Get() @ApiOperation({ operationId: 'listTypes' }) @ApiOkResponse({ type: [TypeView] }) list(
    @Req() r: AuthRequest,
  ) {
    return this.service.types(r.actor);
  }

  @Post()
  @ApiOperation({ operationId: 'createType' })
  @ApiCreatedResponse({ type: TypeView })
  create(@Req() r: AuthRequest, @Body() input: CreateTypeDto) {
    return this.service.createType(r.actor, input);
  }
}

@Module({
  controllers: [
    GroupementsController,
    GroupFunctionsController,
    CampaignEventsController,
    TypesController,
  ],
  providers: [GroupementsService],
  exports: [GroupementsService],
})
export class GroupementsModule {}
