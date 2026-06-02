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
- [ ] Test MG login with real credentials and refine field mapping if needed.
- [x] Finish NAS deployment with safe backup and Docker Compose.
- [x] Connect the local project to the GitHub repository.
- [ ] Watch real-world PV/weather behavior over several days and tune calibration if needed.

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
