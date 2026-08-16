import assert from "node:assert/strict";
import test from "node:test";
import { calculateBucketEnergyKwh } from "./historyEnergyService";

test("berechnet Energie aus gleich breiten Leistungsfenstern", () => {
  const result = calculateBucketEnergyKwh([
    { t: "2026-08-16T10:15:00.000Z", v: 2000 },
    { t: "2026-08-16T10:45:00.000Z", v: 4000 }
  ], 30 * 60 * 1000);

  assert.equal(result, 3);
});

test("ignoriert Datenlücken und ungültige Leistungswerte", () => {
  const result = calculateBucketEnergyKwh([
    { t: "2026-08-16T10:15:00.000Z", v: 1000 },
    { t: "2026-08-16T10:45:00.000Z", v: null },
    { t: "2026-08-16T11:15:00.000Z", v: Number.NaN },
    { t: "2026-08-16T11:45:00.000Z", v: -500 }
  ], 30 * 60 * 1000);

  assert.equal(result, 0.5);
});
