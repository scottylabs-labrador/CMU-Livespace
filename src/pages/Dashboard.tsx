import { useEffect, useState } from 'react';
import { Activity, Coffee, ShieldCheck } from 'lucide-react';
import { useLocations } from '../hooks/useLocations';
import { CurrentConditions } from '../components/CurrentConditions';

export function Dashboard() {
  const { locations, loading, error, retry } = useLocations();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const space = locations[0];
  const age = space ? Math.max(0, Math.floor((now - Date.parse(space.updatedAt)) / 1000)) : 0;

  return (
    <>
      <header className="header">
        <a className="brand" href="./" aria-label="CMU Livespace home"><span className="brand-icon"><Activity size={25} /></span>CMU Livespace<span className="brand-dot">.</span></a>
        <span className="campus">Carnegie Mellon</span>
      </header>
      <main>
        <div className="location-heading">
          <span className="cafe-icon"><Coffee size={28} strokeWidth={1.6} aria-hidden="true" /></span>
          <h1>{space?.name ?? 'CMU Space'}</h1>
          <p>A feel for the space, before you go.</p>
        </div>
        {error && <div className="error" role="alert"><span>{error}</span><button onClick={retry}>Try again</button></div>}
        {loading ? <div className="skeleton" role="status"><span>Checking the space…</span></div> : space ? <>
          {space.awaitingData
            ? <div className="error" role="status">Sensor connected — awaiting first reading.</div>
            : <CurrentConditions space={space} />}
          <p className="freshness">
            <span className="live-dot" />
            {space.awaitingData ? 'No data yet' : 'Live data'}
            <span className="separator">·</span>
            {space.awaitingData ? 'Sensor not yet reporting' : age === 0 ? 'Updated just now' : `Updated ${age}s ago`}
          </p>
        </> : !error && <div className="error" role="status">Readings are unavailable.<button onClick={retry}>Try again</button></div>}
        <footer><ShieldCheck size={18} aria-hidden="true" /><p>CMU Livespace estimates environmental sound and activity without cameras, identity tracking, or storing conversations.</p></footer>
      </main>
    </>
  );
}
