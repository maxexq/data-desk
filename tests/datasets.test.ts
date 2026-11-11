// The Sandbox datasets load into PGlite, and the ER diagram reads their keys.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { execOn } from '../src/lib/pg';
import { layoutEr, readSchema } from '../src/lib/schemaGraph';

const load = async (name: string) => {
  const db = await PGlite.create();
  await db.exec(readFileSync(new URL(`../src/datasets/${name}.sql`, import.meta.url), 'utf8'));
  return db;
};

describe('sandbox datasets', () => {
  it('Chinook loads with its well-known numbers', async () => {
    const db = await load('chinook');
    const r = await db.query<{ n: number }>('SELECT count(*)::int AS n FROM track');
    expect(r.rows[0].n).toBe(3503);
    const s = (await readSchema((sql) => execOn(db, sql), 'public'))!;
    expect(s.tables).toHaveLength(11);
    // employee.reports_to references employee itself
    expect(s.links).toContainEqual(expect.objectContaining({ from: 'employee', to: 'employee', fromCols: ['reports_to'] }));
    await db.close();
  }, 30_000);

  it('Pagila loads cut down and keeps every foreign key valid', async () => {
    const db = await load('pagila');
    const r = await db.query<{ rentals: number; films: number }>('SELECT (SELECT count(*) FROM rental)::int AS rentals, (SELECT count(*) FROM film)::int AS films');
    expect(r.rows[0]).toEqual({ rentals: 16044, films: 1000 });
    const s = (await readSchema((sql) => execOn(db, sql), 'public'))!;
    expect(s.tables).toHaveLength(15);
    expect(s.links.find((l) => l.from === 'film_actor' && l.to === 'actor')?.fromCols).toEqual(['actor_id']);

    // Referenced tables sit left of the tables that reference them, even with the store ↔ staff cycle.
    const at = layoutEr(s, { w: 200, rowH: 20, headH: 26, gapX: 80, gapY: 20 });
    expect(Object.keys(at)).toHaveLength(15);
    expect(at.country.x).toBeLessThan(at.city.x);
    expect(at.city.x).toBeLessThan(at.address.x);
    expect(at.film.x).toBeLessThan(at.film_actor.x);
    await db.close();
  }, 60_000);
});
