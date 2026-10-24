import { Global, Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient, QueryResultRow } from 'pg';
import { settings } from '../config';
export interface Actor {
  id: string;
  login: string;
  name: string;
  isSuper: boolean;
  hasSecretCode?: boolean;
  phone?: string | null;
}
export interface SqlClient {
  query<T extends QueryResultRow = any>(
    sql: string,
    values?: any[],
  ): Promise<{ rows: T[]; rowCount: number | null }>;
}
@Injectable()
export class Database implements OnModuleDestroy {
  private readonly pool = new Pool({
    connectionString: settings.databaseUrl,
    max: 15,
    connectionTimeoutMillis: 5000,
  });
  async query<T extends QueryResultRow = any>(sql: string, values?: any[]) {
    return this.pool.query<T>(sql, values);
  }
  async run<T>(actor: Actor, operation: (client: SqlClient) => Promise<T>): Promise<T> {
    const c: PoolClient = await this.pool.connect();
    try {
      await c.query('BEGIN');
      await c.query("SELECT set_config('app.user_id',$1,true)", [actor.id]);
      const value = await operation(c);
      await c.query('COMMIT');
      return value;
    } catch (error) {
      await c.query('ROLLBACK');
      throw error;
    } finally {
      c.release();
    }
  }
  async onModuleDestroy() {
    await this.pool.end();
  }
  async assertRuntimeRole() {
    const r = await this.query(
      'SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user',
    );
    if (r.rows[0]?.rolsuper || r.rows[0]?.rolbypassrls)
      throw new Error('Le compte API doit être sans SUPERUSER ni BYPASSRLS.');
    const owners = await this.query(
      "SELECT 1 FROM pg_class WHERE relnamespace='public'::regnamespace AND relname IN ('groupements','memberships','campaigns','participations','contributions') AND relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)",
    );
    if (owners.rows.length)
      throw new Error('Le compte API ne doit pas être propriétaire des tables métier.');
  }
}
@Global()
@Module({ providers: [Database], exports: [Database] })
export class DatabaseModule {}
