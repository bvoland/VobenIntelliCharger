<meta name="author" content="Benjamin Voland">

# Agent State

State: 2026-08-16, after verified NAS deployment of PV calibration, physical
forecasting, Parquet archiving, history energy totals, and the responsive Data view.

## Project

- UI app name: `VOBEN INTELLICHARGER`
- NAS URL: configured locally; do not store private LAN IPs in GitHub
- NAS path: `/volume1/docker/pv-charge-controller`
- container: `pv-charge-controller`
- persistent directories: `config` and `data`
- runtime archive: `pv-charge-controller-runtime.tgz`
- GitHub repository: `https://github.com/bvoland/VobenIntelliCharger`

## Current Technical State

- Node/Express app with embedded Growatt reader and MG reader.
- Docker starts directly with `node dist/index.js`, not through `npm start`.
- Docker Compose maps port `8098` and binds `./data:/app/data` and `./config:/app/config`.
- Easee is capped at 16 A.
- Phase mode `auto` can switch between 1-phase and 3-phase charging.
- `Charge now` activates a manual override until the target vehicle SOC is reached.
- Automation generally stays enabled and is only overridden by the manual override.
- MG timestamps are displayed in local time; old naive timestamps are treated as UTC.
- UI has a burger menu with Home, Configuration, Login, and Diagnostics sections.
- UI supports German and English through a language selector in the top-right header.
- Charts scale plausible power values up to 15 kW and are no longer flattened by outliers.
- Login panels expose raw Easee and MG debug output directly in the UI.
- Diagnostics now include explicit MG loading next to Growatt, Easee, and control evaluation.
- Config JSON writes are atomic so `config/settings.json` is not left truncated on interrupted writes.
- MG login can succeed while vehicle access still fails if MG/SAIC vehicle authorization has expired or been revoked.
- MG vehicle values on the overview page are correctly refreshed on every dashboard poll (bug was that `sanitizeSettings` was applied before calling `mgClient.getVehicleStatus`, causing auth signature mismatch).
- In `auto` phase mode, the automation switches from 3-phase to 1-phase before stopping when PV power drops below the 3-phase minimum but 1-phase would still be viable.
- Open-Meteo now supplies instantaneous irradiance for live calibration and
  15-minute GHI, DNI, diffuse radiation, temperature, cloud cover, and weather
  code for two-day power and energy forecasts.
- PV system settings support multiple arrays with peak power, azimuth, tilt,
  module count/power, string count, known shading, inverter rating, and battery
  charge/discharge limits.
- The physical PV forecast uses `suncalc` solar position and irradiance on each
  configured tilted plane, then applies temperature/system losses and the
  inverter power limit.
- The compact learning model uses robust median/MAD outlier rejection, recency
  and quality weighting, bounded update changes, profile groups, and numeric plus
  categorical confidence.
- Charging windows are based on contiguous usable forecast energy rather than raw
  irradiance. Low-confidence planning scores the lower forecast bound.

## Calibration Invariants

- Calibration must use only Growatt `live.pv_total_power_w`, which is the direct
  inverter PV production measurement.
- Never add battery discharge, AC output, house load, or grid power to measured PV.
- Battery fields have these verified project conventions:
  - `battery.charge_power_w`: positive magnitude while charging
  - `battery.discharge_power_w`: positive magnitude while discharging
  - `battery.battery_power_w`: positive means discharge, negative means charge
- Grid fields are separate positive magnitudes, but currently remain derived in
  the Growatt decoder:
  - `live.estimated_import_from_grid_w`
  - `live.estimated_export_to_grid_w`
- A sample is potentially unrestricted when battery charging, battery
  discharging, vehicle charging, or actual grid export exceeds its configured
  noise threshold. Battery discharge is only a release criterion.
- A sample additionally requires fresh and time-aligned inverter/weather data,
  daylight between sunrise and sunset, minimum instant irradiance, minimum direct
  PV power, plausible values, and no detected sensor/communication failure.
- Rejected samples are rate-limited diagnostics and must never enter the model.

## MPPT / String Follow-up

- The Growatt decoder already exposes up to eight entries in `live.trackers`, each
  containing `tracker`, `voltage_v`, `current_a`, and `power_w` from input register
  blocks beginning at register 3.
- A tracker represents an MPPT input and is not automatically identical to one
  physical string; parallel strings may share an MPPT.
- The intended next extension is an explicit `trackerIds` array on every PV array,
  for example `"trackerIds": [1, 2]` for one roof orientation.
- Before tracker-level calibration is trusted, continuously compare the sum of
  active tracker powers with `live.pv_total_power_w`. Fall back to the direct total
  PV value if the difference exceeds a configured tolerance or tracker voltage,
  current, timestamps, or communication state are implausible.
- Tracker power may then train per-array correction factors and shading profiles.
  Do not infer a roof-to-tracker assignment automatically or overwrite the user's
  configured mapping.

## Data Storage

- main database: `data/pv-charge-controller.db`
- Growatt reader database: `data/growatt-reader.db`
- Easee command log: `data/easee-command-log.jsonl`
- Cleanup logic:
  - raw snapshots older than 7 days are consolidated into hourly rows
  - control decisions older than 30 days are deleted
  - weather fetches and legacy `calibration_samples` older than 90 days are deleted
  - rich `calibration_observations` use configurable retention (default 30 days)
    and may only be deleted by the archive service after successful Parquet
    validation and database archive marking
  - consolidated snapshots contain `_consolidated: 1`
  - consolidated timestamps end with `Z`
- Calibration tables:
  - `calibration_observations`: rich raw data with unique observation IDs
  - `calibration_models`: compact versioned active/previous models
  - `calibration_aggregates`: retained 15-minute profiles
  - `calibration_jobs`: last successful archive/model job and diagnostics
- Archive layout:
  - `data/calibration/raw/YYYY/MM/calibration_YYYY_MM_<timestamp>.parquet`
  - `data/calibration/aggregated/YYYY/calibration_15min_YYYY_MM_<timestamp>.parquet`
  - Snappy compression, schema version metadata, and SHA-256 sidecars
- Archive safety order: select unarchived expired rows, write temporary Parquet,
  reopen and validate row count/IDs, atomically rename, write checksum, mark rows
  archived, update compact model, then delete only confirmed database rows.
- Calibration endpoints:
  - `GET /api/calibration/status`
  - `POST /api/calibration/model/update`
  - `POST /api/calibration/archive`
  - `POST /api/calibration/model/rebuild`
- Last verified cleanup run on the NAS:
  - before: `19,522` snapshots
  - after: `17,253` snapshots
  - `17` consolidated hourly rows
  - `2,292` old raw rows consolidated/deleted

## Last Verified NAS Deployment

- date/time: 2026-08-16 around 19:09 Europe/Berlin
- backup: `/volume1/docker/pv-charge-controller/backups/predeploy-20260816-190906-config-data.tgz`
- health check: `GET /api/health` returned `{"status":"ok"}`
- container status: `running`, `RestartCount=0`, `OOMKilled=false`
- history API: PV production and vehicle charging totals available in kWh
- UI: separate Data menu verified, including responsive landscape layout
- changes: physical PV forecast and calibration model, validated Parquet archive,
  energy totals for selected history ranges, and a dedicated responsive Data view
- date/time: 2026-06-08 around 17:05 Europe/Berlin
- backup: `/volume1/docker/pv-charge-controller/backups/predeploy-20260608-170458-config-data.tgz`
- health check: `GET /api/health` returned `{"status":"ok"}`
- container status: `Up`
- MG vehicle status working: `SOC=91.1%`
- changes: MG overview fix (sanitizeSettings bug), 3→1 phase auto-downgrade
- date/time: 2026-06-08 around 14:43 Europe/Berlin
- backup: `/volume1/docker/pv-charge-controller/backups/predeploy-20260608-144232-config-data.tgz`
- health check: `GET /api/health` returned `{"status":"ok"}`
- container status: `Up`
- note: `config/settings.json` had become `0` bytes and was restored from backup before redeploying; atomic writes were implemented locally afterwards to prevent recurrence
- date/time: 2026-06-02 around 22:14 Europe/Berlin
- backup: `/volume1/docker/pv-charge-controller/backups/predeploy-20260602-221426-config-data.tgz`
- health check: `GET /api/health` returned `{"status":"ok"}`
- container status: `running`, `RestartCount=0`, `OOMKilled=false`
- start command: `["node","dist/index.js"]`

## Working Rules

- Run `npm test`, `npm run check`, and `npm run build` before each NAS deployment.
- Runtime archives must not contain production data:
  - no `data`
  - no real `config/settings.json`
  - no real `config/easee.json`
  - no `node_modules`
- Always back up `config` and `data` before replacing the runtime on the NAS.
- Do not delete or reset production databases unless explicitly requested.
- Never write NAS credentials into documentation files.
- If MG says login succeeded but status still fails, check MG app vehicle authorization before debugging password storage.
