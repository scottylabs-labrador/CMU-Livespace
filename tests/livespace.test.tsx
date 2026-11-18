import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { renderToStaticMarkup } from 'react-dom/server';
import { CurrentConditions } from '../src/components/CurrentConditions';
import { SoundHistory } from '../src/components/SoundHistory';
import type { Sensor } from '../src/types/location';
import { createHandler, type Persist } from '../supabase/functions/ingest-noise/handler';

test('isolated PostgreSQL: migrated database, ingestion, permissions and read APIs', async t => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec('create role anon; create role authenticated; create role service_role; create publication supabase_realtime;');
  await db.exec(await readFile(new URL('../supabase/migrations/20261118000100_livespace.sql', import.meta.url), 'utf8'));
  const scalar = async <T,>(sql: string, params: unknown[] = []) => (await db.query<{ value: T }>(sql, params)).rows[0].value;
  const snapshot = () => scalar<{ name: string; devices: Sensor[] }>("select public.location_snapshot('skibo-cafe') value");
  const count = () => scalar<number>('select count(*)::int value from public.noise_readings');
  assert.deepEqual(await snapshot(), { name: 'Skibo Cafe', devices: [] });
  assert.equal(await count(), 0);

  const credential = 'a'.repeat(64);
  const hash = createHash('sha256').update(credential).digest('hex');
  await db.query(`insert into public.devices (device_id, location_id, credential_hash)
    select 'livespace-01', id, $1 from public.locations where slug = 'skibo-cafe'`, [hash]);
  assert.equal((await snapshot()).devices[0].latest, null);
  await assert.rejects(db.query("insert into public.devices(device_id,location_id,credential_hash) values ('no-location',gen_random_uuid(),$1)", [hash]), /foreign key/);

  const handler = createHandler((...args) => scalar<Awaited<ReturnType<Persist>>>(
    'select public.ingest_noise($1,$2,$3,$4,$5) value', args,
  ));
  const payload = { device_id: 'livespace-01', measurement_id: 'm1', noise_dbfs: -42.6, measurement_duration_ms: 30000 };
  const post = (fields: unknown = payload, key = credential) => handler(new Request('https://example.invalid/ingest-noise', {
    method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify(fields),
  }));
  assert.equal((await post(payload, 'b'.repeat(64))).status, 401);
  assert.equal((await post({ ...payload, device_id: 'unregistered' })).status, 401);
  assert.equal((await post({ ...payload, noise_dbfs: 10 })).status, 400);
  assert.equal((await post({ ...payload, measurement_duration_ms: 0 })).status, 400);
  assert.equal((await post({ ...payload, timestamp: '2020-01-01' })).status, 400);
  assert.equal((await post('x'.repeat(2000))).status, 413);
  assert.equal(await count(), 0);
  const start = Date.now();
  const stored = await post();
  assert.equal(stored.status, 201);
  const result = await stored.json();
  assert.ok(Date.parse(result.timestamp) >= start && Date.parse(result.timestamp) <= Date.now());
  assert.equal((await post()).status, 200);
  assert.equal((await post({ ...payload, noise_dbfs: -40 })).status, 409);
  assert.equal((await post({ ...payload, measurement_id: 'm2' })).status, 429);
  assert.equal(await count(), 1);
  const device = (await snapshot()).devices[0];
  assert.equal(device.lastSeenAt, result.timestamp);
  assert.equal(device.latest?.noise_dbfs, -42.6);
  assert.equal(JSON.stringify(await snapshot()).includes(hash), false);

  await db.exec(`insert into public.locations (slug, name) values ('test-other','Test Other');
    insert into public.noise_readings (device_id, measurement_id, timestamp, noise_dbfs, measurement_duration_ms)
    select id, 'm2', clock_timestamp() - interval '10 seconds', -50, 1000 from public.devices`);
  await db.exec('set role anon');
  const range = "'skibo-cafe', now() - interval '1 hour', now() + interval '1 hour'";
  const history = await db.query<{ timestamp: string; id: string }>(`select * from public.noise_history(${range}, null, null, 1)`);
  assert.equal(history.rows.length, 1);
  assert.equal((await db.query(`select * from public.noise_history(${range}, $1, $2, 1)`, [history.rows[0].timestamp, history.rows[0].id])).rows.length, 1);
  assert.equal((await db.query(`select * from public.noise_history('test-other', now()-interval '1 hour', now()+interval '1 hour')`)).rows.length, 0);
  for (const bucket of ['hour', 'day']) {
    const summaries = await db.query<{ count: number; equivalent_dbfs: number }>(`select * from public.noise_summary(${range}, $1)`, [bucket]);
    assert.equal(summaries.rows.reduce((total, row) => total + Number(row.count), 0), 2);
    assert.ok(summaries.rows.every(row => row.equivalent_dbfs >= -50.001 && row.equivalent_dbfs <= -42.599));
  }
  await assert.rejects(db.query('select credential_hash from public.devices'), /permission denied/);
  await assert.rejects(db.query('select * from public.noise_readings'), /permission denied/);
  await assert.rejects(db.query("select public.ingest_noise('device','hash','m',-50,30000)"), /permission denied/);
  await db.exec('reset role; update public.devices set enabled = false;');
  assert.equal((await post()).status, 401);
});

test('dashboard renders empty, current, stale, disabled and connection error states', () => {
  const now = Date.now();
  const timestamp = new Date(now).toISOString();
  const sensor: Sensor = { id: 'one', name: null, enabled: true, staleAfterSeconds: 120, lastSeenAt: timestamp, latest: { timestamp, noise_dbfs: -42.6 } };
  const view = (devices: Sensor[], time = now, error = '') => renderToStaticMarkup(
    <CurrentConditions space={{ name: 'Skibo Cafe', history: [], devices }} now={time} error={error} />,
  );
  assert.match(view([]), /Awaiting sensor data/);
  assert.match(view([{ ...sensor, latest: null, lastSeenAt: null }]), /Awaiting sensor data/);
  assert.match(renderToStaticMarkup(<SoundHistory history={[]} error="" />), /No readings yet/);
  assert.match(view([sensor]), /-42.6/);
  assert.match(view([sensor]), /Online/);
  assert.match(view([sensor], now + 121000), /Offline/);
  assert.match(view([sensor], now + 121000), /Last reading/);
  assert.doesNotMatch(view([sensor], now + 121000), /-42.6/);
  assert.match(view([{ ...sensor, enabled: false }]), /Disabled/);
  assert.match(view([sensor], now, 'API unavailable'), /Connection error/);
  assert.doesNotMatch(view([sensor], now, 'API unavailable'), /-42.6/);
});
