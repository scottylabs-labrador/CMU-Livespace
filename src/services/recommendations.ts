import type { Crowd, Purpose, SoundStatus, SpaceLocation } from '../types/location';
export const crowdRank = (crowd: Crowd) => ['Low','Moderate','Busy','Very Busy'].indexOf(crowd);
export const soundLabel = (db: number): SoundStatus => db < 45 ? 'Quiet' : db < 58 ? 'Moderate' : db < 70 ? 'Lively' : 'Loud';
export function matchesPurpose(s: SpaceLocation, purpose: Purpose) { const rank = crowdRank(s.crowd); return purpose === 'all' || (purpose === 'studying' && s.soundDb < 50 && rank <= 1) || (purpose === 'conversation' && s.soundDb >= 45 && s.soundDb < 60 && rank === 1) || (purpose === 'group' && s.soundDb >= 45 && s.soundDb < 70 && rank >= 1 && rank <= 2); }
export function recommendation(s: SpaceLocation) { return matchesPurpose(s,'studying') ? 'Great for focused work' : matchesPurpose(s,'conversation') ? 'Good for a conversation' : matchesPurpose(s,'group') ? 'Bring your study group' : 'A little lively right now'; }
