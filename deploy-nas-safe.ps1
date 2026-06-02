$ErrorActionPreference = "Stop"

$NasUser = $env:PVCC_NAS_USER
$NasHost = $env:PVCC_NAS_HOST
$RemoteArchive = "/volume1/docker/pv-charge-controller-runtime.tgz"
$RemoteApp = "/volume1/docker/pv-charge-controller"
$Archive = "pv-charge-controller-runtime.tgz"

if (-not $NasUser -or -not $NasHost) {
  Write-Host "Set PVCC_NAS_USER and PVCC_NAS_HOST before running this script." -ForegroundColor Red
  Write-Host '$env:PVCC_NAS_USER = "your-ssh-user"'
  Write-Host '$env:PVCC_NAS_HOST = "your-nas-host-or-ip"'
  exit 1
}

Write-Host "Building local app..." -ForegroundColor Cyan
npm run check
npm run build

Write-Host "Creating runtime archive without config/data..." -ForegroundColor Cyan
tar -czf $Archive Dockerfile docker-compose.yml .dockerignore package.json package-lock.json README.md NAS-DEPLOY.md agent.md dist src/web embedded/growatt-reader embedded/mg-reader config.example

Write-Host "Checking archive for forbidden persistent files..." -ForegroundColor Cyan
$forbidden = tar -tzf $Archive | Select-String -Pattern '(^|/)data/|(^|/)config/easee.json|(^|/)config/settings.json|\.db($|-)|easee-command-log|node_modules'
if ($forbidden) {
  Write-Host "Archive contains files that must not be deployed:" -ForegroundColor Red
  $forbidden
  exit 1
}

Write-Host "Uploading archive to NAS. Enter the SSH password if prompted." -ForegroundColor Cyan
scp $Archive "${NasUser}@${NasHost}:${RemoteArchive}"

$remoteScript = @'
set -e
APP="/volume1/docker/pv-charge-controller"
TS=$(date +%Y%m%d-%H%M%S)

cd "$APP"
echo "Stopping container..."
docker compose stop

echo "Backing up persistent config and data..."
mkdir -p backups
tar -czf "backups/predeploy-$TS-config-data.tgz" config data
tar -tzf "backups/predeploy-$TS-config-data.tgz" >/dev/null
echo "Backup created: $APP/backups/predeploy-$TS-config-data.tgz"

echo "Extracting runtime archive..."
tar -xzf /volume1/docker/pv-charge-controller-runtime.tgz -C "$APP"

echo "Rebuilding image..."
docker compose build

echo "Starting app..."
docker compose up -d

echo "Container status:"
docker compose ps

echo "Recent logs:"
docker compose logs --tail=80
'@

Write-Host "Running safe deploy on NAS. Enter the SSH password if prompted." -ForegroundColor Cyan
$remoteScript | ssh "${NasUser}@${NasHost}" "sh -s"

Write-Host "Deployment command finished." -ForegroundColor Green
