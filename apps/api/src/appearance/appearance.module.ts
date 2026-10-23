import {
  Body,
  Controller,
  Get,
  Module,
  Put,
  Req,
  Header,
  Param,
  ParseUUIDPipe,
  Delete,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Matches } from 'class-validator';
import { AuthRequest, Public } from '../auth/auth.module';
import { audit, requireSuper, requireGroup } from '../common/access';
import { Database } from '../database/database.module';

export class PaletteDto {
  @ApiProperty({ example: '#155d50', pattern: '^#[0-9a-fA-F]{6}$' })
  @Matches(/^#[0-9a-fA-F]{6}$/)
  primary!: string;
  @ApiProperty({ example: '#197647', pattern: '^#[0-9a-fA-F]{6}$' })
  @Matches(/^#[0-9a-fA-F]{6}$/)
  savings!: string;
  @ApiProperty({ example: '#6d3fc0', pattern: '^#[0-9a-fA-F]{6}$' })
  @Matches(/^#[0-9a-fA-F]{6}$/)
  tontine!: string;
  @ApiProperty({ example: '#a85d12', pattern: '^#[0-9a-fA-F]{6}$' })
  @Matches(/^#[0-9a-fA-F]{6}$/)
  solidarity!: string;
}
const id = '00000000-0000-4000-a000-000000000001';
const columns =
  'primary_color AS primary,savings_color AS savings,tontine_color AS tontine,solidarity_color AS solidarity';

@ApiTags('Apparence')
@Controller('appearance')
class AppearanceController {
  constructor(private readonly db: Database) {}

  @Public()
  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ operationId: 'getAppearance' })
  @ApiOkResponse({ type: PaletteDto })
  async read() {
    return (await this.db.query(`SELECT ${columns} FROM platform_appearance WHERE id=$1`, [id]))
      .rows[0];
  }

  @Put()
  @ApiOperation({
    operationId: 'setAppearance',
    summary: 'Palette commune, super administrateur uniquement',
  })
  @ApiOkResponse({ type: PaletteDto })
  async update(@Req() req: AuthRequest, @Body() input: PaletteDto) {
    requireSuper(req.actor);
    return this.db.run(req.actor, async (c) => {
      const result = await c.query(
        `UPDATE platform_appearance SET primary_color=$1,savings_color=$2,tontine_color=$3,solidarity_color=$4,updated_at=now() WHERE id=$5 RETURNING ${columns}`,
        [
          input.primary.toLowerCase(),
          input.savings.toLowerCase(),
          input.tontine.toLowerCase(),
          input.solidarity.toLowerCase(),
          id,
        ],
      );
      await audit(c, req.actor, null, 'APPEARANCE_UPDATED', id, result.rows[0]);
      return result.rows[0];
    });
  }
}

@ApiTags('Apparence')
@Controller('groupements/:groupId/appearance')
class GroupAppearanceController {
  constructor(private readonly db: Database) {}
  @Get()
  @ApiOperation({ operationId: 'getGroupAppearance' })
  @ApiOkResponse({ type: PaletteDto })
  read(@Req() req: AuthRequest, @Param('groupId', ParseUUIDPipe) groupId: string) {
    return this.db.run(req.actor, async (c) => {
      await requireGroup(c, groupId);
      const own = await c.query(`SELECT ${columns} FROM group_appearance WHERE group_id=$1`, [
        groupId,
      ]);
      return (
        own.rows[0] ||
        (await c.query(`SELECT ${columns} FROM platform_appearance WHERE id=$1`, [id])).rows[0]
      );
    });
  }
  @Put()
  @ApiOperation({ operationId: 'setGroupAppearance' })
  @ApiOkResponse({ type: PaletteDto })
  update(
    @Req() req: AuthRequest,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() input: PaletteDto,
  ) {
    return this.db.run(req.actor, async (c) => {
      await requireGroup(c, groupId, true);
      const result = await c.query(
        `INSERT INTO group_appearance(group_id,primary_color,savings_color,tontine_color,solidarity_color)
        VALUES($1,$2,$3,$4,$5) ON CONFLICT(group_id) DO UPDATE SET primary_color=excluded.primary_color,savings_color=excluded.savings_color,tontine_color=excluded.tontine_color,solidarity_color=excluded.solidarity_color,updated_at=now() RETURNING ${columns}`,
        [
          groupId,
          input.primary.toLowerCase(),
          input.savings.toLowerCase(),
          input.tontine.toLowerCase(),
          input.solidarity.toLowerCase(),
        ],
      );
      await audit(c, req.actor, groupId, 'GROUP_APPEARANCE_UPDATED', groupId, result.rows[0]);
      return result.rows[0];
    });
  }
  @Delete()
  @ApiOperation({ operationId: 'resetGroupAppearance' })
  @ApiOkResponse({ type: PaletteDto })
  reset(@Req() req: AuthRequest, @Param('groupId', ParseUUIDPipe) groupId: string) {
    return this.db.run(req.actor, async (c) => {
      await requireGroup(c, groupId, true);
      await c.query('DELETE FROM group_appearance WHERE group_id=$1', [groupId]);
      await audit(c, req.actor, groupId, 'GROUP_APPEARANCE_RESET', groupId);
      return (await c.query(`SELECT ${columns} FROM platform_appearance WHERE id=$1`, [id]))
        .rows[0];
    });
  }
}
@Module({ controllers: [AppearanceController, GroupAppearanceController] })
export class PlatformAppearanceModule {}
