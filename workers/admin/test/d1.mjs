// A small stand-in for Cloudflare D1 on top of Node's built-in SQLite, so the Worker's real SQL runs in tests.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

class Stmt {
  constructor(db, sql, args = []) { this.db = db; this.sql = sql; this.args = args; }
  bind(...a) { return new Stmt(this.db, this.sql, a); }
  _p() { return this.db.prepare(this.sql); }
  async first(col) { const r = this._p().get(...this.args); return r === undefined ? null : col ? r[col] : { ...r }; }
  async all() { return { results: this._p().all(...this.args).map(r => ({ ...r })), success: true }; }
  async run() {
    if (/\bRETURNING\b/i.test(this.sql)) { const rows = this._p().all(...this.args); return { results: rows, meta: { changes: rows.length } }; }
    const r = this._p().run(...this.args); return { success: true, meta: { changes: Number(r.changes) } };
  }
}
export class D1 {
  constructor() {
    this.db = new DatabaseSync(':memory:');
    const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');
    for (const f of readdirSync(dir).sort()) this.db.exec(readFileSync(join(dir, f), 'utf8'));
  }
  prepare(sql) { return new Stmt(this.db, sql); }
  async batch(list) { this.db.exec('BEGIN'); try { const out = []; for (const s of list) out.push(await s.run()); this.db.exec('COMMIT'); return out; } catch (e) { this.db.exec('ROLLBACK'); throw e; } }
}
