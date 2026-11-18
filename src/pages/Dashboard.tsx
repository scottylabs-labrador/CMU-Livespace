import { useEffect, useState } from 'react';
import { Activity, Coffee, ShieldCheck } from 'lucide-react';
import { historyRanges, type HistoryRange } from '../services/locations';
import { useLocations } from '../hooks/useLocations';
import { SoundHistory } from '../components/SoundHistory';
import { CurrentConditions } from '../components/CurrentConditions';

export function Dashboard() {
  const [range, setRange] = useState<HistoryRange>('hour');
  const { space, history, loading, error, retry } = useLocations(range);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <>
      <header className="header">
        <a className="brand" href="./" aria-label="CMU Livespace home"><span className="brand-icon"><Activity size={25} /></span>CMU Livespace<span className="brand-dot">.</span></a>
        <span className="campus">Carnegie Mellon</span>
      </header>
      <main>
        <div className="location-heading">
          <span className="cafe-icon"><Coffee size={28} strokeWidth={1.6} aria-hidden="true" /></span>
          <h1>Skibo Cafe</h1>
          <p>A feel for the space, before you go.</p>
        </div>
        {error && <div className="error" role="alert"><span>{error}</span><button onClick={retry}>Try again</button></div>}
        {loading ? <div className="skeleton" role="status">Checking the cafe…</div> :
          <CurrentConditions space={space} now={now} error={error} />}
        {!loading && <SoundHistory history={history ?? []} error={error} pending={!history && !error}
          rangeLabel={range === 'hour' ? 'dBFS' : 'Equivalent dBFS'}
          controls={<select aria-label="History range" value={range} onChange={event => setRange(event.target.value as HistoryRange)}>
            {Object.entries(historyRanges).map(([value, option]) =>
              <option key={value} value={value}>{option.label}</option>,
            )}
          </select>} />}
        <footer><ShieldCheck size={18} aria-hidden="true" /><p>CMU Livespace estimates environmental sound and activity without cameras, identity tracking, or storing conversations.</p></footer>
      </main>
    </>
  );
}
