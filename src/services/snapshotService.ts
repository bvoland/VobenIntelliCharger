import { AppDatabase } from "../db/database";
import { EaseeStatePayload, GrowattOverviewPayload } from "../types/domain";

export class SnapshotService {
  constructor(private readonly database: AppDatabase) {}

  storeGrowattSnapshot(payload: GrowattOverviewPayload): number {
    const capturedAt = payload.captured_at_local ?? payload.captured_at ?? new Date().toISOString();
    return this.database.insertSnapshot("growatt", capturedAt, payload);
  }

  storeEaseeSnapshot(payload: EaseeStatePayload): number {
    return this.database.insertSnapshot("easee", new Date().toISOString(), payload);
  }
}
