# NAS Deploy

## Target System

- NAS IP: configure locally via `PVCC_NAS_HOST`
- SSH port: `22`
- SSH user: configure locally via `PVCC_NAS_USER`
- project path on the NAS: `/volume1/docker/pv-charge-controller`
- web URL on the NAS: `http://<nas-host>:8098`
- app name: `VOBEN INTELLICHARGER`

## Security

- The SSH password is intentionally **not** stored in this file.
- Easee, MG, and other credentials must not be written into this file.

## Container Setup

- deployment type: `docker compose`
- compose file: `/volume1/docker/pv-charge-controller/docker-compose.yml`
- container name: `pv-charge-controller`
- host port: `8098`

## Persistent Data

- config directory: `/volume1/docker/pv-charge-controller/config`
- database/log directory: `/volume1/docker/pv-charge-controller/data`
- Easee config: `/volume1/docker/pv-charge-controller/config/easee.json`
- app settings: `/volume1/docker/pv-charge-controller/config/settings.json`
- main database: `/volume1/docker/pv-charge-controller/data/pv-charge-controller.db`
- Growatt reader database: `/volume1/docker/pv-charge-controller/data/growatt-reader.db`

## Important Notes

- The container uses a runtime build with prebuilt `dist`.
- The container starts directly with `node dist/index.js` so stop signals reach the Node process cleanly.
- The embedded Growatt reader runs inside the same container.
- The Node process starts the Growatt reader automatically; the container installs Python packages from `embedded/growatt-reader`.
- The Node process also starts the MG reader automatically; the container installs Python packages from `embedded/mg-reader`.
- The app optionally uses Open-Meteo for irradiance forecasts. Outbound internet access is required for that.
- Weather fetches and PV/irradiance calibration samples are stored in the main database so forecasting can keep learning after restarts.
- Raw snapshots older than 7 days are consolidated into hourly rows. Control decisions are cleaned after 30 days, weather fetches and calibration samples after 90 days.
- `config/settings.json` also contains `location` and `weather` for sun times, forecast, and battery preloading before sunset.
- `config/settings.json` also contains MG settings. Credentials must not be included in deployment archives.
- `rules.maxBatteryDischargeWatts: 0` is intentionally strict: any measured battery discharge causes reduction or pause.
- Easee safe mode is off by default and can be deliberately enabled in the UI.
- Easee current is capped at 16 A.
- Phase mode `auto` can control both 1-phase and 3-phase charging.
- `src/config/configStore.ts` tolerates UTF-8 BOM in JSON files because this once caused parser errors.
- If Easee returns `401` while refreshing, `authInvalid` is set and the UI asks for reconnection.

## Local Deployment To NAS

From the local project directory:

1. Run `npm run check`.
2. Run `npm run build`.
3. Create a runtime archive containing:
   `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `package.json`,
   `package-lock.json`, `README.md`, `NAS-DEPLOY.md`, `agent.md`, `dist`,
   `src/web`, `embedded/growatt-reader`, `embedded/mg-reader`, and
   `config.example`.
4. Copy the archive to `/volume1/docker/pv-charge-controller-runtime.tgz`.
5. On the NAS, extract it into the project directory.
6. Run:
   - `docker compose build`
   - `docker compose up -d`

The helper script `deploy-nas-safe.ps1` automates this flow and performs the
archive safety check.

Set the NAS connection locally before running it:

```powershell
$env:PVCC_NAS_USER = "your-ssh-user"
$env:PVCC_NAS_HOST = "your-nas-host-or-ip"
.\deploy-nas-safe.ps1
```

## Useful NAS Commands

Run from `/volume1/docker/pv-charge-controller`:

```powershell
docker compose ps
docker compose logs --tail=200
docker compose build
docker compose up -d
docker compose stop
```

## Last Verified NAS Status

- Last verified deployment: 2026-06-02 around 22:14 Europe/Berlin.
- Backup before deployment:
  `/volume1/docker/pv-charge-controller/backups/predeploy-20260602-221426-config-data.tgz`
- Container status after deployment:
  `running`, `RestartCount=0`, `OOMKilled=false`
- Start command:
  `["node","dist/index.js"]`
- Health endpoint:
  `http://127.0.0.1:8098/api/health` returned `{"status":"ok"}`.
- Cleanup at previous start:
  `17` consolidated hourly rows, `2,292` old raw rows consolidated/deleted.
