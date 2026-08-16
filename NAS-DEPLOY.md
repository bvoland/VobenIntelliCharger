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
- Config JSON writes should be atomic. A `0` byte `config/settings.json` was observed once on the NAS and caused repeated startup crashes until restored from backup.
- `rules.maxBatteryDischargeWatts: 0` is intentionally strict: any measured battery discharge causes reduction or pause.
- Easee safe mode is off by default and can be deliberately enabled in the UI.
- Easee current is capped at 16 A.
- Phase mode `auto` can control both 1-phase and 3-phase charging.
- `src/config/configStore.ts` tolerates UTF-8 BOM in JSON files because this once caused parser errors.
- If Easee returns `401` while refreshing, `authInvalid` is set and the UI asks for reconnection.
- MG login may succeed while status still fails if the MG app's vehicle authorization has expired or been revoked. In that case expect MG code `1100003`.
- On this NAS, non-interactive SSH sessions may start with an empty `PATH`; use absolute paths or export a full `PATH` before calling Docker.
- On this NAS, Docker is available at `/usr/local/bin/docker`.
- The SSH user can log in normally, but Docker access requires `sudo`.
- If SSH automation needs a password with special characters, a temporary UTF-8 password file worked reliably with `plink`/`pscp` `-pwfile`.
- Keep the NAS host key pinned for automation. Last verified fingerprint:
  `ssh-ed25519 255 SHA256:LqUeOEbqBmAb6N+qpFphngHQOysFZFSG/P0BPaf0O6w`

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

## Verified Non-Interactive Deploy Notes

- Local validation used before deploy:
  - `npm run check`
  - `npm run build`
- The runtime archive must still exclude persistent files from `config` and `data`.
- For this NAS, the safe remote flow is:
  1. `docker compose stop`
  2. create backup `backups/predeploy-<timestamp>-config-data.tgz` from `config` and `data`
  3. extract `/volume1/docker/pv-charge-controller-runtime.tgz` into `/volume1/docker/pv-charge-controller`
  4. `docker compose build`
  5. `docker compose up -d`
  6. verify `http://127.0.0.1:8098/api/health`
- In non-interactive sessions, prefer:

```sh
export PATH=/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin
printf '%s\n' "$SUDO_PASSWORD" | sudo -S -p '' /usr/local/bin/docker compose ps
```

- If `docker: command not found` appears, the issue is the remote `PATH`, not a missing Docker installation.
- If `permission denied while trying to connect to the Docker daemon socket` appears, rerun the Docker command through `sudo`.

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

- Last verified deployment: 2026-08-16 around 19:09 Europe/Berlin.
- Backup before deployment:
  `/volume1/docker/pv-charge-controller/backups/predeploy-20260816-190906-config-data.tgz`
- Container status after deployment:
  `running`, `RestartCount=0`, `OOMKilled=false`, health endpoint returned `{"status":"ok"}`
- Verified functions: calibration status API, history energy totals for PV production
  and vehicle charging, separate Data navigation, and responsive landscape layout.
- Changes deployed: physical PV forecasting and calibration, validated Parquet
  archiving, selected-range kWh totals, and a dedicated Data view.
- Last verified deployment: 2026-06-08 around 17:05 Europe/Berlin.
- Backup before deployment:
  `/volume1/docker/pv-charge-controller/backups/predeploy-20260608-170458-config-data.tgz`
- Container status after deployment:
  `Up`, health endpoint returned `{"status":"ok"}`
- MG login and vehicle status working: `Status geladen: SOC=91.1%`
- Changes deployed: MG vehicle values now update on overview page (fixed sanitized-settings bug in dashboard); automatic 3→1 phase downgrade when 3-phase guard fires.
- Last verified deployment: 2026-06-08 around 14:33 Europe/Berlin.
- Backup before deployment:
  `/volume1/docker/pv-charge-controller/backups/predeploy-20260608-143208-config-data.tgz`
- Container status after deployment:
  `Up`, health endpoint returned `{"status":"ok"}`
- Observed runtime note after deployment:
  MG login still works, but vehicle authorization currently reports revoked access and may require reconnect/re-authorization in MG.
- Additional incident after deployment:
  `config/settings.json` was temporarily found as `0` bytes and had to be restored from backup before a follow-up redeploy.
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
