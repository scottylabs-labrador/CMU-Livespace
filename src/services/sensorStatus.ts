import type { Sensor } from '../types/location';

export function sensorStatus(sensor: Sensor, now: number) {
  if (!sensor.enabled) return 'Disabled';
  if (!sensor.lastSeenAt || !sensor.latest) return 'Awaiting first reading';
  if (now - Date.parse(sensor.lastSeenAt) >= sensor.staleAfterSeconds * 1000) return 'Offline';
  return 'Online';
}
