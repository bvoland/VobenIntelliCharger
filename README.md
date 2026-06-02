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

## Operating Logic

- The home screen contains manual controls, Charge now, live values, weather, wallbox control, history, and system status.
- Configuration, login credentials, and debug output are separated into menu sections.
- The automation does not have to be re-enabled before every plug-in. When active, it decides based on PV, battery, grid import, weather, and vehicle SOC.
- `Charge now` sets a manual override until the selected target SOC is reached. After that, the automation can continue normally.
- Easee is capped at 16 A. In `auto` phase mode, the app can switch between 1-phase and 3-phase charging depending on surplus power.
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

The embedded Growatt reader also exposes internal endpoints such as
`/api/growatt/overview`, `/api/growatt/register-explorer`,
`/api/logger/status`, and `/api/logger/history`.

## Build And Checks

```bash
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

Last verified NAS state: backup
`/volume1/docker/pv-charge-controller/backups/predeploy-20260602-221426-config-data.tgz`,
health check `{"status":"ok"}`, container `running`, `RestartCount=0`.

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
