import { initialLocations } from '../data/locations';
import { soundLabel } from './recommendations';
import type { SpaceLocation } from '../types/location';
export interface LocationService { getLocations: () => Promise<SpaceLocation[]>; subscribe: (onUpdate: (locations: SpaceLocation[]) => void, onError: (error: Error) => void) => () => void }
let locations = structuredClone(initialLocations);
export const locationService: LocationService = {
 async getLocations() { await new Promise(resolve=>setTimeout(resolve,500)); return structuredClone(locations); },
 subscribe(onUpdate,onError) { const timer = window.setInterval(()=>{ try { const now=new Date().toISOString(); locations=locations.map(s=>{const soundDb=Math.round(Math.max(28,Math.min(85,s.soundDb+(Math.random()-.5)*3))*10)/10; const radar=s.radar && Object.fromEntries(Object.entries(s.radar).map(([key,value])=>[key,Math.round(Math.max(0,Math.min(100,value+(Math.random()-.5)*10)))])) as SpaceLocation['radar']; const energy=radar ? (radar.near+radar.mid+radar.far)/3 : s.history.at(-1)!.activity; return {...s,soundDb,soundStatus:soundLabel(soundDb),radar,crowd:energy<28?'Low':energy<48?'Moderate':energy<70?'Busy':'Very Busy',updatedAt:now,history:[...s.history.slice(-19),{time:now,sound:soundDb,activity:energy}]}; }); onUpdate(structuredClone(locations)); } catch(error) {onError(error instanceof Error ? error : new Error('Live updates interrupted'));} },5000); return ()=>window.clearInterval(timer); }
};
