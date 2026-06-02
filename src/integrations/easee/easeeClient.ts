import { ConfigStore } from "../../config/configStore";
import { readEaseeConfig } from "./easeeAuth";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import {
  EASEE_BASE_URL,
  EaseeConfig,
  EaseeChargerSummary,
  EaseeLoginResponse,
  EaseeOngoingSession,
  EaseeStateResponse
} from "./easeeTypes";
import { MAX_EASEE_CURRENT_AMPS, MIN_EASEE_CURRENT_AMPS } from "../../config/chargingLimits";

export class EaseeClient {
  private requestChain: Promise<void> = Promise.resolve();

  constructor(private readonly configStore: ConfigStore) {}

  async getChargerState(chargerId: string): Promise<EaseeStateResponse> {
    return this.request<EaseeStateResponse>(`/chargers/${encodeURIComponent(chargerId)}/state`);
  }

  async getOngoingSession(chargerId: string): Promise<EaseeOngoingSession | null> {
    try {
      return await this.request<EaseeOngoingSession>(`/chargers/${encodeURIComponent(chargerId)}/sessions/ongoing`);
    } catch (error) {
      if (error instanceof Error && error.message.includes("(404)")) {
        return null;
      }
      throw error;
    }
  }

  async listChargers(): Promise<EaseeChargerSummary[]> {
    return this.request<EaseeChargerSummary[]>("/chargers");
  }

  async startCharging(chargerId: string): Promise<void> {
    await this.request(`/chargers/${encodeURIComponent(chargerId)}/commands/start_charging`, { method: "POST" });
  }

  async stopCharging(chargerId: string): Promise<void> {
    await this.request(`/chargers/${encodeURIComponent(chargerId)}/commands/stop_charging`, { method: "POST" });
  }

  async pauseCharging(chargerId: string): Promise<void> {
    await this.request(`/chargers/${encodeURIComponent(chargerId)}/commands/pause_charging`, { method: "POST" });
  }

  async setDynamicCurrent(chargerId: string, amps: number, minutes = 0): Promise<void> {
    const safeAmps = Math.min(MAX_EASEE_CURRENT_AMPS, Math.max(MIN_EASEE_CURRENT_AMPS, Math.round(amps)));
    await this.request(`/chargers/${encodeURIComponent(chargerId)}/commands/set_dynamic_charger_current`, {
      method: "POST",
      body: { amps: safeAmps, minutes }
    });
  }

  async setPhaseMode(chargerId: string, phaseMode: 1 | 2 | 3): Promise<void> {
    await this.request(`/chargers/${encodeURIComponent(chargerId)}/commands/set_phase_mode`, {
      method: "POST",
      body: { phaseMode }
    });
  }

  private async request<T = unknown>(
    path: string,
    options: { method?: "GET" | "POST"; body?: unknown } = {}
  ): Promise<T> {
    return this.runSerialized(async () => {
      const startedAt = new Date().toISOString();
      const config = await this.requireConfig();
      await this.enforceCooldown(config);
      await this.enforceSpacing(config);

      let accessToken = await this.ensureAccessToken(config);
      let response = await fetch(`${EASEE_BASE_URL}${path}`, {
        method: options.method ?? "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: options.body ? JSON.stringify(options.body) : undefined
      });

      if (response.status === 401) {
        accessToken = await this.refreshAccessToken(config);
        response = await fetch(`${EASEE_BASE_URL}${path}`, {
          method: options.method ?? "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          },
          body: options.body ? JSON.stringify(options.body) : undefined
        });
      }

      await this.writeAuditLog({
        startedAt,
        path,
        method: options.method ?? "GET",
        body: options.body,
        status: response.status
      });

      await this.recordAttempt(response.status);

      if (!response.ok) {
        throw new Error(`Easee API Request fehlgeschlagen (${response.status}) fuer ${path}.`);
      }

      if (response.status === 204) {
        return undefined as T;
      }

      const contentType = response.headers.get("content-type") ?? "";
      return contentType.includes("application/json")
        ? ((await response.json()) as T)
        : (undefined as T);
    });
  }

  private async writeAuditLog(entry: {
    startedAt: string;
    path: string;
    method: string;
    body?: unknown;
    status: number;
  }): Promise<void> {
    try {
      const logDir = path.join(process.cwd(), "data");
      await mkdir(logDir, { recursive: true });
      const line = JSON.stringify(entry) + "\n";
      await appendFile(path.join(logDir, "easee-command-log.jsonl"), line, "utf8");
    } catch {
      // Logging must never break the actual Easee request flow.
    }
  }

  private async ensureAccessToken(config: EaseeConfig): Promise<string> {
    if (config.authInvalid) {
      throw new Error("Easee Verbindung muss neu authorisiert werden. Bitte in der UI erneut mit Benutzername und Passwort verbinden.");
    }

    if (config.accessToken && config.accessTokenExpiresAt) {
      const expiresAt = new Date(config.accessTokenExpiresAt).getTime();
      if (expiresAt - Date.now() > 60_000) {
        return config.accessToken;
      }
    }

    if (config.accessToken && !config.accessTokenExpiresAt) {
      return config.accessToken;
    }

    return this.refreshAccessToken(config);
  }

  private async refreshAccessToken(config: EaseeConfig): Promise<string> {
    const response = await fetch(`${EASEE_BASE_URL}/accounts/refresh_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: config.refreshToken })
    });

    if (!response.ok) {
      if (response.status === 401) {
        await this.patchConfig({
          accessToken: undefined,
          accessTokenExpiresAt: undefined,
          authInvalid: true,
          cooldownUntil: undefined,
          consecutiveFailures: 0,
          lastErrorStatus: 401,
          lastValidatedAt: new Date().toISOString()
        });
        throw new Error("Easee Sitzung ist abgelaufen oder wurde widerrufen. Bitte Easee in der UI neu verbinden.");
      }

      throw new Error(`Easee Token-Refresh fehlgeschlagen (${response.status}).`);
    }

    const data = (await response.json()) as EaseeLoginResponse;
    await this.patchConfig({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      accessTokenExpiresAt: data.expiresIn ? new Date(Date.now() + data.expiresIn * 1000).toISOString() : undefined,
      authInvalid: false,
      consecutiveFailures: 0,
      cooldownUntil: undefined,
      lastErrorStatus: undefined,
      lastValidatedAt: new Date().toISOString()
    });
    return data.accessToken;
  }

  private async requireConfig(): Promise<EaseeConfig> {
    const config = await readEaseeConfig(this.configStore);
    if (!config) {
      throw new Error("Easee ist noch nicht konfiguriert.");
    }
    return config;
  }

  private runSerialized<T>(task: () => Promise<T>): Promise<T> {
    const run = this.requestChain.then(task);
    this.requestChain = run.then(() => undefined, () => undefined);
    return run;
  }

  private async enforceCooldown(config: EaseeConfig): Promise<void> {
    if (config.safeMode !== true) {
      return;
    }
    if (!config.cooldownUntil) {
      return;
    }
    const remainingMs = new Date(config.cooldownUntil).getTime() - Date.now();
    if (remainingMs > 0) {
      throw new Error(`Easee Safe Mode wartet noch ${Math.ceil(remainingMs / 60000)} Minute(n).`);
    }
  }

  private async enforceSpacing(config: EaseeConfig): Promise<void> {
    if (config.safeMode !== true) {
      return;
    }
    const minIntervalMs = 5_000;
    const lastRequestAt = config.lastRequestAt ? new Date(config.lastRequestAt).getTime() : 0;
    const waitMs = lastRequestAt + minIntervalMs - Date.now();
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  private async recordAttempt(status: number): Promise<void> {
    const config = await this.requireConfig();
    const failure = status >= 400;
    const consecutiveFailures = failure ? (config.consecutiveFailures ?? 0) + 1 : 0;
    const patch: Partial<EaseeConfig> = {
      lastRequestAt: new Date().toISOString(),
      consecutiveFailures,
      lastErrorStatus: failure ? status : undefined
    };

    if (config.safeMode === true && status === 403) {
      patch.cooldownUntil = new Date(Date.now() + 15 * 60_000).toISOString();
    } else if (config.safeMode === true && (status === 429 || consecutiveFailures >= 3)) {
      patch.cooldownUntil = new Date(Date.now() + 5 * 60_000).toISOString();
    } else if (!failure) {
      patch.cooldownUntil = undefined;
    }

    await this.patchConfig(patch);
  }

  private async patchConfig(patch: Partial<EaseeConfig>): Promise<void> {
    const current = await this.requireConfig();
    await this.configStore.writeJson("easee.json", { ...current, ...patch });
  }
}
