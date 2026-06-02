import { AppSettings, GrowattOverviewPayload } from "../../types/domain";

export class GrowattLoggerClient {
  constructor(private readonly baseUrl: string) {}

  async fetchOverview(settings: AppSettings): Promise<GrowattOverviewPayload> {
    const params = new URLSearchParams({
      host: settings.growatt.inverterHost,
      port: String(settings.growatt.inverterPort),
      unit_id: String(settings.growatt.unitId)
    });

    const response = await fetch(
      `${this.baseUrl.replace(/\/$/, "")}/api/growatt/overview?${params.toString()}`
    );
    if (!response.ok) {
      throw new Error(`Growatt-Logger antwortet mit ${response.status}.`);
    }

    return (await response.json()) as GrowattOverviewPayload;
  }

  async checkHealth(settings: AppSettings): Promise<{ status: string }> {
    const response = await fetch(
      `${this.baseUrl.replace(/\/$/, "")}/api/health`
    );
    if (!response.ok) {
      throw new Error(`Growatt-Logger Healthcheck fehlgeschlagen (${response.status}).`);
    }
    return (await response.json()) as { status: string };
  }
}
