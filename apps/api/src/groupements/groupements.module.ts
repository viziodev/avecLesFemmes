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
  ForbiddenException,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { Actor, Database } from '../database/database.module';
import { AuthRequest } from '../auth/auth.module';
import { hashPassword } from '../auth/password';
import {
  CreateGroupDto,
  CreateMemberDto,
  CreateTypeDto,
  GroupPage,
  GroupView,
  MemberPage,
  MemberView,
  PageDto,
  ScopedPageDto,
  TypeView,
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
        'SELECT id,name,phone,role,active FROM memberships WHERE group_id=$1 AND (NOT $4::boolean OR app_owns_membership(id)) ORDER BY created_at DESC,id LIMIT $2 OFFSET $3',
        [groupId, page.limit, (page.page - 1) * page.limit, personal],
      );
      return { items: r.rows, total: Number(count.rows[0].count) };
    });
  }
  addMember(actor: Actor, groupId: string, input: CreateMemberDto) {
    return this.db.run(actor, async (c) => {
      await requireGroup(c, groupId, !actor.isSuper);
      if (input.admin && !actor.isSuper)
        throw new ForbiddenException(
          'Seul le super administrateur attribue le rôle administrateur.',
        );
      if (input.admin && !input.login)
        throw new BadRequestException('Un compte est requis pour une administratrice.');
      if (input.login && !input.password && !input.phone)
        throw new BadRequestException('Prévoir un mot de passe ou un téléphone pour le compte.');
      if (input.password && !input.login)
        throw new BadRequestException('Un identifiant est requis avec le mot de passe.');
      let userId: string | null = null;
      if (input.login) {
        userId = randomUUID();
        await c.query(
          'INSERT INTO app_users(id,login,name,phone,password_hash) VALUES($1,$2,$3,$4,$5)',
          [
            userId,
            input.login,
            input.name,
            input.phone || null,
            input.password ? hashPassword(input.password) : null,
          ],
        );
      }
      const id = randomUUID();
      const r = await c.query(
        'INSERT INTO memberships(id,group_id,user_id,name,phone,role) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,name,phone,role,active',
        [id, groupId, userId, input.name, input.phone || null, input.admin ? 'ADMIN' : 'MEMBER'],
      );
      await audit(c, actor, groupId, 'MEMBER_ADDED', id, {
        role: input.admin ? 'ADMIN' : 'MEMBER',
      });
      return r.rows[0];
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
@Module({ controllers: [GroupementsController, TypesController], providers: [GroupementsService] })
export class GroupementsModule {}
