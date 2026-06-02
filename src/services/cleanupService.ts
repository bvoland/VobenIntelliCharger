import { AppDatabase } from "../db/database";

const INTERVAL_MS = 24 * 60 * 60 * 1000;

export class CleanupService {
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly database: AppDatabase) {}

  start(): void {
    this.runOnce();
    this.timer = setInterval(() => this.runOnce(), INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private runOnce(): void {
    try {
      const { consolidatedRows, deletedRawRows } = this.database.consolidateOldData();
      if (consolidatedRows > 0 || deletedRawRows > 0) {
        console.log(
          `[CleanupService] Consolidated ${consolidatedRows} hourly rows, deleted ${deletedRawRows} raw rows`
        );
      }
    } catch (err) {
      console.error("[CleanupService] Consolidation failed:", err);
    }
  }
}
