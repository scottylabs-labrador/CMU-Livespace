type Result = { status: 'unauthorized' | 'conflict' | 'rate_limited' | 'duplicate' | 'stored'; timestamp?: string };
export type Persist = (device: string, hash: string, measurement: string, noise: number, duration: number) => Promise<Result>;

const maxBytes = 1024;
export function createHandler(persist: Persist) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return Response.json({ error: 'method_not_allowed' }, { status: 405, headers: { Allow: 'POST' } });
    const credential = /^Bearer ([a-f0-9]{64})$/i.exec(request.headers.get('authorization') ?? '')?.[1];
    if (!credential) return Response.json({ error: 'unauthorized' }, { status: 401 });
    if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
      return Response.json({ error: 'expected_json' }, { status: 415 });
    }
    let payload;
    try {
      const reader = request.body?.getReader();
      const bytes = new Uint8Array(maxBytes);
      let length = 0;
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (length + value.length > maxBytes) {
            void reader.cancel().catch(() => {});
            return Response.json({ error: 'payload_too_large' }, { status: 413 });
          }
          bytes.set(value, length);
          length += value.length;
        }
      }
      payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, length)));
    } catch {
      return Response.json({ error: 'invalid_json' }, { status: 400 });
    }
    const { device_id, measurement_id, noise_dbfs, measurement_duration_ms } = payload ?? {};
    if (!payload || typeof payload !== 'object' || Object.keys(payload).length !== 4 ||
        typeof device_id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(device_id) ||
        typeof measurement_id !== 'string' || !/^[A-Za-z0-9_-]{1,96}$/.test(measurement_id) ||
        typeof noise_dbfs !== 'number' || !Number.isFinite(noise_dbfs) || noise_dbfs < -160 || noise_dbfs > 0 ||
        !Number.isInteger(measurement_duration_ms) || measurement_duration_ms < 1000 || measurement_duration_ms > 120000) {
      return Response.json({ error: 'invalid_measurement' }, { status: 400 });
    }
    try {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(credential));
      const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
      const result = await persist(device_id, hash, measurement_id, noise_dbfs, measurement_duration_ms);
      const status = { unauthorized: 401, conflict: 409, rate_limited: 429, duplicate: 200, stored: 201 }[result.status];
      return Response.json(result, { status, headers: status === 429 ? { 'Retry-After': '5' } : {} });
    } catch {
      return Response.json({ error: 'backend_unavailable' }, { status: 503 });
    }
  };
}
