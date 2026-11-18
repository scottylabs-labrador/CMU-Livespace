export interface Measurement {
  timestamp: string;
  noise_dbfs: number;
}

export interface Sensor {
  id: string;
  name: string | null;
  enabled: boolean;
  staleAfterSeconds: number;
  lastSeenAt: string | null;
  latest: Measurement | null;
}

export interface HistoryPoint extends Measurement {
  id: string;
  device_id: string;
}

export interface SpaceLocation {
  name: string;
  devices: Sensor[];
  history: HistoryPoint[];
}
