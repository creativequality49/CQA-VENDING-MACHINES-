// In-memory stand-in for the parts of the Supabase client the server uses,
// so route and call-completion code runs unmodified in tests. It does not
// model RLS: tests/db/*.test.sql covers that against real PostgreSQL.
import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

type Row = Record<string, any>;
type Filter = (row: Row) => boolean;
type Rpc = (args: Record<string, any>, db: FakeDb) => { data: any; error: any } | Promise<{ data: any; error: any }>;

export class FakeDb {
  tables: Record<string, Row[]> = {};
  rpcs: Record<string, Rpc> = {};
  log: Array<{ table: string; op: string; filters: string[] }> = [];

  constructor(seed: Record<string, Row[]> = {}) {
    for (const [table, rows] of Object.entries(seed)) this.tables[table] = rows.map((row) => ({ ...row }));
  }

  rows(table: string) {
    return (this.tables[table] ??= []);
  }

  client(): SupabaseClient {
    return {
      from: (table: string) => new Query(this, table),
      rpc: async (name: string, args: Record<string, any>) => {
        const fn = this.rpcs[name];
        if (!fn) return { data: null, error: { message: `no rpc ${name}`, code: 'PGRST202' } };
        return fn(args, this);
      },
    } as unknown as SupabaseClient;
  }
}

class Query implements PromiseLike<{ data: any; error: any; count?: number | null }> {
  private filters: Filter[] = [];
  private filterLog: string[] = [];
  private op: 'select' | 'update' | 'insert' | 'upsert' = 'select';
  private payload: Row | Row[] | null = null;
  private returning = false;
  private head = false;
  private wantCount = false;
  private orderBy: { column: string; ascending: boolean } | null = null;
  private max: number | null = null;
  private single: 'maybe' | 'one' | null = null;
  private upsertOptions: { onConflict?: string; ignoreDuplicates?: boolean } = {};

  constructor(private db: FakeDb, private table: string) {}

  select(_columns?: string, options?: { count?: string; head?: boolean }) {
    if (this.op === 'select') {
      this.head = Boolean(options?.head);
      this.wantCount = Boolean(options?.count);
    } else {
      this.returning = true;
    }
    return this;
  }
  update(values: Row) { this.op = 'update'; this.payload = values; return this; }
  insert(values: Row | Row[]) { this.op = 'insert'; this.payload = values; return this; }
  upsert(values: Row | Row[], options: { onConflict?: string; ignoreDuplicates?: boolean } = {}) {
    this.op = 'upsert'; this.payload = values; this.upsertOptions = options; return this;
  }
  eq(column: string, value: unknown) { this.filterLog.push(`${column}=${value}`); this.filters.push((row) => row[column] === value); return this; }
  is(column: string, value: unknown) { this.filterLog.push(`${column} is ${value}`); this.filters.push((row) => (row[column] ?? null) === value); return this; }
  gte(column: string, value: string) { this.filterLog.push(`${column}>=${value}`); this.filters.push((row) => row[column] != null && String(row[column]) >= value); return this; }
  order(column: string, options: { ascending?: boolean } = {}) { this.orderBy = { column, ascending: options.ascending ?? true }; return this; }
  limit(n: number) { this.max = n; return this; }
  maybeSingle() { this.single = 'maybe'; return this; }
  singleRow() { this.single = 'one'; return this; }

  private matching() {
    return this.db.rows(this.table).filter((row) => this.filters.every((f) => f(row)));
  }

  private run(): { data: any; error: any; count?: number | null } {
    this.db.log.push({ table: this.table, op: this.op, filters: this.filterLog });
    let rows: Row[];
    if (this.op === 'select') {
      rows = this.matching();
      if (this.orderBy) {
        const { column, ascending } = this.orderBy;
        rows = [...rows].sort((a, b) => (a[column] > b[column] ? 1 : a[column] < b[column] ? -1 : 0) * (ascending ? 1 : -1));
      }
      if (this.max != null) rows = rows.slice(0, this.max);
      if (this.head) return { data: null, error: null, count: rows.length };
      return this.shape(rows.map((row) => ({ ...row })), this.wantCount ? rows.length : undefined);
    }
    if (this.op === 'update') {
      rows = this.matching();
      for (const row of rows) Object.assign(row, this.payload);
      return this.returning ? this.shape(rows.map((row) => ({ ...row }))) : { data: null, error: null };
    }
    const values = (Array.isArray(this.payload) ? this.payload : [this.payload!]).map((row) => ({ id: crypto.randomUUID(), ...row }));
    const inserted: Row[] = [];
    for (const value of values) {
      const key = this.upsertOptions.onConflict;
      const existing = key ? this.db.rows(this.table).find((row) => row[key] === value[key]) : undefined;
      if (existing) {
        if (this.op === 'insert') return { data: null, error: { code: '23505', message: 'duplicate' } };
        if (!this.upsertOptions.ignoreDuplicates) Object.assign(existing, value, { id: existing.id });
        continue;
      }
      this.db.rows(this.table).push(value);
      inserted.push(value);
    }
    return this.returning ? this.shape(inserted.map((row) => ({ ...row }))) : { data: null, error: null };
  }

  private shape(rows: Row[], count?: number) {
    if (this.single) {
      if (rows.length > 1) return { data: null, error: { code: 'PGRST116', message: 'multiple rows' } };
      if (!rows.length && this.single === 'one') return { data: null, error: { code: 'PGRST116', message: 'no rows' } };
      return { data: rows[0] ?? null, error: null };
    }
    return { data: rows, error: null, ...(count !== undefined ? { count } : {}) };
  }

  then<T1 = { data: any; error: any }, T2 = never>(onfulfilled?: ((value: { data: any; error: any; count?: number | null }) => T1 | PromiseLike<T1>) | null, onrejected?: ((reason: any) => T2 | PromiseLike<T2>) | null): PromiseLike<T1 | T2> {
    return Promise.resolve().then(() => this.run()).then(onfulfilled, onrejected);
  }
}

// The claim RPC with the same once-only semantics as the SQL function.
export function installClaimRpc(db: FakeDb) {
  db.rpcs.claim_call_alert = ({ p_call_id, p_recipient }) => {
    const call = db.rows('calls').find((row) => row.id === p_call_id);
    if (!call) return { data: null, error: null };
    if (db.rows('alert_deliveries').some((row) => row.call_id === p_call_id && row.kind === 'owner_new_call')) return { data: null, error: null };
    const id = crypto.randomUUID();
    db.rows('alert_deliveries').push({ id, business_id: call.business_id, call_id: p_call_id, kind: 'owner_new_call', recipient: p_recipient, status: 'pending' });
    return { data: id, error: null };
  };
}

export const BIZ_A = '11111111-1111-4111-8111-111111111111';
export const BIZ_B = '22222222-2222-4222-8222-222222222222';
export const sid = (char: string) => `CA${char.repeat(32)}`;
