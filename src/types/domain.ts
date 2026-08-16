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

export interface PvArraySettings {
  id: string;
  name: string;
  peakPowerWp: number;
  azimuthDeg: number;
  tiltDeg: number;
  moduleCount: number;
  modulePowerWp: number;
  stringCount: number;
  knownShading: string;
}

export interface PvSystemSettings {
  installedPeakPowerWp: number;
  inverterRatedPowerW: number;
  maximumBatteryChargePowerW: number;
  maximumBatteryDischargePowerW: number;
  arrays: PvArraySettings[];
}

export interface CalibrationSettings {
  enabled: boolean;
  rawRetentionDays: number;
  minimumIrradianceWm2: number;
  minimumPvPowerW: number;
  batteryPowerThresholdW: number;
  chargerPowerThresholdW: number;
  gridExportThresholdW: number;
  maximumDataAgeSeconds: number;
  maximumTimestampSkewSeconds: number;
  aggregationIntervalMinutes: number;
  modelUpdateIntervalMinutes: number;
  minimumObservationCount: number;
  archiveEnabled: boolean;
  archiveDirectory: string;
  archiveFormat: "parquet";
  archiveSchedule: string;
  parquetCompression: "SNAPPY" | "UNCOMPRESSED";
  outlierThreshold: number;
  maximumModelChangePercent: number;
}

export interface AppSettings {
  growatt: GrowattConnectionSettings;
  easee: EaseeConnectionSettings;
  rules: ChargingRuleSettings;
  mg: MgVehicleSettings;
  location: LocationSettings;
  weather: WeatherSettings;
  pvSystem: PvSystemSettings;
  calibration: CalibrationSettings;
}

export interface SunTimes {
  sunrise: string;
  sunset: string;
  solarNoon: string;
  isDay: boolean;
  minutesToSunset: number;
}

export interface ForecastPoint {
  timestampUtc: string;
  hour: number;
  irradianceWm2: number;
  theoreticalPvW: number;
  predictedPvW: number;
  predictedEnergyWh: number;
  usableSurplusW: number;
  lowerBoundW: number;
  upperBoundW: number;
  correctionFactor: number;
  confidence: number;
  modelVersion: string;
  hasDataGap: boolean;
  isChargingWindow: boolean;
}

export type ConfidenceLevel = "low" | "medium" | "high" | "very_high";

export interface CalibrationConfidence {
  value: number;
  level: ConfidenceLevel;
}

export interface CalibrationModel {
  version: string;
  status: "active" | "needs_validation";
  globalFactor: number;
  factorsBySolarElevation: Record<string, number>;
  factorsBySolarAzimuth: Record<string, number>;
  factorsByHour: Record<string, number>;
  factorsByMonth: Record<string, number>;
  factorsBySeason: Record<string, number>;
  factorsByWeather: Record<string, number>;
  factorsByIrradiance: Record<string, number>;
  factorsByArray: Record<string, number>;
  shadingPeriods: Array<{ start: string; end: string; affectedArray: string; confidence: number }>;
  estimatedEffectivePeakPowerW: number | null;
  configuredPeakPowerWp: number;
  confidence: CalibrationConfidence;
  validObservationCount: number;
  rejectedObservationCount: number;
  distinctDays: number;
  oldestObservationUtc: string | null;
  newestObservationUtc: string | null;
  updatedAtUtc: string;
  recentMeanAbsolutePercentageError: number | null;
}

export interface CalibrationObservation {
  observationId: string;
  timestampUtc: string;
  timezone: string;
  irradianceWm2: number;
  actualPvPowerW: number;
  pvEnergyWh: number;
  calibrationRatio: number;
  batteryPowerW: number;
  batteryState: "charging" | "discharging" | "idle";
  chargerPowerW: number;
  gridPowerW: number;
  houseConsumptionW: number | null;
  solarElevationDeg: number;
  solarAzimuthDeg: number;
  sunriseUtc: string;
  sunsetUtc: string;
  temperatureC: number | null;
  cloudCoverPercent: number | null;
  weatherCode: number | null;
  month: number;
  season: string;
  validationReason: string;
  qualityScore: number;
  modelVersion: string;
  schemaVersion: number;
  createdAtUtc: string;
  archived: boolean;
}

export interface WeatherContext {
  sunTimes: SunTimes | null;
  currentIrradianceWm2: number | null;
  forecast2hIrradianceWm2: number | null;
  dailyForecast: ForecastPoint[];
  calibrationFactor: number | null;
  calibrationSamples: number;
  model: CalibrationModel;
  todayEnergyWh: number;
  tomorrowEnergyWh: number;
  expectedMaximumPvW: number;
  currentWeather: {
    timestampUtc: string;
    temperatureC: number | null;
    cloudCoverPercent: number | null;
    weatherCode: number | null;
    directNormalIrradianceWm2: number | null;
    diffuseRadiationWm2: number | null;
  } | null;
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
