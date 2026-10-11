import React, { useEffect, useState } from "react";
import {
  PackageSearch,
  X,
  Trash2,
  ReceiptText,
  Route,
  CalendarDays,
  Package,
  Weight,
  ImagePlus,
  Plus,
  Save,
  Pencil,
} from "lucide-react";
import "./products-page.css";
import "./suppliers.css";
import { authFetch } from "./auth.js";
import { shrinkImage, imagesFromPaste } from "./image.js";
import { DEFAULT_EXCHANGE_RATE } from "./calculate.js";
import {
  isRealProduct,
  splitCatalog,
  comparisonGroups,
  galleryOf,
} from "./suppliers.js";

const money = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    n || 0,
  );
const boxVolumeCbm = (box) =>
  (Number(box.l) || 0) *
  (Number(box.w) || 0) *
  (Number(box.h) || 0) *
  (box.unit === "in" ? 0.000016387064 : 0.000001) *
  (Number(box.qty) || 0);
const boxWeightCbm = (box) => {
  const totalWeight = (Number(box.weight) || 0) * (Number(box.qty) || 0);
  const totalKg = box.weightUnit === "lb" ? totalWeight / 2.2046226218 : totalWeight;
  return totalKg / 350;
};
async function api(path, options) {
  const r = await authFetch("/api" + path, {
    headers: { "content-type": "application/json" },
    ...options,
  });
  const data = r.status === 204 ? null : await r.json().catch(() => ({}));
  if (!r.ok)
    throw new Error(
      [data?.error, data?.detail].filter(Boolean).join(": ") ||
        "No se pudo completar",
    );
  return data;
}

function QuoteDialog({ product, onClose, onSaved }) {
  const [form, setForm] = useState({
    customer: "",
    phone: "",
    description: product.description || product.customer_name,
    notes: "",
  });
  const [items, setItems] = useState(
    (product.products || []).map((p) => ({ ...p, salePrice: "" })),
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const total = items.reduce(
    (s, p) => s + (Number(p.qty) || 0) * (Number(p.salePrice) || 0),
    0,
  );
  const profit = total - Number(product.total || 0);
  const profitPercent =
    Number(product.total) > 0 ? (profit / Number(product.total)) * 100 : 0;
  const update = (i, v) =>
    setItems((x) => x.map((p, n) => (n === i ? { ...p, salePrice: v } : p)));
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/products/${product.id}/quote`, {
        method: "POST",
        body: JSON.stringify({ ...form, products: items }),
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <form className="quoteBuilder" onSubmit={submit}>
        <div className="dialogHead">
          <div>
            <small>COTIZACIÓN PARA CLIENTE</small>
            <h2>Definir precios de venta</h2>
          </div>
          <button type="button" onClick={onClose}>
            <X />
          </button>
        </div>
        <div className="quoteClientGrid">
          <label>
            <span>Cliente *</span>
            <input
              value={form.customer}
              onChange={(e) => setForm({ ...form, customer: e.target.value })}
            />
          </label>
          <label>
            <span>Teléfono / WhatsApp</span>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </label>
        </div>
        <label className="quoteFull">
          <span>Descripción</span>
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </label>
        <div className="saleItems">
          <div className="saleHead">
            <span>Producto</span>
            <span>Cantidad</span>
            <span>Precio venta/unidad</span>
            <span>Subtotal</span>
          </div>
          {items.map((p, i) => (
            <div className="saleRow" key={p.id || i}>
              <b>{p.name || "Producto"}</b>
              <span>{Number(p.qty || 0).toLocaleString()}</span>
              <label>
                <i>$</i>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={p.salePrice}
                  onChange={(e) => update(i, e.target.value)}
                />
              </label>
              <strong>
                {money(Number(p.qty || 0) * Number(p.salePrice || 0))}
              </strong>
            </div>
          ))}
        </div>
        <div className="quoteTotals">
          <div>
            <span>Costo interno</span>
            <b>{money(product.total)}</b>
          </div>
          <div>
            <span>Venta al cliente · envío incluido</span>
            <b>{money(total)}</b>
          </div>
          <div className={profit >= 0 ? "profitPositive" : "profitNegative"}>
            <span>Ganancia estimada</span>
            <strong>{money(profit)}</strong>
          </div>
          <div
            className={
              "profitPercentage " +
              (profit >= 0 ? "profitPositive" : "profitNegative")
            }
          >
            <span>Porcentaje de ganancia sobre el costo</span>
            <strong>
              {profitPercent >= 0 ? "+" : ""}
              {profitPercent.toFixed(2)}%
            </strong>
          </div>
        </div>
        <label className="quoteFull">
          <span>Notas para la cotización</span>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </label>
        {error && (
          <div className="saveError">
            <b>No se pudo crear la cotización</b>
            <span>{error}</span>
          </div>
        )}
        <button
          className="primary"
          disabled={busy || !form.customer || !items.length}
        >
          {busy ? "Creando…" : "Crear cotización interna y del cliente"}
        </button>
      </form>
    </div>
  );
}

function ProductDetail({ id, onClose, onChanged }) {
  const [data, setData] = useState(null),
    [quote, setQuote] = useState(false),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api("/records/" + id).then(setData);
  }, [id]);
  if (!data)
    return (
      <div className="overlay">
        <div className="detailSheet loadingDetail">Cargando producto…</div>
      </div>
    );
  const shipping =
    data.route === "miami" ? data.totals.viaMiami : data.totals.direct;
  const boxes = Array.isArray(data.boxes) ? data.boxes : [];
  const totals = data.totals || {};
  const boxCbm = (b) => {
    const factor = b.unit === "cm" ? 1e-6 : 0.000016387064;
    return (
      Math.max(0, Number(b.l) || 0) *
      Math.max(0, Number(b.w) || 0) *
      Math.max(0, Number(b.h) || 0) *
      factor
    );
  };
  async function remove() {
    if (!confirm("¿Eliminar este producto guardado?")) return;
    setBusy(true);
    try {
      await api("/records/" + id, { method: "DELETE" });
      onChanged();
      onClose();
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div
        className="overlay"
        onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      >
        <section className="detailSheet productRecordDetail">
          <div className="detailTop">
            <div>
              <span className="badge pending">Producto</span>
              <small>EXPEDIENTE DE COSTOS</small>
              <h2>{data.number}</h2>
            </div>
            <button className="iconBtn" onClick={onClose}>
              <X />
            </button>
          </div>
          <div className="detailActions">
            <button className="danger" disabled={busy} onClick={remove}>
              <Trash2 /> Eliminar
            </button>
            <button
              className="clientQuoteButton"
              onClick={() => setQuote(true)}
            >
              <ReceiptText /> Crear cotización
            </button>
          </div>
          <div className="detailGrid">
            <div className="detailCard">
              <label>Producto / referencia</label>
              <b>{data.customer_name}</b>
              <span>
                <CalendarDays /> Guardado{" "}
                {new Date(data.created_at).toLocaleString()}
              </span>
            </div>
            <div className="detailCard">
              <label>Descripción</label>
              <b>{data.description || "Sin descripción"}</b>
              <span>
                <Route />{" "}
                {data.route === "miami"
                  ? "China → Miami → Managua"
                  : "China → Managua"}
              </span>
            </div>
          </div>
          <div className="detailSection">
            <h3>
              <Package /> Información de cajas ({data.total_boxes || 0})
            </h3>
            {boxes.length ? (
              <div className="productBoxTable linkedBoxes">
                <div className="productBoxRow head">
                  <span>Producto</span>
                  <span>Cant.</span>
                  <span>Productos/caja</span>
                  <span>Medidas</span>
                  <span>Peso/caja</span>
                  <span>CBM/caja</span>
                  <span>CBM total</span>
                </div>
                {boxes.map((b, i) => {
                  const cbm = boxCbm(b),
                    qty = Math.max(0, Number(b.qty) || 0);
                  return (
                    <div className="productBoxRow" key={b.id || i}>
                      <b className="boxProductName">
                        {b.productName ||
                          data.products?.find((p) => p.id === b.productId)
                            ?.name ||
                          "Producto"}
                      </b>
                      <b>{qty}</b>
                      <span>{b.unitsPerBox || "—"}</span>
                      <span>
                        {b.l} × {b.w} × {b.h} {b.unit}
                      </span>
                      <span>
                        {b.weight} {b.weightUnit}
                      </span>
                      <span>{cbm.toFixed(4)}</span>
                      <b>{(cbm * qty).toFixed(2)}</b>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="boxEmpty">
                Este producto no tiene cajas registradas.
              </p>
            )}
          </div>
          <div className="detailSection">
            <h3>
              <Weight /> Peso y volumen guardados
            </h3>
            <div className="productLogisticsSummary">
              <div>
                <span>CBM total</span>
                <b>{Number(totals.cbm || 0).toFixed(2)} m³</b>
              </div>
              <div>
                <span>Peso crudo total</span>
                <b>{Number(totals.actualKg || 0).toFixed(2)} kg</b>
                <small>{Number(totals.actualLb || 0).toFixed(2)} lb</small>
              </div>
              {data.route === "miami" ? (
                <>
                  <div>
                    <span>China → Miami</span>
                    <b>{Number(totals.cnBillKg || 0).toFixed(2)} kg</b>
                    <small>
                      {Number(totals.cnVolumeKg || 0) >
                      Number(totals.actualKg || 0)
                        ? "Cobro por peso volumétrico"
                        : "Cobro por peso crudo"}
                    </small>
                  </div>
                  <div>
                    <span>Miami → Managua</span>
                    <b>{Number(totals.miBillLb || 0).toFixed(2)} lb</b>
                    <small>
                      {Number(totals.miVolumeLb || 0) >
                      Number(totals.actualLb || 0)
                        ? "Cobro por peso volumétrico"
                        : "Cobro por peso crudo"}
                    </small>
                  </div>
                </>
              ) : (
                <div>
                  <span>Ruta directa</span>
                  <b>{Number(totals.cbm || 0).toFixed(2)} CBM</b>
                  <small>Cobro por espacio</small>
                </div>
              )}
            </div>
          </div>
          <div className="detailSection">
            <h3>Productos y costos</h3>
            <div className="savedProducts">
              {data.products.map((p, i) => (
                <div key={i}>
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt="" />
                  ) : (
                    <span className="noPhoto">Sin foto</span>
                  )}
                  <p>
                    <b>{p.name || "Producto"}</b>
                    <small>
                      {p.qty} × {money(p.price)}
                    </small>
                  </p>
                  <strong>{money(Number(p.qty) * Number(p.price))}</strong>
                </div>
              ))}
            </div>
            <div className="costBreakdown productCosts">
              <div>
                <span>Subtotal productos</span>
                <b>{money(data.totals.productSubtotal)}</b>
              </div>
              <div>
                <span>Comisión ({data.totals.feePercent}%)</span>
                <b>{money(data.totals.feeAmount)}</b>
              </div>
              <div>
                <span>Envío seleccionado</span>
                <b>{money(shipping)}</b>
              </div>
              <div className="selectedCost">
                <span>Costo total puesto en Nicaragua</span>
                <strong>{money(data.total)}</strong>
              </div>
            </div>
          </div>
        </section>
      </div>
      {quote && (
        <QuoteDialog
          product={data}
          onClose={() => setQuote(false)}
          onSaved={onChanged}
        />
      )}
    </>
  );
}

// Los datos del proveedor viajan dentro de la caja del producto ("info"),
// porque el catálogo no tiene columnas propias para ellos.
const infoOf = (product) => product?.boxes?.[0]?.info || {};
const oneBoxCbm = (b) =>
  Number(b?.l || 0) *
  Number(b?.w || 0) *
  Number(b?.h || 0) *
  (b?.unit === "in" ? 0.000016387064 : 0.000001);
const oneBoxKg = (b) =>
  b?.weightUnit === "lb"
    ? Number(b?.weight || 0) / 2.2046226218
    : Number(b?.weight || 0);
const cordobas = (n) =>
  "C$ " +
  ((Number(n) || 0) * DEFAULT_EXCHANGE_RATE).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
// Ficha del producto: cada dato con su nombre, como en la cotización del
// proveedor (Material, Capacity, Weight, Product dimensions, Quantity).
const SPEC_FIELDS = [
  ["material", "Material", "Material", /^(product\s+)?material|^cup body material/i],
  ["capacity", "Capacidad", "Capacity", /capacity|capacidad/i],
  ["weight", "Peso del producto", "Weight", /weight|peso/i],
  ["size", "Medidas del producto", "Product dimensions", /dimension|specification|medida|size/i],
  ["colors", "Colores y cantidad por color", "Quantity", /quantity|colou?r|cantidad/i],
];
// Convierte un texto libre en la ficha: reconoce "Material: PS" y, si las
// líneas no traen nombre, las reparte en el orden de la ficha.
const specsFromText = (text) => {
  const specs = {},
    rest = [];
  const lines = String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const labelled = lines.some((line) => line.includes(":"));
  lines.forEach((line, index) => {
    if (labelled) {
      const cut = line.indexOf(":");
      const label = cut > 0 ? line.slice(0, cut) : "";
      const field = SPEC_FIELDS.find(
        ([key, , , pattern]) => label && pattern.test(label) && !specs[key],
      );
      if (field) specs[field[0]] = line.slice(cut + 1).trim();
      else rest.push(line);
    } else if (index < SPEC_FIELDS.length) {
      specs[SPEC_FIELDS[index][0]] = line;
    } else rest.push(line);
  });
  return { specs, rest: rest.join("\n") };
};
const specsOf = (product) => {
  const info = infoOf(product);
  if (info.specs) return { specs: info.specs, rest: info.description || "" };
  return specsFromText(info.description);
};
function ProductSpecs({ product }) {
  const { specs, rest } = specsOf(product);
  const rows = SPEC_FIELDS.filter(([key]) => specs[key]);
  if (!rows.length && !rest) return null;
  return (
    <div className="catalogSpecs">
      <b>Descripción</b>
      <dl>
        {rows.map(([key, label]) => (
          <div key={key}>
            <dt>{label}:</dt>
            <dd>{specs[key]}</dd>
          </div>
        ))}
      </dl>
      {rest && <p>{rest}</p>}
    </div>
  );
}
const safeLink = (url) => {
  const text = String(url || "").trim();
  if (!text) return "";
  return /^https?:\/\//i.test(text) ? text : "https://" + text;
};

export function RegisterProductDialog({
  onClose,
  onSaved,
  product = null,
  defaults = {},
  options = {},
}) {
  const [form, setForm] = useState({
      name: product?.name || "",
      imageUrl: product?.image_url || "",
      price: product?.unit_price ?? "",
      salePrice: infoOf(product).salePrice ?? "",
      specs: specsOf(product).specs,
      description: specsOf(product).rest,
      category: infoOf(product).category || "",
      supplier: infoOf(product).supplier || defaults.supplier || "",
      group: infoOf(product).group || defaults.group || "",
      url: infoOf(product).url || "",
      notes: infoOf(product).notes || "",
      box: {
        id: product?.boxes?.[0]?.id || crypto.randomUUID(),
        unitsPerBox: product?.boxes?.[0]?.unitsPerBox ?? "",
        l: product?.boxes?.[0]?.l ?? "",
        w: product?.boxes?.[0]?.w ?? "",
        h: product?.boxes?.[0]?.h ?? "",
        unit: product?.boxes?.[0]?.unit || "cm",
        weight: product?.boxes?.[0]?.weight ?? "",
        weightUnit: product?.boxes?.[0]?.weightUnit || "kg",
      },
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const update = (k, v) => setForm((x) => ({ ...x, [k]: v }));
  const updateBox = (k, v) =>
    setForm((x) => ({ ...x, box: { ...x.box, [k]: v } }));
  const boxCbm = oneBoxCbm(form.box),
    perBox = Number(form.box.unitsPerBox || 0);
  async function upload(original) {
    if (!original) return;
    setBusy(true);
    setError("");
    try {
      const file = await shrinkImage(original);
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
          data.error || data.detail || "No se pudo subir la foto",
        );
      update("imageUrl", data.url);
    } catch (e) {
      setError(e.message || "No se pudo subir la foto");
    } finally {
      setBusy(false);
    }
  }
  // Pegar con Ctrl+V un recorte de pantalla lo pone como foto del producto.
  useEffect(() => {
    const onPaste = (event) => {
      const [file] = imagesFromPaste(event);
      if (!file) return;
      event.preventDefault();
      upload(file);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);
  const [gallery, setGallery] = useState(null);
  async function openGallery() {
    try {
      setGallery(galleryOf(await api("/catalog-products")).photos);
    } catch {
      setGallery([]);
    }
  }
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(product ? "/catalog-products/" + product.id : "/catalog-products", {
        method: product ? "PUT" : "POST",
        body: JSON.stringify({
          name: form.name,
          imageUrl: form.imageUrl,
          price: form.price,
          // La cantidad ya no se guarda con el producto: se escribe al cotizar.
          qty: 0,
          boxes: [
            {
              ...form.box,
              qty: "",
              info: {
                salePrice:
                  Number(form.salePrice) > 0 ? Number(form.salePrice) : "",
                specs: Object.fromEntries(
                  SPEC_FIELDS.map(([key]) => [
                    key,
                    String(form.specs[key] || "").trim(),
                  ]),
                ),
                description: form.description.trim(),
                category: form.category.trim(),
                supplier: form.supplier.trim(),
                group: form.group.trim(),
                url: form.url.trim(),
                notes: form.notes.trim(),
              },
            },
          ],
        }),
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <form className="dialog registerProductDialog" onSubmit={submit}>
        <div className="dialogHead">
          <div>
            <small>CATÁLOGO</small>
            <h2>{product ? "Editar producto" : "Registrar producto"}</h2>
          </div>
          <button type="button" onClick={onClose}>
            <X />
          </button>
        </div>
        <div className="rpTop">
          <div className="rpPhoto">
            <label className="catalogPhotoPicker">
              {form.imageUrl ? (
                <img src={form.imageUrl} alt="" />
              ) : (
                <>
                  <ImagePlus />
                  <span>{busy ? "Subiendo…" : "Agregar foto"}</span>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => upload(e.target.files[0])}
              />
            </label>
            <small>
              También puedes pegarla con <b>Ctrl + V</b>
            </small>
            <button type="button" className="rpGalleryButton" onClick={openGallery}>
              Elegir de la galería
            </button>
          </div>
          <div className="rpCol">
            <label className="rpField">
              <span>Nombre del producto *</span>
              <input
                required
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
              />
            </label>
            <label className="rpField">
              <span>
                Precio de compra por unidad (US$) <i>EXW unit price</i>
              </span>
              <input
                type="number"
                min="0"
                step="any"
                value={form.price}
                onChange={(e) => update("price", e.target.value)}
              />
              <em>{Number(form.price) > 0 ? cordobas(form.price) : "C$ —"}</em>
            </label>
            <label className="rpField rpSale">
              <span>Precio de venta por unidad (US$)</span>
              <input
                type="number"
                min="0"
                step="any"
                value={form.salePrice}
                onChange={(e) => update("salePrice", e.target.value)}
              />
              <em>
                {Number(form.salePrice) > 0
                  ? cordobas(form.salePrice) + " por unidad"
                  : "C$ —"}
              </em>
            </label>
          </div>
          <div className="rpCol">
            <label className="rpField">
              <span>Categoría</span>
              <input
                value={form.category}
                placeholder="Ej. Botellas"
                onChange={(e) => update("category", e.target.value)}
              />
            </label>
            <label className="rpField">
              <span>Proveedor</span>
              <input
                list="rpSuppliers"
                value={form.supplier}
                placeholder="Nombre de la fábrica o tienda"
                onChange={(e) => update("supplier", e.target.value)}
              />
              <datalist id="rpSuppliers">
                {(options.suppliers || []).map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </label>
            <label className="rpField">
              <span>Comparar como</span>
              <input
                list="rpGroups"
                value={form.group}
                placeholder="Ej. Botella 700ml (igual en cada proveedor)"
                onChange={(e) => update("group", e.target.value)}
              />
              <datalist id="rpGroups">
                {(options.groups || []).map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </label>
            <label className="rpField">
              <span>Enlace del producto</span>
              <input
                value={form.url}
                placeholder="Alibaba, 1688…"
                onChange={(e) => update("url", e.target.value)}
              />
            </label>
            <label className="rpField">
              <span>Notas</span>
              <input
                value={form.notes}
                placeholder="Mínimo de compra, colores…"
                onChange={(e) => update("notes", e.target.value)}
              />
            </label>
          </div>
        </div>
        {gallery && (
          <div
            className="rpGallery"
            ref={(el) => el?.scrollIntoView({ block: "nearest", behavior: "smooth" })}
          >
            <div>
              <b>Elige una foto de la galería</b>
              <button type="button" onClick={() => setGallery(null)}>
                Cerrar
              </button>
            </div>
            {gallery.length ? (
              <div className="rpGalleryGrid">
                {gallery.map((photo) => (
                  <button
                    type="button"
                    key={photo.id}
                    title={photo.name || photo.product || "Foto"}
                    onClick={() => {
                      update("imageUrl", photo.url);
                      setGallery(null);
                    }}
                  >
                    <img src={photo.url} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
            ) : (
              <p>La galería está vacía. Agrega fotos en la pestaña Fotos.</p>
            )}
          </div>
        )}
        <div className="rpSpecs">
          <h3>
            Descripción <i>Description</i>
          </h3>
          <div className="rpSpecsGrid">
            {SPEC_FIELDS.map(([key, label, supplier]) => (
              <label className="rpField" key={key}>
                <span>
                  {label} <i>{supplier}</i>
                </span>
                <input
                  value={form.specs[key] || ""}
                  onChange={(e) =>
                    update("specs", { ...form.specs, [key]: e.target.value })
                  }
                />
              </label>
            ))}
            <label className="rpField rpSpecsMore">
              <span>Otros detalles</span>
              <input
                value={form.description}
                placeholder="Empaque, logo, tapa…"
                onChange={(e) => update("description", e.target.value)}
              />
            </label>
          </div>
        </div>
        <div className="rpBox">
          <h3>
            <Package /> Caja del proveedor
          </h3>
          <p>
            Copia estos datos de la cotización del proveedor; en gris va el
            nombre de la columna que él usa. La cantidad de unidades y de cajas
            se escribe al crear la cotización.
          </p>
          <div className="rpBoxGrid">
            {[
              ["Productos por caja", "unitsPerBox", "PCS/CTN"],
              ["Largo", "l", "L"],
              ["Ancho", "w", "W"],
              ["Alto", "h", "H"],
            ].map(([label, key, supplier]) => (
              <label className="rpField" key={key}>
                <span>
                  {label} <i>{supplier}</i>
                </span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={form.box[key]}
                  onChange={(e) => updateBox(key, e.target.value)}
                />
              </label>
            ))}
            <label className="rpField">
              <span>Medida</span>
              <select
                value={form.box.unit}
                onChange={(e) => updateBox("unit", e.target.value)}
              >
                <option value="cm">Centímetros</option>
                <option value="in">Pulgadas</option>
              </select>
            </label>
            <label className="rpField">
              <span>
                Peso por caja <i>G.W.</i>
              </span>
              <input
                type="number"
                min="0"
                step="any"
                value={form.box.weight}
                onChange={(e) => updateBox("weight", e.target.value)}
              />
            </label>
            <label className="rpField">
              <span>Unidad de peso</span>
              <select
                value={form.box.weightUnit}
                onChange={(e) => updateBox("weightUnit", e.target.value)}
              >
                <option value="kg">Kilogramos</option>
                <option value="lb">Libras</option>
              </select>
            </label>
          </div>
          <div className="rpCalc">
            <div>
              <span>CBM por caja</span>
              <strong>{boxCbm.toFixed(4)}</strong>
            </div>
            <div>
              <span>CBM por unidad</span>
              <strong>{perBox > 0 ? (boxCbm / perBox).toFixed(6) : "—"}</strong>
            </div>
            <div>
              <span>Peso por unidad</span>
              <strong>
                {perBox > 0
                  ? (oneBoxKg(form.box) / perBox).toFixed(3) + " kg"
                  : "—"}
              </strong>
            </div>
          </div>
        </div>
        {error && (
          <div className="saveError">
            <b>No se pudo guardar</b>
            <span>{error}</span>
          </div>
        )}
        <button className="primary" disabled={busy || !form.name}>
          <Save />
          {busy ? "Guardando…" : product ? "Guardar cambios" : "Guardar producto"}
        </button>
      </form>
    </div>
  );
}

function CatalogSection({ refreshKey, onCatalogChanged, onOptions }) {
  const [items, setItems] = useState([]),
    [loading, setLoading] = useState(true),
    [selected, setSelected] = useState(null),
    [options, setOptions] = useState({ suppliers: [], groups: [] });
  useEffect(() => {
    onOptions?.(options);
  }, [options]);
  async function load() {
    setLoading(true);
    try {
      const rows = await api("/catalog-products");
      setItems(rows.filter(isRealProduct));
      const { products, suppliers } = splitCatalog(rows);
      setOptions({
        suppliers: suppliers.map((s) => s.name),
        groups: comparisonGroups(products).map((g) => g.name),
      });
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [refreshKey]);
  async function remove(e, id) {
    e.stopPropagation();
    if (!confirm("¿Eliminar este producto del catálogo?")) return;
    await api("/catalog-products/" + id, { method: "DELETE" });
    load();
  }
  return (
    <section className="catalogSection">
      <div className="catalogTitle">
        <div>
          <h2>Mis productos</h2>
          <p>Cada producto conserva su foto, precio, proveedor y su caja.</p>
        </div>
        <b>{items.length} guardados</b>
      </div>
      {loading ? (
        <div className="catalogEmpty">Cargando productos…</div>
      ) : items.length ? (
        <div className="catalogGrid">
          {items.map((p) => {
            const box = p.boxes?.[0];
            const info = infoOf(p);
            const perBox = Number(box?.unitsPerBox || 0);
            return (
              <article className="catalogCard catalogCardFull" key={p.id}>
                <div className="catalogProductTop">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} />
                  ) : (
                    <span className="catalogNoPhoto">Sin foto</span>
                  )}
                  <div className="catalogProductIdentity">
                    <small>PRODUCTO GUARDADO</small>
                    <h3>{p.name}</h3>
                    <span>
                      {[info.category, info.supplier]
                        .filter(Boolean)
                        .join(" · ") || "Sin categoría ni proveedor"}
                    </span>
                  </div>
                  <div className="catalogCardActions">
                    <button
                      className="catalogEditButton"
                      onClick={() => setSelected(p)}
                      title="Ver y editar producto"
                    >
                      <Pencil /> <span>Editar</span>
                    </button>
                    <button
                      className="catalogDeleteButton"
                      onClick={(e) => remove(e, p.id)}
                      title="Eliminar del catálogo"
                    >
                      <Trash2 />
                    </button>
                  </div>
                </div>

                <div className="catalogProductSummary">
                  <div><span>Precio de compra</span><strong>{money(p.unit_price)}</strong><small>{cordobas(p.unit_price)}</small></div>
                  <div className="saleSummary"><span>Precio de venta</span><strong>{Number(info.salePrice) > 0 ? money(info.salePrice) : "—"}</strong><small>{Number(info.salePrice) > 0 ? cordobas(info.salePrice) : "Sin precio"}</small></div>
                  <div><span>Productos por caja</span><strong>{perBox ? perBox.toLocaleString() : "—"}</strong></div>
                  <div><span>Medidas de la caja</span><strong>{box?.l ? `${box.l} × ${box.w} × ${box.h} ${box.unit === "in" ? "in" : "cm"}` : "—"}</strong></div>
                  <div><span>Peso por caja</span><strong>{box?.weight ? `${box.weight} ${box.weightUnit || "kg"}` : "—"}</strong></div>
                  <div className="cbmSummary"><span>CBM por caja</span><strong>{oneBoxCbm(box).toFixed(4)}</strong></div>
                  <div className="cbmSummary"><span>CBM por unidad</span><strong>{perBox ? (oneBoxCbm(box) / perBox).toFixed(6) : "—"}</strong></div>
                </div>
                <ProductSpecs product={p} />
                {(info.url || info.notes) && (
                  <div className="catalogInfoLine">
                    {info.url && (
                      <a
                        href={safeLink(info.url)}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        Ver en la página del proveedor ↗
                      </a>
                    )}
                    {info.notes && <span>{info.notes}</span>}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="catalogEmpty">
          <PackageSearch />
          <b>Aún no hay productos guardados</b>
          <span>
            Pulsa “Registrar producto” para guardar tu primer producto con su
            foto, precio y cajas.
          </span>
        </div>
      )}
      {selected && (
        <CatalogProductDetail
          options={options}
          product={selected}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setSelected(null);
            load();
            onCatalogChanged();
          }}
        />
      )}
    </section>
  );
}

function CatalogProductDetail({ product, onClose, onSaved, options }) {
  const boxes = product.boxes || [];
  const [editing, setEditing] = useState(false);
  const cbm = (b) =>
    Number(b.l || 0) *
    Number(b.w || 0) *
    Number(b.h || 0) *
    (b.unit === "in" ? 0.000016387064 : 0.000001);
  return (
    <div
      className="overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section className="catalogDetail">
        <div className="dialogHead">
          <div>
            <small>PRODUCTO GUARDADO</small>
            <h2>{product.name}</h2>
          </div>
          <div className="catalogDetailActions">
            <button className="editCatalogProduct" onClick={() => setEditing(true)}>
              <Pencil /> Editar producto
            </button>
            <button onClick={onClose} aria-label="Cerrar"><X /></button>
          </div>
        </div>
        <div className="catalogDetailHero">
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} />
          ) : (
            <span className="catalogNoPhoto">Sin foto</span>
          )}
          <div>
            <span>Precio de compra por unidad</span>
            <strong>{money(product.unit_price)}</strong>
            <span>
              Precio de venta:{" "}
              {Number(infoOf(product).salePrice) > 0
                ? `${money(infoOf(product).salePrice)} · ${cordobas(infoOf(product).salePrice)}`
                : "sin definir"}
            </span>
            <small>
              {[infoOf(product).category, infoOf(product).supplier]
                .filter(Boolean)
                .join(" · ") || "La cantidad se escribe al crear la cotización"}
            </small>
          </div>
        </div>
        <ProductSpecs product={product} />
        <h3>
          <Package /> Información de la caja
        </h3>
        {boxes.length ? (
          <div className="catalogDetailBoxes">
            {boxes.slice(0, 1).map((b, i) => (
              <article key={b.id || i}>
                <b>Caja del proveedor</b>
                <span>{b.unitsPerBox || 0} productos por caja</span>
                <span>
                  {b.l || 0} × {b.w || 0} × {b.h || 0}{" "}
                  {b.unit === "in" ? "pulgadas" : "cm"}
                </span>
                <span>
                  {b.weight || 0} {b.weightUnit || "kg"} por caja
                </span>
                <strong>{cbm(b).toFixed(4)} CBM por caja</strong>
              </article>
            ))}
          </div>
        ) : (
          <p>Sin información de caja.</p>
        )}
      </section>
      {editing && (
        <RegisterProductDialog
          options={options}
          product={product}
          onClose={() => setEditing(false)}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}

export default function ProductsPage({ refreshKey, onChange }) {
  const [registering, setRegistering] = useState(false),
    [catalogRefresh, setCatalogRefresh] = useState(0),
    [options, setOptions] = useState({ suppliers: [], groups: [] });
  function saved() {
    setCatalogRefresh((x) => x + 1);
    onChange();
  }
  return (
    <div className="workspace">
      <div className="pageHead">
        <div>
          <small>CATÁLOGO PERMANENTE</small>
          <h1>Productos</h1>
          <p>
            Registra y administra tus productos. Los cálculos se realizan
            únicamente en la pestaña Crear cotización.
          </p>
        </div>
        <button className="newProduct" onClick={() => setRegistering(true)}>
          <Plus /> Registrar producto
        </button>
      </div>
      <CatalogSection
        refreshKey={refreshKey + catalogRefresh}
        onCatalogChanged={saved}
        onOptions={setOptions}
      />
      {registering && (
        <RegisterProductDialog
          options={options}
          onClose={() => setRegistering(false)}
          onSaved={saved}
        />
      )}
    </div>
  );
}
