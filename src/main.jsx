import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Ship,
  Plane,
  Settings2,
  Ruler,
  ArrowRight,
  CheckCircle2,
  Info,
  Calculator,
  FileText,
  ClipboardList,
  X,
  Save,
  ReceiptText,
  TrendingUp,
  PackageSearch,
  Users,
  LogOut,
  UserCog,
  Lock,
} from "lucide-react";
import "./style.css";
import "./route-breakdown.css";
import "./app.css";
import { calculate } from "./calculate.js";
import RecordsPage from "./RecordsPage.jsx";
import WeightBreakdown from "./WeightBreakdown.jsx";
import ProductSection, { blankProduct } from "./ProductSection.jsx";
import ProfitPage from "./ProfitPage.jsx";
import ProductsPage from "./ProductsPage.jsx";
import ClientsPage from "./ClientsPage.jsx";
import UsersPage from "./UsersPage.jsx";
import AuthPage from "./AuthPage.jsx";
import PortalPage from "./PortalPage.jsx";
import { authFetch, clearSession, getSession } from "./auth.js";
import "./landed.css";
import "./dark.css";
const money = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    n || 0,
  );
const initialRates = {
  cnRate: 2,
  miRate: 1.5,
  cbmRate: 550,
  cnDivisor: 5000,
  miDivisor: 166,
  minCbm: true,
  directKgPerCbm: 350,
  exchangeRate: 36.62,
};
const statusLabel = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  purchased: "Comprada",
  transit: "En tránsito",
  delivered: "Entregada",
  cancelled: "Cancelada",
};
const statusSteps = ["confirmed", "purchased", "transit", "delivered"];
async function api(path, options) {
  const res = await authFetch("/api" + path, {
    headers: { "content-type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      [data.error, data.detail].filter(Boolean).join(": ") ||
        "No se pudo completar",
    );
  }
  return res.status === 204 ? null : res.json();
}
function Field({ label, value, onChange, type = "number", suffix }) {
  return (
    <label className="field">
      <span>{label}</span>
      <div>
        <input
          type={type}
          step="any"
          min={type === "number" ? 0 : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        {suffix && <em>{suffix}</em>}
      </div>
    </label>
  );
}
function Nav({ page, setPage, currentUser }) {
  return (
    <nav className="mainNav">
      {[
        ["calculator", Calculator, "Crear cotización", "Crear"],
        ["products", PackageSearch, "Productos", "Productos"],
        ["customers", Users, "Clientes", "Clientes"],
        ["quotes", FileText, "Cotizaciones internas", "Internas"],
        [
          "clientQuotes",
          ReceiptText,
          "Cotizaciones para clientes",
          "Cotizaciones",
        ],
        ["orders", ClipboardList, "Órdenes", "Órdenes"],
        ["profits", TrendingUp, "Ganancias", "Ganancias"],
        ...(currentUser?.role === "admin"
          ? [["users", UserCog, "Usuarios", "Usuarios"]]
          : []),
      ].map(([id, Icon, label, short]) => (
        <button
          key={id}
          className={page === id ? "active" : ""}
          onClick={() => setPage(id)}
        >
          <Icon />
          <span className="navFull">{label}</span>
          <span className="navShort">{short}</span>
        </button>
      ))}
    </nav>
  );
}
function SaveDialog({
  onClose,
  onSave,
  result,
  boxes,
  rates,
  products,
  initialCustomer,
}) {
  const [form, setForm] = useState({
    customer: initialCustomer?.name || "",
    phone: initialCustomer?.phone || "",
    description: products
      .map((p) => p.name)
      .filter(Boolean)
      .join(", "),
    notes: "",
    selectedRoute: result.best,
  });
  const [items, setItems] = useState(
    products.map((p) => ({ ...p, salePrice: p.salePrice ?? "" })),
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const change = (k, v) => setForm((x) => ({ ...x, [k]: v }));
  const internalTotal =
    form.selectedRoute === "miami" ? result.landedMiami : result.landedDirect;
  const totalCbm = Number(result.cbm || 0),
    totalDirectBasis =
      result.directChargeBy === "weight"
        ? Number(result.actualKg || 0)
        : totalCbm,
    preparedItems = items.map((p) => {
      const productBoxes = boxes.filter((b) => b.productId === p.id),
        freight = calculate(productBoxes, { ...rates, minCbm: false });
      return { p, freight };
    }),
    detailedItems = preparedItems.map(({ p, freight }) => {
      const units = Number(p.qty || 0),
        purchase = units * Number(p.price || 0),
        commission = (purchase * Number(result.feePercent || 0)) / 100,
        shipping =
          form.selectedRoute === "miami"
            ? freight.viaMiami
            : totalDirectBasis > 0
              ? Number(result.direct || 0) *
                ((result.directChargeBy === "weight"
                  ? freight.actualKg
                  : freight.cbm) /
                  totalDirectBasis)
              : 0,
        totalCost = purchase + commission + shipping,
        unitCost = units ? totalCost / units : 0,
        saleUnit = Number(p.salePrice || 0),
        saleTotal = units * saleUnit,
        unitProfit = saleUnit - unitCost,
        profitPercent = unitCost > 0 ? (unitProfit / unitCost) * 100 : 0;
      return {
        p,
        totalCost,
        unitCost,
        saleUnit,
        saleTotal,
        unitProfit,
        profitPercent,
      };
    });
  const saleTotal = detailedItems.reduce((s, x) => s + x.saleTotal, 0);
  const profit = saleTotal - internalTotal,
    profitPercent = internalTotal > 0 ? (profit / internalTotal) * 100 : 0;
  const updateSale = (id, v) =>
    setItems((x) => x.map((p) => (p.id === id ? { ...p, salePrice: v } : p)));
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSave({ ...form, boxes, rates, products: items, result });
      onClose();
    } catch (e) {
      setError(e.message || "No se pudo guardar la cotización");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <form className="dialog quoteFromCalculator" onSubmit={submit}>
        <div className="dialogHead">
          <div>
            <small>NUEVA COTIZACIÓN</small>
            <h2>Cliente, costo y precio de venta</h2>
          </div>
          <button type="button" onClick={onClose}>
            <X />
          </button>
        </div>
        <div className="quoteClientGrid">
          <Field
            label="Nombre del cliente *"
            type="text"
            value={form.customer}
            onChange={(v) => change("customer", v)}
          />
          <Field
            label="Teléfono / WhatsApp"
            type="text"
            value={form.phone}
            onChange={(v) => change("phone", v)}
          />
        </div>
        <Field
          label="Descripción"
          type="text"
          value={form.description}
          onChange={(v) => change("description", v)}
        />
        <label className="field">
          <span>Ruta cotizada</span>
          <select
            value={form.selectedRoute}
            onChange={(e) => change("selectedRoute", e.target.value)}
          >
            <option value="miami">Vía 1 · China–Miami–Managua</option>
            <option value="direct">Vía 2 · China–Managua</option>
          </select>
        </label>
        <div className="calculatorProductPricing">
          {detailedItems.map(
            ({
              p,
              totalCost,
              unitCost,
              saleUnit,
              saleTotal,
              unitProfit,
              profitPercent,
            }) => (
              <article key={p.id}>
                <div className="pricingProduct">
                  <b>{p.name || "Producto"}</b>
                  <span>
                    {Number(p.qty || 0).toLocaleString()} unidades ·{" "}
                    {money(totalCost)} costo total
                  </span>
                </div>
                <div className="pricingCost">
                  <small>Costo real por unidad</small>
                  <strong>{money(unitCost)}</strong>
                  <span>
                    {money(totalCost)} ÷ {Number(p.qty || 0).toLocaleString()}
                  </span>
                </div>
                <label className="pricingSale">
                  <small>Precio de venta por unidad</small>
                  <div>
                    <i>$</i>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      required
                      value={p.salePrice}
                      onChange={(e) => updateSale(p.id, e.target.value)}
                    />
                  </div>
                  <span>
                    {saleUnit > 0
                      ? `${money(saleTotal)} venta total`
                      : "Escribe el precio de venta"}
                  </span>
                </label>
                <div
                  className={
                    unitProfit >= 0
                      ? "pricingProfit positive"
                      : "pricingProfit negative"
                  }
                >
                  <small>Ganancia por unidad</small>
                  <strong>{saleUnit > 0 ? money(unitProfit) : "—"}</strong>
                  <span>
                    {saleUnit > 0
                      ? `${profitPercent >= 0 ? "+" : ""}${profitPercent.toFixed(2)}%`
                      : "—"}
                  </span>
                </div>
              </article>
            ),
          )}
        </div>
        <div className="quoteTotals">
          <div>
            <span>Costo interno</span>
            <b>{money(internalTotal)}</b>
          </div>
          <div>
            <span>Venta al cliente · envío incluido</span>
            <b>{money(saleTotal)}</b>
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
            <span>Ganancia sobre el costo</span>
            <strong>
              {profitPercent >= 0 ? "+" : ""}
              {profitPercent.toFixed(2)}%
            </strong>
          </div>
        </div>
        <label className="field">
          <span>Notas</span>
          <textarea
            value={form.notes}
            onChange={(e) => change("notes", e.target.value)}
            placeholder="Condiciones, anticipo, detalles…"
          />
        </label>
        {error && (
          <div className="saveError" role="alert">
            <b>No se pudo guardar</b>
            <span>{error}</span>
          </div>
        )}
        <button
          className="primary"
          disabled={
            !form.customer || busy || items.some((p) => !Number(p.salePrice))
          }
        >
          <Save />
          {busy ? "Guardando…" : "Guardar cotización interna y del cliente"}
        </button>
      </form>
    </div>
  );
}
function CalculatorPage({ onSaved, initialCustomer }) {
  const [products, setProducts] = useState([blankProduct()]);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [fee, setFee] = useState(3);
  const [productSummary, setProductSummary] = useState({
    productSubtotal: 0,
    feePercent: 3,
    feeAmount: 0,
    merchandiseTotal: 0,
    totalUnits: 0,
    landedMiami: 0,
    landedDirect: 0,
    unitMiami: 0,
    unitDirect: 0,
  });
  const [rates, setRates] = useState(initialRates);
  const [showRates, setShowRates] = useState(false);
  const [dialog, setDialog] = useState(false);
  useEffect(() => {
    api("/catalog-products")
      .then(setCatalogProducts)
      .catch(() => setCatalogProducts([]));
  }, []);
  const boxes = useMemo(
    () =>
      products.flatMap((p) =>
        (p.boxes || []).map((b) => ({
          ...b,
          productId: p.id,
          productName: p.name || "Producto",
        })),
      ),
    [products],
  );
  const base = useMemo(() => calculate(boxes, rates), [boxes, rates]);
  const r = { ...base, ...productSummary };
  const productRouteRows = useMemo(
    () =>
      products.map((p) => {
        const productBoxes = p.boxes || [],
          metrics = calculate(productBoxes, { ...rates, minCbm: false }),
          boxCount = productBoxes.reduce(
            (sum, b) => sum + Number(b.qty || 0),
            0,
          ),
          units = Number(p.qty || 0);
        return {
          ...p,
          ...metrics,
          boxCount,
          unitCbm: units ? metrics.cbm / units : 0,
        };
      }),
    [products, rates],
  );
  const rr = (k, v) => setRates((x) => ({ ...x, [k]: v }));
  async function save(data) {
    await api("/quotes", { method: "POST", body: JSON.stringify(data) });
    onSaved();
  }
  return (
    <div className="workspace">
      <div className="pageHead">
        <div>
          <small>NUEVA COTIZACIÓN</small>
          <h1>Crear cotización</h1>
          <p>
            Calcula el costo real y guarda la cotización interna y del cliente.
          </p>
        </div>
        <button className="settings" onClick={() => setShowRates(!showRates)}>
          <Settings2 /> Tarifas
        </button>
      </div>
      {showRates && (
        <section className="panel rates">
          <div className="sectionTitle">
            <div>
              <span>$</span>
              <h2>Tarifas y reglas</h2>
            </div>
          </div>
          <div className="rateGrid">
            <Field
              label="China → Miami"
              value={rates.cnRate}
              onChange={(v) => rr("cnRate", v)}
              suffix="$/kg"
            />
            <Field
              label="Miami → Managua"
              value={rates.miRate}
              onChange={(v) => rr("miRate", v)}
              suffix="$/lb"
            />
            <Field
              label="China → Managua"
              value={rates.cbmRate}
              onChange={(v) => rr("cbmRate", v)}
              suffix="$/CBM"
            />
            <Field
              label="Divisor China"
              value={rates.cnDivisor}
              onChange={(v) => rr("cnDivisor", v)}
            />
            <Field
              label="Divisor Miami"
              value={rates.miDivisor}
              onChange={(v) => rr("miDivisor", v)}
            />
            <Field
              label="Máximo kg por CBM directo"
              value={rates.directKgPerCbm}
              onChange={(v) => rr("directKgPerCbm", v)}
              suffix="kg"
            />
            <Field
              label="Tasa de cambio USD → C$"
              value={rates.exchangeRate}
              onChange={(v) => rr("exchangeRate", v)}
              suffix="C$"
            />
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={rates.minCbm}
              onChange={(e) => rr("minCbm", e.target.checked)}
            />
            <span />
            Cobrar mínimo 1 CBM en ruta directa
          </label>
        </section>
      )}
      <ProductSection
        products={products}
        setProducts={setProducts}
        fee={fee}
        setFee={setFee}
        catalogProducts={catalogProducts}
        shipping={{
          viaMiami: r.viaMiami,
          direct: r.direct,
          onSummary: setProductSummary,
        }}
        routeDetails={{
          best: r.best,
          directChargeBy: r.directChargeBy,
          directTotal: r.direct,
          directBasis:
            r.directChargeBy === "weight"
              ? Number(r.actualKg || 0)
              : Number(r.cbm || 0),
          rows: productRouteRows,
        }}
        exchangeRate={Number(rates.exchangeRate || 0)}
      />
      <section className="results">
        <div className="resultHead">
          <span>03</span>
          <div>
            <h2>Costo puesto en Nicaragua</h2>
            <p>Productos, comisión y envío incluidos</p>
          </div>
        </div>
        <div className="routeGrid">
          <RouteOne r={r} rates={rates} />
          <RouteTwo
            r={r}
            rates={rates}
            onCbmRateChange={(value) => rr("cbmRate", value)}
          />
        </div>
        <div className="landedGrid">
          <div>
            <span>Con Vía 1</span>
            <b>{money(r.landedMiami)}</b>
            <small>
              {r.totalUnits
                ? money(r.unitMiami) + " por unidad"
                : "Agrega cantidades"}
            </small>
          </div>
          <div>
            <span>Con Vía 2</span>
            <b>{money(r.landedDirect)}</b>
            <small>
              {r.totalUnits
                ? money(r.unitDirect) + " por unidad"
                : "Agrega cantidades"}
            </small>
          </div>
        </div>
        <div className="verdict">
          <CheckCircle2 />
          <div>
            <small>RECOMENDACIÓN</small>
            <h2>
              {r.best === "miami"
                ? "Vía 1 · China–Miami–Managua"
                : "Vía 2 · China–Managua"}
            </h2>
            <p>
              Ahorro estimado: <b>{money(r.saving)}</b>
            </p>
          </div>
          <button className="saveQuote" onClick={() => setDialog(true)}>
            <Save /> Guardar cotización
          </button>
        </div>
        <div className="capacity">
          <div>
            <span>
              <Ruler /> APROVECHAMIENTO DEL CBM
            </span>
            <b>{Math.min(100, r.cbm * 100).toFixed(1)}%</b>
          </div>
          <div className="bar">
            <i style={{ width: `${Math.min(100, r.cbm * 100)}%` }} />
          </div>
          <p>
            <Info />{" "}
            {r.cbm < 1 ? (
              <>
                Quedan <b>{r.space.toFixed(3)} CBM</b>. Puedes agregar
                aproximadamente <b>{r.more} cajas similares</b>.
              </>
            ) : (
              <>
                La carga ocupa <b>{r.cbm.toFixed(3)} CBM</b>.
              </>
            )}
          </p>
        </div>
        <div className="productCbmBreakdown">
          <div className="productCbmTitle">
            <div>
              <b>Envío individual por producto</b>
              <small>
                {r.best === "miami"
                  ? "Vía 1: cobro por peso facturable en los dos trayectos"
                  : `Vía 2: cobro por ${r.directChargeBy === "weight" ? "peso" : r.directChargeBy === "minimum" ? "mínimo de 1 CBM" : "volumen"}`}
              </small>
            </div>
            <strong>
              {money(r.best === "miami" ? r.viaMiami : r.direct)} total
            </strong>
          </div>
          <div className="productCbmTableWrap">
            <div
              className={
                "productCbmTable " +
                (r.best === "miami" ? "viaMiamiTable" : "directTable")
              }
            >
              {r.best === "miami" ? (
                <>
                  <div className="productCbmHead">
                    <span>Producto</span>
                    <span>Cajas</span>
                    <span>CBM</span>
                    <span>China–Miami</span>
                    <span>Miami–Managua</span>
                    <span>Envío total</span>
                  </div>
                  {productRouteRows.map((p, i) => (
                    <div className="productCbmRow" key={p.id || i}>
                      <div>
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt={p.name || "Producto"} />
                        ) : (
                          <span className="productCbmNoPhoto">Sin foto</span>
                        )}
                        <b>{p.name || `Producto ${i + 1}`}</b>
                      </div>
                      <span>{p.boxCount.toLocaleString()}</span>
                      <b>{p.cbm.toFixed(4)}</b>
                      <span>
                        {p.cnBillKg.toFixed(2)} kg · {money(p.cnCost)}
                      </span>
                      <span>
                        {p.miBillLb.toFixed(2)} lb · {money(p.miCost)}
                      </span>
                      <strong>{money(p.viaMiami)}</strong>
                    </div>
                  ))}
                </>
              ) : (
                <>
                  <div className="productCbmHead">
                    <span>Producto</span>
                    <span>Cajas</span>
                    <span>CBM total</span>
                    <span>CBM/unidad</span>
                    <span>% del espacio</span>
                    <span>Envío asignado</span>
                  </div>
                  {productRouteRows.map((p, i) => {
                    const basis =
                        r.directChargeBy === "weight" ? p.actualKg : p.cbm,
                      totalBasis =
                        r.directChargeBy === "weight" ? r.actualKg : r.cbm,
                      share = totalBasis > 0 ? basis / totalBasis : 0,
                      cost = Number(r.direct || 0) * share;
                    return (
                      <div className="productCbmRow" key={p.id || i}>
                        <div>
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt={p.name || "Producto"} />
                          ) : (
                            <span className="productCbmNoPhoto">Sin foto</span>
                          )}
                          <b>{p.name || `Producto ${i + 1}`}</b>
                        </div>
                        <span>{p.boxCount.toLocaleString()}</span>
                        <b>{p.cbm.toFixed(4)}</b>
                        <span>{p.unitCbm.toFixed(6)}</span>
                        <span>{(share * 100).toFixed(1)}%</span>
                        <strong>{money(cost)}</strong>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>
          {r.best === "direct" && r.directChargeBy === "minimum" && (
            <p className="productCbmNote">
              <Info /> El mínimo de 1 CBM se distribuye entre los productos
              según el espacio que ocupa cada uno.
            </p>
          )}
        </div>
      </section>
      {dialog && (
        <SaveDialog
          onClose={() => setDialog(false)}
          onSave={save}
          result={r}
          boxes={boxes}
          rates={rates}
          products={products}
          initialCustomer={initialCustomer}
        />
      )}
    </div>
  );
}
function RouteOne({ r, rates }) {
  return (
    <article className={"route " + (r.best === "miami" ? "winner" : "")}>
      <div className="routeIcon">
        <Plane />
      </div>
      <div>
        <small>VÍA 1 · DOS TRAYECTOS</small>
        <h3>
          China <ArrowRight /> Miami <ArrowRight /> Managua
        </h3>
      </div>
      {r.best === "miami" && <mark>Recomendada</mark>}
      <WeightBreakdown r={r} />
      <dl className="legs">
        <div>
          <dt>
            <b>1. China → Miami</b>
            <span>
              {r.cnBillKg.toFixed(2)} kg facturables × {money(rates.cnRate)}
            </span>
          </dt>
          <dd>{money(r.cnCost)}</dd>
        </div>
        <div>
          <dt>
            <b>2. Miami → Managua</b>
            <span>
              {r.miBillLb.toFixed(2)} lb facturables × {money(rates.miRate)}
            </span>
          </dt>
          <dd>{money(r.miCost)}</dd>
        </div>
      </dl>
      <div className="routeTotal">
        <span>TOTAL VÍA 1</span>
        <strong>{money(r.viaMiami)}</strong>
      </div>
    </article>
  );
}
function RouteTwo({ r, rates, onCbmRateChange }) {
  return (
    <article className={"route " + (r.best === "direct" ? "winner" : "")}>
      <div className="routeIcon ship">
        <Ship />
      </div>
      <div>
        <small>VÍA 2 · DIRECTA</small>
        <h3>
          China <ArrowRight /> Managua
        </h3>
      </div>
      {r.best === "direct" && <mark>Recomendada</mark>}
      <label className="directRateEditor">
        <span>Precio manual por CBM</span>
        <div>
          <i>$</i>
          <input
            type="number"
            min="0"
            step="any"
            value={rates.cbmRate}
            onChange={(event) => onCbmRateChange(event.target.value)}
            aria-label="Precio manual por CBM para la Vía 2"
          />
          <em>por CBM</em>
        </div>
        <small>Puedes cambiar esta tarifa para cada cotización.</small>
      </label>
      <dl className="legs">
        <div
          className={r.directChargeBy === "volume" ? "directMethodWinner" : ""}
        >
          <dt>
            <b>
              CBM por volumen{" "}
              {r.directChargeBy === "volume" && <em>ENVÍO SELECCIONADO</em>}
            </b>
            <span>Calculado únicamente con las medidas de las cajas</span>
          </dt>
          <dd>{r.cbm.toFixed(3)} CBM</dd>
        </div>
        <div
          className={r.directChargeBy === "weight" ? "directMethodWinner" : ""}
        >
          <dt>
            <b>
              CBM por peso{" "}
              {r.directChargeBy === "weight" && <em>ENVÍO SELECCIONADO</em>}
            </b>
            <span>
              {r.actualKg.toFixed(2)} kg ÷{" "}
              {Number(r.kgPerCbm || 350).toFixed(0)} kg
            </span>
          </dt>
          <dd>{r.weightCbm.toFixed(3)} CBM</dd>
        </div>
        <div className="directChargeFinal">
          <dt>
            <b>
              CBM a cobrar ·{" "}
              {r.directChargeBy === "weight"
                ? "Por peso"
                : r.directChargeBy === "minimum"
                  ? "Mínimo"
                  : "Por volumen"}
            </b>
            <span>
              {r.billCbm.toFixed(3)} CBM × {money(rates.cbmRate)}
            </span>
          </dt>
          <dd>{money(r.direct)}</dd>
        </div>
      </dl>
      <div className="routeTotal">
        <span>TOTAL VÍA 2</span>
        <strong>{money(r.direct)}</strong>
      </div>
    </article>
  );
}
function PinGate({ label, currentUser, onGoToUsers, onUnlock }) {
  const [digits, setDigits] = useState(["", "", "", ""]),
    [configured, setConfigured] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const inputsRef = useRef([]);
  useEffect(() => {
    authFetch("/api/settings/internal-pin")
      .then((r) => (r.ok ? r.json() : { configured: true }))
      .then((d) => setConfigured(Boolean(d.configured)))
      .catch(() => setConfigured(true));
  }, []);
  useEffect(() => {
    if (configured) inputsRef.current[0]?.focus();
  }, [configured]);
  async function submit(code) {
    setBusy(true);
    setError("");
    try {
      const r = await authFetch("/api/settings/internal-pin/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Código incorrecto");
      onUnlock();
    } catch (e) {
      setError(e.message || "Código incorrecto");
      setDigits(["", "", "", ""]);
      inputsRef.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  }
  function setDigit(i, raw) {
    const clean = raw.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    setError("");
    if (clean && i < 3) inputsRef.current[i + 1]?.focus();
    if (clean && next.every((d) => d !== "")) submit(next.join(""));
  }
  function onKeyDown(i, e) {
    if (e.key === "Backspace" && !digits[i] && i > 0)
      inputsRef.current[i - 1]?.focus();
  }
  if (configured === false)
    return (
      <div className="pinGateOverlay">
        <div className="pinGateCard">
          <div className="pinGateIcon">
            <Lock />
          </div>
          <h2>Código de acceso no configurado</h2>
          <p>
            {currentUser?.role === "admin"
              ? "Crea el código de 4 dígitos en Usuarios para poder entrar aquí."
              : "Pide a un administrador que cree el código de acceso en Usuarios."}
          </p>
          {currentUser?.role === "admin" && (
            <button className="pinGateGoUsers" onClick={onGoToUsers}>
              Ir a Usuarios
            </button>
          )}
        </div>
      </div>
    );
  return (
    <div className="pinGateOverlay">
      <div className="pinGateCard">
        <div className="pinGateIcon">
          <Lock />
        </div>
        <h2>{label}</h2>
        <p>Escribe el código de acceso de 4 dígitos</p>
        <div className="pinDigits">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => (inputsRef.current[i] = el)}
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength="1"
              value={d}
              disabled={busy || configured === null}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => onKeyDown(i, e)}
            />
          ))}
        </div>
        {error && <div className="pinGateError">{error}</div>}
      </div>
    </div>
  );
}
function App() {
  const [page, setPage] = useState("calculator"),
    [refresh, setRefresh] = useState(0),
    [quoteCustomer, setQuoteCustomer] = useState(null),
    [currentUser, setCurrentUser] = useState(null),
    [authLoading, setAuthLoading] = useState(true),
    [needsSetup, setNeedsSetup] = useState(false),
    [pinUnlocked, setPinUnlocked] = useState(false);
  // "Cotizaciones internas" y "Órdenes" muestran costos y ganancias, así
  // que piden el código de acceso cada vez que se entra a esa sección.
  useEffect(() => {
    setPinUnlocked(false);
  }, [page]);
  useEffect(() => {
    const session = getSession();
    Promise.all([
      fetch("/api/auth/status").then((r) => r.json()),
      session
        ? authFetch("/api/auth/me").then((r) => (r.ok ? r.json() : null))
        : Promise.resolve(null),
    ])
      .then(([status, user]) => {
        setNeedsSetup(Boolean(status.needsSetup));
        setCurrentUser(user);
        if (!user && session) clearSession();
        setAuthLoading(false);
      })
      .catch(() => setAuthLoading(false));
  }, []);
  function createQuote(customer = null) {
    setQuoteCustomer(customer);
    setPage("calculator");
  }
  function navigate(next) {
    if (next === "calculator") setQuoteCustomer(null);
    setPage(next);
  }
  function saved() {
    setRefresh((x) => x + 1);
    setPage("quotes");
  }
  const recordType =
    page === "quotes" ? "quote" : page === "clientQuotes" ? "client" : "order";
  const changed = () => setRefresh((x) => x + 1);
  if (authLoading)
    return <div className="authLoading">Verificando acceso…</div>;
  if (!currentUser)
    return (
      <AuthPage
        needsSetup={needsSetup}
        onAuthenticated={(session) => {
          setCurrentUser(session.user);
          setNeedsSetup(false);
        }}
      />
    );
  function logout() {
    clearSession();
    setCurrentUser(null);
    setPage("calculator");
  }
  return (
    <>
      <header>
        <div className="brand">
          <div className="logo">
            <Ship />
          </div>
          <div>
            <b>CotizacionesChina</b>
            <small>Cotizaciones y órdenes</small>
          </div>
        </div>
        <Nav page={page} setPage={navigate} currentUser={currentUser} />
        <div className="sessionUser">
          <span>
            {currentUser.username}
            <small>
              {currentUser.role === "admin" ? "Administrador" : "Usuario"}
            </small>
          </span>
          <button onClick={logout} title="Cerrar sesión">
            <LogOut />
          </button>
        </div>
      </header>
      <main className="appMain">
        {page === "calculator" ? (
          <CalculatorPage onSaved={saved} initialCustomer={quoteCustomer} />
        ) : page === "products" ? (
          <ProductsPage
            refreshKey={refresh}
            onChange={changed}
            setPage={navigate}
          />
        ) : page === "customers" ? (
          <ClientsPage refreshKey={refresh} onCreateQuote={createQuote} />
        ) : page === "profits" ? (
          <ProfitPage refreshKey={refresh} />
        ) : page === "users" && currentUser.role === "admin" ? (
          <UsersPage />
        ) : (page === "quotes" || page === "orders") && !pinUnlocked ? (
          <PinGate
            label={page === "quotes" ? "Cotizaciones internas" : "Órdenes"}
            currentUser={currentUser}
            onGoToUsers={() => navigate("users")}
            onUnlock={() => setPinUnlocked(true)}
          />
        ) : (
          <RecordsPage
            type={recordType}
            refreshKey={refresh}
            onChange={changed}
            onCreateQuote={() => createQuote(null)}
          />
        )}
      </main>
    </>
  );
}
const portalMatch = window.location.pathname.match(/^\/portal\/([^/]+)/);
createRoot(document.getElementById("root")).render(
  portalMatch ? <PortalPage token={portalMatch[1]} /> : <App />,
);
