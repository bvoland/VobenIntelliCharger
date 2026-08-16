import { AppSettings, ControlDecision, EaseeStatePayload, GrowattOverviewPayload, MgVehicleStatusPayload, WeatherContext } from "../types/domain";
import { MAX_EASEE_CURRENT_AMPS } from "../config/chargingLimits";

export class ChargingController {
  evaluate(
    settings: AppSettings,
    growatt: GrowattOverviewPayload | null,
    easee: EaseeStatePayload | null,
    weather: WeatherContext | null = null,
    mg: MgVehicleStatusPayload | null = null
  ): ControlDecision {
    const notes: string[] = [];
    const rules = settings.rules;
    const configuredPhaseMode = rules.phaseMode === "single" ? "single" : rules.phaseMode === "three" ? "three" : "auto";
    const minimumChargeAmp = Math.max(7, rules.minAmps);

    if (!settings.easee.chargerEnabled) {
      return {
        reason: "Charger deaktiviert",
        suggestedAmps: 0,
        phaseMode: configuredPhaseMode,
        shouldCharge: false,
        guardActive: true,
        notes: ["Wallbox ist manuell deaktiviert."]
      };
    }

    if (!rules.enabled) {
      return {
        reason: "Regelung deaktiviert",
        suggestedAmps: null,
        phaseMode: configuredPhaseMode,
        shouldCharge: false,
        guardActive: false,
        notes: ["Automatik ist ausgeschaltet."]
      };
    }

    if (mg?.socPercent != null && rules.targetVehicleSocPercent != null && mg.socPercent >= rules.targetVehicleSocPercent) {
      return {
        reason: "Ziel-Fahrzeug-SOC erreicht",
        suggestedAmps: 0,
        phaseMode: configuredPhaseMode,
        shouldCharge: false,
        guardActive: true,
        notes: [`MG meldet ${mg.socPercent.toFixed(1)}% SOC, Ziel ist ${rules.targetVehicleSocPercent}%.`]
      };
    }

    if (rules.manualOverrideEnabled || rules.mode === "manual_override") {
      return {
        reason: "Manueller Override aktiv",
        suggestedAmps: rules.manualOverrideAmps,
        phaseMode: configuredPhaseMode,
        shouldCharge: true,
        guardActive: false,
        notes: ["Ladestrom wird erzwungen."]
      };
    }

    if (!growatt) {
      return {
        reason: "Keine Growatt-Daten",
        suggestedAmps: 0,
        phaseMode: configuredPhaseMode,
        shouldCharge: false,
        guardActive: true,
        notes: ["Die Automatik wartet auf frische PV- und Batteriedaten."]
      };
    }

    if (!easee) {
      return {
        reason: "Keine Easee-Daten",
        suggestedAmps: 0,
        phaseMode: configuredPhaseMode,
        shouldCharge: false,
        guardActive: true,
        notes: ["Die Automatik wartet auf frische Wallbox-Daten."]
      };
    }

    if (easee.chargerModeCode === 1) {
      return {
        reason: "Kein Fahrzeug verbunden",
        suggestedAmps: 0,
        phaseMode: configuredPhaseMode,
        shouldCharge: false,
        guardActive: false,
        notes: ["Die Wallbox meldet kein angeschlossenes Fahrzeug."]
      };
    }

    if (easee.chargerModeCode === 4) {
      return {
        reason: "Fahrzeug vollstaendig geladen",
        suggestedAmps: 0,
        phaseMode: configuredPhaseMode,
        shouldCharge: false,
        guardActive: false,
        notes: ["Das Fahrzeug hat die Ladung abgeschlossen und nimmt keinen Strom mehr an."]
      };
    }

    if (settings.weather.enabled && weather?.dailyForecast?.length) {
      const now = Date.now();
      const currentPoint = weather.dailyForecast.find((p) => new Date(p.timestampUtc).getTime() >= now - 15 * 60_000);
      if (currentPoint && !currentPoint.isChargingWindow) {
        return {
          reason: "Ausserhalb des PV-Ladefensters",
          suggestedAmps: 0,
          phaseMode: configuredPhaseMode,
          shouldCharge: false,
          guardActive: false,
          notes: [
            "Fuer diese Stunde wird kein ausreichendes PV-Potenzial erwartet.",
            "Manuell starten ueber die Easee-App oder 'Jetzt laden' im Dashboard."
          ]
        };
      }
    }

    const batterySoc = (growatt?.battery?.bms_soc_percent ?? 0) * 100;
    const discharge = growatt?.battery?.discharge_power_w ?? 0;
    const chargeW = growatt?.battery?.charge_power_w ?? 0;
    const batteryFull = batterySoc >= 99 && (growatt?.battery?.bms_status === 4 || growatt?.battery?.flow_state === "idle");
    const curtailedPvSurplusW = this.estimateCurtailedPvSurplus(growatt, weather, batteryFull);
    const importPower = growatt?.live?.estimated_import_from_grid_w ?? 0;
    // When not actively charging use 0 so the ramp starts from a clean baseline.
    const currentAmp = easee.charging ? (easee.outputCurrentAmp ?? 0) : 0;
    const startFromCurtailmentW = currentAmp <= 0 && !easee.charging ? curtailedPvSurplusW : 0;
    const assumedPhaseCount = configuredPhaseMode === "three"
      ? 3
      : configuredPhaseMode === "single"
        ? 1
        : this.derivePhaseCount(easee) === 3 ? 3 : 1;
    const stabilityMarginW = this.resolveStabilityMarginW(assumedPhaseCount, rules.upStepAmps, rules.downStepAmps);
    const dischargeTargetW = this.resolveSoftTarget(rules.maxBatteryDischargeWatts, stabilityMarginW);
    const importTargetW = this.resolveSoftTarget(rules.maxGridImportWatts, stabilityMarginW);
    const dischargeHeadroomW = Math.max(0, dischargeTargetW - discharge);
    const importHeadroomW = Math.max(0, importTargetW - importPower);
    const availableSurplusW = Math.max(
      0,
      chargeW + dischargeHeadroomW + importHeadroomW,
      startFromCurtailmentW + dischargeHeadroomW + importHeadroomW
    );
    const phaseMode = this.resolveTargetPhaseMode(
      configuredPhaseMode,
      availableSurplusW,
      currentAmp,
      easee,
      minimumChargeAmp,
      discharge,
      rules.maxBatteryDischargeWatts,
      importPower,
      rules.maxGridImportWatts
    );
    const estimatedPhaseCount = phaseMode === "three"
      ? 3
      : 1;
    const maxAmpsByPower = this.resolveMaxAmpsByPower(rules.maxChargePowerWatts, estimatedPhaseCount);
    const effectiveMaxAmps = Math.max(minimumChargeAmp, Math.min(MAX_EASEE_CURRENT_AMPS, rules.maxAmps, maxAmpsByPower ?? rules.maxAmps));

    if (maxAmpsByPower != null && maxAmpsByPower < minimumChargeAmp) {
      notes.push(`Max. Ladeleistung ${rules.maxChargePowerWatts} W reicht fuer weniger als ${minimumChargeAmp} A.`);
      return {
        reason: "Leistungsgrenze zu niedrig",
        suggestedAmps: 0,
        phaseMode,
        shouldCharge: false,
        guardActive: true,
        notes
      };
    }

    if (batterySoc < rules.minSocPercent) {
      notes.push(`SOC ${batterySoc.toFixed(1)}% liegt unter Reserve ${rules.minSocPercent}%.`);
      return {
        reason: "Batteriereserve schuetzen",
        suggestedAmps: 0,
        phaseMode,
        shouldCharge: false,
        guardActive: true,
        notes
      };
    }

    if (weather?.sunTimes && weather.sunTimes.minutesToSunset > 0) {
      const { minutesToSunset } = weather.sunTimes;
      const { targetBatterySocAtSunsetPercent, sunsetPreloadWindowMinutes } = settings.weather;
      if (minutesToSunset < sunsetPreloadWindowMinutes && batterySoc < targetBatterySocAtSunsetPercent) {
        notes.push(`SOC ${batterySoc.toFixed(1)}% unter Zielvorgabe ${targetBatterySocAtSunsetPercent}% — noch ${Math.round(minutesToSunset)} min bis Sonnenuntergang.`);
        return {
          reason: "Batterie-Vorladen vor Sonnenuntergang",
          suggestedAmps: 0,
          phaseMode,
          shouldCharge: false,
          guardActive: true,
          notes
        };
      }
    }

    const wattsPerAmp = 230 * estimatedPhaseCount;

    if (importPower > rules.maxGridImportWatts) {
      const overshoot = importPower - rules.maxGridImportWatts;
      const next = this.proportionalDown(currentAmp, minimumChargeAmp, overshoot, wattsPerAmp, rules.downStepAmps);
      notes.push(`Netzimport ${importPower.toFixed(0)} W > ${rules.maxGridImportWatts} W → reduziere um ${(currentAmp - next).toFixed(0)} A.`);
      return { reason: "Netzimport begrenzen", suggestedAmps: next, phaseMode, shouldCharge: true, guardActive: true, notes };
    }

    if (discharge > rules.maxBatteryDischargeWatts) {
      const overshoot = discharge - rules.maxBatteryDischargeWatts;
      const next = this.proportionalDown(currentAmp, minimumChargeAmp, overshoot, wattsPerAmp, rules.downStepAmps);
      notes.push(`Batterieentladung ${discharge.toFixed(0)} W > ${rules.maxBatteryDischargeWatts} W → reduziere um ${(currentAmp - next).toFixed(0)} A.`);
      return { reason: "Batterieentladung begrenzen", suggestedAmps: next, phaseMode, shouldCharge: true, guardActive: true, notes };
    }

    const inDischargeCorridor = discharge > dischargeTargetW && discharge <= rules.maxBatteryDischargeWatts;
    const inImportCorridor = importPower > importTargetW && importPower <= rules.maxGridImportWatts;
    if (currentAmp > 0 && (inDischargeCorridor || inImportCorridor)) {
      if (inDischargeCorridor) {
        notes.push(`Batterieentladung ${discharge.toFixed(0)} W liegt im Toleranzkorridor ${dischargeTargetW.toFixed(0)}-${rules.maxBatteryDischargeWatts} W → halte Ladestrom stabil.`);
      }
      if (inImportCorridor) {
        notes.push(`Netzimport ${importPower.toFixed(0)} W liegt im Toleranzkorridor ${importTargetW.toFixed(0)}-${rules.maxGridImportWatts} W → halte Ladestrom stabil.`);
      }
      return {
        reason: "Regelkorridor halten",
        suggestedAmps: Math.max(minimumChargeAmp, currentAmp),
        phaseMode,
        shouldCharge: true,
        guardActive: false,
        notes
      };
    }

    // PV-Fenster: proportional hochregeln auf Basis von realem Batterie-Laden
    // plus dem konfigurierten Restspielraum fuer Batterieentladung/Netzbezug.
    const suggestedAmps = this.proportionalUp(currentAmp, minimumChargeAmp, effectiveMaxAmps, availableSurplusW, wattsPerAmp, rules.upStepAmps);
    const stepTaken = suggestedAmps - Math.max(currentAmp, minimumChargeAmp);
    notes.push("Keine Schutzgrenze verletzt.");
    if (suggestedAmps === 0) {
      notes.push(`Verfuegbarer Regelspielraum ${availableSurplusW.toFixed(0)} W reicht noch nicht fuer ${minimumChargeAmp} A bei ${estimatedPhaseCount} Phase(n).`);
    } else if (chargeW > 50 && stepTaken > 0) {
      notes.push(`Batterie nimmt ${chargeW.toFixed(0)} W auf, zusaetzlicher Spielraum Batterie/Netz ${Math.round(dischargeHeadroomW + importHeadroomW)} W → Schritt +${stepTaken.toFixed(0)} A.`);
    } else if ((dischargeHeadroomW > 50 || importHeadroomW > 50) && stepTaken > 0) {
      notes.push(`Nutze konfigurierten Spielraum: Batterie ${Math.round(dischargeHeadroomW)} W, Netz ${Math.round(importHeadroomW)} W → Schritt +${stepTaken.toFixed(0)} A.`);
    } else if (startFromCurtailmentW > 50) {
      notes.push(`Batterie voll/abgeregelt, PV-Potenzial ca. ${startFromCurtailmentW.toFixed(0)} W plus Batterie/Netz-Spielraum → starte mit ${suggestedAmps} A.`);
    }
    if (maxAmpsByPower != null && maxAmpsByPower < rules.maxAmps) {
      notes.push(`Leistungsgrenze deckelt auf max. ${effectiveMaxAmps} A.`);
    }
    return { reason: "PV-Fenster nutzen", suggestedAmps, phaseMode, shouldCharge: true, guardActive: false, notes };
  }

  // Reduziert proportional zum Überschuss: ceil(overshootW / wattsPerAmp), mindestens minStep.
  private proportionalDown(currentAmp: number, minimumChargeAmp: number, overshootW: number, wattsPerAmp: number, minStep: number): number {
    const step = Math.max(Math.ceil(overshootW / wattsPerAmp), minStep);
    if (currentAmp <= minimumChargeAmp) return 0;
    const next = currentAmp - step;
    return next < minimumChargeAmp ? 0 : next;
  }

  // Erhoeht proportional zum Batterie-Ueberschuss: floor(chargeW / wattsPerAmp), mindestens minStep.
  // Beim Kaltstart zaehlt nur die verfuegbare Kapazitaet; minAmps werden nicht extra
  // addiert, weil das bei 3-phasigem Auto-Modus sofort zu Batterieentladung fuehrt.
  private proportionalUp(currentAmp: number, minimumChargeAmp: number, maxAmps: number, chargeW: number, wattsPerAmp: number, minStep: number): number {
    if (currentAmp <= 0) {
      const availableAmps = Math.floor(chargeW / wattsPerAmp);
      return availableAmps >= minimumChargeAmp
        ? Math.min(maxAmps, availableAmps)
        : 0;
    }

    if (chargeW <= 100) {
      return Math.min(maxAmps, Math.max(minimumChargeAmp, currentAmp));
    }

    const step = Math.max(Math.floor(chargeW / wattsPerAmp), minStep);
    return Math.min(maxAmps, Math.max(minimumChargeAmp, currentAmp + step));
  }

  private resolveTargetPhaseMode(
    configuredPhaseMode: ControlDecision["phaseMode"],
    availableSurplusW: number,
    currentAmp: number,
    easee: EaseeStatePayload,
    minimumChargeAmp: number,
    dischargeW: number,
    maxDischargeW: number,
    importW: number,
    maxImportW: number
  ): "single" | "three" {
    if (configuredPhaseMode === "single" || configuredPhaseMode === "three") {
      return configuredPhaseMode;
    }

    if (dischargeW > maxDischargeW || importW > maxImportW) {
      return "single";
    }

    const singlePhaseMinW = 230 * minimumChargeAmp;
    const threePhaseMinW = singlePhaseMinW * 3;
    if (availableSurplusW >= threePhaseMinW) {
      return "three";
    }
    if (availableSurplusW >= singlePhaseMinW) {
      return "single";
    }

    return this.derivePhaseCount(easee) === 1 || currentAmp <= 0 ? "single" : "three";
  }

  private derivePhaseCount(easee: EaseeStatePayload): number {
    const raw = (easee.raw as Record<string, unknown> | undefined) ?? {};
    const outputPhase = Number(raw.outputPhase);
    if (outputPhase === 3 || outputPhase === 7 || outputPhase === 30) {
      return 3;
    }
    if (outputPhase === 1 || outputPhase === 10) {
      return 1;
    }

    const allocatedCurrents = [
      Number(raw.circuitTotalAllocatedPhaseConductorCurrentL1),
      Number(raw.circuitTotalAllocatedPhaseConductorCurrentL2),
      Number(raw.circuitTotalAllocatedPhaseConductorCurrentL3)
    ];
    const activeAllocatedPhases = allocatedCurrents.filter((value) => Number.isFinite(value) && value > 0).length;
    if (activeAllocatedPhases >= 2) {
      return 3;
    }
    if (activeAllocatedPhases === 1) {
      return 1;
    }

    // Auto-Modus ist ohne belastbare Live-Phase konservativ als 3-phasig zu rechnen.
    return 3;
  }

  private resolveMaxAmpsByPower(maxChargePowerWatts: number, phaseCount: number): number | null {
    if (!Number.isFinite(maxChargePowerWatts) || maxChargePowerWatts <= 0) {
      return null;
    }
    const wattsPerAmp = 230 * Math.max(1, phaseCount);
    return Math.floor(maxChargePowerWatts / wattsPerAmp);
  }

  private resolveStabilityMarginW(phaseCount: number, upStepAmps: number, downStepAmps: number): number {
    const minStepAmps = Math.max(1, Math.min(upStepAmps, downStepAmps));
    return Math.max(100, 230 * Math.max(1, phaseCount) * minStepAmps);
  }

  private resolveSoftTarget(maxWatts: number, marginW: number): number {
    if (!Number.isFinite(maxWatts) || maxWatts <= 0) {
      return 0;
    }

    const corridorW = Math.min(marginW, maxWatts * 0.4);
    return Math.max(0, maxWatts - corridorW);
  }

  private estimateCurtailedPvSurplus(
    growatt: GrowattOverviewPayload,
    weather: WeatherContext | null,
    batteryFull: boolean
  ): number {
    if (!batteryFull || !weather?.dailyForecast?.length) {
      return 0;
    }

    const now = Date.now();
    const currentPoint = weather.dailyForecast.find((point) => new Date(point.timestampUtc).getTime() >= now - 15 * 60_000);
    const predictedPvW = currentPoint?.predictedPvW;
    if (predictedPvW == null || predictedPvW <= 0) {
      return 0;
    }

    const loadW = growatt.live?.estimated_load_power_w ?? growatt.live?.ac_total_power_w ?? 0;
    const exportW = growatt.live?.estimated_export_to_grid_w ?? 0;
    return Math.max(0, predictedPvW - loadW + exportW);
  }
}
