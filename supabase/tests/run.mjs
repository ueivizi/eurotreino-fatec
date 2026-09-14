// Testes do banco de dados.
//
//   npm run test:db          aplica as migrações num Postgres em memória (PGlite) e roda os testes
//   npm run test:db:linked   roda os mesmos arquivos de teste no projeto ligado (eurotreino-dev)
//
// Nenhum dos modos precisa de Docker ou de senha. O modo local roda dentro do Node; o modo ligado
// usa o login da CLI do Supabase e executa cada arquivo numa transação desfeita no fim (rollback).
//
// Cada arquivo em supabase/tests/database é SQL puro: o trecho antes do primeiro "-- caso:" é o
// preparo, e cada "-- caso: descrição" abre um caso. No modo local cada caso roda num savepoint,
// então uma falha é relatada e os casos seguintes continuam.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
const migrationsDir = join(root, 'supabase', 'migrations');
const testsDir = join(here, 'database');
const helpersSql = readFileSync(join(here, 'support', 'helpers.sql'), 'utf8');

const CASE_MARKER = /^-- caso: (.+)$/gm;

let passed = 0;
let failed = 0;

function pass(name) {
  passed += 1;
  console.log(`    ✓ ${name}`);
}

function fail(name, message) {
  failed += 1;
  console.log(`    ✗ ${name}\n      ${message.split('\n').join('\n      ')}`);
}

function sqlFiles(dir, suffix) {
  return readdirSync(dir)
    .filter((name) => name.endsWith(suffix))
    .sort();
}

function splitCases(sql) {
  const markers = [...sql.matchAll(CASE_MARKER)];
  const setupEnd = markers.length > 0 ? markers[0].index : sql.length;
  return {
    setup: sql.slice(0, setupEnd),
    cases: markers.map((marker, i) => ({
      name: marker[1].trim(),
      sql: sql.slice(marker.index, i + 1 < markers.length ? markers[i + 1].index : sql.length),
    })),
  };
}

async function importApp(relativePath) {
  return import(pathToFileURL(join(root, relativePath)).href);
}

// As regras que o app espelha precisam ser idênticas às do banco.
async function checkSyncWithApp(db) {
  console.log('  sincronia com o app');
  const { TIERS } = await importApp('src/features/ranks/tiers.ts');
  const { WORKOUT_TYPES, INTENSITIES, DURATION } = await importApp('src/features/workouts/workout-types.ts');
  const { EMBLEMS } = await importApp('src/features/profile/emblems.ts');

  const check = (name, actual, expected) => {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a === e) pass(name);
    else fail(name, `banco: ${a}\n app:   ${e}`);
  };

  const tiers = await db.query('select id, tier, tier_name, division, min_glory from public.rank_tiers order by id');
  const expectedTiers = TIERS.flatMap((tier) =>
    tier.thresholds.map((min, index) => ({
      tier: tier.id,
      tier_name: tier.name,
      division: tier.thresholds.length > 1 ? 3 - index : null,
      min_glory: min,
    })),
  ).map((row, index) => ({ id: index + 1, ...row }));
  check('rank_tiers igual a src/features/ranks/tiers.ts', tiers.rows, expectedTiers);

  const types = await db.query('select id, label from public.workout_types where is_active order by sort_order');
  check(
    'workout_types igual a src/features/workouts/workout-types.ts',
    types.rows,
    WORKOUT_TYPES.map(({ id, label }) => ({ id, label })),
  );

  const intensities = await db.query(
    'select array_agg(i order by i) as accepted from unnest($1::text[]) as i where (select wp.intensity from private.workout_points_v1(10, i) as wp) is not null',
    [INTENSITIES.map(({ id }) => id)],
  );
  check('intensidades do app aceitas pelo banco', intensities.rows[0].accepted, INTENSITIES.map(({ id }) => id).sort());

  const emblems = await db.query(
    "select array_agg(e order by e) filter (where private.is_valid_emblem(e)) as accepted, private.is_valid_emblem('fenix') as accepts_unknown from unnest($1::text[]) as e",
    [EMBLEMS],
  );
  check(
    'emblemas do app aceitos pelo banco (e só eles)',
    emblems.rows[0],
    { accepted: [...EMBLEMS].sort(), accepts_unknown: false },
  );

  const duration = await db.query(
    "select pg_get_constraintdef(oid) as definition from pg_constraint where conname = 'workouts_duration_range'",
  );
  check(
    'limites de duração iguais a DURATION',
    duration.rows[0]?.definition,
    `CHECK (((duration_min >= ${DURATION.min}) AND (duration_min <= ${DURATION.max})))`,
  );
}

async function runLocal() {
  const { PGlite } = await import('@electric-sql/pglite');
  const { pgcrypto } = await import('@electric-sql/pglite/contrib/pgcrypto');
  // `db.exec` executa SQL no Postgres em memória (protocolo simples); não é um shell.
  const db = await PGlite.create({ extensions: { pgcrypto } });

  try {
    const version = await db.query('show server_version');
    console.log(`Banco de dados · PGlite (PostgreSQL ${version.rows[0].server_version})`);

    await db.exec(readFileSync(join(here, 'support', 'supabase-shim.sql'), 'utf8'));

    const migrations = sqlFiles(migrationsDir, '.sql');
    for (const file of migrations) {
      try {
        await db.exec(`begin;\n${readFileSync(join(migrationsDir, file), 'utf8')}\ncommit;`);
      } catch (error) {
        console.log(`  ✗ migração ${file}\n    ${error.message}`);
        process.exitCode = 1;
        return;
      }
    }
    console.log(`  ${migrations.length} migrações aplicadas`);

    await checkSyncWithApp(db);

    for (const file of sqlFiles(testsDir, '.test.sql')) {
      console.log(`  ${file}`);
      const { setup, cases } = splitCases(readFileSync(join(testsDir, file), 'utf8'));

      await db.exec('begin');
      try {
        await db.exec(helpersSql);
        await db.exec(setup);
      } catch (error) {
        fail('preparo', error.message);
        await db.exec('rollback');
        continue;
      }

      for (const testCase of cases) {
        await db.exec('savepoint test_case');
        try {
          await db.exec(testCase.sql);
          await db.exec('release savepoint test_case');
          pass(testCase.name);
        } catch (error) {
          await db.exec('rollback to savepoint test_case');
          fail(testCase.name, error.message);
        }
      }

      await db.exec('rollback');
    }
  } finally {
    await db.close();
  }
}

function runLinked() {
  const cli = join(root, 'node_modules', 'supabase', 'dist', 'supabase.js');
  const tempDir = mkdtempSync(join(tmpdir(), 'eurotreino-db-tests-'));
  console.log('Banco de dados · projeto Supabase ligado (cada arquivo é desfeito no fim)');

  try {
    for (const file of sqlFiles(testsDir, '.test.sql')) {
      const script = join(tempDir, file);
      const sql = readFileSync(join(testsDir, file), 'utf8');
      writeFileSync(script, `begin;\n${helpersSql}\n${sql}\nrollback;\n`);

      try {
        execFileSync(process.execPath, [cli, 'db', 'query', '--linked', '-f', script], {
          cwd: root,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        pass(`${file} (${splitCases(sql).cases.length} casos)`);
      } catch (error) {
        const output = `${error.stderr ?? ''}${error.stdout ?? ''}`.trim();
        fail(file, output || error.message);
      }
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

if (process.argv.includes('--linked')) {
  runLinked();
} else {
  await runLocal();
}

console.log(`\n${passed} ok, ${failed} com falha`);
if (failed > 0) process.exitCode = 1;
