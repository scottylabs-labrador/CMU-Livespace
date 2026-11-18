# CMU Livespace

The existing React + TypeScript + Vite dashboard shows ambient sound readings for Skibo Cafe. ESP32 devices send aggregate dBFS measurements to Supabase. Supabase stores the readings and serves public read APIs. Vercel serves the frontend.

## Develop

Use Node 22 or later. Run `npm ci`, copy `.env.example` to `.env.local`, and supply the URL and publishable key of a **test** Supabase project to use the real API locally. Run `npm run dev`. An unconfigured or unreachable backend displays a connection error. A reachable database with no readings displays **Awaiting sensor data** and an empty chart.

Run `npm test` and `npm run build`. Tests execute the migration and ingestion transaction in disposable PostgreSQL (PGlite) and render the frontend states. They do not contact production, invoke the Supabase gateway, or exercise hosted Realtime delivery.

- `src/pages` and `src/components` render the existing dashboard and the sound history.
- `src/services` reads Supabase and subscribes to location updates. `src/hooks` manages requests, timeouts, reconnects, and 30-second polling.
- `supabase/migrations` defines the database, access policies, and API functions.
- `supabase/functions/ingest-noise` authenticates and validates device uploads.
- `vercel.json` configures the frontend build. GitHub Actions builds and tests PRs.

## Public read API

Use POST on `https://PROJECT_REF.supabase.co/rest/v1/rpc/FUNCTION_NAME` with `apikey: PUBLISHABLE_KEY` and JSON. Use the location slug `skibo-cafe`. The public tables and RPCs expose only location metadata, opaque sensor IDs, optional public sensor labels, sensor state inputs, and numeric readings.

| Function | Input and result |
| --- | --- |
| `location_snapshot` | `p_slug`. Returns sensor metadata and the latest reading per enabled device. The latest current location value is the newest non-stale device reading. |
| `noise_history` | `p_slug`, `p_from`, `p_to`, optional `p_limit` (max 1000). Returns newest first. Pass the previous page's final timestamp and ID as `p_before_time` and `p_before_id`. Reverse each complete result for chronological charts. |
| `noise_summary` | `p_slug`, `p_from`, `p_to`, and `p_bucket` (`hour` or `day`). Returns UTC buckets per sensor. |

Intervals are half-open and limited to 31 days per call. History remains available for disabled and offline devices. Sensor staleness defaults to 120 seconds and is configured per device. Realtime listens for updates to the location row, which carries no credentials. Polling covers missed events and device registry changes.

The summary assumes each device reports interval RMS dBFS with a consistent reference and non-overlapping measurement windows. It takes the duration-weighted mean of `10^(dBFS / 10)`, then converts back with `10 log10`. The summary buckets by receipt time and includes each interval in full. It describes the included digital energy for one device. Cross-device acoustic comparisons need calibration. Future calibrated SPL and mmWave readings can use separate tables and APIs.

See [deployment instructions](DEPLOYMENT.md) and [ESP32 integration](ESP32_INTEGRATION.md).
