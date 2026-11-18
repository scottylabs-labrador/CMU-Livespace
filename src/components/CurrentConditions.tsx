import { Users, Volume2 } from 'lucide-react';
import type { SpaceLocation } from '../types/location';
import { crowdRank, recommendation } from '../services/recommendations';

export function CurrentConditions({ space }: { space: SpaceLocation }) {
  const rank = crowdRank(space.crowd);
  return (
    <section className="conditions" aria-label="Current conditions at Skibo Cafe">
      <div className="readings">
        <div className="reading sound-reading">
          <h2><Volume2 size={22} aria-hidden="true" /> Sound level</h2>
          <div className="sound-value">{space.soundDb.toFixed(0)}<span>dB</span></div>
          <span className={`status ${space.soundStatus.toLowerCase()}`}><i />{space.soundStatus}</span>
        </div>
        <div className="reading crowd-reading">
          <h2><Users size={22} aria-hidden="true" /> Crowd activity</h2>
          <div className="crowd-value">{space.crowd}</div>
          <div className={`activity-meter level-${rank}`} aria-hidden="true">
            {[0, 1, 2, 3].map(index => <i key={index} className={index <= rank ? 'active' : ''} />)}
          </div>
        </div>
      </div>
      <div className="recommendation"><span className="recommendation-dot" />{recommendation(space)}</div>
    </section>
  );
}
