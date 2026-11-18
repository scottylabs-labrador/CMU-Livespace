import { createClient } from '@supabase/supabase-js';
import type { HistoryPoint, SpaceLocation } from '../types/location';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const client = url && key ? createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
}) : undefined;

export const locationSlug = 'skibo-cafe';

export const historyRanges = {
  hour: { label: 'Past hour', hours: 1 },
  day: { label: 'Past 24 hours', hours: 24, bucket: 'hour' },
  week: { label: 'Past 7 days', hours: 168, bucket: 'day' },
} as const;
export type HistoryRange = keyof typeof historyRanges;

export async function getLocation(signal: AbortSignal, range: HistoryRange): Promise<SpaceLocation> {
  if (!client) throw new Error('Sensor data connection is not configured.');
  const window = historyRanges[range];
  const end = Date.now();
  const interval = {
    p_slug: locationSlug,
    p_from: new Date(end - window.hours * 3600000).toISOString(),
    p_to: new Date(end).toISOString(),
  };
  const historyQuery = 'bucket' in window
    ? client.rpc('noise_summary', { ...interval, p_bucket: window.bucket })
    : client.rpc('noise_history', { ...interval, p_limit: 500 });
  const [snapshot, history] = await Promise.all([
    client.rpc('location_snapshot', { p_slug: locationSlug }).abortSignal(signal),
    historyQuery.abortSignal(signal),
  ]);
  if (snapshot.error || history.error || !snapshot.data) throw new Error('Can’t reach the sensor data service.');
  const points: HistoryPoint[] = 'bucket' in window
    ? (history.data as { device_id: string; bucket: string; equivalent_dbfs: number }[]).map(row => ({
        id: row.device_id + row.bucket,
        device_id: row.device_id,
        timestamp: row.bucket,
        noise_dbfs: row.equivalent_dbfs,
      }))
    : (history.data as HistoryPoint[]).reverse();
  return { ...snapshot.data, history: points };
}

export function subscribeToLocation(refresh: () => void) {
  if (!client) return;
  const channel = client.channel('skibo-cafe-readings')
    .on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'locations', filter: `slug=eq.${locationSlug}`,
    }, refresh)
    .subscribe(status => { if (status === 'SUBSCRIBED') refresh(); });
  return () => { void client.removeChannel(channel); };
}
