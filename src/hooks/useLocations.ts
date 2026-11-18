import { useEffect, useState } from 'react';
import { getLocation, subscribeToLocation, type HistoryRange } from '../services/locations';
import type { SpaceLocation } from '../types/location';

export function useLocations(range: HistoryRange) {
  const [space, setSpace] = useState<SpaceLocation>();
  const [loadedRange, setLoadedRange] = useState<HistoryRange>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const lifetime = new AbortController();
    let pending = false;
    let queued = false;
    async function refresh() {
      if (lifetime.signal.aborted) return;
      if (pending) { queued = true; return; }
      pending = true;
      try {
        const signal = AbortSignal.any([lifetime.signal, AbortSignal.timeout(10000)]);
        const result = await getLocation(signal, range);
        if (!lifetime.signal.aborted) { setSpace(result); setLoadedRange(range); setError(''); }
      } catch (failure) {
        if (!lifetime.signal.aborted) setError(failure instanceof Error ? failure.message : 'Sensor data is unavailable.');
      } finally {
        pending = false;
        if (!lifetime.signal.aborted) {
          setLoading(false);
          if (queued) { queued = false; void refresh(); }
        }
      }
    }
    void refresh();
    const unsubscribe = subscribeToLocation(refresh);
    const timer = window.setInterval(refresh, 30000);
    return () => {
      lifetime.abort();
      unsubscribe?.();
      window.clearInterval(timer);
    };
  }, [attempt, range]);

  return { space, history: loadedRange === range ? space?.history : undefined, loading, error, retry: () => setAttempt(value => value + 1) };
}
