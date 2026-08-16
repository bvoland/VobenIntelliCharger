export type HistoryPoint = { t: string; v: number | null };

export function calculateBucketEnergyKwh(points: HistoryPoint[], bucketMs: number): number {
  if (!Number.isFinite(bucketMs) || bucketMs <= 0) {
    return 0;
  }

  const wattHours = points.reduce((sum, point) => {
    if (typeof point.v !== "number" || !Number.isFinite(point.v) || point.v <= 0) {
      return sum;
    }
    return sum + point.v * bucketMs / 3_600_000;
  }, 0);

  return wattHours / 1000;
}
