export type SnapshotSource = "growatt" | "easee";

export interface GrowattConnectionSettings {
  loggerBaseUrl: string;
  inverterHost: string;
  inverterPort: number;
  unitId: number;
  pollIntervalSeconds: number;
}

export interface EaseeConnectionSettings {
  chargerId: string;
  pollIntervalSeconds: number;
  safeMode: boolean;
  chargerEnabled: boolean;
}

export interface ChargingRuleSettings {
  enabled: boolean;
  mode: "pv_optimized" | "manual_override";
  minSocPercent: number;
  maxBatteryDischargeWatts: number;
  maxGridImportWatts: number;
  maxChargePowerWatts: number;
  phaseMode: "auto" | "single" | "three";
  minAmps: number;
  maxAmps: number;
  regulationIntervalSeconds: number;
  holdSecondsAfterAdjustment: number;
  upStepAmps: number;
  downStepAmps: number;
  manualOverrideEnabled: boolean;
  manualOverrideAmps: number;
  targetVehicleSocPercent: number | null;
}

export interface MgVehicleSettings {
  enabled: boolean;
  apiBaseUrl: string;
  username: string;
  password: string;
  vehicleId: string;
}

export interface LocationSettings {
  lat: number;
  lon: number;
}

export interface WeatherSettings {
  enabled: boolean;
  targetBatterySocAtSunsetPercent: number;
  sunsetPreloadWindowMinutes: number;
}

export interface AppSettings {
  growatt: GrowattConnectionSettings;
  easee: EaseeConnectionSettings;
  rules: ChargingRuleSettings;
  mg: MgVehicleSettings;
  location: LocationSettings;
  weather: WeatherSettings;
}

export interface SunTimes {
  sunrise: string;
  sunset: string;
  solarNoon: string;
  isDay: boolean;
  minutesToSunset: number;
}

export interface ForecastPoint {
  hour: number;
  irradianceWm2: number;
  predictedPvW: number | null;
  isChargingWindow: boolean;
}

export interface WeatherContext {
  sunTimes: SunTimes | null;
  currentIrradianceWm2: number | null;
  forecast2hIrradianceWm2: number | null;
  dailyForecast: ForecastPoint[];
  calibrationFactor: number | null;
  calibrationSamples: number;
  fetchedAt: string;
  fetchError: string | null;
}

export interface MgVehicleStatusPayload {
  vin: string;
  socPercent: number | null;
  isCharging: boolean;
  rangeKm: number | null;
  updatedAt: string;
}

export interface SnapshotRecord {
  id: number;
  source: SnapshotSource;
  capturedAt: string;
  payload: unknown;
}

export interface GrowattOverviewPayload {
  captured_at?: string;
  captured_at_local?: string;
  captured_at_utc?: string;
  host?: string;
  port?: number;
  unit_id?: number;
  live?: {
    pv_total_power_w?: number;
    ac_total_power_w?: number;
    estimated_import_from_grid_w?: number;
    estimated_export_to_grid_w?: number;
    estimated_load_power_w?: number;
  };
  battery?: {
    bms_soc_percent?: number;
    charge_power_w?: number;
    discharge_power_w?: number;
    battery_power_w?: number;
    flow_state?: string;
    bms_status?: number;
    candidate_registers?: Record<string, unknown>;
  };
  control?: Record<string, unknown>;
  zero_export?: Record<string, unknown>;
  raw?: Record<string, unknown>;
}

export interface EaseeSite {
  id?: string | number;
  name?: string;
}

export interface EaseeStatePayload {
  chargerId: string;
  online: boolean;
  charging: boolean;
  chargerModeCode?: number;
  totalPowerWatts?: number;
  outputCurrentAmp?: number;
  dynamicChargerCurrentAmp?: number;
  voltage?: number;
  smartCharging?: boolean;
  reasonForNoCurrent?: number;
  sessionEnergyKwh?: number;
  lifetimeEnergyKwh?: number;
  site?: EaseeSite | null;
  raw?: unknown;
}

export interface ControlDecision {
  reason: string;
  suggestedAmps: number | null;
  phaseMode: "single" | "three" | "auto";
  shouldCharge: boolean;
  guardActive: boolean;
  notes: string[];
}

export interface AutomationRuntimeStatus {
  running: boolean;
  state: string;
  lastEvaluatedAt: string | null;
  lastActionAt: string | null;
  lastAction: string | null;
  holdUntil: string | null;
  lastError: string | null;
  desiredAmps: number | null;
  desiredPhaseMode: "single" | "three" | "auto" | null;
  shouldCharge: boolean | null;
}
