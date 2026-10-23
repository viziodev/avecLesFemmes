import {
  addTontineInterval,
  isTontine,
  tontineCalendar,
  tontinePeriod,
} from '../common/tontine-schedule';
import { savingsToday, scheduledSavingsDay, savingsType } from '../common/savings-schedule';
import { SavingsSessionStatusView } from '../common/dto';
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
  ConflictException,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomUUID, randomInt } from 'node:crypto';
import { Actor, Database, SqlClient } from '../database/database.module';
import { AuthRequest } from '../auth/auth.module';
import {
  CampaignShortcutsDto,
  EligibleMembersQueryDto,
  EligibleMemberPage,
  TontineStatusView,
  TontineMembersPage,
  TontineMembersQueryDto,
  MemberQrDto,
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

  shortcuts(actor: Actor, groupId: string, input?: CampaignShortcutsDto) {
    return this.db.run(actor, async (c) => {
      await requireGroup(c, groupId, true);
      if (actor.isSuper)
        throw new ForbiddenException('Raccourcis réservés au responsable du groupement.');
      if (input) {
        const ids = await c.query(
          'SELECT id FROM campaigns WHERE group_id=$1 AND active AND id=ANY($2::uuid[])',
          [groupId, input.campaignIds],
        );
        if (ids.rows.length !== input.campaignIds.length)
          throw new BadRequestException(
            'Choisissez uniquement des campagnes actives de ce groupement.',
          );
        await c.query(
          `INSERT INTO campaign_shortcut_preferences(user_id,group_id,campaign_ids) VALUES($1,$2,$3::uuid[]) ON CONFLICT(user_id,group_id) DO UPDATE SET campaign_ids=excluded.campaign_ids,updated_at=now()`,
          [actor.id, groupId, input.campaignIds],
        );
        await audit(c, actor, groupId, 'CAMPAIGN_SHORTCUTS_UPDATED', groupId, input);
        return input;
      }
      const saved = await c.query(
        'SELECT campaign_ids FROM campaign_shortcut_preferences WHERE user_id=$1 AND group_id=$2',
        [actor.id, groupId],
      );
      const active = await c.query(
        'SELECT id FROM campaigns WHERE group_id=$1 AND active ORDER BY created_at DESC,id',
        [groupId],
      );
      const ids = saved.rows[0]?.campaign_ids ?? active.rows.slice(0, 6).map((r: any) => r.id);
      return { campaignIds: ids.filter((id: string) => active.rows.some((r: any) => r.id === id)) };
    });
  }

  eligibleMembers(actor: Actor, groupId: string, id: string, page: EligibleMembersQueryDto) {
    return this.db.run(actor, async (c) => {
      await requireGroup(c, groupId, true);
      await findCampaign(c, groupId, id);
      const q = (page.q || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
      const where = `m.group_id=$1 AND m.active AND NOT m.is_blocked AND NOT EXISTS(SELECT 1 FROM participations p WHERE p.campaign_id=$2 AND p.membership_id=m.id) AND (strpos(translate(lower(m.name),'àâäéèêëîïôöùûüç','aaaeeeeiioouuuc'),$3)>0 OR strpos(coalesce(m.phone,''),$3)>0)`;
      const count = await c.query(`SELECT count(*)::int total FROM memberships m WHERE ${where}`, [
        groupId,
        id,
        q,
      ]);
      const rows = await c.query(
        `SELECT m.id,m.name,m.phone FROM memberships m WHERE ${where} ORDER BY m.name,m.id LIMIT $4 OFFSET $5`,
        [groupId, id, q, page.limit, (page.page - 1) * page.limit],
      );
      return { items: rows.rows, total: count.rows[0].total };
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
    if (input.monthlyWeek && input.rotationInterval !== 'MONTHLY')
      throw new BadRequestException('Le rang mensuel exige une fréquence mensuelle.');

    return this.db.run(actor, async (c) => {
      await requireGroup(c, groupId, true);
      const type = await c.query('SELECT * FROM campaign_types WHERE id=$1', [input.typeId]);
      if (!type.rows[0]) throw new NotFoundException('Type introuvable.');
      if (/tontine/i.test(`${type.rows[0].code} ${type.rows[0].name}`) && !input.standardAmount)
        throw new BadRequestException('Définissez le montant commun de la tontine.');
      const monthlyWeek =
        input.monthlyWeek ??
        (input.rotationInterval === 'MONTHLY' && (await savingsType(c, input.typeId)) ? 1 : null);

      let eventId = input.eventId;
      if (!eventId && !/tontine/i.test(`${type.rows[0].code} ${type.rows[0].name}`)) {
        const ev = await c.query("SELECT id FROM campaign_events WHERE code='AVEC' LIMIT 1");
        eventId = ev.rows[0]?.id;
      }

      const id = randomUUID();
      const r = await c.query(
        `INSERT INTO campaigns(
           id, group_id, type_id, name, start_date, end_date, weekday, interval_weeks, rule_version,
           event_id, is_mandatory, standard_amount, rotation_interval, due_day, monthly_week
         ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
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
          monthlyWeek,
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

  resolveQr(actor: Actor, groupId: string, id: string, input: MemberQrDto) {
    return this.db.run(actor, async (c) => {
      await requireGroup(c, groupId, true);
      await findCampaign(c, groupId, id);
      const match = /^ALF:MEMBER:([0-9a-f-]{36}):([0-9a-f-]{36})(?::.*)?$/i.exec(input.code);
      if (!match || match[1].toLowerCase() !== groupId.toLowerCase())
        throw new BadRequestException('Scannez le QR d’un membre de ce groupement.');
      const result = await c.query(
        `SELECT p.id, p.membership_id, m.name, p.forfait::text, p.is_random
         FROM participations p JOIN memberships m ON m.id=p.membership_id
         WHERE p.campaign_id=$1 AND m.group_id=$2 AND m.active AND NOT m.is_blocked
         AND (m.id::text=$3 OR m.user_id::text=$3)`,
        [id, groupId, match[2].toLowerCase()],
      );
      if (result.rows.length !== 1)
        throw new NotFoundException('Membre non inscrit, inactif ou bloqué dans cette campagne.');
      return result.rows[0];
    });
  }

  participants(actor: Actor, groupId: string, id: string, page: ScopedPageDto) {
    return this.db.run(actor, async (c) => {
      await requireGroup(c, groupId);
      await findCampaign(c, groupId, id);
      const personal = page.scope === 'personal';
      const search = (page.q || '').trim();
      const count = await c.query(
        `SELECT count(*) FROM participations p JOIN memberships m ON m.id=p.membership_id WHERE p.campaign_id=$1 AND (NOT $2::boolean OR app_owns_membership(p.membership_id)) AND (strpos(lower(m.name),lower($3))>0 OR strpos(coalesce(m.phone,''),$3)>0)`,
        [id, personal, search],
      );
      const r = await c.query(
        `SELECT p.id, p.membership_id, m.name, p.forfait::text, p.is_random, p.round_number,
                (SELECT count(DISTINCT to_char(cb.paid_on, 'YYYY-MM'))
                 FROM contributions cb
                 WHERE cb.participation_id=p.id AND cb.voided_at IS NULL)::int AS months_contributed_count,
                (SELECT count(DISTINCT cb.paid_on)
                 FROM contributions cb
                 WHERE cb.participation_id=p.id AND cb.voided_at IS NULL)::int AS sessions_contributed_count,
                (SELECT coalesce(sum(cb.amount),0)::text
                 FROM contributions cb
                 WHERE cb.participation_id=p.id AND cb.voided_at IS NULL) AS total_contributed_amount,
                (SELECT tr.paid
                 FROM tontine_rounds tr
                 WHERE tr.campaign_id=p.campaign_id AND tr.beneficiary_id=p.membership_id
                 ORDER BY tr.round_number LIMIT 1) AS has_received_payout,
                (SELECT coalesce(tr.paid_at::text, tr.expected_date::text)
                 FROM tontine_rounds tr
                 WHERE tr.campaign_id=p.campaign_id AND tr.beneficiary_id=p.membership_id
                 ORDER BY tr.round_number LIMIT 1) AS recovery_period,
                (SELECT tr.payout_amount::text
                 FROM tontine_rounds tr
                 WHERE tr.campaign_id=p.campaign_id AND tr.beneficiary_id=p.membership_id
                 ORDER BY tr.round_number LIMIT 1) AS payout_amount
         FROM participations p
         JOIN memberships m ON m.id=p.membership_id
         WHERE p.campaign_id=$1 AND (NOT $4::boolean OR app_owns_membership(p.membership_id)) AND (strpos(lower(m.name),lower($5))>0 OR strpos(coalesce(m.phone,''),$5)>0)
         ORDER BY m.name, p.id LIMIT $2 OFFSET $3`,
        [id, page.limit, (page.page - 1) * page.limit, personal, search],
      );
      return { items: r.rows, total: Number(count.rows[0].count) };
    });
  }

  participate(actor: Actor, groupId: string, id: string, input: ParticipationDto) {
    return this.db.run(actor, async (c) => {
      await requireGroup(c, groupId, true);
      const campaign = await findCampaign(c, groupId, id, true);
      if (!campaign.active) throw new BadRequestException('Campagne désactivée.');
      if (await isTontine(c, campaign.type_id)) {
        const drawn = await c.query('SELECT id FROM tontine_rounds WHERE campaign_id=$1 LIMIT 1', [
          id,
        ]);
        if (drawn.rows.length)
          throw new ConflictException('Les participations sont figées après le premier tirage.');
      }

      const member = await c.query(
        'SELECT * FROM memberships WHERE id=$1 AND group_id=$2 AND active',
        [input.membershipId, groupId],
      );
      if (!member.rows[0]) throw new NotFoundException('Membre introuvable.');
      if (member.rows[0].is_blocked)
        throw new ForbiddenException('Ce membre est actuellement bloqué.');

      const tontine = await isTontine(c, campaign.type_id);
      const savings = await savingsType(c, campaign.type_id);
      if (tontine && input.isRandom)
        throw new BadRequestException('Le montant est commun à tous les membres de la tontine.');
      const isRandom = tontine ? false : (input.isRandom ?? false);
      const standard = campaign.standard_amount;
      if ((tontine || savings) && !isRandom && !standard)
        throw new BadRequestException(
          'Un montant standard doit être défini à la création de la campagne pour une cotisation fixe.',
        );
      if (
        (tontine || savings) &&
        !isRandom &&
        input.forfait != null &&
        String(input.forfait) !== String(standard)
      )
        throw new BadRequestException(
          'Le montant fixe correspond au montant standard de la campagne.',
        );
      const forfait = isRandom
        ? null
        : tontine || savings
          ? standard
          : (input.forfait ?? standard ?? null);

      const r = await c.query(
        `INSERT INTO participations(id, group_id, campaign_id, membership_id, forfait, is_random, round_number)
         VALUES($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT(campaign_id, membership_id)
         DO NOTHING
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

      if (!r.rows[0])
        throw new ConflictException('Ce membre est déjà inscrit dans cette campagne.');
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
  tontineStatus(actor: Actor, groupId: string, campaignId: string) {
    return this.db.run(actor, async (c) => {
      await requireGroup(c, groupId);
      const campaign = await findCampaign(c, groupId, campaignId);
      if (!(await isTontine(c, campaign.type_id)))
        throw new BadRequestException('Campagne de tontine requise.');
      const today = savingsToday();
      const period = await tontinePeriod(c, campaign, today);
      const active =
        campaign.active &&
        today >= new Date(campaign.start_date).toISOString().slice(0, 10) &&
        today <= new Date(campaign.end_date).toISOString().slice(0, 10);
      const row = period
        ? await c.query(
            'SELECT tr.drawn_at, m.name FROM tontine_rounds tr JOIN memberships m ON m.id=tr.beneficiary_id WHERE tr.campaign_id=$1 AND tr.round_number=$2',
            [campaignId, period.round_number],
          )
        : { rows: [] };
      const drawn = !!row.rows[0]?.drawn_at;
      return {
        today,
        round_number: period?.round_number ?? null,
        round_date: period?.expected_date ?? null,
        scheduled: !!active && period?.expected_date === today,
        drawn,
        can_draw: !!active && period?.expected_date === today && !drawn,
        can_collect: !!active && !!period && drawn,
        beneficiary_name: row.rows[0]?.name ?? null,
      };
    });
  }

  generateTontineDraw(actor: Actor, groupId: string, campaignId: string) {
    return this.db.run(actor, async (c) => {
      await requireGroup(c, groupId, true);
      if (actor.isSuper)
        throw new ForbiddenException('Tirage réservé à l’administration du groupement.');
      const camp = await findCampaign(c, groupId, campaignId, true);
      if (!camp.active || !(await isTontine(c, camp.type_id)))
        throw new BadRequestException('Campagne de tontine active requise.');
      const today = savingsToday();
      const calendar = await tontineCalendar(c, camp);
      const period = calendar.find((r) => r.expected_date === today);
      if (!period || today > new Date(camp.end_date).toISOString().slice(0, 10))
        throw new BadRequestException(
          'Le tirage est autorisé uniquement le jour prévu pour ce tour.',
        );
      const existing = await c.query(
        'SELECT tr.*,tr.expected_date::text,tr.payout_amount::text,tr.drawn_at::text,m.name beneficiary_name FROM tontine_rounds tr JOIN memberships m ON m.id=tr.beneficiary_id WHERE tr.campaign_id=$1 AND tr.round_number=$2',
        [campaignId, period.round_number],
      );
      if (existing.rows.length) return existing.rows;
      const candidates = await c.query(
        `SELECT p.id participation_id,m.id,m.name FROM participations p JOIN memberships m ON m.id=p.membership_id
        WHERE p.campaign_id=$1 AND m.active AND NOT m.is_blocked AND NOT EXISTS(SELECT 1 FROM tontine_rounds tr WHERE tr.campaign_id=$1 AND tr.beneficiary_id=m.id) ORDER BY m.id`,
        [campaignId],
      );
      if (calendar.length < 2 || !candidates.rows.length)
        throw new BadRequestException(
          'Au moins deux participantes et une bénéficiaire encore éligible sont requises.',
        );
      const chosen = candidates.rows[randomInt(candidates.rows.length)];
      const payout = BigInt(camp.standard_amount || 5000) * BigInt(calendar.length);
      const result = await c.query(
        `INSERT INTO tontine_rounds(id,campaign_id,group_id,round_number,beneficiary_id,expected_date,payout_amount,drawn_at,drawn_by)
        VALUES($1,$2,$3,$4,$5,$6,$7,now(),$8) RETURNING *,expected_date::text,payout_amount::text,drawn_at::text`,
        [
          randomUUID(),
          campaignId,
          groupId,
          period.round_number,
          chosen.id,
          today,
          payout.toString(),
          actor.id,
        ],
      );
      await c.query('UPDATE participations SET round_number=$1 WHERE id=$2', [
        period.round_number,
        chosen.participation_id,
      ]);
      if (period.round_number === 1) {
        const end = new Date(calendar[calendar.length - 1].period_end + 'T12:00:00Z');
        end.setUTCDate(end.getUTCDate() - 1);
        await c.query('UPDATE campaigns SET end_date=$1 WHERE id=$2', [
          end.toISOString().slice(0, 10),
          campaignId,
        ]);
      }
      await audit(c, actor, groupId, 'TONTINE_ROUND_DRAWN', result.rows[0].id, {
        roundNumber: period.round_number,
        beneficiaryId: chosen.id,
      });
      return [{ ...result.rows[0], beneficiary_name: chosen.name }];
    });
  }

  listTontineRounds(actor: Actor, groupId: string, campaignId: string) {
    return this.db.run(actor, async (c) => {
      await requireGroup(c, groupId);
      const campaign = await findCampaign(c, groupId, campaignId);
      const calendar = await tontineCalendar(c, campaign);
      const stored = await c.query(
        `SELECT tr.id,tr.round_number,tr.beneficiary_id,m.name beneficiary_name,tr.expected_date::text,tr.payout_amount::text,tr.paid,tr.paid_at::text,tr.drawn_at::text FROM tontine_rounds tr JOIN memberships m ON m.id=tr.beneficiary_id WHERE tr.campaign_id=$1`,
        [campaignId],
      );
      const rounds = [];
      for (const period of calendar) {
        const row = stored.rows.find((r: any) => r.round_number === period.round_number) || {
          id: `planned:${campaignId}:${period.round_number}`,
          round_number: period.round_number,
          beneficiary_id: null,
          beneficiary_name: null,
          expected_date: period.expected_date,
          payout_amount: (
            BigInt(campaign.standard_amount || 5000) * BigInt(calendar.length)
          ).toString(),
          paid: false,
          paid_at: null,
          drawn_at: null,
        };
        const contribs = await c.query(
          `SELECT cb.id contribution_id,m.id member_id,m.name member_name,cb.amount::text,cb.reference,cb.paid_on::text FROM contributions cb JOIN participations p ON p.id=cb.participation_id JOIN memberships m ON m.id=p.membership_id WHERE cb.campaign_id=$1 AND cb.voided_at IS NULL AND cb.paid_on >= $2::date AND cb.paid_on < $3::date ORDER BY cb.paid_on DESC,cb.created_at DESC`,
          [campaignId, period.expected_date, period.period_end],
        );
        const contributed = new Set(contribs.rows.map((r: any) => r.member_id)).size;
        rounds.push({
          ...row,
          total_collected_amount: contribs.rows
            .reduce((sum: bigint, item: any) => sum + BigInt(item.amount), 0n)
            .toString(),
          contributions: contribs.rows,
          contributed_count: contributed,
          unpaid_count: Math.max(0, calendar.length - contributed),
        });
      }
      return rounds;
    });
  }

  tontineMembers(actor: Actor, groupId: string, campaignId: string, page: TontineMembersQueryDto) {
    return this.db.run(actor, async (c) => {
      await requireGroup(c, groupId, true);
      const campaign = await findCampaign(c, groupId, campaignId);
      const type = await c.query('SELECT name,code FROM campaign_types WHERE id=$1', [
        campaign.type_id,
      ]);
      if (!/tontine/i.test(`${type.rows[0]?.name} ${type.rows[0]?.code}`))
        throw new BadRequestException('Campagne de tontine requise.');
      const calendar = await tontineCalendar(c, campaign);
      const period = page.roundNumber
        ? calendar.find((r) => r.round_number === page.roundNumber)
        : calendar[0];
      if (!period) throw new NotFoundException('Tour introuvable.');
      const start = period.expected_date;
      const end = period.period_end;
      const search = (page.q || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
      const args = [campaignId, start, end, search, page.state || 'all', campaign.standard_amount];
      const roster = `WITH roster AS (
        SELECT m.id member_id, m.name member_name, coalesce(p.forfait, $6::bigint)::text expected_amount,
          coalesce((SELECT sum(cb.amount) FROM contributions cb WHERE cb.participation_id=p.id AND cb.voided_at IS NULL AND cb.paid_on >= $2::date AND cb.paid_on < $3::date),0)::text paid_amount,
          (SELECT gp.extended_deadline::text FROM contribution_grace_periods gp WHERE gp.campaign_id=p.campaign_id AND gp.membership_id=m.id AND gp.period_date=$2::date) grace_deadline
        FROM participations p JOIN memberships m ON m.id=p.membership_id WHERE p.campaign_id=$1
      ), attendance AS (SELECT *, paid_amount::bigint > 0 contributed FROM roster)`;
      const filter = `strpos(translate(lower(member_name),'àâäéèêëîïôöùûüç','aaaeeeeiioouuuc'),$4)>0 AND ($5='all' OR contributed=($5='paid'))`;
      const counts = await c.query(
        `${roster} SELECT count(*) FILTER (WHERE ${filter})::int total, count(*) FILTER (WHERE contributed)::int contributed_count, count(*) FILTER (WHERE NOT contributed)::int unpaid_count FROM attendance`,
        args,
      );
      const rows = await c.query(
        `${roster} SELECT * FROM attendance WHERE ${filter} ORDER BY member_name,member_id LIMIT $7 OFFSET $8`,
        [...args, page.limit, (page.page - 1) * page.limit],
      );
      const today = savingsToday();
      const drawn = await c.query(
        'SELECT id,beneficiary_id FROM tontine_rounds WHERE campaign_id=$1 AND round_number=$2 AND drawn_at IS NOT NULL',
        [campaignId, period.round_number],
      );
      const canGrant =
        !actor.isSuper &&
        campaign.active &&
        today >= start &&
        today < end &&
        today <= new Date(campaign.end_date).toISOString().slice(0, 10) &&
        drawn.rows.length > 0;
      return {
        items: rows.rows.map((row: any) => ({
          ...row,
          is_beneficiary: row.member_id === drawn.rows[0]?.beneficiary_id,
          grace_deadline:
            row.member_id === drawn.rows[0]?.beneficiary_id ? null : row.grace_deadline,
          absent:
            row.member_id !== drawn.rows[0]?.beneficiary_id &&
            !row.contributed &&
            !!row.grace_deadline &&
            row.grace_deadline < today,
          can_grant_grace:
            row.member_id !== drawn.rows[0]?.beneficiary_id &&
            !!canGrant &&
            !row.contributed &&
            (!row.grace_deadline ||
              row.grace_deadline <
                new Date(Date.parse(end + 'T12:00:00Z') - 86400000).toISOString().slice(0, 10)),
        })),
        ...counts.rows[0],
        period_start: start,
        period_end: end,
      };
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
      throw new ConflictException('Les tirages enregistrés ne peuvent pas être réattribués.');
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
      if (actor.isSuper)
        throw new ForbiddenException('Le responsable du groupement accorde les délais de grâce.');
      const campaign = await findCampaign(c, groupId, campaignId, true);
      const validDate = (value: string) =>
        Number.isFinite(Date.parse(value + 'T00:00:00Z')) &&
        new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
      const today = savingsToday();
      if (
        !validDate(input.periodDate) ||
        !validDate(input.extendedDeadline) ||
        input.extendedDeadline < input.periodDate ||
        input.extendedDeadline < today
      )
        throw new BadRequestException(
          'La date limite doit être valide et ne peut pas être passée.',
        );
      const participation = await c.query(
        'SELECT p.id,m.name FROM participations p JOIN memberships m ON m.id=p.membership_id WHERE p.campaign_id=$1 AND m.id=$2 AND m.group_id=$3',
        [campaignId, input.membershipId, groupId],
      );
      if (!participation.rows[0])
        throw new NotFoundException('Membre non inscrit à cette campagne.');
      if (await isTontine(c, campaign.type_id)) {
        const period = (await tontineCalendar(c, campaign)).find(
          (r) => r.expected_date === input.periodDate,
        );
        if (
          !period ||
          !campaign.active ||
          today < period.expected_date ||
          today >= period.period_end ||
          today > new Date(campaign.end_date).toISOString().slice(0, 10) ||
          input.extendedDeadline >= period.period_end
        )
          throw new BadRequestException(
            'Le délai doit concerner le tour en cours et se terminer avant le prochain tour.',
          );
        const draw = await c.query(
          'SELECT id,beneficiary_id FROM tontine_rounds WHERE campaign_id=$1 AND round_number=$2 AND drawn_at IS NOT NULL',
          [campaignId, period.round_number],
        );
        if (!draw.rows.length)
          throw new ConflictException('Effectuez le tirage avant d’accorder un délai.');
        if (draw.rows[0].beneficiary_id === input.membershipId)
          throw new ConflictException(
            'La bénéficiaire de ce tour n’a pas besoin de délai de grâce.',
          );
        const paid = await c.query(
          'SELECT id FROM contributions WHERE participation_id=$1 AND voided_at IS NULL AND paid_on >= $2::date AND paid_on < $3::date LIMIT 1',
          [participation.rows[0].id, period.expected_date, period.period_end],
        );
        if (paid.rows.length) throw new ConflictException('Ce membre a déjà cotisé pour ce tour.');
      }
      const id = randomUUID();
      const r = await c.query(
        `INSERT INTO contribution_grace_periods(id, group_id, campaign_id, membership_id, period_date, extended_deadline, reason, granted_by)
         VALUES($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (campaign_id,membership_id,period_date) DO UPDATE SET extended_deadline=excluded.extended_deadline,reason=excluded.reason,granted_by=excluded.granted_by
         WHERE contribution_grace_periods.extended_deadline < excluded.extended_deadline
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
      if (!r.rows[0])
        throw new ConflictException('Le nouveau délai doit prolonger le délai existant.');
      await audit(c, actor, groupId, 'GRACE_PERIOD_GRANTED', r.rows[0].id, input);
      return { ...r.rows[0], member_name: participation.rows[0].name };
    });
  }

  listGracePeriods(actor: Actor, groupId: string, campaignId: string) {
    return this.db.run(actor, async (c) => {
      await requireGroup(c, groupId);
      await findCampaign(c, groupId, campaignId);
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

  savingsSession(actor: Actor, groupId: string, campaignId: string, open = false) {
    return this.db.run(actor, async (c) => {
      await requireGroup(c, groupId, open);
      const campaign = await findCampaign(c, groupId, campaignId, open);
      const today = savingsToday();
      const isSavings = await savingsType(c, campaign.type_id);
      const scheduled = isSavings && scheduledSavingsDay(campaign, today);
      if (open) {
        const permission = await c.query('SELECT app_is_admin($1) AS allowed', [groupId]);
        if (!permission.rows[0].allowed || actor.isSuper)
          throw new ForbiddenException('Ouverture réservée à l’administratrice du groupement.');
        if (!scheduled)
          throw new BadRequestException(
            'La séance ne peut être ouverte que le jour prévu dans la campagne d’épargne.',
          );
        const inserted = await c.query(
          `INSERT INTO savings_sessions(id,group_id,campaign_id,session_date,created_by)
          VALUES($1,$2,$3,$4,$5) ON CONFLICT(campaign_id,session_date) DO NOTHING RETURNING id`,
          [randomUUID(), groupId, campaignId, today, actor.id],
        );
        if (inserted.rows[0])
          await audit(c, actor, groupId, 'SAVINGS_SESSION_OPENED', inserted.rows[0].id, {
            campaignId,
            date: today,
          });
      }
      const result = await c.query(
        'SELECT id FROM savings_sessions WHERE campaign_id=$1 AND session_date=$2',
        [campaignId, today],
      );
      const opened = result.rows.length > 0;
      return { today, scheduled, opened, can_collect: scheduled && opened };
    });
  }

  // Cahier de séance (Détails des séances avec total encaissé et cotisation par membre)
  sessions(actor: Actor, groupId: string, campaignId: string) {
    return this.db.run(actor, async (c) => {
      await requireGroup(c, groupId);
      await findCampaign(c, groupId, campaignId);
      const roster = await c.query(
        `SELECT m.id member_id, m.name member_name,
                CASE WHEN p.is_random THEN NULL ELSE p.forfait::text END expected_amount
         FROM participations p JOIN memberships m ON m.id=p.membership_id
         WHERE p.campaign_id=$1 ORDER BY m.name, m.id`,
        [campaignId],
      );
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

      const opened = await c.query(
        'SELECT session_date::text FROM savings_sessions WHERE campaign_id=$1',
        [campaignId],
      );
      for (const row of opened.rows)
        if (!map.has(row.session_date)) map.set(row.session_date, { total: 0n, items: [] });
      const sessions: CampaignSessionView[] = [];
      for (const [date, val] of map.entries()) {
        const distinctMembers = new Set(val.items.map((i: any) => i.member_id)).size;
        sessions.push({
          expected_amount: roster.rows
            .reduce((sum, member) => sum + BigInt(member.expected_amount || '0'), 0n)
            .toString(),
          free_members_count: roster.rows.filter((member) => member.expected_amount === null)
            .length,
          members: roster.rows.map((member) => {
            const payments = val.items.filter((payment) => payment.member_id === member.member_id);
            return {
              ...member,
              paid_amount: payments
                .reduce((sum, payment) => sum + BigInt(payment.amount), 0n)
                .toString(),
              contributed: payments.length > 0,
            };
          }),
          session_date: date,
          total_amount: val.total.toString(),
          count: val.items.length,
          members_count: distinctMembers,
          contributions: val.items,
        });
      }

      return sessions.sort((a, b) => b.session_date.localeCompare(a.session_date));
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

  @Get('shortcuts')
  @ApiOperation({ operationId: 'getCampaignShortcuts' })
  @ApiOkResponse({ type: CampaignShortcutsDto })
  shortcuts(@Req() r: AuthRequest, @Param('groupId', ParseUUIDPipe) g: string) {
    return this.service.shortcuts(r.actor, g);
  }

  @Put('shortcuts')
  @ApiOperation({ operationId: 'saveCampaignShortcuts' })
  @ApiOkResponse({ type: CampaignShortcutsDto })
  saveShortcuts(
    @Req() r: AuthRequest,
    @Param('groupId', ParseUUIDPipe) g: string,
    @Body() input: CampaignShortcutsDto,
  ) {
    return this.service.shortcuts(r.actor, g, input);
  }

  @Get(':id/eligible-members')
  @ApiOperation({ operationId: 'eligibleCampaignMembers' })
  @ApiOkResponse({ type: EligibleMemberPage })
  eligibleMembers(
    @Req() r: AuthRequest,
    @Param('groupId', ParseUUIDPipe) g: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() page: EligibleMembersQueryDto,
  ) {
    return this.service.eligibleMembers(r.actor, g, id, page);
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

  @Post(':id/resolve-member-qr')
  @ApiOperation({ operationId: 'resolveMemberQr' })
  @ApiCreatedResponse({ type: ParticipationView })
  resolveQr(
    @Req() r: AuthRequest,
    @Param('groupId', ParseUUIDPipe) g: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: MemberQrDto,
  ) {
    return this.service.resolveQr(r.actor, g, id, input);
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

  @Get(':id/tontine/status')
  @ApiOperation({ operationId: 'getTontineStatus' })
  @ApiOkResponse({ type: TontineStatusView })
  tontineStatus(
    @Req() r: AuthRequest,
    @Param('groupId', ParseUUIDPipe) g: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.tontineStatus(r.actor, g, id);
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

  @Get(':id/tontine/members')
  @ApiOperation({ operationId: 'listTontineMembers' })
  @ApiOkResponse({ type: TontineMembersPage })
  tontineMembers(
    @Req() r: AuthRequest,
    @Param('groupId', ParseUUIDPipe) g: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() page: TontineMembersQueryDto,
  ) {
    return this.service.tontineMembers(r.actor, g, id, page);
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

  @Get(':id/savings-session')
  @ApiOperation({ operationId: 'savingsSessionStatus' })
  @ApiOkResponse({ type: SavingsSessionStatusView })
  savingsSessionStatus(
    @Req() r: AuthRequest,
    @Param('groupId', ParseUUIDPipe) g: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.savingsSession(r.actor, g, id);
  }

  @Post(':id/savings-session')
  @ApiOperation({ operationId: 'openSavingsSession' })
  @ApiCreatedResponse({ type: SavingsSessionStatusView })
  openSavingsSession(
    @Req() r: AuthRequest,
    @Param('groupId', ParseUUIDPipe) g: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.savingsSession(r.actor, g, id, true);
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
