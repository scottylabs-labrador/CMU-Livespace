# Cloud deployment

## Supabase

1. Use a Supabase organization you control and create a Free project. Select a region near Pittsburgh where available. Use a unique database password and store it in a password manager. Never put it in Vercel or GitHub source.
2. Install the official Supabase CLI and sign in with `supabase login`. Run `supabase projects list` to identify the correct ref.
3. In this checkout, run the following. Confirm the ref is the intended production project before applying the migration.

   ```sh
   supabase link --project-ref YOUR_PROJECT_REF
   supabase db push --remote --dry-run
   supabase db push --remote
   supabase functions deploy ingest-noise --use-api --no-verify-jwt
   ```

   The Edge Function uses Supabase's server-provided `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. The ingestion route authenticates individual device tokens. Gateway JWT verification is disabled for this function only.
4. Verify from the SQL editor using `select count(*) from public.noise_readings;`. Expect zero. The migration adds only Skibo Cafe metadata. It registers no devices and inserts no readings.
5. Over HTTPS, POST valid-shaped JSON with an unknown device and a disposable, syntactically valid token. Expect 401, then confirm the count is still zero. Use a separate staging project for authenticated write tests. Verify the anonymous `location_snapshot` returns Skibo Cafe and an empty device array.

## Vercel

Import `scottylabs-labrador/CMU-Livespace` from the Vercel dashboard. If the GitHub App is missing, have the GitHub organization authorize it for this repository. An organization member may need to do the import if Vercel identifies you as an outside collaborator. Use the eligible free scope or confirm an existing team scope before deploying.

Set the repository root as the app directory, Vite as the framework, and `main` as the production branch. The build uses `npm run build` and publishes `dist`. Set these variables under Production:

- `VITE_SUPABASE_URL` — the HTTPS project URL from the Supabase dashboard.
- `VITE_SUPABASE_PUBLISHABLE_KEY` — the publishable key. Vite embeds this value in the browser bundle.

For pull request previews, configure the same variable names under Preview using a **separate** Supabase project. Vercel's Git integration automatically builds eligible branches and redeploys production on updates to `main`. Scope and commit-author restrictions vary by plan. The app has one route, `/`. Verify that it loads without an account over HTTPS and renders **Awaiting sensor data** and an empty chart without a connection error. Record the actual URLs only after verification.

- [Supabase CLI](https://supabase.com/docs/reference/cli/introduction)
- [Supabase Edge Function deployment](https://supabase.com/docs/guides/functions/deploy)
- [Vercel Git deployments](https://vercel.com/docs/git)
- [Vercel GitHub integration](https://vercel.com/docs/git/vercel-for-github)

## Capacity estimate

Three devices uploading every 30 seconds generate 8,640 readings a day and 259,200 per 30-day month. Each upload invokes the Edge Function. This is about 52% of Supabase Free's 500,000 monthly invocations before retries and other traffic. An estimate of 200–350 bytes per row, including its indexes, gives roughly 52–91 MB of additional storage per month. This is a planning estimate. Monitor actual relation size, index growth, and the project's shared 500 MB limit. Establish an export and retention policy before reaching the storage limit.

An open tab requests a snapshot and bounded history every 30 seconds, plus refreshes on Realtime location updates. At most three sensors at this rate yield 360 raw readings per hour. Realtime fanout and egress scale with the number of simultaneous viewers. For example, 100 viewers present throughout all 259,200 updates would receive about 25.9 million change events, above the Free project's 2 million monthly Realtime messages. Free also lists 200 peak connections and 5 GB of egress. Watch the usage dashboards during rollout. Free Supabase projects can pause after inactivity, so check the project before the first field test. See [Supabase limits and pricing](https://supabase.com/pricing).

The ingestion transaction limits authenticated devices to one new accepted reading per five seconds. Replays are deduplicated. Requests rejected by the Edge Function can still count toward the provider's quota. Check invocation levels before introducing public-facing device fleets.
