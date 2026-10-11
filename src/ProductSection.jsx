import React from "react";
import { authFetch } from "./auth.js";
import { shrinkImage } from "./image.js";
import { autoBoxes, syncBoxes } from "./calculate.js";
import { Plus, Trash2, ImagePlus, PackagePlus } from "lucide-react";
import "./products.css";
const money = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    n || 0,
  );
const unitDollars = (n) =>
  `US$ ${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n || 0)}`;
const cordobas = (n) =>
  `C$ ${new Intl.NumberFormat("es-NI", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n || 0)}`;
const blankBox = () => ({
  id: crypto.randomUUID(),
  qty: "",
  unitsPerBox: "",
  l: "",
  w: "",
  h: "",
  unit: "cm",
  weight: "",
  weightUnit: "kg",
});
const blank = () => ({
  id: crypto.randomUUID(),
  name: "",
  price: "",
  qty: "",
  imageUrl: "",
  salePrice: "",
  uploading: false,
  boxes: [blankBox()],
});
function NumberField({ label, value, onChange }) {
  return (
    <label>
      <span>{label}</span>
      <input
        type="number"
        min="0"
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
const boxVolumeCbm = (box) => {
  const factor = box.unit === "in" ? 0.000016387064 : 0.000001;
  return (
    (Number(box.l) || 0) *
    (Number(box.w) || 0) *
    (Number(box.h) || 0) *
    factor *
    (Number(box.qty) || 0)
  );
};
const boxWeightCbm = (box) => {
  const totalWeight = (Number(box.weight) || 0) * (Number(box.qty) || 0);
  const totalKg = box.weightUnit === "lb" ? totalWeight / 2.2046226218 : totalWeight;
  return totalKg / 350;
};
const boxWeightKg = (box) => {
  const totalWeight = (Number(box.weight) || 0) * (Number(box.qty) || 0);
  return box.weightUnit === "lb" ? totalWeight / 2.2046226218 : totalWeight;
};
const weightNumber = (n) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n || 0);
export default function ProductSection({
  products,
  setProducts,
  fee,
  setFee,
  shipping,
  routeDetails,
  exchangeRate,
  catalogProducts = [],
}) {
  const [selectedCatalog, setSelectedCatalog] = React.useState("");
  const subtotal = products.reduce(
      (s, p) => s + (Number(p.price) || 0) * (Number(p.qty) || 0),
      0,
    ),
    feeAmount = (subtotal * Number(fee || 0)) / 100,
    totalProducts = subtotal + feeAmount,
    units = products.reduce((s, p) => s + (Number(p.qty) || 0), 0),
    totalBoxes = products.reduce(
      (sum, p) =>
        sum + (p.boxes || []).reduce((n, b) => n + (Number(b.qty) || 0), 0),
      0,
    ),
    totalVolumeCbm = products.reduce(
      (sum, p) => sum + (p.boxes || []).reduce((n, b) => n + boxVolumeCbm(b), 0),
      0,
    ),
    totalWeightCbm = products.reduce(
      (sum, p) => sum + (p.boxes || []).reduce((n, b) => n + boxWeightCbm(b), 0),
      0,
    ),
    totalWeightKg = products.reduce(
      (sum, p) => sum + (p.boxes || []).reduce((n, b) => n + boxWeightKg(b), 0),
      0,
    );
  const pricingRows = products.map((p) => {
    const units = Number(p.qty) || 0;
    const purchase = (Number(p.price) || 0) * units;
    const commission = (purchase * Number(fee || 0)) / 100;
    const freight = routeDetails?.rows?.find((row) => row.id === p.id);
    let productShipping = 0;
    if (routeDetails?.best === "miami") {
      productShipping = Number(freight?.viaMiami || 0);
    } else if (routeDetails?.directBasis > 0) {
      const productBasis =
        routeDetails.directChargeBy === "weight"
          ? Number(freight?.actualKg || 0)
          : Number(freight?.cbm || 0);
      productShipping =
        Number(routeDetails.directTotal || 0) *
        (productBasis / routeDetails.directBasis);
    }
    const totalCost = purchase + commission + productShipping;
    const unitCost = units ? totalCost / units : 0;
    return {
      p,
      units,
      unitCost,
      purchase,
      commission,
      productShipping,
      totalCost,
    };
  });
  const update = (id, k, v) =>
    setProducts((x) =>
      x.map((p) => (p.id === id ? syncBoxes({ ...p, [k]: v }) : p)),
    );
  const updateBox = (productId, boxId, k, v) =>
    setProducts((x) =>
      x.map((p) =>
        p.id === productId
          ? syncBoxes({
              ...p,
              boxes: p.boxes.map((b) =>
                b.id === boxId
                  ? {
                      ...b,
                      [k]: v,
                      // Escribir las cajas las deja fijas; borrarlas o pulsar
                      // "auto" vuelve al cálculo por unidades.
                      ...(k === "qty" ? { qtyManual: v !== "" } : {}),
                    }
                  : b,
              ),
            })
          : p,
      ),
    );
  const addCatalogProduct = (id) => {
    const saved = catalogProducts.find((p) => p.id === id);
    if (!saved) return;
    const product = {
      id: crypto.randomUUID(),
      name: saved.name || "",
      price: saved.unit_price ?? "",
      qty: saved.default_quantity ?? "",
      imageUrl: saved.image_url || "",
      uploading: false,
      boxes: (saved.boxes?.length ? saved.boxes : [blankBox()])
        .slice(0, 1)
        .map((b) => ({
          ...b,
          id: crypto.randomUUID(),
          qty:
            autoBoxes(saved.default_quantity, b.unitsPerBox) || (b.qty ?? ""),
          qtyManual: false,
          unitsPerBox: b.unitsPerBox ?? "",
          l: b.l ?? "",
          w: b.w ?? "",
          h: b.h ?? "",
          unit: b.unit || "cm",
          weight: b.weight ?? "",
          weightUnit: b.weightUnit || "kg",
        })),
    };
    setProducts((x) =>
      x.length === 1 && !x[0].name && !Number(x[0].price) && !Number(x[0].qty)
        ? [product]
        : [...x, product],
    );
    setSelectedCatalog("");
  };
  async function upload(id, original) {
    if (!original) return;
    const file = await shrinkImage(original);
    if (file.size > 5 * 1024 * 1024) {
      alert("La foto debe pesar menos de 5 MB");
      return;
    }
    update(id, "uploading", true);
    try {
      const key =
        crypto.randomUUID() + "-" + file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const r = await authFetch("/api/uploads/" + key, {
        method: "PUT",
        headers: { "content-type": file.type || "application/octet-stream" },
        body: file,
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok)
        throw new Error(
          data.detail || data.error || "No se pudo subir la foto",
        );
      update(id, "imageUrl", data.url || "/api/files/" + key);
    } catch (error) {
      alert(error.message || "No se pudo subir la foto");
    } finally {
      update(id, "uploading", false);
    }
  }
  React.useEffect(() => {
    shipping.onSummary({
      productSubtotal: subtotal,
      feePercent: Number(fee || 0),
      feeAmount,
      merchandiseTotal: totalProducts,
      totalUnits: units,
      landedMiami: totalProducts + shipping.viaMiami,
      landedDirect: totalProducts + shipping.direct,
      unitMiami: units ? (totalProducts + shipping.viaMiami) / units : 0,
      unitDirect: units ? (totalProducts + shipping.direct) / units : 0,
    });
  }, [
    subtotal,
    feeAmount,
    totalProducts,
    units,
    shipping.viaMiami,
    shipping.direct,
  ]);
  return (
    <section className="panel productPanel">
      <div className="sectionTitle">
        <div>
          <span>01</span>
          <h2>Productos de la cotización</h2>
        </div>
        <p>
          {products.length} productos · {totalBoxes} cajas
        </p>
      </div>
      <p className="sectionHelp">
        Elige un producto guardado para cargar sus datos automáticamente o
        completa uno manualmente.
      </p>
      {catalogProducts.length > 0 && (
        <div className="catalogPicker">
          <div>
            <small>CATÁLOGO</small>
            <b>Elegir producto guardado</b>
          </div>
          <select
            value={selectedCatalog}
            onChange={(e) => {
              const id = e.target.value;
              setSelectedCatalog(id);
              if (id) addCatalogProduct(id);
            }}
          >
            <option value="">Selecciona un producto…</option>
            {catalogProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <span className="autoLoadHint">Se carga automáticamente</span>
        </div>
      )}
      <div className="manualDivider">
        <span>O escribe los productos en la tabla</span>
      </div>
      <div className="qtTable">
        <div className="qtRow qtHead">
          <span />
          <span>Producto</span>
          <span>Precio</span>
          <span>Unidades</span>
          <span>Cajas</span>
          <span>Por caja</span>
          <span>Medidas de la caja</span>
          <span>Peso por caja</span>
          <span>CBM</span>
          <span>Peso total</span>
          <span>Costo/unidad</span>
          <span />
        </div>
        {products.map((p, i) => {
          const b = p.boxes?.[0] || blankBox();
          const row = pricingRows[i];
          return (
            <div className="qtRow" key={p.id}>
              <label className="photoPicker qtPhoto">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt="" />
                ) : (
                  <>
                    <ImagePlus />
                    <span>{p.uploading ? "…" : "Foto"}</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => upload(p.id, e.target.files[0])}
                />
              </label>
              <label className="qtCell qtName">
                <span className="qtLabel">Producto</span>
                <input
                  value={p.name}
                  onChange={(e) => update(p.id, "name", e.target.value)}
                  placeholder={"Producto " + (i + 1)}
                />
              </label>
                <label className="qtCell">
                  <span className="qtLabel">Precio</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={p.price}
                    onChange={(e) => update(p.id, "price", e.target.value)}
                  />
                </label>
                <label className="qtCell">
                  <span className="qtLabel">Unidades</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={p.qty}
                    onChange={(e) => update(p.id, "qty", e.target.value)}
                  />
                </label>
                <label className="qtCell">
                  <span className="qtLabel">Cajas</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={b.qty}
                    onChange={(e) => updateBox(p.id, b.id, "qty", e.target.value)}
                  />
                  {b.qtyManual && autoBoxes(p.qty, b.unitsPerBox) !== "" && (
                    <button
                      type="button"
                      className="qtAuto"
                      title="Volver al cálculo automático: unidades ÷ productos por caja"
                      onClick={(e) => {
                        e.preventDefault();
                        updateBox(p.id, b.id, "qty", "");
                      }}
                    >
                      ↺ auto {autoBoxes(p.qty, b.unitsPerBox)}
                    </button>
                  )}
                </label>
                <label className="qtCell">
                  <span className="qtLabel">Por caja</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={b.unitsPerBox ?? ""}
                    onChange={(e) => updateBox(p.id, b.id, "unitsPerBox", e.target.value)}
                  />
                </label>
              <div className="qtCell qtDims">
                <span className="qtLabel">Medidas de la caja</span>
                <div>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="Largo"
                    title="Largo"
                    value={b.l}
                    onChange={(e) => updateBox(p.id, b.id, "l", e.target.value)}
                  />
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="Ancho"
                    title="Ancho"
                    value={b.w}
                    onChange={(e) => updateBox(p.id, b.id, "w", e.target.value)}
                  />
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="Alto"
                    title="Alto"
                    value={b.h}
                    onChange={(e) => updateBox(p.id, b.id, "h", e.target.value)}
                  />
                  <select
                    title="Unidad de medida"
                    value={b.unit}
                    onChange={(e) =>
                      updateBox(p.id, b.id, "unit", e.target.value)
                    }
                  >
                    <option value="cm">cm</option>
                    <option value="in">in</option>
                  </select>
                </div>
              </div>
              <div className="qtCell qtWeight">
                <span className="qtLabel">Peso por caja</span>
                <div>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={b.weight}
                    onChange={(e) =>
                      updateBox(p.id, b.id, "weight", e.target.value)
                    }
                  />
                  <select
                    title="Unidad de peso"
                    value={b.weightUnit}
                    onChange={(e) =>
                      updateBox(p.id, b.id, "weightUnit", e.target.value)
                    }
                  >
                    <option value="kg">kg</option>
                    <option value="lb">lb</option>
                  </select>
                </div>
              </div>
              <div className="qtCell qtCalc">
                <span className="qtLabel">CBM</span>
                <b>{boxVolumeCbm(b).toFixed(4)}</b>
                <small>por peso {boxWeightCbm(b).toFixed(4)}</small>
              </div>
              <div className="qtCell qtCalc">
                <span className="qtLabel">Peso total</span>
                <b>{weightNumber(boxWeightKg(b))} kg</b>
                <small>{weightNumber(boxWeightKg(b) * 2.2046226218)} lb</small>
              </div>
              <div className="qtCell qtCalc qtCost">
                <span className="qtLabel">Costo/unidad</span>
                <b>{unitDollars(row.unitCost)}</b>
                <small>{cordobas(row.unitCost * exchangeRate)}</small>
              </div>
              <button
                className="qtRemove"
                disabled={products.length < 2}
                onClick={() =>
                  setProducts((x) => x.filter((v) => v.id !== p.id))
                }
                title="Quitar producto"
              >
                <Trash2 />
              </button>
            </div>
          );
        })}
        <div className="qtRow qtFoot">
          <span />
          <b>
            {products.length} {products.length === 1 ? "producto" : "productos"}
          </b>
          <span />
          <b>{units.toLocaleString()}</b>
          <b>{totalBoxes.toLocaleString()}</b>
          <span />
          <span />
          <span />
          <div className="qtCalc">
            <b>{totalVolumeCbm.toFixed(4)}</b>
            <small>por peso {totalWeightCbm.toFixed(4)}</small>
          </div>
          <div className="qtCalc">
            <b>{weightNumber(totalWeightKg)} kg</b>
            <small>{weightNumber(totalWeightKg * 2.2046226218)} lb</small>
          </div>
          <span />
          <span />
        </div>
      </div>
      <button
        className="add addCompleteProduct"
        onClick={() => setProducts((x) => [...x, blank()])}
      >
        <Plus /> Agregar otra fila
      </button>
      <div className="liveProductPricing">
        <div className="livePricingHead">
          <small>COSTO UNITARIO PUESTO EN NICARAGUA</small>
        </div>
        {pricingRows.map((row) => (
          <article className="livePricingRow" key={row.p.id}>
            <div className="livePricingImage">
              {row.p.imageUrl ? <img src={row.p.imageUrl} alt="" /> : <PackagePlus />}
            </div>
            <div className="livePricingName">
              <b>{row.p.name || "Producto"}</b>
              <small>
                Producto {money(row.purchase)} + Comisión{" "}
                {money(row.commission)} + Flete {money(row.productShipping)} ={" "}
                {money(row.totalCost)} ÷ {row.units.toLocaleString()} unidades
              </small>
            </div>
            <strong className="livePricingUnitCost">
              {unitDollars(row.unitCost)} <span>·</span> {cordobas(row.unitCost * exchangeRate)}
            </strong>
          </article>
        ))}
      </div>
      <div className="purchaseSummary">
        <div>
          <span>Subtotal mercancía</span>
          <b>{money(subtotal)}</b>
        </div>
        <label>
          <span>Comisión de compra</span>
          <div>
            <input
              type="number"
              min="0"
              step="any"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
            />
            <em>%</em>
          </div>
        </label>
        <div>
          <span>Comisión ({fee}%)</span>
          <b>{money(feeAmount)}</b>
        </div>
        <div className="purchaseTotal">
          <span>Total de productos</span>
          <strong>{money(totalProducts)}</strong>
        </div>
      </div>
    </section>
  );
}
export { blank as blankProduct };
