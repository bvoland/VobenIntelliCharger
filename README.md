# VOBEN INTELLICHARGER

Local controller for PV-optimized EV charging with a Growatt inverter, Easee
wallbox, MG vehicle SOC, local history, weather forecasts, and sun-position
logic.

## Features

- embedded Growatt reader for the DR302/Modbus adapter
- Easee Cloud API for status, start/pause/stop, dynamic current, and phase mode
- PV automation with battery SOC, grid import, power limits, and hold times
- automatic phase selection for 1-phase and 3-phase charging
- manual "Charge now" mode with current and target vehicle SOC
- MG iSmart integration for vehicle SOC, range, and target-SOC stop
- MG login/debug output directly in the Login section plus `MG laden` in Diagnostics
- location and weather logic using SunCalc and Open-Meteo irradiance forecasts
- battery preloading before sunset if the configured battery target SOC is not reached
- adaptive PV forecast calibration from real PV output and irradiance data
- local SQLite database for snapshots, control decisions, and history charts
- automatic data consolidation for old raw samples
- web UI / basic PWA on `http://127.0.0.1:8098`
- Docker setup for Synology NAS or Raspberry Pi

## Local Start

```bash
npm install
npm run dev
```

Then open:

- UI: `http://127.0.0.1:8098`
- health check: `http://127.0.0.1:8098/api/health`
- internal Growatt reader: `http://127.0.0.1:5001`

The Node process starts the embedded Growatt reader and MG reader automatically.
For local development, Python and the packages from
`embedded/growatt-reader/requirements.txt` and
`embedded/mg-reader/requirements.txt` must be available. The Docker image
installs them automatically.

## Configuration

Persistent settings and data are stored in:

- `config/settings.json` for app, Growatt, Easee, rules, location, and weather settings
- `config/easee.json` for Easee tokens and runtime status
- `data/pv-charge-controller.db` for snapshots, history, control decisions, weather fetches, and calibration samples
- `data/growatt-reader.db` for the internal Growatt reader history

Important settings sections:

- `growatt`: adapter IP, port, Modbus unit ID, and poll interval
- `easee`: charger ID, poll interval, safe mode, and controller enable flag
- `rules`: automation, PV mode, manual override, battery/grid protection, current limits, and hold time
- `mg`: MG iSmart credentials, internal reader URL, and vehicle ID/VIN
- `location`: latitude and longitude for sun times
- `weather`: Open-Meteo enable flag, battery target SOC, and preload window before sunset

For `rules.maxBatteryDischargeWatts`, `0` means that the automation tolerates no
active battery discharge. Higher values allow a small discharge before charging
current is reduced.

`growatt.loggerBaseUrl` is set internally to the embedded reader.
Config JSON files are written atomically so `settings.json` is not left empty if
the process is interrupted during a save.

## Operating Logic

- The home screen contains manual controls, Charge now, live values, weather, wallbox control, and system status.
- The separate Data menu contains the history graph, range controls, and energy totals. In landscape orientation, the view uses the available display width and scales the graph proportionally.
- The history section shows total PV production and vehicle charging energy in kWh for the selected preset or custom time range. The totals use the same averaged time buckets as the displayed power graph, so missing buckets are not counted as generated or charged energy.
- Configuration, login credentials, and debug output are separated into menu sections.
- Easee and MG login panels now show their latest raw API/debug output directly below the connection controls.
- The diagnostics section can explicitly load Growatt, Easee, and MG data.
- The automation does not have to be re-enabled before every plug-in. When active, it decides based on PV, battery, grid import, weather, and vehicle SOC.
- `Charge now` sets a manual override until the selected target SOC is reached. After that, the automation can continue normally.
- Easee is capped at 16 A. In `auto` phase mode, the app switches between 1-phase and 3-phase charging depending on surplus power. When PV power drops below the 3-phase minimum while charging, the automation switches to 1-phase before stopping so charging can continue at lower power.
- The UI supports German and English. The language selector is in the top-right corner of the home header.

## Easee Safe Mode

Safe mode is off by default and must be enabled deliberately in the UI. When
enabled, it limits Easee requests more conservatively:

- at least 5 seconds between requests
- 5 minute cooldown on HTTP 429 or repeated follow-up errors
- 15 minute cooldown on HTTP 403

When safe mode is off, these local cooldowns are not enforced. The Easee API can
still apply its own limits.

## REST API

Important endpoints:

- `GET /api/dashboard`
- `GET /api/settings`
- `PUT /api/settings`
- `GET /api/history?hours=12`
- `GET /api/history?from=<ISO timestamp>&to=<ISO timestamp>`
- `GET /api/snapshots?source=growatt|easee&limit=10`
- `POST /api/control/evaluate`
- `POST /api/control/manual-charge`
- `POST /api/control/manual-charge/stop`
- `POST /api/automation/enabled`
- `POST /api/charger/enabled`
- `POST /api/easee/command`
- `POST /api/integrations/easee/auth`
- `GET /api/integrations/easee/chargers`
- `GET /api/integrations/growatt/test`
- `GET /api/integrations/mg/status`
- `POST /api/integrations/mg/auth`

The embedded Growatt reader also exposes internal endpoints such as
`/api/growatt/overview`, `/api/growatt/register-explorer`,
`/api/logger/status`, and `/api/logger/history`.

## Build And Checks

```bash
npm test
npm run check
npm run build
npm start
```

`npm start` uses the built code from `dist`. The Docker container starts
directly with `node dist/index.js` so Docker stop signals reach the Node process
cleanly.

## Docker

```bash
npm run build
docker compose up --build
```

Persistent data:

- `./data`
- `./config`

## NAS Deployment

The production NAS deployment is located at:

- URL: `http://<nas-host>:8098`
- path: `/volume1/docker/pv-charge-controller`
- container: `pv-charge-controller`

Before each deployment:

```bash
npm run check
npm run build
```

The NAS host and SSH user are intentionally not stored in GitHub. Set them
locally via `PVCC_NAS_HOST` and `PVCC_NAS_USER` when using
`deploy-nas-safe.ps1`.

The runtime archive must not contain production data. In particular, `data`,
real `config/settings.json`, real `config/easee.json`, `node_modules`, and local
logs must stay out of the archive. Before replacing the runtime on the NAS,
`config` and `data` are backed up to `backups/predeploy-...-config-data.tgz`.

Last verified NAS state on 2026-08-16: backup
`/volume1/docker/pv-charge-controller/backups/predeploy-20260816-190906-config-data.tgz`,
health check `{"status":"ok"}`, container `running`, `RestartCount=0`,
`OOMKilled=false`. The Data menu, landscape graph layout, and history energy totals
were verified after deployment.

## Data Storage And Consolidation

The main database `data/pv-charge-controller.db` stores snapshots, control
decisions, weather fetches, and calibration samples. To keep growth bounded, a
daily cleanup task runs:

- raw snapshots older than 7 days are consolidated into hourly rows
- control decisions older than 30 days are deleted
- weather fetches and calibration samples older than 90 days are deleted
- consolidated snapshots remain visible in history and contain `_consolidated: 1`

SQLite does not necessarily return deleted space to the filesystem immediately,
but it reuses the freed pages internally. The file size may therefore remain
stable for a while even though future growth pressure is reduced.

## Notes

- Easee Dynamic Current intentionally uses the volatile/dynamic API, not static flash settings.
- The automation pauses active charging only for protection reasons; passive reasons leave manually started sessions alone.
- MG is connected through the embedded reader. Without enabled MG integration, PV/Easee control continues unchanged.
- MG can report a successful account login while still rejecting vehicle access with code `1100003` if the vehicle authorization has expired or been revoked in the MG app.
## PV calibration, forecast, and archive

The controller uses the inverter's direct `live.pv_total_power_w` measurement for
calibration. Battery discharge is never added to this value. A sample is accepted
only during daylight with fresh, aligned and plausible inverter/weather data and
when at least one unrestricted-production indicator is active: battery charging,
battery discharging, vehicle charging, or actual grid export. Thresholds and raw
retention are configured under `calibration` in `config/settings.json`.

Open-Meteo is requested at 15-minute resolution for two days. Instantaneous GHI is
used for comparison with the live inverter measurement; interval-average GHI,
DNI and diffuse radiation are used for energy forecasts. `suncalc` supplies solar
elevation and azimuth. For every configured array, radiation is transposed to the
tilted plane (direct incidence, isotropic diffuse sky, and 20% ground albedo),
then converted with array peak power, a temperature coefficient, system losses,
and the inverter limit. Without array data, the previous generic 20 kWp behavior
is retained as a low-confidence fallback.

The compact model in SQLite uses robust median/MAD outlier rejection, recency and
quality weighting, a maximum update step, and profiles by hour, solar position,
month, season, weather, and irradiance band. Sparse profiles fall back to the
global factor. Confidence combines sample/day/time/month coverage and dispersion.
Configured plant values are never overwritten; learned peak power is explicitly
reported as an estimate. A plant configuration change marks the model as needing
validation.

The forecast exposes theoretical/corrected power, interval energy, usable surplus,
bounds, confidence, model version and data-gap state. Charging windows are chosen
from the highest contiguous usable-surplus energy, not raw irradiance alone. Live
safety limits (battery SOC/discharge and grid import) continue to take precedence.

### SQLite migration and retention

Startup creates these backward-compatible tables and indexes with `IF NOT EXISTS`:

- `calibration_observations`: versioned rich raw samples, unique observation ID,
  timestamp/model/archive indexes
- `calibration_models`: compact versioned models and one active model
- `calibration_aggregates`: reserved versioned compact interval profiles
- `calibration_jobs`: last successful model/archive job and diagnostics

Legacy `calibration_samples` remains readable. Rich observations are never deleted
by generic cleanup. Only the archive service may delete them after a validated and
atomically committed Parquet file exists.

### Parquet archive

Files are written under
`data/calibration/raw/YYYY/MM/calibration_YYYY_MM_<UTC timestamp>.parquet` with
Snappy compression and a sibling SHA-256 file. The stable schema version is stored
in file metadata and in every row. Units are W, Wh, W/m², °C and degrees.

The archive process selects expired, unarchived rows, deduplicates by the database
primary key, writes a unique temporary file, reopens it with an independent reader,
checks row count and every observation ID, atomically renames it, writes the
checksum, marks rows archived, refreshes the compact model, and only then deletes
confirmed rows. Any error before confirmation leaves raw rows intact. A restart can
repeat the selection safely because archived state and unique IDs are persistent.

Operational endpoints:

- `GET /api/calibration/status`
- `POST /api/calibration/model/update`
- `POST /api/calibration/archive`
- `POST /api/calibration/model/rebuild` (full rebuild from raw Parquet files)
