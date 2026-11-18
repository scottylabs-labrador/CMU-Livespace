import { createHandler } from './handler.ts';

Deno.serve(createHandler(async (device, hash, measurement, noise, duration) => {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Missing server configuration');
  const response = await fetch(`${url}/rest/v1/rpc/ingest_noise`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_device: device, p_hash: hash, p_measurement: measurement, p_noise: noise, p_duration: duration }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error('Database request failed');
  return response.json();
}));
