import { mkdir } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { CalibrationModel, CalibrationObservation, SnapshotRecord, SnapshotSource } from "../types/domain";

export class AppDatabase {
  private readonly db: DatabaseSync;

  constructor(dbPath: string) {
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL,
        captured_at TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_snapshots_source_captured_at
        ON snapshots (source, captured_at DESC);
      CREATE TABLE IF NOT EXISTS control_decisions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS weather_fetches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fetched_at TEXT NOT NULL,
        lat REAL NOT NULL,
        lon REAL NOT NULL,
        hourly_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_weather_fetches_at
        ON weather_fetches (fetched_at DESC);
      CREATE TABLE IF NOT EXISTS calibration_samples (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recorded_at TEXT NOT NULL,
        pv_w REAL NOT NULL,
        irradiance_wm2 REAL NOT NULL,
        ratio REAL NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_calibration_recorded_at
        ON calibration_samples (recorded_at DESC);
      CREATE TABLE IF NOT EXISTS calibration_observations (
        observation_id TEXT PRIMARY KEY,
        timestamp_utc TEXT NOT NULL,
        model_version TEXT NOT NULL,
        archived INTEGER NOT NULL DEFAULT 0,
        archive_path TEXT,
        payload_json TEXT NOT NULL,
        created_at_utc TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_calibration_observations_time ON calibration_observations(timestamp_utc);
      CREATE INDEX IF NOT EXISTS idx_calibration_observations_archive ON calibration_observations(archived, timestamp_utc);
      CREATE INDEX IF NOT EXISTS idx_calibration_observations_model ON calibration_observations(model_version);
      CREATE TABLE IF NOT EXISTS calibration_models (
        version TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 0,
        payload_json TEXT NOT NULL,
        created_at_utc TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_calibration_models_active ON calibration_models(active, created_at_utc DESC);
      CREATE TABLE IF NOT EXISTS calibration_aggregates (
        bucket_start_utc TEXT NOT NULL,
        interval_minutes INTEGER NOT NULL,
        model_version TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        PRIMARY KEY(bucket_start_utc, interval_minutes, model_version)
      );
      CREATE TABLE IF NOT EXISTS calibration_jobs (
        job_name TEXT PRIMARY KEY,
        last_success_at_utc TEXT,
        status TEXT NOT NULL,
        details_json TEXT
      );
    `);
  }

  static async create(baseDir: string): Promise<AppDatabase> {
    await mkdir(baseDir, { recursive: true });
    return new AppDatabase(path.join(baseDir, "pv-charge-controller.db"));
  }

  close(): void { this.db.close(); }

  insertSnapshot(source: SnapshotSource, capturedAt: string, payload: unknown): number {
    const stmt = this.db.prepare(
      "INSERT INTO snapshots (source, captured_at, payload_json) VALUES (?, ?, ?)"
    );
    const result = stmt.run(source, capturedAt, JSON.stringify(payload));
    return Number(result.lastInsertRowid);
  }

  listSnapshots(source?: SnapshotSource, limit = 100): SnapshotRecord[] {
    const rows = source
      ? this.db.prepare(
          "SELECT id, source, captured_at, payload_json FROM snapshots WHERE source = ? ORDER BY id DESC LIMIT ?"
        ).all(source, limit)
      : this.db.prepare(
          "SELECT id, source, captured_at, payload_json FROM snapshots ORDER BY id DESC LIMIT ?"
        ).all(limit);

    return rows.map((row) => ({
      id: Number(row.id),
      source: row.source as SnapshotSource,
      capturedAt: String(row.captured_at),
      payload: JSON.parse(String(row.payload_json))
    }));
  }

  insertWeatherFetch(lat: number, lon: number, hourly: number[]): void {
    this.db.prepare(
      "INSERT INTO weather_fetches (fetched_at, lat, lon, hourly_json) VALUES (?, ?, ?, ?)"
    ).run(new Date().toISOString(), lat, lon, JSON.stringify(hourly));
  }

  insertCalibrationSample(pvW: number, irradianceWm2: number): void {
    const ratio = pvW / irradianceWm2;
    this.db.prepare(
      "INSERT INTO calibration_samples (recorded_at, pv_w, irradiance_wm2, ratio) VALUES (?, ?, ?, ?)"
    ).run(new Date().toISOString(), pvW, irradianceWm2, ratio);
  }

  loadCalibrationSamples(limit = 120): number[] {
    const rows = this.db.prepare(
      "SELECT ratio FROM calibration_samples ORDER BY id DESC LIMIT ?"
    ).all(limit);
    return rows.map((r) => Number(r.ratio));
  }

  insertCalibrationObservation(observation: CalibrationObservation): boolean {
    const result = this.db.prepare(`INSERT OR IGNORE INTO calibration_observations
      (observation_id,timestamp_utc,model_version,archived,payload_json,created_at_utc)
      VALUES (?,?,?,?,?,?)`).run(observation.observationId, observation.timestampUtc,
        observation.modelVersion, observation.archived ? 1 : 0, JSON.stringify(observation), observation.createdAtUtc);
    return Number(result.changes) === 1;
  }

  loadCalibrationObservations(limit = 5000): CalibrationObservation[] {
    return this.db.prepare(`SELECT payload_json FROM calibration_observations ORDER BY timestamp_utc DESC LIMIT ?`)
      .all(limit).map((row) => JSON.parse(String(row.payload_json)) as CalibrationObservation);
  }

  loadExpiredCalibrationObservations(cutoffUtc: string): CalibrationObservation[] {
    return this.db.prepare(`SELECT payload_json FROM calibration_observations
      WHERE timestamp_utc < ? AND archived = 0 ORDER BY timestamp_utc`).all(cutoffUtc)
      .map((row) => JSON.parse(String(row.payload_json)) as CalibrationObservation);
  }

  markCalibrationArchived(ids: string[], archivePath: string): number {
    if (ids.length === 0) return 0;
    const stmt = this.db.prepare(`UPDATE calibration_observations SET archived=1, archive_path=? WHERE observation_id=?`);
    let count = 0;
    this.db.exec("BEGIN");
    try { for (const id of ids) count += Number(stmt.run(archivePath, id).changes); this.db.exec("COMMIT"); }
    catch (error) { this.db.exec("ROLLBACK"); throw error; }
    return count;
  }

  deleteArchivedCalibrationObservations(ids: string[]): number {
    if (ids.length === 0) return 0;
    const stmt = this.db.prepare(`DELETE FROM calibration_observations WHERE observation_id=? AND archived=1`);
    let count = 0;
    this.db.exec("BEGIN");
    try { for (const id of ids) count += Number(stmt.run(id).changes); this.db.exec("COMMIT"); }
    catch (error) { this.db.exec("ROLLBACK"); throw error; }
    return count;
  }

  saveCalibrationModel(model: CalibrationModel): void {
    this.db.exec("BEGIN");
    try {
      this.db.prepare(`UPDATE calibration_models SET active=0 WHERE active=1`).run();
      this.db.prepare(`INSERT OR REPLACE INTO calibration_models(version,status,active,payload_json,created_at_utc) VALUES(?,?,1,?,?)`)
        .run(model.version, model.status, JSON.stringify(model), model.updatedAtUtc);
      this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }

  loadActiveCalibrationModel(): CalibrationModel | null {
    const row = this.db.prepare(`SELECT payload_json FROM calibration_models WHERE active=1 ORDER BY created_at_utc DESC LIMIT 1`).get();
    return row ? JSON.parse(String(row.payload_json)) as CalibrationModel : null;
  }

  setCalibrationJobStatus(jobName: string, status: string, details: unknown, successful = false): void {
    this.db.prepare(`INSERT INTO calibration_jobs(job_name,last_success_at_utc,status,details_json) VALUES(?,?,?,?)
      ON CONFLICT(job_name) DO UPDATE SET last_success_at_utc=CASE WHEN ? THEN excluded.last_success_at_utc ELSE calibration_jobs.last_success_at_utc END,status=excluded.status,details_json=excluded.details_json`)
      .run(jobName, successful ? new Date().toISOString() : null, status, JSON.stringify(details), successful ? 1 : 0);
  }

  getCalibrationStats(): { rawRows: number; archivedRows: number; lastArchiveUtc: string | null } {
    const rows = this.db.prepare(`SELECT COUNT(*) total, SUM(archived) archived FROM calibration_observations`).get()!;
    const job = this.db.prepare(`SELECT last_success_at_utc FROM calibration_jobs WHERE job_name='archive'`).get();
    return { rawRows: Number(rows.total), archivedRows: Number(rows.archived ?? 0), lastArchiveUtc: job ? String(job.last_success_at_utc) : null };
  }

  upsertCalibrationAggregate(bucketStartUtc:string,intervalMinutes:number,modelVersion:string,payload:unknown):void {
    this.db.prepare(`INSERT OR REPLACE INTO calibration_aggregates(bucket_start_utc,interval_minutes,model_version,payload_json) VALUES(?,?,?,?)`)
      .run(bucketStartUtc,intervalMinutes,modelVersion,JSON.stringify(payload));
  }

  insertControlDecision(payload: unknown): void {
    this.db.prepare(
      "INSERT INTO control_decisions (created_at, payload_json) VALUES (?, ?)"
    ).run(new Date().toISOString(), JSON.stringify(payload));
  }

  queryHistoryGrowatt(fromIso: string): Array<{
    capturedAt: string;
    pvPowerW: number | null;
    socPercent: number | null;
    chargeW: number | null;
    dischargeW: number | null;
  }> {
    const rows = this.db.prepare(`
      SELECT
        captured_at,
        CAST(json_extract(payload_json, '$.live.pv_total_power_w')        AS REAL) AS pv_w,
        CAST(json_extract(payload_json, '$.battery.bms_soc_percent')       AS REAL) AS soc,
        CAST(json_extract(payload_json, '$.battery.charge_power_w')        AS REAL) AS charge_w,
        CAST(json_extract(payload_json, '$.battery.discharge_power_w')     AS REAL) AS discharge_w
      FROM snapshots
      WHERE source = 'growatt' AND captured_at >= ?
      ORDER BY captured_at ASC
    `).all(fromIso);
    return rows.map((r) => ({
      capturedAt: String(r.captured_at),
      pvPowerW: r.pv_w != null ? Number(r.pv_w) : null,
      socPercent: r.soc != null ? Number(r.soc) * 100 : null,
      chargeW: r.charge_w != null ? Number(r.charge_w) : null,
      dischargeW: r.discharge_w != null ? Number(r.discharge_w) : null
    }));
  }

  consolidateOldData(): { consolidatedRows: number; deletedRawRows: number } {
    const growattInsert = this.db.prepare(`
      INSERT INTO snapshots (source, captured_at, payload_json)
      SELECT
        'growatt',
        strftime('%Y-%m-%dT%H:00:00Z', captured_at),
        json_object(
          '_consolidated', 1,
          'live', json_object(
            'pv_total_power_w',               AVG(json_extract(payload_json, '$.live.pv_total_power_w')),
            'ac_total_power_w',               AVG(json_extract(payload_json, '$.live.ac_total_power_w')),
            'estimated_import_from_grid_w',   AVG(json_extract(payload_json, '$.live.estimated_import_from_grid_w')),
            'estimated_export_to_grid_w',     AVG(json_extract(payload_json, '$.live.estimated_export_to_grid_w')),
            'estimated_load_power_w',         AVG(json_extract(payload_json, '$.live.estimated_load_power_w'))
          ),
          'battery', json_object(
            'bms_soc_percent',    AVG(json_extract(payload_json, '$.battery.bms_soc_percent')),
            'charge_power_w',     AVG(json_extract(payload_json, '$.battery.charge_power_w')),
            'discharge_power_w',  AVG(json_extract(payload_json, '$.battery.discharge_power_w')),
            'battery_power_w',    AVG(json_extract(payload_json, '$.battery.battery_power_w'))
          )
        )
      FROM snapshots
      WHERE source = 'growatt'
        AND captured_at < datetime('now', '-7 days')
        AND json_extract(payload_json, '$._consolidated') IS NULL
      GROUP BY strftime('%Y-%m-%dT%H', captured_at)
    `);

    const easeeInsert = this.db.prepare(`
      INSERT INTO snapshots (source, captured_at, payload_json)
      SELECT
        'easee',
        strftime('%Y-%m-%dT%H:00:00Z', captured_at),
        json_object(
          '_consolidated', 1,
          'chargerId',          MAX(json_extract(payload_json, '$.chargerId')),
          'totalPowerWatts',    AVG(json_extract(payload_json, '$.totalPowerWatts')),
          'outputCurrentAmp',   AVG(json_extract(payload_json, '$.outputCurrentAmp')),
          'sessionEnergyKwh',   MAX(json_extract(payload_json, '$.sessionEnergyKwh')),
          'lifetimeEnergyKwh',  MAX(json_extract(payload_json, '$.lifetimeEnergyKwh'))
        )
      FROM snapshots
      WHERE source = 'easee'
        AND captured_at < datetime('now', '-7 days')
        AND json_extract(payload_json, '$._consolidated') IS NULL
      GROUP BY strftime('%Y-%m-%dT%H', captured_at)
    `);

    const deleteRawSnapshots = this.db.prepare(`
      DELETE FROM snapshots
      WHERE captured_at < datetime('now', '-7 days')
        AND json_extract(payload_json, '$._consolidated') IS NULL
    `);

    const deleteOldDecisions = this.db.prepare(
      `DELETE FROM control_decisions WHERE created_at < datetime('now', '-30 days')`
    );

    const deleteOldWeather = this.db.prepare(
      `DELETE FROM weather_fetches WHERE fetched_at < datetime('now', '-90 days')`
    );

    // Legacy samples remain bounded; rich observations are removed only by the
    // archive service after a successfully validated Parquet write.
    const deleteOldCalibration = this.db.prepare(`DELETE FROM calibration_samples WHERE recorded_at < datetime('now', '-90 days')`);

    let consolidatedRows = 0;
    let deletedRawRows = 0;
    this.db.exec("BEGIN");
    try {
      consolidatedRows += Number(growattInsert.run().changes);
      consolidatedRows += Number(easeeInsert.run().changes);
      deletedRawRows = Number(deleteRawSnapshots.run().changes);
      deleteOldDecisions.run();
      deleteOldWeather.run();
      deleteOldCalibration.run();
      this.db.exec("COMMIT");
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
    return { consolidatedRows, deletedRawRows };
  }

  queryHistoryEasee(fromIso: string): Array<{
    capturedAt: string;
    powerW: number | null;
    currentA: number | null;
  }> {
    const rows = this.db.prepare(`
      SELECT
        captured_at,
        CAST(json_extract(payload_json, '$.totalPowerWatts')  AS REAL) AS power_w,
        CAST(json_extract(payload_json, '$.outputCurrentAmp') AS REAL) AS current_a
      FROM snapshots
      WHERE source = 'easee' AND captured_at >= ?
      ORDER BY captured_at ASC
    `).all(fromIso);
    return rows.map((r) => ({
      capturedAt: String(r.captured_at),
      powerW: r.power_w != null ? Number(r.power_w) : null,
      currentA: r.current_a != null ? Number(r.current_a) : null
    }));
  }
}
