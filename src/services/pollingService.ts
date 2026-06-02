import { SettingsService } from "../config/settingsService";
import { EaseeClient } from "../integrations/easee/easeeClient";
import { GrowattLoggerClient } from "../integrations/growatt/growattClient";
import { SnapshotService } from "./snapshotService";
import { EaseeStatePayload, GrowattOverviewPayload } from "../types/domain";

export class PollingService {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private lastGrowatt: GrowattOverviewPayload | null = null;
  private lastEasee: EaseeStatePayload | null = null;
  private lastEaseeCapturedAt: string | null = null;
  private lastError: string | null = null;

  constructor(
    private readonly settingsService: SettingsService,
    private readonly growattClient: GrowattLoggerClient,
    private readonly easeeClient: EaseeClient,
    private readonly snapshotService: SnapshotService
  ) {}

  getStatus() {
    return {
      running: this.running,
      lastError: this.lastError,
      lastGrowatt: this.lastGrowatt?.captured_at_local ?? this.lastGrowatt?.captured_at ?? null,
      lastEasee: this.lastEaseeCapturedAt
    };
  }

  getLatestData(): { growatt: GrowattOverviewPayload | null; easee: EaseeStatePayload | null } {
    return {
      growatt: this.lastGrowatt,
      easee: this.lastEasee
    };
  }

  async start(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    await this.tick();
  }

  async refreshNow(): Promise<void> {
    if (!this.running) {
      await this.performPoll();
      return;
    }

    await this.performPoll();
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  async tick(): Promise<void> {
    if (!this.running) {
      return;
    }

    await this.performPoll();
    const settings = await this.settingsService.getSettings();
    const intervalSeconds = Math.max(5, Math.min(
      settings.growatt.pollIntervalSeconds,
      settings.easee.pollIntervalSeconds || 15
    ));
    this.timer = setTimeout(() => void this.tick(), intervalSeconds * 1000);
  }

  private async performPoll(): Promise<void> {
    const settings = await this.settingsService.getSettings();
    try {
      const growatt = await this.growattClient.fetchOverview(settings);
      this.lastGrowatt = growatt;
      this.snapshotService.storeGrowattSnapshot(growatt);

      if (settings.easee.chargerId) {
        const state = await this.easeeClient.getChargerState(settings.easee.chargerId);

        this.lastEasee = {
          chargerId: settings.easee.chargerId,
          online: Boolean(state.isOnline ?? state.connectedToCloud ?? true),
          charging: state.chargerOpMode === 3,
          chargerModeCode: state.chargerOpMode,
          totalPowerWatts: this.normalizeEaseePowerWatts(state.totalPower),
          outputCurrentAmp: state.outputCurrent,
          dynamicChargerCurrentAmp: state.dynamicChargerCurrent,
          voltage: state.voltage,
          smartCharging: state.smartCharging,
          reasonForNoCurrent: state.reasonForNoCurrent,
          sessionEnergyKwh: state.sessionEnergy,
          lifetimeEnergyKwh: state.lifetimeEnergy,
          raw: state
        };
        this.lastEaseeCapturedAt = new Date().toISOString();
        this.snapshotService.storeEaseeSnapshot(this.lastEasee);
      }

      this.lastError = null;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
    }
  }

  private normalizeEaseePowerWatts(totalPower: number | undefined): number | undefined {
    if (typeof totalPower !== "number" || Number.isNaN(totalPower)) {
      return undefined;
    }

    // Easee observation 120 "TOTAL POWER" is documented in kW.
    return totalPower * 1000;
  }
}
