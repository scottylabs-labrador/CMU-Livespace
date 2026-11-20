import { supabase } from '../lib/supabase';
import { initialLocations } from '../data/locations';
import { soundLabel } from './recommendations';
import type { Crowd, SpaceLocation } from '../types/location';

export interface LocationService {
  getLocations: () => Promise<SpaceLocation[]>;
  subscribe: (onUpdate: (locations: SpaceLocation[]) => void, onError: (error: Error) => void) => () => void;
}

// Schema:
//   locations      — id (uuid), name, description
//   devices        — id, location_id, active, last_seen_at
//   measurements   — id, device_id, location_id, noise_db, measured_at
//   latest_by_location (view) — location_id, device_id, noise_db, measured_at

function dbToCrowd(db: number): Crowd {
  if (db < 45) return 'Low';
  if (db < 58) return 'Moderate';
  if (db < 70) return 'Busy';
  return 'Very Busy';
}

async function fetchFromSupabase(): Promise<SpaceLocation[]> {
  if (!supabase) throw new Error('Supabase not configured');

  const [{ data: locs, error: locErr }, { data: latest, error: latestErr }, { data: history, error: histErr }] =
    await Promise.all([
      supabase.from('locations').select('id, name, description'),
      supabase.from('latest_by_location').select('location_id, noise_db, measured_at'),
      supabase.from('measurements').select('location_id, noise_db, measured_at').order('measured_at', { ascending: false }).limit(200),
    ]);

  if (locErr) throw new Error(locErr.message);
  if (latestErr) throw new Error(latestErr.message);
  if (histErr) throw new Error(histErr.message);
  if (!locs || locs.length === 0) return [];

  return locs.map(loc => {
    const reading = latest?.find(r => r.location_id === loc.id);
    const locHistory = (history ?? [])
      .filter(h => h.location_id === loc.id)
      .slice(0, 20)
      .reverse()
      .map(h => ({ time: h.measured_at as string, sound: Number(h.noise_db), activity: Number(h.noise_db) }));

    if (!reading) {
      return {
        id: loc.id as string,
        name: loc.name as string,
        subtitle: (loc.description as string) || 'Carnegie Mellon University',
        kind: 'book' as const,
        walkMinutes: 0,
        soundDb: 0,
        soundStatus: 'Quiet' as const,
        crowd: 'Low' as const,
        updatedAt: new Date().toISOString(),
        history: [],
        awaitingData: true,
      };
    }

    const soundDb = Number(reading.noise_db);
    return {
      id: loc.id as string,
      name: loc.name as string,
      subtitle: (loc.description as string) || 'Carnegie Mellon University',
      kind: 'book' as const,
      walkMinutes: 0,
      soundDb,
      soundStatus: soundLabel(soundDb),
      crowd: dbToCrowd(soundDb),
      updatedAt: reading.measured_at as string,
      history: locHistory,
      awaitingData: false,
    };
  }).sort((a, b) => Number(a.awaitingData) - Number(b.awaitingData));
}

const supabaseService: LocationService = {
  async getLocations() {
    return fetchFromSupabase();
  },
  subscribe(onUpdate, onError) {
    const poll = async () => {
      try { onUpdate(await fetchFromSupabase()); }
      catch (err) { onError(err instanceof Error ? err : new Error('Live updates interrupted')); }
    };
    const timer = window.setInterval(poll, 15_000);
    return () => window.clearInterval(timer);
  },
};

// ── Mock fallback (used when Supabase is not configured) ──────────────────────

let mockLocations = structuredClone(initialLocations);

const mockService: LocationService = {
  async getLocations() {
    await new Promise(resolve => setTimeout(resolve, 500));
    return structuredClone(mockLocations);
  },
  subscribe(onUpdate, onError) {
    const timer = window.setInterval(() => {
      try {
        const now = new Date().toISOString();
        mockLocations = mockLocations.map(s => {
          const soundDb = Math.round(Math.max(28, Math.min(85, s.soundDb + (Math.random() - 0.5) * 3)) * 10) / 10;
          const radar = s.radar && Object.fromEntries(
            Object.entries(s.radar).map(([k, v]) => [k, Math.round(Math.max(0, Math.min(100, v + (Math.random() - 0.5) * 10)))])
          ) as SpaceLocation['radar'];
          const energy = radar ? (radar.near + radar.mid + radar.far) / 3 : s.history.at(-1)!.activity;
          return {
            ...s, soundDb, soundStatus: soundLabel(soundDb), radar,
            crowd: energy < 28 ? 'Low' : energy < 48 ? 'Moderate' : energy < 70 ? 'Busy' : 'Very Busy',
            updatedAt: now,
            history: [...s.history.slice(-19), { time: now, sound: soundDb, activity: energy }],
          };
        });
        onUpdate(structuredClone(mockLocations));
      } catch (err) {
        onError(err instanceof Error ? err : new Error('Live updates interrupted'));
      }
    }, 5_000);
    return () => window.clearInterval(timer);
  },
};

export const locationService: LocationService = supabase ? supabaseService : mockService;
