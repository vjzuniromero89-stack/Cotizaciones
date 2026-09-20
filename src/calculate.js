export const KG_TO_LB = 2.2046226218,
  IN3_TO_M3 = 0.000016387064;
const num = (v, f = 0) => (Number.isFinite(+v) ? +v : f);
export function calculate(boxes, rates) {
  let actualKg = 0,
    actualLb = 0,
    cbm = 0,
    cnVolumeKg = 0,
    miVolumeLb = 0,
    cnBillKg = 0,
    miBillLb = 0,
    totalBoxes = 0;
  const cnDiv = num(rates.cnDivisor, 5000),
    miDiv = num(rates.miDivisor, 166);
  for (const b of boxes) {
    const q = Math.max(0, num(b.qty)),
      l = num(b.l),
      w = num(b.w),
      h = num(b.h);
    const cm = b.unit === "cm" ? 1 : 2.54,
      inch = b.unit === "in" ? 1 : 1 / 2.54,
      m3 = l * w * h * (b.unit === "cm" ? 1e-6 : IN3_TO_M3),
      kg = num(b.weight) * (b.weightUnit === "lb" ? 1 / KG_TO_LB : 1),
      lb = kg * KG_TO_LB,
      volKg = (l * cm * w * cm * h * cm) / cnDiv,
      volLb = (l * inch * w * inch * h * inch) / miDiv;
    actualKg += kg * q;
    actualLb += lb * q;
    cbm += m3 * q;
    totalBoxes += q;
    cnVolumeKg += volKg * q;
    miVolumeLb += volLb * q;
    cnBillKg += Math.max(kg, volKg) * q;
    miBillLb += Math.max(lb, volLb) * q;
  }
  const cnCost = cnBillKg * num(rates.cnRate),
    miCost = miBillLb * num(rates.miRate);
  const viaMiami = cnCost + miCost;
  const kgPerCbm = Math.max(1, num(rates.directKgPerCbm, 350)),
    weightCbm = actualKg / kgPerCbm,
    minimumCbm = rates.minCbm ? 1 : 0;
  const billCbm = Math.max(cbm, weightCbm, minimumCbm),
    directChargeBy =
      billCbm === minimumCbm && minimumCbm > cbm && minimumCbm > weightCbm
        ? "minimum"
        : weightCbm > cbm
          ? "weight"
          : "volume";
  const direct = billCbm * num(rates.cbmRate);
  const avg = totalBoxes ? cbm / totalBoxes : 0,
    space = Math.max(0, 1 - cbm),
    more = avg ? Math.ceil(space / avg) : 0;
  return {
    actualKg,
    actualLb,
    cbm,
    weightCbm,
    kgPerCbm,
    directChargeBy,
    cnVolumeKg,
    miVolumeLb,
    cnBillKg,
    miBillLb,
    cnChargeBy: cnVolumeKg > actualKg ? "volume" : "actual",
    miChargeBy: miVolumeLb > actualLb ? "volume" : "actual",
    cnCost,
    miCost,
    viaMiami,
    direct,
    billCbm,
    more,
    space,
    totalBoxes,
    best: viaMiami <= direct ? "miami" : "direct",
    saving: Math.abs(viaMiami - direct),
  };
}
