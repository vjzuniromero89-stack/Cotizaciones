import React from "react";
import { authFetch } from "./auth.js";
import { Plus, Trash2, ImagePlus, PackagePlus } from "lucide-react";
import "./products.css";
const money = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    n || 0,
  );
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
export default function ProductSection({
  products,
  setProducts,
  fee,
  setFee,
  shipping,
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
    );
  const update = (id, k, v) =>
    setProducts((x) => x.map((p) => (p.id === id ? { ...p, [k]: v } : p)));
  const updateBox = (productId, boxId, k, v) =>
    setProducts((x) =>
      x.map((p) =>
        p.id === productId
          ? {
              ...p,
              boxes: p.boxes.map((b) =>
                b.id === boxId ? { ...b, [k]: v } : b,
              ),
            }
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
          qty: b.qty ?? "",
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
  async function upload(id, file) {
    if (!file) return;
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
        <span>O completa el producto manualmente</span>
      </div>
      <div className="productCargoList">
        {products.map((p, i) => {
          const b = p.boxes?.[0] || blankBox();
          const volumeCbm = boxVolumeCbm(b);
          const weightCbm = boxWeightCbm(b);
          return (
            <article className="productCargoCard unifiedProductCard" key={p.id}>
              <div className="productCargoHead">
                <div>
                  <small>PRODUCTO {String(i + 1).padStart(2, "0")}</small>
                  <h3>{p.name || "Nuevo producto"}</h3>
                </div>
                {products.length > 1 && (
                  <button
                    className="removeProduct"
                    onClick={() =>
                      setProducts((x) => x.filter((v) => v.id !== p.id))
                    }
                    title="Eliminar producto"
                  >
                    <Trash2 />
                  </button>
                )}
              </div>
              <div className="productRow productInfoRow">
                <label className="photoPicker">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt="" />
                  ) : (
                    <>
                      <ImagePlus />
                      <span>{p.uploading ? "Subiendo…" : "Foto"}</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => upload(p.id, e.target.files[0])}
                  />
                </label>
                <label>
                  <span>Nombre del producto</span>
                  <input
                    value={p.name}
                    onChange={(e) => update(p.id, "name", e.target.value)}
                    placeholder={"Producto " + (i + 1)}
                  />
                </label>
                <NumberField
                  label="Precio unitario"
                  value={p.price}
                  onChange={(v) => update(p.id, "price", v)}
                />
                <NumberField
                  label="Cantidad de unidades"
                  value={p.qty}
                  onChange={(v) => update(p.id, "qty", v)}
                />
                <div className="productLineTotal">
                  <span>Subtotal</span>
                  <b>{money(Number(p.price) * Number(p.qty))}</b>
                </div>
              </div>
              <div className="singleBoxInfo">
                <div className="singleBoxTitle">
                  <PackagePlus />
                  <b>Información de la caja</b>
                  <span>{Number(b.qty || 0)} cajas</span>
                </div>
                <div className="productBoxEditor">
                  <NumberField
                    label="Cantidad de cajas"
                    value={b.qty}
                    onChange={(v) => updateBox(p.id, b.id, "qty", v)}
                  />
                  <NumberField
                    label="Productos por caja"
                    value={b.unitsPerBox ?? ""}
                    onChange={(v) => updateBox(p.id, b.id, "unitsPerBox", v)}
                  />
                  <NumberField
                    label="Largo"
                    value={b.l}
                    onChange={(v) => updateBox(p.id, b.id, "l", v)}
                  />
                  <NumberField
                    label="Ancho"
                    value={b.w}
                    onChange={(v) => updateBox(p.id, b.id, "w", v)}
                  />
                  <NumberField
                    label="Alto"
                    value={b.h}
                    onChange={(v) => updateBox(p.id, b.id, "h", v)}
                  />
                  <label>
                    <span>Medidas</span>
                    <select
                      value={b.unit}
                      onChange={(e) =>
                        updateBox(p.id, b.id, "unit", e.target.value)
                      }
                    >
                      <option value="in">Pulgadas</option>
                      <option value="cm">Centímetros</option>
                    </select>
                  </label>
                  <NumberField
                    label="Peso/caja"
                    value={b.weight}
                    onChange={(v) => updateBox(p.id, b.id, "weight", v)}
                  />
                  <label>
                    <span>Unidad peso</span>
                    <select
                      value={b.weightUnit}
                      onChange={(e) =>
                        updateBox(p.id, b.id, "weightUnit", e.target.value)
                      }
                    >
                      <option value="kg">Kilogramos</option>
                      <option value="lb">Libras</option>
                    </select>
                  </label>
                  <div className="productCbmResult volume">
                    <span>CBM por volumen</span>
                    <strong>{volumeCbm.toFixed(4)} CBM</strong>
                    <small>Medidas × cajas</small>
                  </div>
                  <div className="productCbmResult weight">
                    <span>CBM por peso</span>
                    <strong>{weightCbm.toFixed(4)} CBM</strong>
                    <small>Peso total kg ÷ 350</small>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <div className="quotationCbmTotals">
        <div className="quotationCbmTotalsTitle">
          <PackagePlus />
          <div>
            <small>TOTAL DE TODOS LOS PRODUCTOS</small>
            <b>Resumen de CBM de la cotización</b>
          </div>
          <span>{totalBoxes.toLocaleString()} cajas</span>
        </div>
        <div className="quotationCbmTotal volume">
          <span>CBM total por volumen</span>
          <strong>{totalVolumeCbm.toFixed(4)} CBM</strong>
          <small>Suma de las medidas de todas las cajas</small>
        </div>
        <div className="quotationCbmTotal weight">
          <span>CBM total por peso</span>
          <strong>{totalWeightCbm.toFixed(4)} CBM</strong>
          <small>Peso total en kg ÷ 350</small>
        </div>
      </div>
      <button
        className="add addCompleteProduct"
        onClick={() => setProducts((x) => [...x, blank()])}
      >
        <Plus /> Agregar otro producto a esta cotización
      </button>
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
