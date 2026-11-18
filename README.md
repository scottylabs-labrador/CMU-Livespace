# CMU Livespace

A React + TypeScript + Vite frontend. A minimal, single-location dashboard for Skibo Cafe at Carnegie Mellon. Large sound and crowd readings plus a simple recommendation help visitors decide whether to go. Readings are mock data, updated every five seconds. No camera, identity, or conversation data is collected.

## Run

```sh
npm install
npm run dev
```

`npm run build` type-checks and builds the production bundle. `npm run preview` serves that bundle.

## Structure

- `src/pages/Dashboard.tsx`: single-location page, loading/error states, retry, and freshness timestamp.
- `src/components/CurrentConditions.tsx`: large sound/crowd indicators and recommendation.
- `src/data/locations.ts`: Skibo Cafe mock readings.
- `src/services/locations.ts`: initial fetch and five-second subscriptions.
- `src/services/recommendations.ts`: sound labels and recommendation rules.
- `src/types/location.ts`: typed sensor data.
- `src/hooks/useLocations.ts`: loading, errors, and subscription cleanup.
- `src/styles.css`: responsive layout, focus indicators, and reduced-motion support.

The existing `LocationService` contract supports replacing the mock fetch with REST and the subscription with WebSocket or SSE. Return a cleanup function that closes the connection. Components do not need backend-specific logic. Radar values are relative energy indicators, never people counts.

Sound labels: Quiet <45 dB, Moderate 45–57.9, Lively 58–69.9, Loud ≥70. Study recommendations require <50 dB and Low/Moderate crowd; conversation requires 45–59.9 dB and Moderate crowd; group work requires 45–69.9 dB and Moderate/Busy crowd. Crowd is simulated from radar energy thresholds.
