# Agenda

## Done: Easee Safe Mode

Safe mode is no longer enabled automatically.

### Implementation

- `easeeAuth.ts` sets `safeMode` only when explicitly `true`.
- `easeeClient.ts` enforces request spacing and cooldowns only when safe mode is active.
- `config/settings.json`, `config/easee.json`, and `config.example/settings.json` use `safeMode: false`.
- The UI exposes safe mode as an explicit choice in the Easee base configuration.
- `/api/dashboard` exposes runtime status under `easeeRuntime.safeMode`.

### Behavior When Safe Mode Is Active

| Behavior | Code |
|---|---|
| At least 5 seconds between all requests | `easeeClient.ts` `enforceSpacing` |
| 5 minute cooldown on HTTP 429 or 3 consecutive errors | `easeeClient.ts` `recordAttempt` |
| 15 minute cooldown on HTTP 403 | `easeeClient.ts` `recordAttempt` |

## Current Open Items

- [x] Integrate basic MG vehicle support so target SOC can be read from the vehicle.
- [x] Test MG login with real credentials and refine field mapping if needed.
- [x] Finish NAS deployment with safe backup and Docker Compose.
- [x] Connect the local project to the GitHub repository.
- [x] Add direct MG raw/debug visibility in the UI.
- [x] Prevent truncated `settings.json` writes by switching config persistence to atomic writes.
- [x] Fix MG vehicle values not updating on overview page.
- [x] Automatic 3→1 phase downgrade when PV power drops below 3-phase minimum.
- [ ] Watch real-world PV/weather behavior over several days and tune calibration if needed.

## Recent Findings

- MG credentials were valid; the real production issue was expired vehicle authorization in the MG app.
- MG can therefore report successful login while vehicle status still fails with revoked authorization.
- A production `config/settings.json` was observed as `0` bytes on the NAS, which caused repeated `Unexpected end of JSON input` crashes.
- Resulting decision: keep MG debug output visible in the UI and write config JSON atomically.
- MG vehicle values on the overview page were not updating because `sanitizeSettings()` (which clears the MG password) was applied before passing settings to `mgClient.getVehicleStatus()` in the dashboard endpoint. The auth signature check failed on every call, causing a silent error.
- When in 3-phase mode with sinking PV power, the automation was stopping the charge session instead of switching to 1-phase first. The phase mode check in `automationService` now runs before the stop check when a 3→1 downgrade is indicated.

## Deferred: Weather Calibration

PV system: 32 modules x 450 W = 14.4 kWp, 50% southeast / 50% northwest.
Calibration factor around 12 W/(W/m2) is correct for this system size.

SO/NW split issue: Open-Meteo provides global irradiance without orientation
correction. Morning and evening output can therefore deviate systematically
because the two roof orientations produce differently than a single global value
suggests.

Decision: keep the control logic as-is for now, collect production and weather
data over several days, and then decide whether hourly calibration factors are
worth the extra complexity.

Update: calibration samples and weather fetches are now stored in SQLite and
reused after restarts.
