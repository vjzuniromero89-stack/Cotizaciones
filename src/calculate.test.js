import { describe, it, expect } from "vitest";
import { calculate } from "./calculate.js";
describe("shipping calculator", () => {
  it("compares raw and dimensional weight on both legs", () => {
    const b = [
      { qty: 2, l: 12, w: 12, h: 12, unit: "in", weight: 10, weightUnit: "kg" },
    ];
    const r = calculate(b, {
      cnRate: 2,
      miRate: 1.5,
      cbmRate: 550,
      cnDivisor: 5000,
      miDivisor: 166,
      minCbm: true,
    });
    expect(r.actualKg).toBeCloseTo(20);
    expect(r.actualLb).toBeCloseTo(44.09, 1);
    expect(r.cnVolumeKg).toBeCloseTo(11.33, 1);
    expect(r.miVolumeLb).toBeCloseTo(20.82, 1);
    expect(r.cnBillKg).toBeCloseTo(20);
    expect(r.miBillLb).toBeCloseTo(44.09, 1);
    expect(r.cnChargeBy).toBe("actual");
    expect(r.miChargeBy).toBe("actual");
    expect(r.viaMiami).toBeCloseTo(r.cnCost + r.miCost);
    expect(r.direct).toBe(550);
  });
  it("charges route two by weight-equivalent CBM when it exceeds volume", () => {
    const r = calculate(
      [
        {
          qty: 1,
          l: 100,
          w: 100,
          h: 100,
          unit: "cm",
          weight: 600,
          weightUnit: "kg",
        },
      ],
      { cbmRate: 550, directKgPerCbm: 350, minCbm: true },
    );
    expect(r.cbm).toBeCloseTo(1);
    expect(r.weightCbm).toBeCloseTo(600 / 350);
    expect(r.billCbm).toBeCloseTo(600 / 350);
    expect(r.directChargeBy).toBe("weight");
    expect(r.direct).toBeCloseTo((600 / 350) * 550);
  });
  it("combines all products before comparing volume with the 350 kg per CBM limit", () => {
    const r = calculate(
      [
        {
          qty: 1,
          l: 100,
          w: 100,
          h: 100,
          unit: "cm",
          weight: 500,
          weightUnit: "kg",
        },
        {
          qty: 1,
          l: 100,
          w: 100,
          h: 100,
          unit: "cm",
          weight: 100,
          weightUnit: "kg",
        },
      ],
      { cbmRate: 550, directKgPerCbm: 350, minCbm: true },
    );
    expect(r.cbm).toBeCloseTo(2);
    expect(r.actualKg).toBeCloseTo(600);
    expect(r.weightCbm).toBeCloseTo(600 / 350);
    expect(r.directChargeBy).toBe("volume");
    expect(r.billCbm).toBeCloseTo(2);
  });
});
