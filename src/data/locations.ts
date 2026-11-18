import type { SpaceLocation } from '../types/location';

const now = Date.now();
export const initialLocations: SpaceLocation[] = [{
  id: 'skibo-cafe',
  name: 'Skibo Cafe',
  subtitle: 'Carnegie Mellon University',
  kind: 'coffee',
  walkMinutes: 0,
  soundDb: 62.1,
  soundStatus: 'Lively',
  crowd: 'Busy',
  radar: { near: 48, mid: 65, far: 43 },
  updatedAt: new Date(now).toISOString(),
  history: Array.from({ length: 20 }, (_, index) => ({
    time: new Date(now - (19 - index) * 60000).toISOString(),
    sound: 62.1 + Math.sin(index * 1.3) * 4,
    activity: 52 + Math.sin(index) * 8,
  })),
}];
