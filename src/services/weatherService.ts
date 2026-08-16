import SunCalc from "suncalc";
import { SettingsService } from "../config/settingsService";
import { AppDatabase } from "../db/database";
import { ForecastPoint, GrowattOverviewPayload, WeatherContext, SunTimes } from "../types/domain";
import { PvCalibrationService } from "./pvCalibrationService";

interface Series { time?: string[]; shortwave_radiation?: number[]; shortwave_radiation_instant?: number[]; direct_normal_irradiance?: number[]; diffuse_radiation?: number[]; temperature_2m?: number[]; cloud_cover?: number[]; weather_code?: number[] }
interface OpenMeteoResponse { timezone?: string; current?: { time?:string; shortwave_radiation_instant?:number; direct_normal_irradiance_instant?:number; diffuse_radiation_instant?:number; temperature_2m?:number; cloud_cover?:number; weather_code?:number }; minutely_15?: Series }
interface WeatherCache { fetchedAt:string; timezone:string; current:NonNullable<OpenMeteoResponse["current"]>|null; points:Array<{timestampUtc:string;ghi:number;dni:number|null;dhi:number|null;temperatureC:number|null;cloudCover:number|null;weatherCode:number|null}>; error:string|null }

export class WeatherService {
  private cache: WeatherCache | null = null;
  private readonly cacheMaxAgeMs = 15 * 60 * 1000;
  constructor(private readonly settingsService: SettingsService, private readonly database: AppDatabase, private readonly calibration: PvCalibrationService) {}

  recordObservation(growatt: GrowattOverviewPayload | null, easee: Parameters<PvCalibrationService["record"]>[2], weather: WeatherContext | null): void {
    void this.settingsService.getSettings().then(settings => this.calibration.record(settings, growatt, easee, weather)).catch(error => console.error("[Calibration]", error));
  }

  async getContext(growatt: GrowattOverviewPayload | null = null): Promise<WeatherContext | null> {
    const settings = await this.settingsService.getSettings(); const {lat,lon}=settings.location; if(lat===0&&lon===0)return null;
    const now=new Date(), sc=SunCalc.getTimes(now,lat,lon); const minutes=(sc.sunset.getTime()-now.getTime())/60000;
    const sunTimes:SunTimes={sunrise:sc.sunrise.toISOString(),sunset:sc.sunset.toISOString(),solarNoon:sc.solarNoon.toISOString(),isDay:now>=sc.sunrise&&now<=sc.sunset,minutesToSunset:Math.max(0,minutes)};
    if(settings.weather.enabled) await this.refreshIfNeeded(lat,lon);
    const model=this.calibration.getModel(); const loadW=growatt?.live?.estimated_load_power_w ?? 0;
    const phaseCount=settings.rules.phaseMode==="three"?3:1, minChargingW=Math.max(7,settings.rules.minAmps)*230*phaseCount;
    const forecasts:ForecastPoint[]=(this.cache?.points??[]).map((p,index)=>{
      const theoretical=this.calibration.physicalPower(settings,p.timestampUtc,p.ghi,p.dni,p.temperatureC,p.dhi);
      const correction=model.validObservationCount>=settings.calibration.minimumObservationCount?this.calibration.correctionFactor(p.timestampUtc,p.ghi,lat,lon):1;
      const predicted=Math.min(settings.pvSystem.inverterRatedPowerW||Infinity,theoretical*correction); const confidence=model.confidence.value;
      const uncertainty=.12+(1-confidence)*.38, usable=Math.max(0,predicted-loadW); const durationHours=index+1<this.cache!.points.length?(new Date(this.cache!.points[index+1].timestampUtc).getTime()-new Date(p.timestampUtc).getTime())/3600000:.25;
      return {timestampUtc:p.timestampUtc,hour:new Date(p.timestampUtc).getHours(),irradianceWm2:p.ghi,theoreticalPvW:Math.round(theoretical),predictedPvW:Math.round(predicted),predictedEnergyWh:Math.round(predicted*durationHours),usableSurplusW:Math.round(usable),lowerBoundW:Math.round(predicted*(1-uncertainty)),upperBoundW:Math.round(predicted*(1+uncertainty)),correctionFactor:correction,confidence,modelVersion:model.version,hasDataGap:!Number.isFinite(p.ghi),isChargingWindow:usable>=minChargingW};
    });
    // Mark the best contiguous energy windows, rather than every high-radiation point.
    const candidates=forecasts.map((p,i)=>({i,energy:forecasts.slice(i,i+4).reduce((n,x)=>n+(x.confidence<.5?Math.max(0,x.lowerBoundW-loadW):x.usableSurplusW)*.25,0)})).sort((a,b)=>b.energy-a.energy).slice(0,8);
    const chosen=new Set(candidates.filter(x=>x.energy>=minChargingW).flatMap(x=>[x.i,x.i+1,x.i+2,x.i+3])); forecasts.forEach((p,i)=>p.isChargingWindow=chosen.has(i));
    const current=this.cache?.current??null; const currentIrr=current?.shortwave_radiation_instant??this.nearest(now)?.ghi??null;
    const today=this.localDateKey(now), tomorrow=this.localDateKey(new Date(now.getTime()+86400000));
    return {sunTimes,currentIrradianceWm2:currentIrr,forecast2hIrradianceWm2:this.averageNext(now,8),dailyForecast:forecasts,calibrationFactor:model.globalFactor,calibrationSamples:model.validObservationCount,model,todayEnergyWh:forecasts.filter(p=>this.localDateKey(new Date(p.timestampUtc))===today&&new Date(p.timestampUtc)>=now).reduce((n,p)=>n+p.predictedEnergyWh,0),tomorrowEnergyWh:forecasts.filter(p=>this.localDateKey(new Date(p.timestampUtc))===tomorrow).reduce((n,p)=>n+p.predictedEnergyWh,0),expectedMaximumPvW:Math.max(0,...forecasts.map(p=>p.predictedPvW)),currentWeather:current?{timestampUtc:this.utcDate(current.time,now).toISOString(),temperatureC:current.temperature_2m??null,cloudCoverPercent:current.cloud_cover??null,weatherCode:current.weather_code??null,directNormalIrradianceWm2:current.direct_normal_irradiance_instant??null,diffuseRadiationWm2:current.diffuse_radiation_instant??null}:null,fetchedAt:this.cache?.fetchedAt??now.toISOString(),fetchError:this.cache?.error??null};
  }

  private nearest(now:Date){return this.cache?.points.reduce((a,b)=>Math.abs(new Date(a.timestampUtc).getTime()-now.getTime())<Math.abs(new Date(b.timestampUtc).getTime()-now.getTime())?a:b);}
  private utcDate(value:string|undefined,fallback:Date){return value?new Date(value.endsWith("Z")?value:`${value}Z`):fallback;}
  private localDateKey(date:Date){const parts=new Intl.DateTimeFormat("en-CA",{year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);const get=(type:string)=>parts.find(p=>p.type===type)?.value;return `${get("year")}-${get("month")}-${get("day")}`;}
  private averageNext(now:Date,count:number){const p=(this.cache?.points??[]).filter(x=>new Date(x.timestampUtc)>=now).slice(0,count);return p.length?p.reduce((n,x)=>n+x.ghi,0)/p.length:null;}
  private async refreshIfNeeded(lat:number,lon:number){const age=this.cache?Date.now()-new Date(this.cache.fetchedAt).getTime():Infinity;if(age<this.cacheMaxAgeMs)return;
    try {const params=new URLSearchParams({latitude:String(lat),longitude:String(lon),current:"shortwave_radiation_instant,direct_normal_irradiance_instant,diffuse_radiation_instant,temperature_2m,cloud_cover,weather_code",minutely_15:"shortwave_radiation,direct_normal_irradiance,diffuse_radiation,temperature_2m,cloud_cover,weather_code",forecast_days:"2",timezone:"UTC"});const response=await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);if(!response.ok)throw new Error(`Open-Meteo HTTP ${response.status}`);const data=await response.json() as OpenMeteoResponse;const s=data.minutely_15??{};const points=(s.time??[]).map((time,i)=>({timestampUtc:new Date(`${time}Z`).toISOString(),ghi:s.shortwave_radiation?.[i]??NaN,dni:s.direct_normal_irradiance?.[i]??null,dhi:s.diffuse_radiation?.[i]??null,temperatureC:s.temperature_2m?.[i]??null,cloudCover:s.cloud_cover?.[i]??null,weatherCode:s.weather_code?.[i]??null}));this.cache={fetchedAt:new Date().toISOString(),timezone:data.timezone??"UTC",current:data.current??null,points,error:null};this.database.insertWeatherFetch(lat,lon,points.map(p=>p.ghi));}
    catch(error){this.cache={fetchedAt:new Date().toISOString(),timezone:"UTC",current:null,points:[],error:error instanceof Error?error.message:String(error)};}}
}
