import {
  Body,
  Controller,
  Get,
  Delete,
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
  ActivationDto,
  BlockMemberDto,
  CampaignEventView,
  ConfigureGroupEventsDto,
  ConfigureGroupFunctionsDto,
  ConfigureGroupTypesDto,
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
  UpdateCampaignEventDto,
  UpdateMemberDto,
  UpdateTypeDto,
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
      // Rendre disponibles les fonctions par défaut
      await c.query(
        'INSERT INTO groupment_functions(group_id, function_id) SELECT $1, id FROM group_functions ON CONFLICT DO NOTHING',
        [id],
      );

      // Types de campagne affectés
      if (input.typeIds && input.typeIds.length > 0) {
        for (const typeId of input.typeIds) {
          await c.query(
            'INSERT INTO groupment_types(group_id, type_id) VALUES($1, $2) ON CONFLICT DO NOTHING',
            [id, typeId],
          );
        }
      } else {
        await c.query(
          'INSERT INTO groupment_types(group_id, type_id) SELECT $1, id FROM campaign_types ON CONFLICT DO NOTHING',
          [id],
        );
      }

      // Événements affectés
      if (input.eventIds && input.eventIds.length > 0) {
        for (const eventId of input.eventIds) {
          await c.query(
            'INSERT INTO groupment_events(group_id, event_id, is_mandatory, default_amount) VALUES($1, $2, false, 5000) ON CONFLICT DO NOTHING',
            [id, eventId],
          );
        }
      } else {
        await c.query(
          'INSERT INTO groupment_events(group_id, event_id, is_mandatory, default_amount) SELECT $1, id, false, 5000 FROM campaign_events ON CONFLICT DO NOTHING',
          [id],
        );
      }

      await audit(c, actor, id, 'GROUP_CREATED', id);
      return { ...r.rows[0], my_role: 'SUPER', member_count: '0', campaign_count: '0' };
    });
  }

  activate(actor: Actor, id: string, input: ActivationDto) {
    requireSuper(actor);
    return this.db.run(actor, async (c) => {
      const existing = await c.query('SELECT id, name FROM groupements WHERE id=$1', [id]);
      if (!existing.rows[0]) throw new NotFoundException('Groupement introuvable.');
      await c.query('UPDATE groupements SET active=$1 WHERE id=$2', [input.active, id]);
      await audit(c, actor, id, 'GROUP_ACTIVATION', id, { active: input.active });
      return { id, active: input.active };
    });
  }

  members(actor: Actor, groupId: string, page: ScopedPageDto) {
    return this.db.run(actor, async (c) => {
      await requireGroup(c, groupId);
      const personal = page.scope === 'personal';
      const search = (page.q || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
      const count = await c.query(
        `SELECT count(*) FROM memberships WHERE group_id=$1 AND (NOT $2::boolean OR app_owns_membership(id)) AND (strpos(translate(lower(name),'àâäéèêëîïôöùûüç','aaaeeeeiioouuuc'),$3)>0 OR strpos(coalesce(phone,''),$3)>0)`,
        [groupId, personal, search],
      );
      const r = await c.query(
        `SELECT m.id,m.name,m.phone,m.role,m.active,m.address,m.gender,m.function_id,f.name function_name,m.is_blocked
         FROM memberships m
         LEFT JOIN group_functions f ON f.id=m.function_id
         WHERE m.group_id=$1 AND (NOT $4::boolean OR app_owns_membership(m.id)) AND (strpos(translate(lower(m.name),'àâäéèêëîïôöùûüç','aaaeeeeiioouuuc'),$5)>0 OR strpos(coalesce(m.phone,''),$5)>0)
         ORDER BY m.created_at DESC,m.id LIMIT $2 OFFSET $3`,
        [groupId, page.limit, (page.page - 1) * page.limit, personal, search],
      );
      const campaigns = r.rows.length
        ? await c.query(
            `
        SELECT p.membership_id,x.id campaign_id,x.name,t.name type_name,t.code type_code,x.active,
          coalesce(sum(cb.amount),0)::text paid_amount
        FROM participations p JOIN campaigns x ON x.id=p.campaign_id JOIN campaign_types t ON t.id=x.type_id
        LEFT JOIN contributions cb ON cb.participation_id=p.id AND cb.voided_at IS NULL
        WHERE p.group_id=$1 AND p.membership_id=ANY($2::uuid[])
        GROUP BY p.membership_id,x.id,x.name,t.name,t.code,x.active,x.created_at
        ORDER BY x.active DESC,x.created_at DESC,x.id`,
            [groupId, r.rows.map((m: any) => m.id)],
          )
        : { rows: [] };
      return {
        items: r.rows.map((m: any) => ({
          ...m,
          campaigns: campaigns.rows
            .filter((p: any) => p.membership_id === m.id)
            .map(({ membership_id, ...entry }: any) => ({
              ...entry,
              is_savings: /avec|epargne/.test(
                `${entry.type_code} ${entry.type_name}`
                  .normalize('NFD')
                  .replace(/[\u0300-\u036f]/g, '')
                  .toLowerCase(),
              ),
            })),
        })),
        total: Number(count.rows[0].count),
      };
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
      const credential = input.password;
      const login = input.login || input.phone;

      if (credential) {
        userId = randomUUID();
        const userLogin = login || `membre.${userId.slice(0, 8)}`;
        await c.query(
          'INSERT INTO app_users(id,login,name,phone,password_hash,secret_code_hash) VALUES($1,$2,$3,$4,$5,$6)',
          [userId, userLogin, input.name, input.phone || null, hashPassword(credential), null],
        );
      } else if (input.login) {
        throw new BadRequestException(
          'Un mot de passe initial d’au moins douze caractères est requis pour créer un accès.',
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

  resetPin(actor: Actor, groupId: string, memberId: string, _input: ResetPinDto) {
    requireSuper(actor);
    return this.db.run(actor, async (c) => {
      await requireGroup(c, groupId, true);
      const m = await c.query('SELECT * FROM memberships WHERE id=$1 AND group_id=$2', [
        memberId,
        groupId,
      ]);
      const member = m.rows[0];
      if (!member) throw new NotFoundException('Membre introuvable.');
      if (!member.user_id)
        throw new BadRequestException(
          'Ce membre ne possède pas de compte. Créez son accès séparément.',
        );
      const target = await c.query('SELECT is_super FROM app_users WHERE id=$1 FOR UPDATE', [
        member.user_id,
      ]);
      if (target.rows[0]?.is_super)
        throw new ForbiddenException('Utilisez la récupération du compte Super Admin.');
      // Recovery never installs a credential chosen by another person.
      await c.query(
        'UPDATE app_users SET secret_code_hash=NULL,failed_attempts=0,locked_until=NULL WHERE id=$1',
        [member.user_id],
      );
      await c.query('DELETE FROM sessions WHERE user_id=$1', [member.user_id]);
      await c.query('DELETE FROM trusted_devices WHERE user_id=$1', [member.user_id]);
      await audit(c, actor, groupId, 'MEMBER_CODE_REVOKED', memberId);
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

  updateCampaignEvent(actor: Actor, id: string, input: UpdateCampaignEventDto) {
    requireSuper(actor);
    return this.db.run(actor, async (c) => {
      const existing = await c.query('SELECT * FROM campaign_events WHERE id=$1', [id]);
      if (!existing.rows[0]) throw new NotFoundException('Événement introuvable.');
      const r = await c.query(
        `UPDATE campaign_events
         SET name = COALESCE($2, name),
             code = COALESCE($3, code),
             description = COALESCE($4, description)
         WHERE id = $1
         RETURNING *`,
        [
          id,
          input.name ?? null,
          input.code ? input.code.toUpperCase() : null,
          input.description !== undefined ? input.description : null,
        ],
      );
      await audit(c, actor, null, 'CAMPAIGN_EVENT_UPDATED', id, input);
      return r.rows[0];
    });
  }

  deleteCampaignEvent(actor: Actor, id: string) {
    requireSuper(actor);
    return this.db.run(actor, async (c) => {
      const existing = await c.query('SELECT * FROM campaign_events WHERE id=$1', [id]);
      if (!existing.rows[0]) throw new NotFoundException('Événement introuvable.');
      const inUse = await c.query('SELECT 1 FROM campaigns WHERE event_id=$1 LIMIT 1', [id]);
      if (inUse.rowCount && inUse.rowCount > 0) {
        throw new BadRequestException(
          'Impossible de supprimer cet événement car il est associé à des campagnes existantes.',
        );
      }
      await c.query('DELETE FROM campaign_events WHERE id=$1', [id]);
      await audit(c, actor, null, 'CAMPAIGN_EVENT_DELETED', id);
      return { ok: true, id };
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

  groupTypes(actor: Actor, groupId: string) {
    return this.db.run(actor, async (c) => {
      await requireGroup(c, groupId);
      const r = await c.query(
        `SELECT t.id, t.name, t.code, t.rule_version, t.engine
         FROM campaign_types t
         JOIN groupment_types gt ON gt.type_id=t.id
         WHERE gt.group_id=$1
         ORDER BY t.name`,
        [groupId],
      );
      return r.rows;
    });
  }

  configureGroupTypes(actor: Actor, groupId: string, input: ConfigureGroupTypesDto) {
    requireSuper(actor);
    return this.db.run(actor, async (c) => {
      await requireGroup(c, groupId);
      await c.query('DELETE FROM groupment_types WHERE group_id=$1', [groupId]);
      for (const typeId of input.typeIds) {
        await c.query(
          'INSERT INTO groupment_types(group_id, type_id) VALUES($1, $2) ON CONFLICT DO NOTHING',
          [groupId, typeId],
        );
      }
      await audit(c, actor, groupId, 'GROUP_TYPES_CONFIGURED', groupId, input);
      return { ok: true, count: input.typeIds.length };
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

  updateType(actor: Actor, id: string, input: UpdateTypeDto) {
    requireSuper(actor);
    return this.db.run(actor, async (c) => {
      const existing = await c.query('SELECT * FROM campaign_types WHERE id=$1', [id]);
      if (!existing.rows[0]) throw new NotFoundException('Type de campagne introuvable.');
      const r = await c.query(
        `UPDATE campaign_types
         SET name = COALESCE($2, name),
             code = COALESCE($3, code)
         WHERE id = $1
         RETURNING *`,
        [id, input.name ?? null, input.code ? input.code.toUpperCase() : null],
      );
      await audit(c, actor, null, 'TYPE_UPDATED', id, input);
      return r.rows[0];
    });
  }

  deleteType(actor: Actor, id: string) {
    requireSuper(actor);
    return this.db.run(actor, async (c) => {
      const existing = await c.query('SELECT * FROM campaign_types WHERE id=$1', [id]);
      if (!existing.rows[0]) throw new NotFoundException('Type de campagne introuvable.');
      const inUse = await c.query('SELECT 1 FROM campaigns WHERE type_id=$1 LIMIT 1', [id]);
      if (inUse.rowCount && inUse.rowCount > 0) {
        throw new BadRequestException(
          'Impossible de supprimer ce type de campagne car il est associé à des campagnes existantes.',
        );
      }
      await c.query('DELETE FROM campaign_types WHERE id=$1', [id]);
      await audit(c, actor, null, 'TYPE_DELETED', id);
      return { ok: true, id };
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

  @Get(':groupId/types')
  @ApiOperation({ operationId: 'listGroupTypes' })
  @ApiOkResponse({ type: [TypeView] })
  groupTypes(@Req() r: AuthRequest, @Param('groupId', ParseUUIDPipe) groupId: string) {
    return this.service.groupTypes(r.actor, groupId);
  }

  @Put(':groupId/types')
  @ApiOperation({ operationId: 'configureGroupTypes' })
  configureGroupTypes(
    @Req() r: AuthRequest,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() input: ConfigureGroupTypesDto,
  ) {
    return this.service.configureGroupTypes(r.actor, groupId, input);
  }

  @Patch(':groupId/activation')
  @ApiOperation({ operationId: 'setGroupActivation' })
  @ApiOkResponse({ description: 'Statut d’activation du groupement mis à jour' })
  setGroupActivation(
    @Req() r: AuthRequest,
    @Param('groupId', ParseUUIDPipe) id: string,
    @Body() input: ActivationDto,
  ) {
    return this.service.activate(r.actor, id, input);
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

  @Patch(':id')
  @ApiOperation({ operationId: 'updateCampaignEvent' })
  @ApiOkResponse({ type: CampaignEventView })
  update(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateCampaignEventDto,
  ) {
    return this.service.updateCampaignEvent(r.actor, id, input);
  }

  @Delete(':id')
  @ApiOperation({ operationId: 'deleteCampaignEvent' })
  delete(@Req() r: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.deleteCampaignEvent(r.actor, id);
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

  @Patch(':id')
  @ApiOperation({ operationId: 'updateType' })
  @ApiOkResponse({ type: TypeView })
  update(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateTypeDto,
  ) {
    return this.service.updateType(r.actor, id, input);
  }

  @Delete(':id')
  @ApiOperation({ operationId: 'deleteType' })
  delete(@Req() r: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.deleteType(r.actor, id);
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
