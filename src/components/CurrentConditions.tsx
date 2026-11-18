import { Radio, Volume2 } from 'lucide-react';
import { sensorStatus } from '../services/sensorStatus';
import type { SpaceLocation } from '../types/location';

export function CurrentConditions({ space, now, error }: { space?: SpaceLocation; now: number; error: string }) {
  const devices = space?.devices ?? [];
  const online = devices.filter(sensor => sensorStatus(sensor, now) === 'Online');
  const latest = online.flatMap(sensor => sensor.latest ? [sensor.latest] : [])
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))[0];
  const lastSeen = devices.flatMap(sensor => sensor.lastSeenAt ? [sensor.lastSeenAt] : []).sort(
    (a, b) => Date.parse(b) - Date.parse(a),
  )[0];
  const status = error ? 'Connection error' : online.length ? 'Online'
    : devices.length && devices.every(sensor => !sensor.enabled) ? 'Disabled'
    : devices.some(sensor => sensorStatus(sensor, now) === 'Offline') ? 'Offline' : 'Awaiting sensor data';

  return (
    <section className="conditions" aria-label="Current conditions at Skibo Cafe">
      <div className="readings">
        <div className="reading">
          <h2><Volume2 size={22} aria-hidden="true" /> Sound level</h2>
          <div className="sound-value">{latest && !error ? latest.noise_dbfs.toFixed(1) : '—'}<span>dBFS</span></div>
        </div>
        <div className="reading">
          <h2><Radio size={22} aria-hidden="true" /> Sensor status</h2>
          <div className="sensor-value">{status}</div>
          {devices.length > 1 && <ul className="sensor-list">{devices.map((sensor, i) =>
            <li key={sensor.id}>{sensor.name || `Sensor ${i + 1}`} · {sensorStatus(sensor, now)}</li>,
          )}</ul>}
        </div>
      </div>
      <div className="recommendation">{lastSeen ? `Last reading: ${new Date(lastSeen).toLocaleString()}`
        : error ? 'Waiting to reconnect' : 'Waiting for the first measurement'}</div>
    </section>
  );
}
