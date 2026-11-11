// Builds the Sandbox datasets in src/datasets/ from the upstream SQL files.
//
//   node scripts/build-datasets.mjs <folder>
//
// <folder> must hold, downloaded from the upstream repos:
//   Chinook_PostgreSql.sql  https://github.com/lerocha/chinook-database (MIT)
//   pagila-data.sql         https://github.com/devrimgunduz/pagila (PostgreSQL License)
//
// Chinook is used as is, minus the psql-only lines. Pagila is cut down to load in a browser:
// the classic Sakila shape (about 16k rentals) without pgvector embeddings, full-text vectors,
// UUIDs, staff pictures or password hashes, and with payments in one table instead of partitions.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) throw new Error('usage: node scripts/build-datasets.mjs <folder with the upstream .sql files>');
const out = new URL('../src/datasets/', import.meta.url);

// ---------- Chinook ----------
const chinook = readFileSync(join(dir, 'Chinook_PostgreSql.sql'), 'utf8')
  .split('\n')
  .filter((l) => !/^(DROP DATABASE|CREATE DATABASE|\\c )/.test(l))
  .join('\n');
writeFileSync(
  new URL('chinook.sql', out),
  `-- Chinook Database 1.4.5, Copyright (c) 2008-2024 Luis Rocha, MIT License.\n-- https://github.com/lerocha/chinook-database — built by scripts/build-datasets.mjs\n${chinook}`,
);

// ---------- Pagila ----------
const MAX_RENTAL = 16049; // the original Sakila rental count
const copy = {};
let cur = null;
for (const line of readFileSync(join(dir, 'pagila-data.sql'), 'utf8').split('\n')) {
  if (!cur) {
    const m = line.match(/^COPY public\.(\w+) \((.*)\) FROM stdin;$/);
    if (m) {
      cur = m[1].startsWith('payment_p') ? 'payment' : m[1];
      copy[cur] ??= { cols: m[2].split(', '), rows: [] };
    }
  } else if (line === '\\.') cur = null;
  else copy[cur].rows.push(line.split('\t'));
}

// COPY text format → SQL literal. Postgres casts the quoted text to each column's type.
const unescape = (v) => v.replace(/\\(.)/g, (_, c) => ({ t: '\t', n: '\n', r: '\r', '\\': '\\' })[c] ?? c);
const lit = (v) => (v === '\\N' ? 'NULL' : `'${unescape(v).replaceAll("'", "''")}'`);

const SCHEMA = `
CREATE TYPE mpaa_rating AS ENUM ('G', 'PG', 'PG-13', 'R', 'NC-17');

CREATE TABLE language (language_id int PRIMARY KEY, name text NOT NULL);
CREATE TABLE category (category_id int PRIMARY KEY, name text NOT NULL);
CREATE TABLE actor (actor_id int PRIMARY KEY, first_name text NOT NULL, last_name text NOT NULL);
CREATE TABLE film (
  film_id int PRIMARY KEY,
  title text NOT NULL,
  description text,
  release_year int CHECK (release_year BETWEEN 1901 AND 2155),
  language_id int NOT NULL REFERENCES language,
  original_language_id int REFERENCES language (language_id),
  rental_duration smallint NOT NULL DEFAULT 3,
  rental_rate numeric(4, 2) NOT NULL DEFAULT 4.99,
  length smallint,
  replacement_cost numeric(5, 2) NOT NULL DEFAULT 19.99,
  rating mpaa_rating DEFAULT 'G',
  special_features text[]
);
CREATE TABLE film_actor (actor_id int REFERENCES actor, film_id int REFERENCES film, PRIMARY KEY (actor_id, film_id));
CREATE TABLE film_category (film_id int REFERENCES film, category_id int REFERENCES category, PRIMARY KEY (film_id, category_id));
CREATE TABLE country (country_id int PRIMARY KEY, country text NOT NULL);
CREATE TABLE city (city_id int PRIMARY KEY, city text NOT NULL, country_id int NOT NULL REFERENCES country);
CREATE TABLE address (
  address_id int PRIMARY KEY,
  address text NOT NULL,
  address2 text,
  district text NOT NULL,
  city_id int NOT NULL REFERENCES city,
  postal_code text,
  phone text NOT NULL
);
CREATE TABLE store (store_id int PRIMARY KEY, manager_staff_id int NOT NULL, address_id int NOT NULL REFERENCES address);
CREATE TABLE staff (
  staff_id int PRIMARY KEY,
  first_name text NOT NULL,
  last_name text NOT NULL,
  address_id int NOT NULL REFERENCES address,
  email text,
  store_id int NOT NULL REFERENCES store,
  active boolean NOT NULL DEFAULT true,
  username text NOT NULL
);
CREATE TABLE customer (
  customer_id int PRIMARY KEY,
  store_id int NOT NULL REFERENCES store,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  address_id int NOT NULL REFERENCES address,
  activebool boolean NOT NULL DEFAULT true,
  create_date date NOT NULL DEFAULT CURRENT_DATE,
  active int
);
CREATE TABLE inventory (inventory_id int PRIMARY KEY, film_id int NOT NULL REFERENCES film, store_id int NOT NULL REFERENCES store);
CREATE TABLE rental (
  rental_id int PRIMARY KEY,
  rental_date timestamptz NOT NULL,
  inventory_id int NOT NULL REFERENCES inventory,
  customer_id int NOT NULL REFERENCES customer,
  return_date timestamptz,
  staff_id int NOT NULL REFERENCES staff
);
CREATE TABLE payment (
  payment_id int PRIMARY KEY,
  customer_id int NOT NULL REFERENCES customer,
  staff_id int NOT NULL REFERENCES staff,
  rental_id int NOT NULL REFERENCES rental,
  amount numeric(5, 2) NOT NULL,
  payment_date timestamptz NOT NULL
);
`;

// Order matters: a table is loaded after every table it references.
const KEEP = {
  language: ['language_id', 'name'],
  category: ['category_id', 'name'],
  actor: ['actor_id', 'first_name', 'last_name'],
  film: ['film_id', 'title', 'description', 'release_year', 'language_id', 'original_language_id', 'rental_duration', 'rental_rate', 'length', 'replacement_cost', 'rating', 'special_features'],
  film_actor: ['actor_id', 'film_id'],
  film_category: ['film_id', 'category_id'],
  country: ['country_id', 'country'],
  city: ['city_id', 'city', 'country_id'],
  address: ['address_id', 'address', 'address2', 'district', 'city_id', 'postal_code', 'phone'],
  store: ['store_id', 'manager_staff_id', 'address_id'],
  staff: ['staff_id', 'first_name', 'last_name', 'address_id', 'email', 'store_id', 'active', 'username'],
  customer: ['customer_id', 'store_id', 'first_name', 'last_name', 'email', 'address_id', 'activebool', 'create_date', 'active'],
  inventory: ['inventory_id', 'film_id', 'store_id'],
  rental: ['rental_id', 'rental_date', 'inventory_id', 'customer_id', 'return_date', 'staff_id'],
  payment: ['payment_id', 'customer_id', 'staff_id', 'rental_id', 'amount', 'payment_date'],
};
const KEEP_ROW = {
  rental: (r) => Number(r.rental_id) <= MAX_RENTAL,
  payment: (r) => Number(r.rental_id) <= MAX_RENTAL,
};

const parts = [SCHEMA];
const counts = {};
for (const [table, cols] of Object.entries(KEEP)) {
  const src = copy[table];
  if (!src) throw new Error(`pagila-data.sql has no COPY for ${table}`);
  const idx = cols.map((c) => src.cols.indexOf(c));
  if (idx.includes(-1)) throw new Error(`${table}: missing one of ${cols}`);
  const rows = src.rows
    .filter((r) => (KEEP_ROW[table] ? KEEP_ROW[table](Object.fromEntries(src.cols.map((c, i) => [c, r[i]]))) : true))
    .map((r) => `(${idx.map((i) => lit(r[i])).join(', ')})`);
  counts[table] = rows.length;
  for (let i = 0; i < rows.length; i += 500)
    parts.push(`INSERT INTO ${table} (${cols.join(', ')}) VALUES\n${rows.slice(i, i + 500).join(',\n')};`);
}
// store and staff reference each other, so this key is added once both are loaded.
parts.push('ALTER TABLE store ADD FOREIGN KEY (manager_staff_id) REFERENCES staff;');

writeFileSync(
  new URL('pagila.sql', out),
  `-- Pagila, Copyright (c) 2015-2026 Devrim Gündüz, PostgreSQL License. https://github.com/devrimgunduz/pagila
-- Cut down by scripts/build-datasets.mjs: first ${MAX_RENTAL} rentals, no embeddings, full-text, UUIDs or pictures.
${parts.join('\n\n')}
`,
);
console.log('pagila rows', counts);
