import React, { useEffect, useState } from "react";
import {
  Search,
  FileText,
  CheckCircle2,
  X,
  Pencil,
  Trash2,
  Phone,
  Package,
  Route,
  CalendarDays,
  StickyNote,
  Printer,
  Plus,
} from "lucide-react";
import "./detail.css";
import "./product-detail.css";

const money = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    n || 0,
  );
const cordobas = (n) =>
  `C$${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format((n || 0) * 37)}`;
const labels = {
  pending: "Pendiente",
  returned: "Archivada",
  confirmed: "Confirmada",
  purchased: "Comprada",
  transit: "En tránsito",
  delivered: "Entregada",
  cancelled: "Cancelada",
};
const steps = ["confirmed", "purchased", "transit", "delivered"];
async function api(path, options) {
  const r = await fetch("/api" + path, {
    headers: { "content-type": "application/json" },
    ...options,
  });
  if (!r.ok) throw new Error((await r.json()).error || "No se pudo completar");
  return r.status === 204 ? null : r.json();
}
const boxCbm = (b) =>
  Number(b.l || 0) *
  Number(b.w || 0) *
  Number(b.h || 0) *
  (b.unit === "cm" ? 0.000001 : 0.000016387064);
const KG_TO_LB = 2.2046226218;
const productFreight = (boxes, rates = {}) =>
  boxes.reduce(
    (a, b) => {
      const q = Number(b.qty || 0),
        cm = b.unit === "cm" ? 1 : 2.54,
        inch = b.unit === "in" ? 1 : 1 / 2.54,
        kg = Number(b.weight || 0) * (b.weightUnit === "lb" ? 1 / KG_TO_LB : 1),
        lb = kg * KG_TO_LB,
        volKg =
          (Number(b.l || 0) *
            cm *
            Number(b.w || 0) *
            cm *
            Number(b.h || 0) *
            cm) /
          Number(rates.cnDivisor || 5000),
        volLb =
          (Number(b.l || 0) *
            inch *
            Number(b.w || 0) *
            inch *
            Number(b.h || 0) *
            inch) /
          Number(rates.miDivisor || 166);
      a.cnBill += Math.max(kg, volKg) * q;
      a.miBill += Math.max(lb, volLb) * q;
      a.actualKg += kg * q;
      return a;
    },
    { cnBill: 0, miBill: 0, actualKg: 0 },
  );
const productLogistics = (data, product) => {
  const boxes = (data.boxes || []).filter(
      (b) =>
        b.productId === product.id ||
        (!b.productId && b.productName === product.name),
    ),
    boxCount = boxes.reduce((sum, b) => sum + Number(b.qty || 0), 0),
    totalCbm = boxes.reduce(
      (sum, b) => sum + boxCbm(b) * Number(b.qty || 0),
      0,
    );
  const mainBox = boxes[0] || {};
  return {
    boxCount,
    totalCbm,
    unitCbm: Number(product.qty || 0) > 0 ? totalCbm / Number(product.qty) : 0,
    boxSize: mainBox.l
      ? `${mainBox.l} × ${mainBox.w} × ${mainBox.h} ${mainBox.unit === "in" ? "in" : "cm"}`
      : "Sin medida",
  };
};

function ClientQuote({ data, onClose, onConfirmed, onDeleted }) {
  const total = Number(data.totals?.saleTotal ?? Number(data.total || 0) * 1.3),
    totalUnits = Number(data.totals?.totalUnits || 0),
    totalBoxes = Number(
      data.total_boxes ??
        (data.boxes || []).reduce((sum, b) => sum + Number(b.qty || 0), 0),
    ),
    totalCbm = Number(
      data.totals?.cbm ??
        (data.boxes || []).reduce(
          (sum, b) => sum + boxCbm(b) * Number(b.qty || 0),
          0,
        ),
    );
  async function confirmQuote() {
    if (
      !window.confirm(
        "¿El cliente confirmó esta cotización? Se registrará en Órdenes.",
      )
    )
      return;
    await api(`/records/${data.id}/promote`, { method: "POST" });
    onConfirmed();
    onClose();
  }
  async function deleteQuote() {
    if (
      !window.confirm(
        "¿Eliminar esta cotización? También se borrará de Cotizaciones internas. Esta acción no se puede deshacer.",
      )
    )
      return;
    await api(`/records/${data.id}`, { method: "DELETE" });
    onDeleted();
    onClose();
  }
  return (
    <div className="clientQuoteOverlay">
      <section className="clientQuotePrint">
        <div className="clientQuoteTools">
          <button onClick={onClose}>
            <X /> Cerrar
          </button>
          <button className="clientDelete" onClick={deleteQuote}>
            <Trash2 /> Eliminar
          </button>
          <button className="clientConfirmed" onClick={confirmQuote}>
            <CheckCircle2 /> Cliente confirmó
          </button>
          <button className="printQuote" onClick={() => window.print()}>
            <Printer /> Imprimir / guardar PDF
          </button>
        </div>
        <header className="clientQuoteHeader">
          <div className="quoteBrand">
            <span>CC</span>
            <div>
              <b>CotizacionesChina</b>
              <small>Compras y logística internacional</small>
            </div>
          </div>
          <div className="quoteTitle">
            <small>COTIZACIÓN PARA CLIENTE</small>
            <strong>{data.number}</strong>
          </div>
        </header>
        <div className="clientQuoteMeta">
          <div>
            <small>PREPARADA PARA</small>
            <strong>{data.customer_name}</strong>
            {data.phone && <span>{data.phone}</span>}
          </div>
          <div>
            <small>FECHA</small>
            <strong>
              {new Date(data.created_at).toLocaleDateString("es-NI", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </strong>
            <span>Entrega en Managua, Nicaragua</span>
          </div>
        </div>
        <div className="clientProductTableWrap">
          <div className="clientProductTable">
            <div className="clientProductHead clientProductLogistics">
              <span>Producto</span>
              <span>Unidades</span>
              <span>Cajas</span>
              <span>Tamaño de caja</span>
              <span>CBM/unidad</span>
              <span>CBM total</span>
              <span>Precio por unidad</span>
              <span>Subtotal</span>
            </div>
            {data.products?.length ? (
              <>
                {data.products.map((p, i) => {
                  const logistics = productLogistics(data, p);
                  return (
                    <div
                      className="clientProductRow clientProductLogistics"
                      key={p.id || i}
                    >
                      <div className="clientProductCell">
                        {p.imageUrl ? (
                          <img
                            className="clientProductPhoto"
                            src={p.imageUrl}
                            alt={p.name || "Producto"}
                          />
                        ) : (
                          <span className="clientProductNoPhoto">Sin foto</span>
                        )}
                        <b>{p.name || "Producto"}</b>
                      </div>
                      <b>{Number(p.qty || 0).toLocaleString()}</b>
                      <b>{logistics.boxCount.toLocaleString()}</b>
                      <b className="clientBoxSize">{logistics.boxSize}</b>
                      <b>{logistics.unitCbm.toFixed(6)}</b>
                      <b>{logistics.totalCbm.toFixed(4)}</b>
                      <div className="clientDualPrice">
                        <b>US{money(p.salePrice ?? p.price)}</b>
                        <small>
                          {cordobas(Number(p.salePrice ?? p.price))}
                        </small>
                      </div>
                      <b>
                        {money(
                          Number(p.qty || 0) *
                            Number((p.salePrice ?? p.price) || 0),
                        )}
                      </b>
                    </div>
                  );
                })}
              </>
            ) : (
              <div className="clientProductRow">
                <span>{data.description || "Productos cotizados"}</span>
                <b>{totalUnits.toLocaleString()}</b>
              </div>
            )}
          </div>
        </div>
        <div className="clientQuoteSummary">
          <div>
            <span>Total de unidades</span>
            <b>{totalUnits.toLocaleString()}</b>
          </div>
          <div>
            <span>Total de cajas</span>
            <b>{totalBoxes.toLocaleString()}</b>
          </div>
          <div>
            <span>CBM total</span>
            <b>{totalCbm.toFixed(4)} m³</b>
          </div>
          <div className="clientGrandTotal">
            <span>
              Total puesto en Managua
              <br />
              <small>Incluyendo envío</small>
            </span>
            <strong>{money(total)}</strong>
          </div>
        </div>
        <div className="clientQuoteNotes">
          <b>Servicio incluido</b>
          <p>
            Compra, gestión logística y envío de los productos hasta Managua,
            Nicaragua.
          </p>
        </div>
        <footer>
          <span>Gracias por confiar en CotizacionesChina.</span>
          <b>Cotización válida sujeta a confirmación de disponibilidad.</b>
        </footer>
      </section>
    </div>
  );
}

function ClientDetail({ id, onClose, onConfirmed, onDeleted }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    api("/records/" + id).then(setData);
  }, [id]);
  if (!data)
    return (
      <div className="overlay">
        <div className="detailSheet loadingDetail">
          Preparando cotización para el cliente…
        </div>
      </div>
    );
  return (
    <ClientQuote
      data={data}
      onClose={onClose}
      onConfirmed={onConfirmed}
      onDeleted={onDeleted}
    />
  );
}

function Detail({ id, type, onClose, onChanged }) {
  const [data, setData] = useState(null),
    [edit, setEdit] = useState(false),
    [form, setForm] = useState(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api("/records/" + id).then((x) => {
      setData(x);
      setForm({ ...x });
    });
  }, [id]);
  if (!data)
    return (
      <div className="overlay">
        <div className="detailSheet loadingDetail">Cargando expediente…</div>
      </div>
    );
  const totals = data.totals || {},
    rates = data.rates || {},
    shownRoute = edit ? form.route : data.route,
    selectedShipping =
      shownRoute === "miami"
        ? Number(totals.viaMiami || 0)
        : Number(totals.direct || 0),
    routeTotal =
      shownRoute === "miami"
        ? (totals.landedMiami ?? totals.viaMiami)
        : (totals.landedDirect ?? totals.direct),
    productSubtotal =
      Number(totals.productSubtotal) ||
      data.products?.reduce(
        (sum, p) => sum + Number(p.qty || 0) * Number(p.price || 0),
        0,
      ) ||
      0,
    totalCbm = Number(totals.cbm || 0);
  const prepared = (data.products || []).map((p) => {
      const boxes = (data.boxes || []).filter(
          (b) =>
            b.productId === p.id || (!b.productId && b.productName === p.name),
        ),
        cbm = boxes.reduce((sum, b) => sum + boxCbm(b) * Number(b.qty || 0), 0),
        freight = productFreight(boxes, rates);
      return {
        p,
        boxes,
        cbm,
        freight,
        purchase: Number(p.qty || 0) * Number(p.price || 0),
      };
    }),
    totalMiamiBasis = prepared.reduce(
      (s, x) =>
        s +
        x.freight.cnBill * Number(rates.cnRate || 2) +
        x.freight.miBill * Number(rates.miRate || 1.5),
      0,
    );
  const productBreakdown = prepared.map((x) => {
    const { p, boxes, cbm, freight, purchase } = x,
      share =
        shownRoute === "miami"
          ? totalMiamiBasis > 0
            ? (freight.cnBill * Number(rates.cnRate || 2) +
                freight.miBill * Number(rates.miRate || 1.5)) /
              totalMiamiBasis
            : 0
          : totals.directChargeBy === "weight" &&
              Number(totals.actualKg || 0) > 0
            ? freight.actualKg / Number(totals.actualKg)
            : totalCbm > 0
              ? cbm / totalCbm
              : productSubtotal > 0
                ? purchase / productSubtotal
                : 0,
      shipping = selectedShipping * share,
      commission = (purchase * Number(totals.feePercent || 0)) / 100,
      totalCost = purchase + commission + shipping,
      units = Number(p.qty || 0),
      unitCost = units ? totalCost / units : 0,
      saleUnit = Number(p.salePrice || 0),
      saleTotal = units * saleUnit,
      profit = saleTotal - totalCost,
      unitProfit = saleUnit - unitCost,
      profitPercent = unitCost > 0 ? (unitProfit / unitCost) * 100 : 0;
    return {
      p,
      boxes,
      cbm,
      freight,
      purchase,
      shipping,
      commission,
      totalCost,
      unitCost,
      saleUnit,
      saleTotal,
      profit,
      unitProfit,
      profitPercent,
    };
  });
  const f = (k, v) => setForm((x) => ({ ...x, [k]: v }));
  async function save() {
    setBusy(true);
    try {
      await api("/records/" + id, {
        method: "PATCH",
        body: JSON.stringify({ ...form, total: routeTotal }),
      });
      setData({ ...data, ...form, total: routeTotal });
      setEdit(false);
      onChanged();
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    const isOrder = data.record_type === "order",
      message = isOrder
        ? "¿Quitar esta orden? Se conservará en Cotizaciones internas y Cotizaciones para clientes."
        : "¿Eliminar esta cotización permanentemente? Esta acción no se puede deshacer.";
    if (!confirm(message)) return;
    setBusy(true);
    try {
      await api("/records/" + id + (isOrder ? "/revert" : ""), {
        method: isOrder ? "POST" : "DELETE",
      });
      onChanged();
      onClose();
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section className="detailSheet">
        <div className="detailTop">
          <div>
            <span className={"badge " + data.status}>
              {labels[data.status]}
            </span>
            <small>
              {data.record_type === "quote"
                ? "EXPEDIENTE DE COTIZACIÓN"
                : "EXPEDIENTE DE ORDEN"}
            </small>
            <h2>{data.number}</h2>
          </div>
          <button className="iconBtn" onClick={onClose}>
            <X />
          </button>
        </div>
        <div className="detailActions">
          {!edit && (
            <>
              {type === "quote" && (
                <button onClick={() => setEdit(true)}>
                  <Pencil /> Editar
                </button>
              )}
              <button className="danger" disabled={busy} onClick={remove}>
                <Trash2 /> {type === "order" ? "Quitar de órdenes" : "Eliminar"}
              </button>
            </>
          )}
        </div>
        <div className="internalQuoteV2">
          <section className="internalOverview">
            <div>
              <small>CLIENTE</small>
              {edit ? (
                <input
                  value={form.customer_name}
                  onChange={(e) => f("customer_name", e.target.value)}
                />
              ) : (
                <b>{data.customer_name}</b>
              )}
              <span>
                <Phone />{" "}
                {edit ? (
                  <input
                    value={form.phone}
                    onChange={(e) => f("phone", e.target.value)}
                  />
                ) : (
                  data.phone || "Sin teléfono"
                )}
              </span>
            </div>
            <div>
              <small>DESCRIPCIÓN</small>
              {edit ? (
                <input
                  value={form.description}
                  onChange={(e) => f("description", e.target.value)}
                />
              ) : (
                <b>{data.description || "Sin descripción"}</b>
              )}
              <span>
                <CalendarDays /> {new Date(data.created_at).toLocaleString()}
              </span>
            </div>
            <div>
              <small>RUTA COTIZADA</small>
              {edit ? (
                <select
                  value={form.route}
                  onChange={(e) => f("route", e.target.value)}
                >
                  <option value="miami">Vía 1 · China–Miami–Managua</option>
                  <option value="direct">Vía 2 · China–Managua</option>
                </select>
              ) : (
                <b className="chosenRoute">
                  {shownRoute === "miami"
                    ? "China → Miami → Managua"
                    : "China → Managua"}
                </b>
              )}
              <span>{money(selectedShipping)} de envío</span>
            </div>
          </section>
          <section className="internalBlock">
            <header>
              <div>
                <span>01</span>
                <h3>Productos de la cotización</h3>
              </div>
              <small>
                Compra, empaque, costo real, venta y ganancia por producto
              </small>
            </header>
            <div className="combinedProductTableWrap">
              <div className="combinedProductTable">
                <div className="combinedProductHead">
                  <span>Producto</span>
                  <span>Compra</span>
                  <span>Comisión</span>
                  <span>Envío asignado</span>
                  <span>Total puesto</span>
                  <span>Costo/unidad</span>
                  <span>Venta/unidad</span>
                  <span>Ganancia/unidad</span>
                  <span>Cajas</span>
                  <span>CBM</span>
                  <span>Información de caja</span>
                </div>
                {productBreakdown.map(
                  (
                    {
                      p,
                      boxes,
                      purchase,
                      commission,
                      shipping,
                      totalCost,
                      unitCost,
                      saleUnit,
                      saleTotal,
                      profit,
                      unitProfit,
                      profitPercent,
                      cbm,
                    },
                    i,
                  ) => {
                    const box = boxes[0] || {},
                      boxCount = boxes.reduce(
                        (s, b) => s + Number(b.qty || 0),
                        0,
                      );
                    return (
                      <article className="combinedProductRow" key={p.id || i}>
                        <div className="quoteProductIdentity">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt={p.name || "Producto"} />
                          ) : (
                            <span className="noPhoto">Sin foto</span>
                          )}
                          <div>
                            <b>{p.name || "Producto"}</b>
                            <small>
                              {Number(p.qty || 0).toLocaleString()} unidades ×{" "}
                              {money(p.price)}
                            </small>
                          </div>
                        </div>
                        <b>{money(purchase)}</b>
                        <b>{money(commission)}</b>
                        <b>{money(shipping)}</b>
                        <strong className="productLandedTotal">
                          {money(totalCost)}
                        </strong>
                        <b>{money(unitCost)}</b>
                        <div className="inlineSale">
                          <b>{saleUnit > 0 ? money(saleUnit) : "Pendiente"}</b>
                          <small>
                            {saleUnit > 0
                              ? `${money(saleTotal)} total`
                              : "Sin precio"}
                          </small>
                        </div>
                        <div
                          className={
                            profit >= 0
                              ? "inlineProfit positive"
                              : "inlineProfit negative"
                          }
                        >
                          <b>{saleUnit > 0 ? money(unitProfit) : "—"}</b>
                          <small>
                            {saleUnit > 0
                              ? `${profitPercent >= 0 ? "+" : ""}${profitPercent.toFixed(2)}% · ${money(profit)}`
                              : "—"}
                          </small>
                        </div>
                        <b>{boxCount}</b>
                        <b>{cbm.toFixed(4)}</b>
                        <div className="quoteBoxInfo">
                          <b>
                            {box.l
                              ? `${box.l} × ${box.w} × ${box.h} ${box.unit}`
                              : "Sin caja"}
                          </b>
                          <span>
                            {box.weight || 0} {box.weightUnit || "kg"} ·{" "}
                            {box.unitsPerBox || "—"} productos/caja
                          </span>
                        </div>
                      </article>
                    );
                  },
                )}
              </div>
            </div>
            <p className="allocationMethod">
              {shownRoute === "miami"
                ? "El envío se asigna según el peso facturable de cada producto en China–Miami y Miami–Managua."
                : "El envío se asigna según el CBM que ocupa cada producto."}
            </p>
          </section>
          <section className="internalBlock">
            <header>
              <div>
                <span>02</span>
                <h3>Envío y total de la cotización</h3>
              </div>
              <small>Ruta seleccionada y costos generales</small>
            </header>
            <div className="quoteLogistics">
              <div>
                <small>Ruta</small>
                <b>
                  {shownRoute === "miami"
                    ? "Vía 1 · Dos trayectos"
                    : "Vía 2 · Directa"}
                </b>
                <span>
                  {shownRoute === "miami"
                    ? `${money(totals.cnCost)} + ${money(totals.miCost)}`
                    : `${Number(totals.billCbm || totals.cbm || 0).toFixed(3)} CBM cobrados por ${totals.directChargeBy === "weight" ? "peso" : totals.directChargeBy === "minimum" ? "mínimo" : "volumen"}`}
                </span>
              </div>
              <div>
                <small>Peso total</small>
                <b>{Number(totals.actualKg || 0).toFixed(2)} kg</b>
                <span>{Number(totals.actualLb || 0).toFixed(2)} lb</span>
              </div>
              <div>
                <small>CBM total</small>
                <b>{Number(totals.cbm || 0).toFixed(4)}</b>
                {shownRoute === "direct" && (
                  <span>
                    Por peso: {Number(totals.weightCbm || 0).toFixed(4)}
                  </span>
                )}
              </div>
              <div>
                <small>Envío</small>
                <b>{money(selectedShipping)}</b>
              </div>
            </div>
            <div className="quoteTotalStrip">
              <span>
                Productos {money(totals.productSubtotal)} + Comisión{" "}
                {money(totals.feeAmount)} + Envío {money(selectedShipping)}
              </span>
              <strong>{money(edit ? routeTotal : data.total)}</strong>
            </div>
          </section>
          <section className="internalNotes">
            <h3>
              <StickyNote /> Notas
            </h3>
            {edit ? (
              <textarea
                value={form.notes}
                onChange={(e) => f("notes", e.target.value)}
              />
            ) : (
              <p>{data.notes || "Sin notas"}</p>
            )}
          </section>
        </div>
        {edit && (
          <div className="editFooter">
            <button
              onClick={() => {
                setEdit(false);
                setForm({ ...data });
              }}
            >
              Cancelar
            </button>
            <button
              className="primary"
              disabled={!form.customer_name || busy}
              onClick={save}
            >
              {busy ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

export default function RecordsPage({
  type,
  refreshKey,
  onChange,
  onCreateQuote,
}) {
  const [rows, setRows] = useState([]),
    [query, setQuery] = useState(""),
    [loading, setLoading] = useState(true),
    [selected, setSelected] = useState(null);
  const isClient = type === "client",
    recordType = isClient ? "quote" : type;
  async function load() {
    setLoading(true);
    try {
      setRows(await api(`/records?type=${recordType}`));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [type, refreshKey]);
  const filtered = rows.filter((x) =>
    (x.customer_name + " " + x.number + " " + (x.description || ""))
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  async function promote(e, id) {
    e.stopPropagation();
    await api(`/records/${id}/promote`, { method: "POST" });
    load();
    onChange();
  }
  async function status(e, id) {
    e.stopPropagation();
    await api(`/records/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: e.target.value }),
    });
    load();
  }
  async function removeRow(e, id) {
    e.stopPropagation();
    if (
      !window.confirm(
        "¿Quitar esta orden? Se conservará en Cotizaciones internas y Cotizaciones para clientes.",
      )
    )
      return;
    await api(`/records/${id}/revert`, { method: "POST" });
    load();
    onChange();
  }
  async function deleteClientQuote(e, id) {
    e.stopPropagation();
    if (
      !window.confirm(
        "¿Eliminar esta cotización? También se borrará de Cotizaciones internas. Esta acción no se puede deshacer.",
      )
    )
      return;
    await api(`/records/${id}`, { method: "DELETE" });
    load();
    onChange();
  }
  return (
    <div className="workspace">
      <div className="pageHead">
        <div>
          <small>
            {isClient
              ? "DOCUMENTOS PARA ENVIAR"
              : type === "quote"
                ? "VENTAS"
                : "LOGÍSTICA"}
          </small>
          <h1>
            {isClient
              ? "Cotizaciones para clientes"
              : type === "quote"
                ? "Cotizaciones internas"
                : "Órdenes en proceso"}
          </h1>
          <p>
            {isClient
              ? "Precios finales con ganancia y envío incluidos, listos para imprimir."
              : type === "quote"
                ? "Edita, revisa o confirma cada propuesta."
                : "Abre una orden para ver, actualizar o eliminar su expediente."}
          </p>
        </div>
        {isClient && (
          <button className="newClientQuote" onClick={onCreateQuote}>
            <Plus /> Crear cotización
          </button>
        )}
      </div>
      <div className="stats">
        <div>
          <span>Total</span>
          <b>{rows.length}</b>
        </div>
        <div>
          <span>{type === "order" ? "En proceso" : "Pendientes"}</span>
          <b>
            {
              rows.filter((x) =>
                type === "order"
                  ? x.status !== "delivered"
                  : x.status === "pending",
              ).length
            }
          </b>
        </div>
        <div>
          <span>{isClient ? "Valor de venta" : "Valor"}</span>
          <b>
            {money(
              rows.reduce(
                (s, x) =>
                  s +
                  (isClient
                    ? Number(x.totals?.saleTotal ?? x.total * 1.3)
                    : Number(x.total)),
                0,
              ),
            )}
          </b>
        </div>
      </div>
      <section className="panel records">
        <div className="search">
          <Search />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar cliente o número…"
          />
        </div>
        {loading ? (
          <div className="empty">Cargando…</div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            <FileText />
            <h3>No hay registros</h3>
            <p>
              {type === "order"
                ? "Las cotizaciones confirmadas aparecerán aquí."
                : "Crea una cotización desde la sección Calcular."}
            </p>
          </div>
        ) : (
          <div className="recordList">
            {filtered.map((x) => {
              const shownTotal = isClient
                ? Number(x.totals?.saleTotal ?? x.total * 1.3)
                : Number(x.total);
              return (
                <article
                  className="record clickable"
                  key={x.id}
                  onClick={() => setSelected(x.id)}
                >
                  <div className="recordMain">
                    <span className={"badge " + x.status}>
                      {labels[x.status]}
                    </span>
                    <b>{x.number}</b>
                    <h3>{x.customer_name}</h3>
                    <p>
                      {x.description || "Sin descripción"} · {x.total_boxes}{" "}
                      cajas
                      {isClient
                        ? " · Envío incluido"
                        : " · " +
                          (x.route === "miami" ? "Vía Miami" : "Vía directa")}
                    </p>
                  </div>
                  <div className="recordSide">
                    <strong>{money(shownTotal)}</strong>
                    <small>{new Date(x.created_at).toLocaleDateString()}</small>
                    {isClient ? (
                      <div className="clientRowActions">
                        <button
                          className="confirm"
                          onClick={(e) => promote(e, x.id)}
                        >
                          <CheckCircle2 /> Cliente confirmó
                        </button>
                        <button
                          className="clientRowDelete"
                          onClick={(e) => deleteClientQuote(e, x.id)}
                        >
                          <Trash2 /> Eliminar
                        </button>
                      </div>
                    ) : type === "quote" ? (
                      <button
                        className="confirm"
                        onClick={(e) => promote(e, x.id)}
                      >
                        <CheckCircle2 /> Cliente confirmó
                      </button>
                    ) : type === "order" ? (
                      <div className="orderRowActions">
                        <select
                          value={x.status}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => status(e, x.id)}
                        >
                          {steps.map((s) => (
                            <option key={s} value={s}>
                              {labels[s]}
                            </option>
                          ))}
                        </select>
                        <button
                          className="orderDelete"
                          onClick={(e) => removeRow(e, x.id)}
                        >
                          <Trash2 /> Quitar
                        </button>
                      </div>
                    ) : (
                      <span className="readyToSend">
                        <Printer /> Lista para imprimir
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      {selected &&
        (isClient ? (
          <ClientDetail
            id={selected}
            onClose={() => setSelected(null)}
            onConfirmed={() => {
              load();
              onChange();
            }}
            onDeleted={() => {
              load();
              onChange();
            }}
          />
        ) : (
          <Detail
            id={selected}
            type={type}
            onClose={() => setSelected(null)}
            onChanged={() => {
              load();
              onChange();
            }}
          />
        ))}
    </div>
  );
}
