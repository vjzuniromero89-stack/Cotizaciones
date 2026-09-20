import React from "react";
import { Scale, Ruler } from "lucide-react";
import "./weight.css";
function Leg({ title, actual, volume, billed, unit, by }) {
  return (
    <div className="weightLeg">
      <h4>{title}</h4>
      <div>
        <span>
          <Scale /> Peso crudo
        </span>
        <b>
          {actual.toFixed(2)} {unit}
        </b>
      </div>
      <div>
        <span>
          <Ruler /> Peso por volumen
        </span>
        <b>
          {volume.toFixed(2)} {unit}
        </b>
      </div>
      <div className="charged">
        <span>TE COBRAN POR {by === "volume" ? "VOLUMEN" : "PESO CRUDO"}</span>
        <strong>
          {billed.toFixed(2)} {unit}
        </strong>
      </div>
    </div>
  );
}
export default function WeightBreakdown({ r }) {
  return (
    <section className="weightCompare">
      <header>
        <b>Comparación de peso facturable</b>
        <small>El sistema selecciona automáticamente el mayor</small>
      </header>
      <div className="weightGrid">
        <Leg
          title="China → Miami"
          actual={r.actualKg}
          volume={r.cnVolumeKg}
          billed={r.cnBillKg}
          unit="kg"
          by={r.cnChargeBy}
        />
        <Leg
          title="Miami → Managua"
          actual={r.actualLb}
          volume={r.miVolumeLb}
          billed={r.miBillLb}
          unit="lb"
          by={r.miChargeBy}
        />
      </div>
    </section>
  );
}
