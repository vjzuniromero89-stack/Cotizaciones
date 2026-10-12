import React, { useEffect, useMemo, useState } from "react";
import { Percent, Package, Search } from "lucide-react";
import { authFetch } from "./auth.js";
import { DEFAULT_EXCHANGE_RATE, estimateLandedUnit } from "./calculate.js";
import { isRealProduct, infoOf } from "./suppliers.js";
import "./suppliers.css";

const usd = (n) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  }).format(n || 0);
const cs = (n) =>
  "C$ " +
  ((Number(n) || 0) * DEFAULT_EXCHANGE_RATE).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
async function api(path) {
  const r = await authFetch("/api" + path);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || "No se pudo cargar");
  return data;
}

export default function MarginsPage({ refreshKey }) {
  const [products, setProducts] = useState([]),
    [loading, setLoading] = useState(true),
    [search, setSearch] = useState(""),
    [cbmRate, setCbmRate] = useState(550),
    [feePercent, setFeePercent] = useState(3);
  useEffect(() => {
    api("/catalog-products")
      .then((rows) => setProducts(rows.filter(isRealProduct)))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [refreshKey]);
  const rows = useMemo(
    () =>
      products
        .map((product) => {
          const info = infoOf(product),
            sale = Number(info.salePrice) || 0,
            cost = estimateLandedUnit(
              { price: product.unit_price, box: product.boxes?.[0] },
              {
                cbmRate: Number(cbmRate) || 0,
                feePercent: Number(feePercent) || 0,
              },
            ),
            profit = cost && sale > 0 ? sale - cost.total : null;
          return {
            product,
            info,
            sale,
            cost,
            profit,
            percent: profit != null && cost.total > 0 ? (profit / cost.total) * 100 : null,
          };
        })
        .sort((a, b) => (b.percent ?? -Infinity) - (a.percent ?? -Infinity)),
    [products, cbmRate, feePercent],
  );
  const complete = rows.filter((r) => r.profit != null);
  const average = complete.length
    ? complete.reduce((s, r) => s + r.percent, 0) / complete.length
    : null;
  const shown = rows.filter((r) =>
    (r.product.name + " " + (r.info.supplier || "") + " " + (r.info.category || ""))
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  return (
    <div className="workspace">
      <div className="pageHead">
        <div>
          <small>RENTABILIDAD</small>
          <h1>Ganancia por producto</h1>
          <p>
            Cuánto te cuesta cada producto puesto en Nicaragua (compra +
            comisión + flete), a cuánto lo vendes y cuánto ganas por unidad.
          </p>
        </div>
      </div>
      <div className="marginSettings">
        <label>
          <span>Flete directo (US$ por CBM)</span>
          <input
            type="number"
            min="0"
            step="any"
            value={cbmRate}
            onChange={(e) => setCbmRate(e.target.value)}
          />
        </label>
        <label>
          <span>Comisión de compra (%)</span>
          <input
            type="number"
            min="0"
            step="any"
            value={feePercent}
            onChange={(e) => setFeePercent(e.target.value)}
          />
        </label>
        <p>
          Cambia estos dos números para ver cómo se mueve la ganancia. El flete
          es por unidad según lo que ocupa o pesa la caja; no incluye el mínimo
          de 1 CBM, que depende del pedido completo.
        </p>
      </div>
      <div className="marginSummary">
        <div>
          <span>Productos con ganancia calculada</span>
          <b>
            {complete.length} de {rows.length}
          </b>
        </div>
        <div>
          <span>Ganancia promedio sobre el costo</span>
          <b>{average != null ? average.toFixed(1) + " %" : "—"}</b>
        </div>
        <div>
          <span>Mejor producto</span>
          <b>{complete[0] ? complete[0].product.name : "—"}</b>
          {complete[0] && <small>{complete[0].percent.toFixed(1)} %</small>}
        </div>
        <div>
          <span>Menor ganancia</span>
          <b>
            {complete.length > 1
              ? complete[complete.length - 1].product.name
              : "—"}
          </b>
          {complete.length > 1 && (
            <small>{complete[complete.length - 1].percent.toFixed(1)} %</small>
          )}
        </div>
      </div>
      <label className="clientSearch marginSearch">
        <Search />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por producto, proveedor o categoría…"
        />
      </label>
      {loading ? (
        <div className="catalogEmpty">Cargando productos…</div>
      ) : shown.length ? (
        <div className="marginTable">
          <div className="marginRow marginHead">
            <span />
            <span>Producto</span>
            <span>Compra</span>
            <span>Comisión</span>
            <span>Flete</span>
            <span>Costo en Nicaragua</span>
            <span>Precio de venta</span>
            <span>Ganancia por unidad</span>
            <span>% sobre el costo</span>
          </div>
          {shown.map(({ product, info, sale, cost, profit, percent }) => (
            <div className="marginRow" key={product.id}>
              {product.image_url ? (
                <img src={product.image_url} alt="" loading="lazy" />
              ) : (
                <span className="compareNoPhoto">
                  <Package size={18} />
                </span>
              )}
              <div className="marginName">
                <b>{product.name}</b>
                <small>{info.supplier || "Sin proveedor"}</small>
              </div>
              <div>
                <span className="marginLabel">Compra</span>
                <b>{usd(product.unit_price)}</b>
              </div>
              <div>
                <span className="marginLabel">Comisión</span>
                <b>{cost ? usd(cost.fee) : "—"}</b>
              </div>
              <div>
                <span className="marginLabel">Flete</span>
                <b>{cost ? usd(cost.freight) : "—"}</b>
              </div>
              <div className="marginCost">
                <span className="marginLabel">Costo en Nicaragua</span>
                <b>{cost ? usd(cost.total) : "Faltan datos"}</b>
                <small>{cost ? cs(cost.total) : "precio o caja del producto"}</small>
              </div>
              <div className="marginSale">
                <span className="marginLabel">Precio de venta</span>
                <b>{sale > 0 ? usd(sale) : "Sin precio"}</b>
                <small>{sale > 0 ? cs(sale) : "ponlo en el producto"}</small>
              </div>
              <div className={profit == null ? "" : profit >= 0 ? "marginGain" : "marginLoss"}>
                <span className="marginLabel">Ganancia por unidad</span>
                <b>{profit != null ? usd(profit) : "—"}</b>
                <small>{profit != null ? cs(profit) : ""}</small>
              </div>
              <div className={percent == null ? "" : percent >= 0 ? "marginGain" : "marginLoss"}>
                <span className="marginLabel">% sobre el costo</span>
                <b className="marginPercent">
                  {percent != null ? percent.toFixed(1) + " %" : "—"}
                </b>
                {percent != null && sale > 0 && (
                  <small>{((profit / sale) * 100).toFixed(1)} % del precio de venta</small>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="catalogEmpty">
          <Percent />
          <b>No hay productos para mostrar</b>
          <span>Registra productos con precio de compra, caja y precio de venta.</span>
        </div>
      )}
    </div>
  );
}
