import express from "express";
import path from "node:path";
import { z } from "zod";
import { ConfigStore } from "../config/configStore";
import { authenticateEasee, readEaseeConfig } from "../integrations/easee/easeeAuth";
import { EaseeClient } from "../integrations/easee/easeeClient";
import { GrowattLoggerClient } from "../integrations/growatt/growattClient";
import { MgClient } from "../integrations/mg/mgClient";
import { ChargingController } from "../services/chargingController";
import { AutomationService } from "../services/automationService";
import { PollingService } from "../services/pollingService";
import { WeatherService } from "../services/weatherService";
import { SettingsService } from "../config/settingsService";
import { AppDatabase } from "../db/database";
import { MAX_EASEE_CURRENT_AMPS, MIN_EASEE_CURRENT_AMPS } from "../config/chargingLimits";
import { calculateBucketEnergyKwh } from "../services/historyEnergyService";
import { PvCalibrationService } from "../services/pvCalibrationService";
import { CalibrationArchiveService } from "../services/calibrationArchiveService";

export function createApp(deps: {
  baseDir: string;
  database: AppDatabase;
  settingsService: SettingsService;
  pollingService: PollingService;
  growattClient: GrowattLoggerClient;
  easeeClient: EaseeClient;
  mgClient: MgClient;
  chargingController: ChargingController;
  automationService: AutomationService;
  weatherService: WeatherService;
  configStore: ConfigStore;
  calibrationService: PvCalibrationService;
  archiveService: CalibrationArchiveService;
}) {
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use(express.static(path.join(deps.baseDir, "src", "web")));

  function sanitizeSettings<T extends { mg?: { password?: string } }>(settings: T): T {
    return {
      ...settings,
      mg: settings.mg
        ? {
            ...settings.mg,
            password: ""
          }
        : settings.mg
    };
  }

  function mergeMgPassword<T extends { mg: { password: string } }>(next: T, current: T): T {
    if (next.mg.password.trim()) {
      return next;
    }
    return {
      ...next,
      mg: {
        ...next.mg,
        password: current.mg.password
      }
    };
  }

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/settings", async (_req, res) => {
    res.json(sanitizeSettings(await deps.settingsService.getSettings()));
  });

  app.put("/api/settings", async (req, res) => {
    const schema = z.object({
      growatt: z.object({
        loggerBaseUrl: z.string().url(),
        inverterHost: z.string().min(1),
        inverterPort: z.number().int().min(1).max(65535),
        unitId: z.number().int().min(1).max(247),
        pollIntervalSeconds: z.number().int().min(5).max(3600)
      }),
      easee: z.object({
        chargerId: z.string(),
        pollIntervalSeconds: z.number().int().min(5).max(3600),
        safeMode: z.boolean(),
        chargerEnabled: z.boolean()
      }),
      rules: z.object({
        enabled: z.boolean(),
        mode: z.enum(["pv_optimized", "manual_override"]),
        minSocPercent: z.number().min(0).max(100),
        maxBatteryDischargeWatts: z.number().min(0),
        maxGridImportWatts: z.number().min(0),
        maxChargePowerWatts: z.number().min(0),
        phaseMode: z.enum(["auto", "single", "three"]),
        minAmps: z.number().int().min(MIN_EASEE_CURRENT_AMPS).max(MAX_EASEE_CURRENT_AMPS),
        maxAmps: z.number().int().min(MIN_EASEE_CURRENT_AMPS).max(MAX_EASEE_CURRENT_AMPS),
        regulationIntervalSeconds: z.number().int().min(5).max(3600),
        holdSecondsAfterAdjustment: z.number().int().min(0).max(3600),
        upStepAmps: z.number().int().min(1).max(16),
        downStepAmps: z.number().int().min(1).max(16),
        manualOverrideEnabled: z.boolean(),
        manualOverrideAmps: z.number().int().min(MIN_EASEE_CURRENT_AMPS).max(MAX_EASEE_CURRENT_AMPS),
        targetVehicleSocPercent: z.number().min(0).max(100).nullable()
      }),
      mg: z.object({
        enabled: z.boolean(),
        apiBaseUrl: z.string(),
        username: z.string(),
        password: z.string(),
        vehicleId: z.string()
      }),
      location: z.object({
        lat: z.number().min(-90).max(90),
        lon: z.number().min(-180).max(180)
      }),
      weather: z.object({
        enabled: z.boolean(),
        targetBatterySocAtSunsetPercent: z.number().min(0).max(100),
        sunsetPreloadWindowMinutes: z.number().int().min(0).max(480)
      }),
      pvSystem: z.object({
        installedPeakPowerWp: z.number().min(0), inverterRatedPowerW: z.number().min(0),
        maximumBatteryChargePowerW: z.number().min(0), maximumBatteryDischargePowerW: z.number().min(0),
        arrays: z.array(z.object({ id:z.string().min(1),name:z.string().min(1),peakPowerWp:z.number().positive(),azimuthDeg:z.number().min(0).lt(360),tiltDeg:z.number().min(0).max(90),moduleCount:z.number().int().positive(),modulePowerWp:z.number().positive(),stringCount:z.number().int().positive(),knownShading:z.string() }))
      }),
      calibration: z.object({
        enabled:z.boolean(),rawRetentionDays:z.number().int().min(1),minimumIrradianceWm2:z.number().min(0),minimumPvPowerW:z.number().min(0),batteryPowerThresholdW:z.number().min(0),chargerPowerThresholdW:z.number().min(0),gridExportThresholdW:z.number().min(0),maximumDataAgeSeconds:z.number().int().min(1),maximumTimestampSkewSeconds:z.number().int().min(1),aggregationIntervalMinutes:z.number().int().min(1),modelUpdateIntervalMinutes:z.number().int().min(1),minimumObservationCount:z.number().int().min(1),archiveEnabled:z.boolean(),archiveDirectory:z.string().min(1).refine(value=>!path.isAbsolute(value)&&!value.split(/[\\/]/).includes(".."),"Archivpfad muss relativ und innerhalb des Datenverzeichnisses sein."),archiveFormat:z.literal("parquet"),archiveSchedule:z.string(),parquetCompression:z.enum(["SNAPPY","UNCOMPRESSED"]),outlierThreshold:z.number().positive(),maximumModelChangePercent:z.number().min(0).max(100)
      })
    });

    const parsed = schema.parse(req.body);
    const current = await deps.settingsService.getSettings();
    const next = mergeMgPassword(parsed, current);
    const validationErrors = deps.calibrationService.validateSystem(next);
    if (validationErrors.length) { res.status(400).json({ message: "PV-Anlagenkonfiguration ist unplausibel.", errors: validationErrors }); return; }
    await deps.settingsService.saveSettings(next);
    if (JSON.stringify(current.pvSystem) !== JSON.stringify(next.pvSystem)) deps.calibrationService.markNeedsValidation(next.pvSystem.installedPeakPowerWp);
    res.json({ success: true, settings: sanitizeSettings(next) });
  });

  app.get("/api/calibration/status", async (_req,res)=>{const settings=await deps.settingsService.getSettings();res.json({model:deps.calibrationService.getModel(),systemValidation:deps.calibrationService.validateSystem(settings),database:deps.database.getCalibrationStats()});});
  app.post("/api/calibration/model/update", async (_req,res)=>res.json(deps.calibrationService.updateModel(await deps.settingsService.getSettings())));
  app.post("/api/calibration/archive", async (_req,res)=>res.json(await deps.archiveService.runNow()));
  app.post("/api/calibration/model/rebuild", async (_req,res)=>res.json(await deps.archiveService.rebuildModelFromArchive()));

  app.get("/api/integrations/growatt/test", async (_req, res) => {
    const settings = await deps.settingsService.getSettings();
    const health = await deps.growattClient.checkHealth(settings);
    const overview = await deps.growattClient.fetchOverview(settings);
    res.json({ health, overview });
  });

  app.post("/api/integrations/easee/auth", async (req, res) => {
    const schema = z.object({
      userName: z.string().min(1),
      password: z.string().min(1),
      safeMode: z.boolean().optional()
    });
    const parsed = schema.parse(req.body);
    await authenticateEasee(deps.configStore, parsed);
    const chargers = await deps.easeeClient.listChargers();
    const settings = await deps.settingsService.getSettings();
    let selectedChargerId = settings.easee.chargerId;

    if (!selectedChargerId && chargers.length === 1) {
      selectedChargerId = chargers[0].id;
      await deps.settingsService.saveSettings({
        ...settings,
        easee: {
          ...settings.easee,
          chargerId: selectedChargerId
        }
      });
      await deps.pollingService.refreshNow();
    }

    res.json({ success: true, chargers, selectedChargerId });
  });

  app.get("/api/integrations/easee/status", async (_req, res) => {
    const config = await readEaseeConfig(deps.configStore);
    const settings = await deps.settingsService.getSettings();
    const chargers = config ? await deps.easeeClient.listChargers() : [];
    res.json({
      configured: Boolean(config),
      config,
      chargers,
      selectedChargerId: settings.easee.chargerId
    });
  });

  app.get("/api/integrations/easee/chargers", async (_req, res) => {
    const settings = await deps.settingsService.getSettings();
    const chargers = await deps.easeeClient.listChargers();
    res.json({
      chargers,
      selectedChargerId: settings.easee.chargerId
    });
  });

  app.post("/api/integrations/mg/auth", async (req, res) => {
    const schema = z.object({
      enabled: z.boolean(),
      apiBaseUrl: z.string(),
      username: z.string().min(1),
      password: z.string(),
      vehicleId: z.string()
    });
    const parsed = schema.parse(req.body);
    const settings = await deps.settingsService.getSettings();
    const nextSettings = mergeMgPassword({
      ...settings,
      mg: parsed
    }, settings);
    await deps.settingsService.saveSettings(nextSettings);
    const auth = await deps.mgClient.authenticate(nextSettings.mg);
    if (auth.vin && !parsed.vehicleId) {
      nextSettings.mg.vehicleId = auth.vin;
      await deps.settingsService.saveSettings(nextSettings);
    }
    res.json({ success: true, vin: auth.vin ?? parsed.vehicleId, warning: auth.warning });
  });

  app.get("/api/integrations/mg/status", async (_req, res) => {
    const settings = await deps.settingsService.getSettings();
    const status = await deps.mgClient.getVehicleStatus(settings);
    res.json(status ?? { configured: false });
  });

  app.post("/api/integrations/easee/select-charger", async (req, res) => {
    const schema = z.object({
      chargerId: z.string().min(1)
    });
    const parsed = schema.parse(req.body);
    const settings = await deps.settingsService.getSettings();
    await deps.settingsService.saveSettings({
      ...settings,
      easee: {
        ...settings.easee,
        chargerId: parsed.chargerId
      }
    });
    await deps.pollingService.refreshNow();
    res.json({
      success: true,
      chargerId: parsed.chargerId
    });
  });

  app.post("/api/polling/start", async (_req, res) => {
    await deps.pollingService.start();
    res.json(deps.pollingService.getStatus());
  });

  app.post("/api/polling/stop", (_req, res) => {
    deps.pollingService.stop();
    res.json(deps.pollingService.getStatus());
  });

  app.get("/api/polling/status", (_req, res) => {
    res.json(deps.pollingService.getStatus());
  });

  app.get("/api/dashboard", async (_req, res) => {
    const settings = await deps.settingsService.getSettings();
    const easeeConfig = await readEaseeConfig(deps.configStore);
    const latest = deps.pollingService.getLatestData();
    const growatt = latest.growatt ?? deps.database.listSnapshots("growatt", 1)[0]?.payload ?? null;
    const easee = latest.easee ?? deps.database.listSnapshots("easee", 1)[0]?.payload ?? null;
    const weather = await deps.weatherService.getContext(growatt as never).catch(() => null);
    const mg = await deps.mgClient.getVehicleStatus(settings).catch((error) => ({
      configured: settings.mg.enabled,
      error: error instanceof Error ? error.message : String(error)
    }));
    const mgStatus = mg && "status" in mg ? mg.status ?? null : null;
    const decision = deps.chargingController.evaluate(settings, growatt as never, easee as never, weather, mgStatus);

    res.json({
      status: deps.pollingService.getStatus(),
      settings: sanitizeSettings(settings),
      growatt,
      easee,
      mg,
      weather,
      automation: deps.automationService.getStatus(),
      easeeRuntime: easeeConfig ? {
        safeMode: easeeConfig.safeMode === true,
        authInvalid: easeeConfig.authInvalid === true,
        cooldownUntil: easeeConfig.cooldownUntil ?? null,
        consecutiveFailures: easeeConfig.consecutiveFailures ?? 0,
        lastErrorStatus: easeeConfig.lastErrorStatus ?? null,
        lastValidatedAt: easeeConfig.lastValidatedAt ?? null
      } : null,
      decision
    });
  });

  app.get("/api/snapshots", (req, res) => {
    const source = req.query.source === "growatt" || req.query.source === "easee" ? req.query.source : undefined;
    const limit = Number(req.query.limit ?? 100);
    res.json({
      rows: deps.database.listSnapshots(source, limit)
    });
  });

  app.get("/api/history", (req, res) => {
    const maxPoints = 300;
    let fromMs: number;
    let toMs: number;

    if (req.query.from && req.query.to) {
      fromMs = new Date(String(req.query.from)).getTime();
      toMs = new Date(String(req.query.to)).getTime();
      if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs >= toMs) {
        res.status(400).json({ message: "Ungültiger Zeitraum." });
        return;
      }
    } else {
      const hours = Math.min(720, Math.max(1, Number(req.query.hours ?? 12)));
      toMs = Date.now();
      fromMs = toMs - hours * 3600 * 1000;
    }

    const hours = (toMs - fromMs) / 3_600_000;
    const bucketMs = (toMs - fromMs) / maxPoints;
    const fromIso = new Date(fromMs).toISOString();

    function downsample<T extends { capturedAt: string }>(
      rows: T[],
      field: keyof T
    ): Array<{ t: string; v: number | null }> {
      const sums = new Float64Array(maxPoints);
      const counts = new Int32Array(maxPoints);
      for (const row of rows) {
        const idx = Math.floor((new Date(row.capturedAt).getTime() - fromMs) / bucketMs);
        if (idx >= 0 && idx < maxPoints) {
          const v = row[field] as unknown;
          if (typeof v === "number" && Number.isFinite(v)) {
            sums[idx] += v;
            counts[idx]++;
          }
        }
      }
      return Array.from({ length: maxPoints }, (_, i) => ({
        t: new Date(fromMs + i * bucketMs + bucketMs / 2).toISOString(),
        v: counts[i] > 0 ? sums[i] / counts[i] : null
      }));
    }

    const growatt = deps.database.queryHistoryGrowatt(fromIso);
    const easee = deps.database.queryHistoryEasee(fromIso);

    const pvPowerW = downsample(growatt, "pvPowerW");
    const chargingPowerW = downsample(easee, "powerW");

    res.json({
      timeRange: { from: fromIso, to: new Date(toMs).toISOString(), hours: Math.round(hours) },
      energyTotals: {
        pvProducedKwh: calculateBucketEnergyKwh(pvPowerW, bucketMs),
        vehicleChargedKwh: calculateBucketEnergyKwh(chargingPowerW, bucketMs)
      },
      pvPowerW,
      socPercent: downsample(growatt, "socPercent"),
      batteryChargeW: downsample(growatt, "chargeW"),
      batteryDischargeW: downsample(growatt, "dischargeW"),
      chargingPowerW,
      chargingCurrentA: downsample(easee, "currentA")
    });
  });

  app.post("/api/control/manual-charge", async (req, res) => {
    const schema = z.object({
      amps: z.number().int().min(MIN_EASEE_CURRENT_AMPS).max(MAX_EASEE_CURRENT_AMPS),
      targetSocPercent: z.number().min(0).max(100)
    });
    const { amps, targetSocPercent } = schema.parse(req.body);
    const settings = await deps.settingsService.getSettings();
    await deps.settingsService.saveSettings({
      ...settings,
      rules: {
        ...settings.rules,
        manualOverrideEnabled: true,
        manualOverrideAmps: amps,
        targetVehicleSocPercent: targetSocPercent
      }
    });
    const status = await deps.automationService.runNow();
    res.json({ success: true, amps, targetSocPercent, automation: status });
  });

  app.post("/api/control/manual-charge/stop", async (_req, res) => {
    const settings = await deps.settingsService.getSettings();
    await deps.settingsService.saveSettings({
      ...settings,
      rules: { ...settings.rules, manualOverrideEnabled: false }
    });
    if (settings.easee.chargerId) {
      await deps.easeeClient.pauseCharging(settings.easee.chargerId).catch(() => undefined);
    }
    const status = await deps.automationService.runNow();
    res.json({ success: true, automation: status });
  });

  app.post("/api/control/evaluate", async (_req, res) => {
    const status = await deps.automationService.runNow();
    const settings = await deps.settingsService.getSettings();
    const latest = deps.pollingService.getLatestData();
    const weather = await deps.weatherService.getContext(latest.growatt).catch(() => null);
    const mg = await deps.mgClient.getVehicleStatus(settings).catch(() => null);
    const decision = deps.chargingController.evaluate(settings, latest.growatt, latest.easee, weather, mg?.status ?? null);
    res.json({
      decision,
      automation: status
    });
  });

  app.post("/api/easee/command", async (req, res) => {
    const schema = z.discriminatedUnion("type", [
      z.object({ type: z.literal("start") }),
      z.object({ type: z.literal("stop") }),
      z.object({ type: z.literal("pause") }),
      z.object({ type: z.literal("setDynamicCurrent"), amps: z.number().int().min(MIN_EASEE_CURRENT_AMPS).max(MAX_EASEE_CURRENT_AMPS), minutes: z.number().int().min(0).max(1440).default(0) }),
      z.object({ type: z.literal("setPhaseMode"), phaseMode: z.union([z.literal(1), z.literal(2), z.literal(3)]) })
    ]);
    const parsed = schema.parse(req.body);
    const settings = await deps.settingsService.getSettings();
    if (!settings.easee.chargerId) {
      throw new Error("Keine Easee Charger-ID konfiguriert.");
    }

    if (!settings.easee.chargerEnabled && parsed.type !== "stop" && parsed.type !== "pause") {
      throw new Error("Wallbox ist derzeit deaktiviert.");
    }

    if (parsed.type === "start") {
      await deps.easeeClient.startCharging(settings.easee.chargerId);
    } else if (parsed.type === "stop") {
      await deps.easeeClient.stopCharging(settings.easee.chargerId);
    } else if (parsed.type === "pause") {
      await deps.easeeClient.pauseCharging(settings.easee.chargerId);
    } else if (parsed.type === "setDynamicCurrent") {
      await deps.easeeClient.setDynamicCurrent(settings.easee.chargerId, parsed.amps, parsed.minutes);
    } else if (parsed.type === "setPhaseMode") {
      await deps.easeeClient.setPhaseMode(settings.easee.chargerId, parsed.phaseMode);
    }

    res.json({
      success: true,
      message: "Easee-Befehl uebermittelt. Die Live-Daten werden mit dem naechsten Poll aktualisiert."
    });
  });

  app.post("/api/automation/enabled", async (req, res) => {
    const schema = z.object({ enabled: z.boolean() });
    const { enabled } = schema.parse(req.body);
    const settings = await deps.settingsService.getSettings();
    await deps.settingsService.saveSettings({
      ...settings,
      rules: { ...settings.rules, enabled }
    });
    res.json({ success: true, automationEnabled: enabled });
  });

  app.post("/api/charger/enabled", async (req, res) => {
    const schema = z.object({
      enabled: z.boolean()
    });
    const parsed = schema.parse(req.body);
    const settings = await deps.settingsService.getSettings();
    const nextSettings = {
      ...settings,
      easee: {
        ...settings.easee,
        chargerEnabled: parsed.enabled
      }
    };

    await deps.settingsService.saveSettings(nextSettings);

    if (!parsed.enabled && settings.easee.chargerId) {
      try {
        await deps.easeeClient.stopCharging(settings.easee.chargerId);
      } catch {
        // Keep the persisted disable state even if the immediate stop command fails.
      }
    }

    res.json({
      success: true,
      chargerEnabled: nextSettings.easee.chargerEnabled
    });
  });

  app.use((_req, res) => {
    res.sendFile(path.join(deps.baseDir, "src", "web", "index.html"));
  });

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message = error instanceof Error ? error.message : String(error);
    const status = error instanceof z.ZodError ? 400 : 500;
    if (status >= 500) {
      console.error(error);
    }
    res.status(status).json({ message });
  });

  return app;
}
