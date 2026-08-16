import path from "node:path";
import { createServer } from "node:http";
import { ConfigStore } from "./config/configStore";
import { SettingsService } from "./config/settingsService";
import { AppDatabase } from "./db/database";
import { EaseeClient } from "./integrations/easee/easeeClient";
import { GrowattLoggerClient } from "./integrations/growatt/growattClient";
import { createApp } from "./api/createApp";
import { SnapshotService } from "./services/snapshotService";
import { ChargingController } from "./services/chargingController";
import { PollingService } from "./services/pollingService";
import { EmbeddedGrowattService } from "./services/embeddedGrowattService";
import { EmbeddedMgService } from "./services/embeddedMgService";
import { AutomationService } from "./services/automationService";
import { WeatherService } from "./services/weatherService";
import { CleanupService } from "./services/cleanupService";
import { MgClient } from "./integrations/mg/mgClient";
import { PvCalibrationService } from "./services/pvCalibrationService";
import { CalibrationArchiveService } from "./services/calibrationArchiveService";

async function main(): Promise<void> {
  const baseDir = path.resolve(__dirname, "..");
  const dataDir = path.join(baseDir, "data");
  const configDir = path.join(baseDir, "config");

  const configStore = new ConfigStore(configDir);
  await configStore.ensure();
  const database = await AppDatabase.create(dataDir);
  const settingsService = new SettingsService(configStore);
  const embeddedGrowattService = new EmbeddedGrowattService(baseDir);
  await embeddedGrowattService.start();
  const embeddedMgService = new EmbeddedMgService(baseDir);
  await embeddedMgService.start();
  const growattClient = new GrowattLoggerClient(embeddedGrowattService.getBaseUrl());
  const easeeClient = new EaseeClient(configStore);
  const mgClient = new MgClient(embeddedMgService.getBaseUrl());
  const snapshotService = new SnapshotService(database);
  const cleanupService = new CleanupService(database);
  const chargingController = new ChargingController();
  const calibrationService = new PvCalibrationService(database);
  const weatherService = new WeatherService(settingsService, database, calibrationService);
  const archiveService = new CalibrationArchiveService(dataDir, settingsService, database, calibrationService);
  const pollingService = new PollingService(
    settingsService,
    growattClient,
    easeeClient,
    snapshotService
  );
  const automationService = new AutomationService(
    settingsService,
    pollingService,
    chargingController,
    easeeClient,
    database,
    weatherService,
    mgClient
  );

  const app = createApp({
    baseDir,
    database,
    settingsService,
    pollingService,
    growattClient,
    easeeClient,
    mgClient,
    chargingController,
    automationService,
    weatherService,
    calibrationService,
    archiveService,
    configStore
  });

  const port = Number(process.env.PORT ?? 8098);
  const host = process.env.HOST ?? "0.0.0.0";
  const server = createServer(app);
  process.on("SIGINT", () => {
    automationService.stop();
    pollingService.stop();
    cleanupService.stop();
    archiveService.stop();
    embeddedGrowattService.stop();
    embeddedMgService.stop();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    automationService.stop();
    pollingService.stop();
    cleanupService.stop();
    archiveService.stop();
    embeddedGrowattService.stop();
    embeddedMgService.stop();
    process.exit(0);
  });
  await pollingService.start();
  await automationService.start();
  cleanupService.start();
  archiveService.start();
  server.listen(port, host, () => {
    console.log(`VOBEN INTELLICHARGER listening on http://${host}:${port}`);
  });
}

void main();
