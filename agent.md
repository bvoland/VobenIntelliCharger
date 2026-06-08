# Agent State

State: 2026-06-08, after NAS deployment with phase-downgrade and MG overview fix.

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

## Data Storage

- main database: `data/pv-charge-controller.db`
- Growatt reader database: `data/growatt-reader.db`
- Easee command log: `data/easee-command-log.jsonl`
- Cleanup logic:
  - raw snapshots older than 7 days are consolidated into hourly rows
  - control decisions older than 30 days are deleted
  - weather fetches and calibration samples older than 90 days are deleted
  - consolidated snapshots contain `_consolidated: 1`
  - consolidated timestamps end with `Z`
- Last verified cleanup run on the NAS:
  - before: `19,522` snapshots
  - after: `17,253` snapshots
  - `17` consolidated hourly rows
  - `2,292` old raw rows consolidated/deleted

## Last Verified NAS Deployment

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

- Run `npm run check` and `npm run build` before each NAS deployment.
- Runtime archives must not contain production data:
  - no `data`
  - no real `config/settings.json`
  - no real `config/easee.json`
  - no `node_modules`
- Always back up `config` and `data` before replacing the runtime on the NAS.
- Do not delete or reset production databases unless explicitly requested.
- Never write NAS credentials into documentation files.
- If MG says login succeeded but status still fails, check MG app vehicle authorization before debugging password storage.
