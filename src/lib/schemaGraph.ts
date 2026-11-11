// Read tables, columns and foreign keys from the catalog, for the ER diagram.
import type { Exec } from './pg';

export interface ErColumn {
  name: string;
  type: string;
  pk: boolean;
  fk: boolean;
  notNull: boolean;
}
export interface ErLink {
  from: string; // table holding the foreign key
  fromCols: string[];
  to: string; // referenced table
  toCols: string[];
  name: string;
}
export interface ErTable {
  name: string;
  columns: ErColumn[];
}
export interface ErSchema {
  tables: ErTable[];
  links: ErLink[];
}

const quote = (s: string) => `'${s.replace(/'/g, "''")}'`;

export async function readSchema(exec: Exec, schema: string): Promise<ErSchema | null> {
  const ns = quote(schema);
  const cols = await exec(`
    SELECT c.relname, a.attname, format_type(a.atttypid, a.atttypmod), a.attnotnull,
      EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conrelid = c.oid AND k.contype = 'p' AND a.attnum = ANY (k.conkey)),
      EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conrelid = c.oid AND k.contype = 'f' AND a.attnum = ANY (k.conkey))
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
    WHERE n.nspname = ${ns} AND c.relkind IN ('r', 'p')
    ORDER BY c.relname, a.attnum`);
  const fks = await exec(`
    SELECT k.conname, c.relname, r.relname,
      (SELECT string_agg(a.attname, ',' ORDER BY x.i) FROM unnest(k.conkey) WITH ORDINALITY x(n, i) JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = x.n),
      (SELECT string_agg(a.attname, ',' ORDER BY x.i) FROM unnest(k.confkey) WITH ORDINALITY x(n, i) JOIN pg_attribute a ON a.attrelid = k.confrelid AND a.attnum = x.n)
    FROM pg_constraint k
    JOIN pg_class c ON c.oid = k.conrelid
    JOIN pg_class r ON r.oid = k.confrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE k.contype = 'f' AND n.nspname = ${ns}
    ORDER BY c.relname, k.conname`);
  if (!cols.ok || !fks.ok) return null;
  const tables = new Map<string, ErTable>();
  for (const [t, name, type, notNull, pk, fk] of cols.results[0].values) {
    const key = String(t);
    if (!tables.has(key)) tables.set(key, { name: key, columns: [] });
    tables.get(key)!.columns.push({ name: String(name), type: String(type), notNull: !!notNull, pk: !!pk, fk: !!fk });
  }
  const arr = (v: unknown) => String(v).split(',');
  const links = fks.results[0].values.map(([name, from, to, fromCols, toCols]) => ({
    name: String(name),
    from: String(from),
    to: String(to),
    fromCols: arr(fromCols),
    toCols: arr(toCols),
  }));
  return { tables: [...tables.values()], links };
}

export interface Box {
  x: number;
  y: number;
}

/**
 * Place tables in columns by how deep their chain of foreign keys goes: tables that reference
 * nothing on the left, tables that reference them to the right, and so on.
 */
export function layoutEr(s: ErSchema, size: { w: number; rowH: number; headH: number; gapX: number; gapY: number }): Record<string, Box> {
  const depth = new Map<string, number>();
  const parents = (t: string) => s.links.filter((l) => l.from === t && l.to !== t).map((l) => l.to);
  const visit = (t: string, seen: Set<string>): number => {
    if (depth.has(t)) return depth.get(t)!;
    if (seen.has(t)) return 0; // a cycle (store ↔ staff): stop here
    seen.add(t);
    const d = Math.max(-1, ...parents(t).map((p) => visit(p, seen))) + 1;
    seen.delete(t);
    depth.set(t, d);
    return d;
  };
  s.tables.forEach((t) => visit(t.name, new Set()));
  const cols: ErTable[][] = [];
  for (const t of s.tables) (cols[depth.get(t.name) ?? 0] ??= []).push(t);
  const out: Record<string, Box> = {};
  cols.forEach((list, ci) => {
    let y = 16;
    for (const t of list ?? []) {
      out[t.name] = { x: 16 + ci * (size.w + size.gapX), y };
      y += size.headH + t.columns.length * size.rowH + size.gapY;
    }
  });
  return out;
}
