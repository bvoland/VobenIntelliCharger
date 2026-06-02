import SunCalc from "suncalc";
import { SettingsService } from "../config/settingsService";
import { AppDatabase } from "../db/database";
import { AppSettings, ForecastPoint, WeatherContext, SunTimes } from "../types/domain";

interface OpenMeteoResponse {
  hourly?: {
    time?: string[];
    shortwave_radiation?: number[];
  };
}

interface IrradianceCache {
  fetchedAt: string;
  hourly: number[] | null;
  error: string | null;
}

export class WeatherService {
  private irradianceCache: IrradianceCache | null = null;
  private readonly cacheMaxAgeMs = 60 * 60 * 1000;

  private calibrationBuffer: number[] = [];
  private readonly maxCalibrationSamples = 120;

  constructor(
    private readonly settingsService: SettingsService,
    private readonly database: AppDatabase
  ) {
    // Restore calibration buffer from DB so learning survives restarts
    this.calibrationBuffer = this.database.loadCalibrationSamples(this.maxCalibrationSamples);
  }

  // Call every poll tick. Only records when PV is running freely (not throttled by zero-export).
  // isFreePv = true when battery is actively charging OR car is charging.
  recordObservation(pvPowerW: number, isFreePv: boolean): void {
    if (!isFreePv || pvPowerW < 100) return;
    const irradiance = this.getCurrentIrradianceWm2();
    if (irradiance == null || irradiance < 50) return;
    this.calibrationBuffer.push(pvPowerW / irradiance);
    if (this.calibrationBuffer.length > this.maxCalibrationSamples) {
      this.calibrationBuffer.shift();
    }
    this.database.insertCalibrationSample(pvPowerW, irradiance);
  }

  async getContext(): Promise<WeatherContext | null> {
    const settings = await this.settingsService.getSettings();
    const { lat, lon } = settings.location;

    if (lat === 0 && lon === 0) return null;

    const now = new Date();
    const sc = SunCalc.getTimes(now, lat, lon);
    const minutesToSunset = (sc.sunset.getTime() - now.getTime()) / 60_000;

    const sunTimes: SunTimes = {
      sunrise: sc.sunrise.toISOString(),
      sunset: sc.sunset.toISOString(),
      solarNoon: sc.solarNoon.toISOString(),
      isDay: now >= sc.sunrise && now <= sc.sunset,
      minutesToSunset: Math.max(0, minutesToSunset)
    };

    if (settings.weather.enabled) {
      await this.refreshIfNeeded(lat, lon);
    }

    const irradiance = this.extractCurrentIrradiance();
    const calibrationFactor = this.getCalibrationFactor();
    const dailyForecast = this.buildDailyForecast(settings, calibrationFactor);

    return {
      sunTimes,
      currentIrradianceWm2: irradiance?.current ?? null,
      forecast2hIrradianceWm2: irradiance?.forecast2h ?? null,
      dailyForecast,
      calibrationFactor,
      calibrationSamples: this.calibrationBuffer.length,
      fetchedAt: now.toISOString(),
      fetchError: this.irradianceCache?.error ?? null
    };
  }

  private getCalibrationFactor(): number | null {
    if (this.calibrationBuffer.length < 5) return null;
    const sorted = [...this.calibrationBuffer].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  private buildDailyForecast(settings: AppSettings, factor: number | null): ForecastPoint[] {
    if (!this.irradianceCache?.hourly) return [];
    const phaseCount = settings.rules.phaseMode === "three" ? 3 : 1;
    const minChargingW = Math.max(7, settings.rules.minAmps) * 230 * phaseCount;
    // When not yet calibrated use 20 W/(W/m²) as conservative fallback so the
    // charging window is visible from day one (calibrated orange line appears later).
    const windowFactor = factor ?? 20;
    return this.irradianceCache.hourly.map((irradianceWm2, hour) => {
      const predictedPvW = factor != null ? Math.round(factor * irradianceWm2) : null;
      const estimatedPvW = Math.round(windowFactor * irradianceWm2);
      return {
        hour,
        irradianceWm2,
        predictedPvW,
        isChargingWindow: estimatedPvW >= minChargingW && irradianceWm2 > 30
      };
    });
  }

  private getCurrentIrradianceWm2(): number | null {
    if (!this.irradianceCache?.hourly) return null;
    const h = new Date().getHours();
    return this.irradianceCache.hourly[h] ?? null;
  }

  private async refreshIfNeeded(lat: number, lon: number): Promise<void> {
    const age = this.irradianceCache
      ? Date.now() - new Date(this.irradianceCache.fetchedAt).getTime()
      : Infinity;
    if (age < this.cacheMaxAgeMs) return;

    try {
      const url =
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${lat}&longitude=${lon}` +
        `&hourly=shortwave_radiation&forecast_days=1&timezone=auto`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Open-Meteo HTTP ${response.status}`);
      const data = (await response.json()) as OpenMeteoResponse;
      const hourly = data.hourly?.shortwave_radiation ?? null;
      this.irradianceCache = {
        fetchedAt: new Date().toISOString(),
        hourly,
        error: null
      };
      if (hourly) {
        this.database.insertWeatherFetch(lat, lon, hourly);
      }
    } catch (error) {
      this.irradianceCache = {
        fetchedAt: new Date().toISOString(),
        hourly: null,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private extractCurrentIrradiance(): { current: number; forecast2h: number } | null {
    if (!this.irradianceCache?.hourly) return null;
    const h = new Date().getHours();
    const hourly = this.irradianceCache.hourly;
    return {
      current: hourly[h] ?? 0,
      forecast2h: ((hourly[h + 1] ?? 0) + (hourly[h + 2] ?? 0)) / 2
    };
  }
}
