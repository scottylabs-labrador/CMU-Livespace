export type Crowd = 'Low' | 'Moderate' | 'Busy' | 'Very Busy';
export type SoundStatus = 'Quiet' | 'Moderate' | 'Lively' | 'Loud';
export type Purpose = 'all' | 'studying' | 'conversation' | 'group';
export interface HistoryPoint { time: string; sound: number; activity: number }
export interface SpaceLocation { id: string; name: string; subtitle: string; kind: 'coffee' | 'book' | 'sofa' | 'building' | 'music' | 'tree'; walkMinutes: number; soundDb: number; soundStatus: SoundStatus; crowd: Crowd; radar?: { near: number; mid: number; far: number }; updatedAt: string; history: HistoryPoint[] }
