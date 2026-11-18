# Connecting the first ESP32

Use the deployed Supabase project ref to resolve the ingestion URL:

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/ingest-noise
```

The actual production ref is assigned during deployment. Send an HTTPS POST with `Content-Type: application/json` and `Authorization: Bearer DEVICE_TOKEN`. The token is unique to each device. The frontend publishable key is unnecessary for this endpoint.

## Register a device

Generate a 32-byte token and its SHA-256 digest in a private terminal. Keep the token in a password manager until firmware provisioning. Keep terminal output out of shared logs.

```sh
DEVICE_TOKEN="$(openssl rand -hex 32)"
printf '%s' "$DEVICE_TOKEN" | shasum -a 256
```

Use the resulting hash in the target Supabase project's SQL editor. Choose a unique device ID and a label suitable for public display.

```sql
insert into public.devices (device_id, location_id, device_name, credential_hash)
select 'livespace-01', id, 'Cafe sensor', '<64-character SHA-256 hash>'
from public.locations where slug = 'skibo-cafe';
```

Provision the original token on the ESP32 via a private provisioning channel, preferably using encrypted storage on supported hardware. To rotate, generate a new token, update the matching row's hash, and provision the new token. The old token is rejected as soon as the hash changes. To revoke access, set `enabled = false` on that device. Schedule a short maintenance window if rotation requires device downtime.

## Upload contract

```json
{
  "device_id": "livespace-01",
  "measurement_id": "unique-measurement-id",
  "noise_dbfs": -42.6,
  "measurement_duration_ms": 30000
}
```

Calculate interval RMS dBFS locally. Send only a finite value from −160 to 0, with a duration of 1000–120000 ms. Upload every 30 seconds. Keep the ID and payload stable across retries, even if the device restarts. Use a UUID or another collision-resistant ID for each new interval. The database assigns UTC receipt time. Delayed uploads are recorded at receipt time.

| Response | Device action |
| --- | --- |
| 201 | Stored. Remove this measurement from the pending queue. |
| 200 | Previous request already stored this exact measurement. Remove it from the queue. |
| 429 | Wait at least the `Retry-After` interval. |
| Transport error or 5xx | Retry the same payload with capped exponential backoff and jitter. |
| 400 / 413 / 415 | Inspect payload validation, size, and content type. |
| 401 | Check token, device ID, and whether the device is enabled. |
| 409 | Investigate ID reuse with a different payload. |

## Arduino example

This helper assumes Wi-Fi is connected and the device clock has synced. Use the applicable trusted root CA for the Supabase endpoint. Keep the trust chain current across firmware updates. Leave certificate and hostname verification enabled.

```cpp
#include <WiFiClientSecure.h>
#include <HTTPClient.h>

// Supply the token from provisioned storage and a trust root from firmware.
int uploadNoise(const String& endpoint, const String& token,
                const char* trustedRootPem, const String& payload) {
  WiFiClientSecure tls;
  tls.setCACert(trustedRootPem);
  HTTPClient http;
  if (!http.begin(tls, endpoint)) return -1;
  http.setConnectTimeout(5000);
  http.setTimeout(10000);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Bearer " + token);
  int status = http.POST(payload);
  http.end();
  return status;
}
```

Register the device for campus Wi-Fi using CMU's current CMU-DEVICE procedure. Verify that it can resolve the Supabase hostname, synchronize its clock, and reach outbound TCP 443. The ESP32 and students' browsers can be on different networks.

## Try the contract on staging

Register an enabled test device on a separate project, then load its URL and token into `INGEST_URL` and `DEVICE_TOKEN` in a private shell session. Use a new ID for a new test and repeat the same ID to verify deduplication.

```sh
curl --fail-with-body -sS -i \
  -H "Authorization: Bearer ${DEVICE_TOKEN}" \
  -H 'Content-Type: application/json' \
  --data '{"device_id":"livespace-01","measurement_id":"staging-check-001","noise_dbfs":-42.6,"measurement_duration_ms":30000}' \
  "${INGEST_URL}"
```

If TLS fails, verify the clock, CA, hostname, and Wi-Fi. If uploads return 201 but the dashboard stays empty, check that Vercel points to the same Supabase project and the device is associated with Skibo Cafe. With no Realtime connection, the next polling cycle should refresh within 30 seconds.
