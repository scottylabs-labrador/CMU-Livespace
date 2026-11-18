import type { ReactNode } from 'react';
import type { HistoryPoint } from '../types/location';

export function SoundHistory({ history, error, pending = false, rangeLabel = 'dBFS', controls }: {
  history: HistoryPoint[]; error: string; pending?: boolean; rangeLabel?: string; controls?: ReactNode;
}) {
  const readings = new Map<string, HistoryPoint[]>();
  for (const point of history) {
    const series = readings.get(point.device_id);
    if (series) series.push(point);
    else readings.set(point.device_id, [point]);
  }
  const left = history.length ? Date.parse(history[0].timestamp) : 0;
  const right = history.length ? Date.parse(history[history.length - 1].timestamp) : 0;
  const min = Math.max(-160, Math.min(-10, Math.floor(Math.min(...history.map(point => point.noise_dbfs)) / 10) * 10 - 10));
  const max = Math.min(0, Math.ceil(Math.max(...history.map(point => point.noise_dbfs)) / 10) * 10 + 10);
  return (
    <section className="history">
      <div className="history-header"><h2>Sound history <span>{rangeLabel}</span></h2>{controls}</div>
      {!history.length ? <div className="history-empty">{error ? 'History unavailable' : pending ? 'Loading history…' : 'No readings yet'}</div> : <>
        <svg viewBox="0 0 560 128" role="img" aria-label={`Sound history, ${history.length} readings in dBFS`}>
          {[0, 1, 2].map(i => <g key={i}><text x={0} y={15 + i * 50}>{Math.round(max - (max - min) * i / 2)}</text>
            <path d={`M40 ${12 + i * 50}H550`} stroke="#e1e6da" /></g>)}
          {[...readings.values()].map((series, i) => {
            const color = ['#34654d', '#85642a', '#485798'][i % 3];
            const points = series.map(point => [
              left === right ? 295 : 44 + (Date.parse(point.timestamp) - left) / (right - left) * 500,
              12 + (max - point.noise_dbfs) / (max - min) * 100,
            ]);
            return <g key={series[0].device_id}><polyline points={points.map(point => point.join(',')).join(' ')} fill="none" stroke={color} strokeWidth="2" />
              {points.map(([cx, cy], j) => <circle key={series[j].id} cx={cx} cy={cy} r={points.length === 1 ? 4 : 1.5} fill={color} />)}</g>;
          })}
        </svg>
        <div className="history-times"><span>{new Date(left).toLocaleString()}</span><span>{new Date(right).toLocaleString()}</span></div>
      </>}
    </section>
  );
}
