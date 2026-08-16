import { createHash } from "node:crypto";
import SunCalc from "suncalc";
import { AppDatabase } from "../db/database";
import {
  AppSettings, CalibrationModel, CalibrationObservation, EaseeStatePayload,
  GrowattOverviewPayload, PvArraySettings, WeatherContext
} from "../types/domain";

const MODEL_VERSION = "pv-model-v2";
const SCHEMA_VERSION = 1;

function median(values: number[]): number {
  if (!values.length) return 1;
  const sorted = [...values].sort((a, b) => a - b);
  const i = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[i] : (sorted[i - 1] + sorted[i]) / 2;
}

function season(month: number): string {
  return month === 12 || month <= 2 ? "winter" : month <= 5 ? "spring" : month <= 8 ? "summer" : "autumn";
}

function bucket(value: number, size: number): string { return String(Math.floor(value / size) * size); }

export interface ObservationDecision { accepted: boolean; reasons: string[]; observation?: CalibrationObservation }

export class PvCalibrationService {
  private model: CalibrationModel;
  private lastRejectLog = 0;
  private updating = false;
  private acceptedSinceUpdate = 0;

  constructor(private readonly database: AppDatabase) {
    this.model = database.loadActiveCalibrationModel() ?? this.emptyModel(0);
  }

  getModel(): CalibrationModel { return this.model; }
  markNeedsValidation(configuredPeakPowerWp:number):void { this.model={...this.model,status:"needs_validation",configuredPeakPowerWp,updatedAtUtc:new Date().toISOString()};this.database.saveCalibrationModel(this.model); }

  validateSystem(settings: AppSettings): string[] {
    const pv = settings.pvSystem;
    const errors: string[] = [];
    if (pv.installedPeakPowerWp < 0 || pv.inverterRatedPowerW < 0) errors.push("Leistungswerte dürfen nicht negativ sein.");
    const sum = pv.arrays.reduce((n, a) => n + a.peakPowerWp, 0);
    if (pv.arrays.length && Math.abs(sum - pv.installedPeakPowerWp) > Math.max(100, pv.installedPeakPowerWp * 0.02))
      errors.push("Summe der Teilanlagenleistung weicht um mehr als 2 % von der Gesamtleistung ab.");
    for (const array of pv.arrays) {
      if (!array.id || !array.name) errors.push("Jede Dachfläche benötigt ID und Name.");
      if (array.azimuthDeg < 0 || array.azimuthDeg >= 360) errors.push(`${array.name}: Azimut muss 0–<360° betragen.`);
      if (array.tiltDeg < 0 || array.tiltDeg > 90) errors.push(`${array.name}: Neigung muss 0–90° betragen.`);
      if (array.moduleCount <= 0 || array.modulePowerWp <= 0 || array.stringCount <= 0) errors.push(`${array.name}: Modul- und Stringangaben sind unvollständig.`);
      const moduleWp = array.moduleCount * array.modulePowerWp;
      if (Math.abs(moduleWp - array.peakPowerWp) > Math.max(50, array.peakPowerWp * 0.02)) errors.push(`${array.name}: Module × Modulleistung weicht um mehr als 2 % ab.`);
    }
    if (pv.installedPeakPowerWp > 0 && pv.inverterRatedPowerW > pv.installedPeakPowerWp * 2) errors.push("Wechselrichterleistung ist im Verhältnis zur PV-Leistung unplausibel hoch.");
    return errors;
  }

  record(settings: AppSettings, growatt: GrowattOverviewPayload | null, easee: EaseeStatePayload | null, weather: WeatherContext | null, now = new Date()): ObservationDecision {
    const reasons: string[] = [];
    if (!settings.calibration.enabled) return { accepted: false, reasons: ["disabled"] };
    if (!growatt || !weather?.sunTimes || !weather.currentWeather || weather.currentIrradianceWm2 == null) return { accepted: false, reasons: ["missing-data"] };
    const pvW = growatt.live?.pv_total_power_w;
    const chargeW = growatt.battery?.charge_power_w ?? Math.max(0, -(growatt.battery?.battery_power_w ?? 0));
    const dischargeW = growatt.battery?.discharge_power_w ?? Math.max(0, growatt.battery?.battery_power_w ?? 0);
    const chargerW = easee?.totalPowerWatts ?? 0;
    const exportW = growatt.live?.estimated_export_to_grid_w ?? 0;
    const captured = new Date(growatt.captured_at_utc ?? growatt.captured_at ?? growatt.captured_at_local ?? "");
    const weatherAt = new Date(weather.currentWeather.timestampUtc);
    const maxAge = settings.calibration.maximumDataAgeSeconds * 1000;
    if (!Number.isFinite(captured.getTime()) || now.getTime() - captured.getTime() > maxAge || now.getTime() - weatherAt.getTime() > maxAge) reasons.push("stale-data");
    if (Math.abs(captured.getTime() - weatherAt.getTime()) > settings.calibration.maximumTimestampSkewSeconds * 1000) reasons.push("timestamp-skew");
    if (!weather.sunTimes.isDay || now < new Date(weather.sunTimes.sunrise) || now > new Date(weather.sunTimes.sunset)) reasons.push("outside-daylight");
    if (weather.currentIrradianceWm2 < settings.calibration.minimumIrradianceWm2) reasons.push("low-irradiance");
    if (typeof pvW !== "number" || pvW < settings.calibration.minimumPvPowerW) reasons.push("low-or-missing-pv");
    const release: string[] = [];
    if (chargeW >= settings.calibration.batteryPowerThresholdW) release.push("battery-charging");
    if (dischargeW >= settings.calibration.batteryPowerThresholdW) release.push("battery-discharging");
    if (chargerW >= settings.calibration.chargerPowerThresholdW) release.push("vehicle-charging");
    if (exportW >= settings.calibration.gridExportThresholdW) release.push("grid-export");
    if (!release.length) reasons.push("possible-curtailment");
    const maxPv = Math.max(settings.pvSystem.installedPeakPowerWp * 1.25, settings.pvSystem.inverterRatedPowerW * 1.1, 1000);
    if (typeof pvW === "number" && (!Number.isFinite(pvW) || pvW < 0 || pvW > maxPv)) reasons.push("implausible-pv");
    if (![chargeW, dischargeW, chargerW, exportW, weather.currentIrradianceWm2].every(Number.isFinite)) reasons.push("sensor-error");
    if (reasons.length || typeof pvW !== "number") {
      if (Date.now() - this.lastRejectLog > 5 * 60_000) { console.debug(`[Calibration] Messpunkt verworfen: ${reasons.join(",")}`); this.lastRejectLog = Date.now(); }
      return { accepted: false, reasons };
    }
    const position = this.solarPosition(now, settings.location.lat, settings.location.lon);
    const month = now.getMonth() + 1;
    const ratio = pvW / weather.currentIrradianceWm2;
    const plausibleRatioMax = Math.max(2, settings.pvSystem.installedPeakPowerWp / 100);
    if (ratio <= 0 || ratio > plausibleRatioMax) return { accepted: false, reasons: ["implausible-ratio"] };
    const batteryState = chargeW >= settings.calibration.batteryPowerThresholdW ? "charging" : dischargeW >= settings.calibration.batteryPowerThresholdW ? "discharging" : "idle";
    const observation: CalibrationObservation = {
      observationId: createHash("sha256").update(`${captured.toISOString()}|${weatherAt.toISOString()}`).digest("hex"), timestampUtc: captured.toISOString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      irradianceWm2: weather.currentIrradianceWm2, actualPvPowerW: pvW, pvEnergyWh: pvW * settings.growatt.pollIntervalSeconds / 3600, calibrationRatio: ratio,
      batteryPowerW: dischargeW - chargeW, batteryState, chargerPowerW: chargerW, gridPowerW: exportW - (growatt.live?.estimated_import_from_grid_w ?? 0),
      houseConsumptionW: growatt.live?.estimated_load_power_w ?? null, solarElevationDeg: position.elevationDeg, solarAzimuthDeg: position.azimuthDeg,
      sunriseUtc: weather.sunTimes.sunrise, sunsetUtc: weather.sunTimes.sunset, temperatureC: weather.currentWeather.temperatureC,
      cloudCoverPercent: weather.currentWeather.cloudCoverPercent, weatherCode: weather.currentWeather.weatherCode,
      month, season: season(month), validationReason: release.join("+"), qualityScore: this.qualityScore(now, captured, weatherAt, weather.currentIrradianceWm2),
      modelVersion: this.model.version, schemaVersion: SCHEMA_VERSION, createdAtUtc: now.toISOString(), archived: false
    };
    if (this.database.insertCalibrationObservation(observation)) {
      this.acceptedSinceUpdate++; console.debug(`[Calibration] Messpunkt angenommen (${observation.validationReason}, PV=${pvW.toFixed(0)} W)`);
      const age=Date.now()-new Date(this.model.updatedAtUtc).getTime();
      if(this.acceptedSinceUpdate>=settings.calibration.minimumObservationCount||age>=settings.calibration.modelUpdateIntervalMinutes*60000)this.updateModel(settings);
    }
    return { accepted: true, reasons: release, observation };
  }

  updateModel(settings: AppSettings): CalibrationModel {
    if(this.updating)return this.model; this.updating=true;
    try {
    const observations = this.database.loadCalibrationObservations();
    if (!observations.length) { if(!this.model.validObservationCount){this.model = this.emptyModel(settings.pvSystem.installedPeakPowerWp);this.database.saveCalibrationModel(this.model);} return this.model; }
    const samples = observations.map(o => ({ o, f: o.actualPvPowerW / Math.max(1, this.physicalPower(settings, o.timestampUtc, o.irradianceWm2, null, o.temperatureC)) }))
      .filter(x => Number.isFinite(x.f) && x.f >= 0.2 && x.f <= 2);
    const center = median(samples.map(x => x.f));
    const mad = median(samples.map(x => Math.abs(x.f - center))) || 0.05;
    const robust = samples.filter(x => Math.abs(x.f - center) / mad <= settings.calibration.outlierThreshold);
    const weighted = (items: typeof robust): number => {
      let sum = 0, weights = 0;
      for (const x of items) { const ageDays = Math.max(0, (Date.now() - new Date(x.o.timestampUtc).getTime()) / 86400000); const w = x.o.qualityScore * Math.pow(0.5, ageDays / 180); sum += x.f * w; weights += w; }
      return weights ? sum / weights : center;
    };
    const rawGlobal = weighted(robust);
    const maxChange = settings.calibration.maximumModelChangePercent / 100;
    const previous = this.model.validObservationCount ? this.model.globalFactor : rawGlobal;
    const globalFactor = Math.max(previous * (1 - maxChange), Math.min(previous * (1 + maxChange), rawGlobal));
    const grouped = (key: (o: CalibrationObservation) => string): Record<string, number> => {
      const map = new Map<string, typeof robust>(); for (const x of robust) { const k = key(x.o); map.set(k, [...(map.get(k) ?? []), x]); }
      return Object.fromEntries([...map].map(([k, v]) => [k, v.length >= 5 ? weighted(v) / globalFactor : 1]));
    };
    const days = new Set(robust.map(x => x.o.timestampUtc.slice(0, 10))).size;
    const months = new Set(robust.map(x => x.o.month)).size;
    const hours = new Set(robust.map(x => new Date(x.o.timestampUtc).getHours())).size;
    const dispersion = mad / Math.max(center, 0.1);
    const confidenceValue = Math.max(0, Math.min(1, Math.min(1, robust.length / 200) * .35 + Math.min(1, days / 21) * .25 + Math.min(1, hours / 10) * .15 + Math.min(1, months / 4) * .15 + Math.max(0, 1 - dispersion) * .1));
    const level = robust.length < 20 || days < 2 ? "low" : confidenceValue >= .85 && months >= 3 ? "very_high" : confidenceValue >= .65 && days >= 14 ? "high" : "medium";
    this.model = {
      version: `${MODEL_VERSION}-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 17)}`, status: "active", globalFactor,
      factorsBySolarElevation: grouped(o => bucket(o.solarElevationDeg, 10)), factorsBySolarAzimuth: grouped(o => bucket(o.solarAzimuthDeg, 30)),
      factorsByHour: grouped(o => String(new Date(o.timestampUtc).getHours())), factorsByMonth: grouped(o => String(o.month)), factorsBySeason: grouped(o => o.season),
      factorsByWeather: grouped(o => String(o.weatherCode ?? "unknown")), factorsByIrradiance: grouped(o => bucket(o.irradianceWm2, 100)), factorsByArray: {}, shadingPeriods: [],
      estimatedEffectivePeakPowerW: Math.max(...robust.map(x => x.o.actualPvPowerW), 0) || null, configuredPeakPowerWp: settings.pvSystem.installedPeakPowerWp,
      confidence: { value: confidenceValue, level }, validObservationCount: robust.length, rejectedObservationCount: samples.length - robust.length,
      distinctDays: days, oldestObservationUtc: robust.at(-1)?.o.timestampUtc ?? null, newestObservationUtc: robust[0]?.o.timestampUtc ?? null,
      updatedAtUtc: new Date().toISOString(), recentMeanAbsolutePercentageError: dispersion
    };
    this.database.saveCalibrationModel(this.model);this.acceptedSinceUpdate=0; console.info(`[Calibration] Modell ${this.model.version} aktualisiert, Confidence ${level} (${confidenceValue.toFixed(2)})`); return this.model;
    } finally { this.updating=false; }
  }

  correctionFactor(timestampUtc: string, irradiance: number, lat=0, lon=0): number {
    const date = new Date(timestampUtc); const pos = this.solarPosition(date, lat, lon); const m = this.model;
    const local = [m.factorsByHour[String(date.getHours())], m.factorsByMonth[String(date.getMonth()+1)], m.factorsBySeason[season(date.getMonth()+1)], m.factorsByIrradiance[bucket(irradiance,100)], m.factorsBySolarElevation[bucket(pos.elevationDeg,10)]].filter(Number.isFinite);
    return m.globalFactor * (local.length ? local.reduce((a,b)=>a+b,0)/local.length : 1);
  }

  physicalPower(settings: AppSettings, timestampUtc: string, ghi: number, dni: number | null, temperatureC: number | null, dhi?: number | null): number {
    const date = new Date(timestampUtc); const p = this.solarPosition(date, settings.location.lat, settings.location.lon);
    const arrays = settings.pvSystem.arrays.length ? settings.pvSystem.arrays : [{ id:"fallback", name:"Fallback", peakPowerWp: settings.pvSystem.installedPeakPowerWp || 20000, azimuthDeg:180, tiltDeg:30, moduleCount:1,modulePowerWp:1,stringCount:1,knownShading:"" }];
    const estimatedDhi = dhi ?? ghi * .25; const estimatedDni = dni ?? Math.max(0, (ghi - estimatedDhi) / Math.max(.1, Math.sin(p.elevationDeg*Math.PI/180)));
    let power = arrays.reduce((sum, a) => sum + this.arrayPower(a, p, ghi, estimatedDni, estimatedDhi, temperatureC), 0);
    if (settings.pvSystem.inverterRatedPowerW > 0) power = Math.min(power, settings.pvSystem.inverterRatedPowerW); return Math.max(0, power);
  }

  private arrayPower(array: PvArraySettings, sun: {elevationDeg:number;azimuthDeg:number}, ghi:number,dni:number,dhi:number,temp:number|null): number {
    if (sun.elevationDeg <= 0) return 0; const rad=Math.PI/180, zen=(90-sun.elevationDeg)*rad, tilt=array.tiltDeg*rad;
    const incidence=Math.cos(zen)*Math.cos(tilt)+Math.sin(zen)*Math.sin(tilt)*Math.cos((sun.azimuthDeg-array.azimuthDeg)*rad);
    const poa=Math.max(0,dni*Math.max(0,incidence)+dhi*(1+Math.cos(tilt))/2+ghi*.2*(1-Math.cos(tilt))/2);
    const cellTemp=(temp ?? 25)+poa*.025; const tempFactor=Math.max(.75,1-.004*(cellTemp-25)); return array.peakPowerWp*(poa/1000)*tempFactor*.96;
  }

  private solarPosition(date: Date, lat: number, lon: number) { const p=SunCalc.getPosition(date,lat,lon); return { elevationDeg:p.altitude*180/Math.PI, azimuthDeg:(p.azimuth*180/Math.PI+180+360)%360 }; }
  private qualityScore(now:Date,a:Date,b:Date,irr:number) { const skew=Math.abs(a.getTime()-b.getTime())/1000; return Math.max(.2,Math.min(1,.55+Math.min(.25,irr/2000)+.2*Math.max(0,1-skew/120))); }
  private emptyModel(configuredPeakPowerWp:number): CalibrationModel { return { version:MODEL_VERSION,status:"needs_validation",globalFactor:1,factorsBySolarElevation:{},factorsBySolarAzimuth:{},factorsByHour:{},factorsByMonth:{},factorsBySeason:{},factorsByWeather:{},factorsByIrradiance:{},factorsByArray:{},shadingPeriods:[],estimatedEffectivePeakPowerW:null,configuredPeakPowerWp,confidence:{value:0,level:"low"},validObservationCount:0,rejectedObservationCount:0,distinctDays:0,oldestObservationUtc:null,newestObservationUtc:null,updatedAtUtc:new Date().toISOString(),recentMeanAbsolutePercentageError:null}; }
}
