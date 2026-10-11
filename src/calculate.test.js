import { describe, it, expect } from "vitest";
import { calculate, autoBoxes, syncBoxes } from "./calculate.js";
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
describe("cajas según las unidades", () => {
  it("divide las unidades entre los productos por caja", () => {
    expect(autoBoxes(10000, 50)).toBe(200);
    expect(autoBoxes("1000", "25")).toBe(40);
  });
  it("una caja a medias cuenta como caja completa", () => {
    expect(autoBoxes(1010, 25)).toBe(41);
    expect(autoBoxes(1, 50)).toBe(1);
  });
  it("no inventa cajas si falta un dato", () => {
    expect(autoBoxes("", 50)).toBe("");
    expect(autoBoxes(1000, "")).toBe("");
    expect(autoBoxes(1000, 0)).toBe("");
  });
  it("actualiza las cajas al cambiar las unidades", () => {
    const p = { qty: "2000", boxes: [{ qty: 1, unitsPerBox: "25" }] };
    expect(syncBoxes(p).boxes[0].qty).toBe(80);
  });
  it("respeta las cajas escritas a mano", () => {
    const p = {
      qty: "2000",
      boxes: [{ qty: "75", unitsPerBox: "25", qtyManual: true }],
    };
    expect(syncBoxes(p).boxes[0].qty).toBe("75");
  });
  it("no toca las cajas si no se sabe cuántos van por caja", () => {
    const p = { qty: "2000", boxes: [{ qty: "12", unitsPerBox: "" }] };
    expect(syncBoxes(p).boxes[0].qty).toBe("12");
  });
  it("vacía las cajas automáticas si se borran las unidades", () => {
    const p = { qty: "", boxes: [{ qty: 80, unitsPerBox: "25" }] };
    expect(syncBoxes(p).boxes[0].qty).toBe("");
  });
});
