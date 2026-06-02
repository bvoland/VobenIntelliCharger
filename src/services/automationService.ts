import { AppDatabase } from "../db/database";
import { SettingsService } from "../config/settingsService";
import { EaseeClient } from "../integrations/easee/easeeClient";
import { MgClient } from "../integrations/mg/mgClient";
import { AutomationRuntimeStatus, ControlDecision, EaseeStatePayload, GrowattOverviewPayload } from "../types/domain";
import { ChargingController } from "./chargingController";
import { PollingService } from "./pollingService";
import { WeatherService } from "./weatherService";
import { MAX_EASEE_CURRENT_AMPS } from "../config/chargingLimits";

type PlannedAction =
  | { type: "none"; summary: string }
  | { type: "pause"; summary: string }
  | { type: "setPhaseMode"; phaseMode: 1 | 2 | 3; summary: string }
  | { type: "setDynamicCurrent"; amps: number; summary: string }
  | { type: "start"; summary: string };

export class AutomationService {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private lastEvaluatedAt: string | null = null;
  private lastActionAt: string | null = null;
  private lastAction: string | null = null;
  private lastError: string | null = null;
  private holdUntil: string | null = null;
  private state = "Noch keine Regelung ausgefuehrt";
  private lastDecision: ControlDecision | null = null;
  private lastRequestedPhaseMode: 1 | 2 | 3 | null = null;
  private lastRequestedAmps: number | null = null;

  constructor(
    private readonly settingsService: SettingsService,
    private readonly pollingService: PollingService,
    private readonly chargingController: ChargingController,
    private readonly easeeClient: EaseeClient,
    private readonly database: AppDatabase,
    private readonly weatherService: WeatherService,
    private readonly mgClient: MgClient
  ) {}

  async start(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    await this.tick();
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  async runNow(): Promise<AutomationRuntimeStatus> {
    await this.evaluateAndApply(true);
    return this.getStatus();
  }

  getStatus(): AutomationRuntimeStatus {
    return {
      running: this.running,
      state: this.state,
      lastEvaluatedAt: this.lastEvaluatedAt,
      lastActionAt: this.lastActionAt,
      lastAction: this.lastAction,
      holdUntil: this.holdUntil,
      lastError: this.lastError,
      desiredAmps: this.lastDecision?.suggestedAmps ?? null,
      desiredPhaseMode: this.lastDecision?.phaseMode ?? null,
      shouldCharge: this.lastDecision?.shouldCharge ?? null
    };
  }

  private async tick(): Promise<void> {
    if (!this.running) {
      return;
    }

    await this.evaluateAndApply(false);
    const settings = await this.settingsService.getSettings();
    const intervalMs = Math.max(5, settings.rules.regulationIntervalSeconds) * 1000;
    this.timer = setTimeout(() => void this.tick(), intervalMs);
  }

  private async evaluateAndApply(force: boolean): Promise<void> {
    const settings = await this.settingsService.getSettings();
    const latest = this.pollingService.getLatestData();
    const growatt = latest.growatt;
    const easee = latest.easee;
    const weather = await this.weatherService.getContext().catch(() => null);
    const mg = await this.mgClient.getVehicleStatus(settings).catch(() => null);
    const decision = this.chargingController.evaluate(settings, growatt, easee, weather, mg?.status ?? null);

    // Kalibrierung nur wenn Wechselrichter nicht gedrosselt wird:
    // Batterie lädt aktiv (PV hat freien Abfluss) ODER Auto lädt (PV-Strom wird direkt genutzt)
    const isFreePv =
      (growatt?.battery?.charge_power_w ?? 0) > 50 ||
      easee?.charging === true;
    this.weatherService.recordObservation(growatt?.live?.pv_total_power_w ?? 0, isFreePv);
    this.lastDecision = decision;
    this.lastEvaluatedAt = new Date().toISOString();

    const holdUntilMs = this.holdUntil ? new Date(this.holdUntil).getTime() : 0;
    if (!force && holdUntilMs > Date.now()) {
      this.state = `Haltezeit aktiv bis ${new Date(holdUntilMs).toLocaleTimeString("de-DE")}`;
      this.lastError = null;
      this.persistDecision(growatt, easee, weather, mg?.status ?? null, decision, "hold");
      return;
    }

    if (!settings.easee.chargerId) {
      this.state = "Keine Easee Charger-ID gesetzt";
      this.lastError = null;
      this.persistDecision(growatt, easee, weather, mg?.status ?? null, decision, "idle");
      return;
    }

    if (!growatt || !easee) {
      this.state = "Warte auf frische Growatt- und Easee-Daten";
      this.lastError = null;
      this.persistDecision(growatt, easee, weather, mg?.status ?? null, decision, "idle");
      return;
    }

    const action = this.planAction(settings, easee, decision);
    if (action.type === "none") {
      this.state = action.summary;
      this.lastError = null;
      this.persistDecision(growatt, easee, weather, mg?.status ?? null, decision, "idle");
      return;
    }

    try {
      await this.executeAction(settings.easee.chargerId, action);
      this.lastActionAt = new Date().toISOString();
      this.lastAction = action.summary;
      this.lastError = null;
      this.state = `Automatik aktiv: ${action.summary}`;
      const holdSeconds = Math.max(0, settings.rules.holdSecondsAfterAdjustment);
      this.holdUntil = holdSeconds > 0
        ? new Date(Date.now() + holdSeconds * 1000).toISOString()
        : null;
      this.persistDecision(growatt, easee, weather, mg?.status ?? null, decision, "applied", action.summary);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.lastError = message;
      this.state = "Automatikfehler";
      this.persistDecision(growatt, easee, weather, mg?.status ?? null, decision, "error", message);
    }
  }

  private planAction(
    settings: Awaited<ReturnType<SettingsService["getSettings"]>>,
    easee: EaseeStatePayload,
    decision: ControlDecision
  ): PlannedAction {
    const minimumChargeAmp = Math.max(7, settings.rules.minAmps);
    const desiredAmps = typeof decision.suggestedAmps === "number"
      ? Math.max(0, Math.min(MAX_EASEE_CURRENT_AMPS, settings.rules.maxAmps, decision.suggestedAmps))
      : null;
    const desiredPhaseMode = this.toEaseePhaseMode(decision.phaseMode);
    const actualDynamicCurrent = easee.dynamicChargerCurrentAmp ?? easee.outputCurrentAmp ?? 0;

    if (!decision.shouldCharge || desiredAmps == null || desiredAmps < minimumChargeAmp) {
      // Only stop an active session when a safety guard is active (SOC, grid etc.).
      // For passive reasons (outside PV window, no vehicle) we leave manually
      // started sessions untouched so the user can charge via the Easee app or
      // the "Jetzt laden" function without the automation immediately pausing.
      if (easee.charging && decision.guardActive) {
        return { type: "pause", summary: `Ladung pausieren: ${decision.reason}` };
      }
      return { type: "none", summary: `Automatik wartet: ${decision.reason}` };
    }

    if (this.lastRequestedPhaseMode !== desiredPhaseMode) {
      return {
        type: "setPhaseMode",
        phaseMode: desiredPhaseMode,
        summary: `Phasenmodus auf ${this.phaseModeLabel(desiredPhaseMode)} setzen`
      };
    }

    if (this.lastRequestedAmps !== desiredAmps || Math.round(actualDynamicCurrent) !== Math.round(desiredAmps)) {
      return {
        type: "setDynamicCurrent",
        amps: desiredAmps,
        summary: `Ladestrom auf ${desiredAmps} A setzen`
      };
    }

    // Only start when charger is in a startable state (2 = AwaitingStart, 6 = ReadyToCharge).
    // Mode 4 (Completed) means the vehicle finished on its own — don't restart.
    const startableMode = easee.chargerModeCode === 2 || easee.chargerModeCode === 6 || easee.chargerModeCode == null;
    if (!easee.charging && startableMode) {
      return { type: "start", summary: `Ladung starten: ${decision.reason}` };
    }

    const actualOutputCurrent = easee.outputCurrentAmp ?? 0;
    if (desiredAmps - actualOutputCurrent >= 1) {
      const allocatedCurrent = this.readAllocatedCurrent(easee);
      if (allocatedCurrent != null && desiredAmps - allocatedCurrent >= 1) {
        return {
          type: "none",
          summary: `Ziel ${desiredAmps} A gesetzt, aber Easee/Circuit gibt aktuell nur ${allocatedCurrent} A frei`
        };
      }

      return {
        type: "none",
        summary: `Ziel ${desiredAmps} A gesetzt, Fahrzeug zieht aktuell nur ${Math.round(actualOutputCurrent)} A`
      };
    }

    return { type: "none", summary: `Automatik stabil: ${decision.reason}` };
  }

  private async executeAction(chargerId: string, action: Exclude<PlannedAction, { type: "none" }>): Promise<void> {
    if (action.type === "pause") {
      await this.easeeClient.pauseCharging(chargerId);
      return;
    }

    if (action.type === "setPhaseMode") {
      await this.easeeClient.setPhaseMode(chargerId, action.phaseMode);
      this.lastRequestedPhaseMode = action.phaseMode;
      return;
    }

    if (action.type === "setDynamicCurrent") {
      await this.easeeClient.setDynamicCurrent(chargerId, action.amps, 0);
      this.lastRequestedAmps = action.amps;
      return;
    }

    await this.easeeClient.startCharging(chargerId);
  }

  private toEaseePhaseMode(phaseMode: ControlDecision["phaseMode"]): 1 | 2 | 3 {
    if (phaseMode === "single") {
      return 1;
    }
    if (phaseMode === "three") {
      return 3;
    }
    return 2;
  }

  private phaseModeLabel(phaseMode: 1 | 2 | 3): string {
    if (phaseMode === 1) {
      return "1 Phase";
    }
    if (phaseMode === 3) {
      return "3 Phasen";
    }
    return "Auto";
  }

  private readAllocatedCurrent(easee: EaseeStatePayload): number | null {
    const raw = (easee.raw as Record<string, unknown> | undefined) ?? {};
    const candidates = [
      raw.circuitTotalAllocatedPhaseConductorCurrentL1,
      raw.circuitTotalAllocatedPhaseConductorCurrentL2,
      raw.circuitTotalAllocatedPhaseConductorCurrentL3
    ]
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0);

    if (!candidates.length) {
      return null;
    }

    return Math.max(...candidates);
  }

  private persistDecision(
    growatt: GrowattOverviewPayload | null,
    easee: EaseeStatePayload | null,
    weather: import("../types/domain").WeatherContext | null,
    mg: import("../types/domain").MgVehicleStatusPayload | null,
    decision: ControlDecision,
    result: "idle" | "hold" | "applied" | "error",
    detail?: string
  ): void {
    this.database.insertControlDecision({
      createdAt: new Date().toISOString(),
      result,
      detail: detail ?? null,
      decision,
      automation: this.getStatus(),
      growatt,
      easee,
      weather,
      mg
    });
  }
}
