import { AppSettings, MgVehicleSettings, MgVehicleStatusPayload } from "../../types/domain";

interface MgAuthResponse {
  success: boolean;
  vin?: string;
  error?: string;
  warning?: string;
}

interface MgStatusResponse {
  configured: boolean;
  status?: MgVehicleStatusPayload;
  error?: string;
  fetchError?: string;
}

export class MgClient {
  private lastAuthSignature: string | null = null;

  constructor(private readonly baseUrl: string) {}

  async authenticate(settings: MgVehicleSettings): Promise<MgAuthResponse> {
    if (!settings.enabled) {
      throw new Error("MG-Integration ist deaktiviert.");
    }
    if (!settings.username || !settings.password) {
      throw new Error("MG-Benutzername und Passwort fehlen.");
    }

    const response = await fetch(`${this.baseUrl}/api/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: settings.username,
        password: settings.password,
        vehicleId: settings.vehicleId
      })
    });
    const payload = (await response.json()) as MgAuthResponse;
    if (!response.ok || !payload.success) {
      throw new Error(payload.error || `MG Login fehlgeschlagen (${response.status}).`);
    }

    this.lastAuthSignature = this.authSignature(settings);
    return payload;
  }

  async getVehicleStatus(settings: AppSettings): Promise<MgStatusResponse | null> {
    if (!settings.mg.enabled) {
      return null;
    }

    await this.ensureAuthenticated(settings.mg);

    const response = await fetch(`${this.baseUrl}/api/vehicle/status`);
    const payload = (await response.json()) as MgStatusResponse;

    if (response.status === 503) {
      await this.authenticate(settings.mg);
      const retry = await fetch(`${this.baseUrl}/api/vehicle/status`);
      const retryPayload = (await retry.json()) as MgStatusResponse;
      if (!retry.ok) {
        throw new Error(retryPayload.error || `MG Status fehlgeschlagen (${retry.status}).`);
      }
      return retryPayload;
    }

    if (!response.ok) {
      throw new Error(payload.error || `MG Status fehlgeschlagen (${response.status}).`);
    }

    return payload;
  }

  private async ensureAuthenticated(settings: MgVehicleSettings): Promise<void> {
    const signature = this.authSignature(settings);
    if (this.lastAuthSignature === signature) {
      return;
    }
    await this.authenticate(settings);
  }

  private authSignature(settings: MgVehicleSettings): string {
    return [
      settings.enabled ? "1" : "0",
      settings.username,
      settings.password,
      settings.vehicleId
    ].join("\u0000");
  }
}
