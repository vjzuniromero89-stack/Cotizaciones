import React, { useEffect, useState } from "react";
import { History, Package, Search } from "lucide-react";
import { authFetch } from "./auth.js";
import { DEFAULT_EXCHANGE_RATE } from "./calculate.js";
import { isRealProduct } from "./suppliers.js";
import { priceChanges, marginOf, localToday } from "./specs.js";
import "./suppliers.css";

const usd = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    n || 0,
  );
const cs = (n) =>
  "C$ " +
  ((Number(n) || 0) * DEFAULT_EXCHANGE_RATE).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const shortDate = (text) =>
  text
    ? new Date(text + "T12:00:00").toLocaleDateString("es-NI", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "sin fecha";

// Una casilla "antes → ahora" en dólares y córdobas. "goodUp" dice si subir es
// bueno (venta) o malo (costo), para pintar la flecha de verde o de rojo.
function MoneyChange({ before, now, goodUp }) {
  if (!(now > 0) && !(before > 0)) return <div className="chgCell">—</div>;
  if (before === now)
    return (
      <div className="chgCell same">
        <strong>{usd(now)}</strong>
        <small>{cs(now)}</small>
        <i>Igual</i>
      </div>
    );
  const up = now > before,
    percent = before > 0 ? ((now - before) / before) * 100 : null;
  return (
    <div className="chgCell">
      <s>
        {usd(before)} · {cs(before)}
      </s>
      <strong>{usd(now)}</strong>
      <small>{cs(now)}</small>
      <i className={up === goodUp ? "good" : "bad"}>
        {up ? "▲ subió" : "▼ bajó"}
        {percent != null && " " + Math.abs(percent).toFixed(1) + " %"}
      </i>
    </div>
  );
}

// Cambios de precio: cada vez que a un producto se le cambió el precio de
// compra, el porcentaje de ganancia o el precio de venta.
export default function ChangesPage({ refreshKey }) {
  const [products, setProducts] = useState([]),
    [loading, setLoading] = useState(true),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all");
  useEffect(() => {
    authFetch("/api/catalog-products")
      .then((r) => r.json())
      .then((rows) =>
        setProducts((Array.isArray(rows) ? rows : []).filter(isRealProduct)),
      )
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [refreshKey]);
  const all = priceChanges(products).map((c) => {
    const mBefore = marginOf(c.before),
      mNow = marginOf(c.now);
    return {
      ...c,
      mBefore,
      mNow,
      buyChanged: c.before.price !== c.now.price,
      sellChanged: c.before.salePrice !== c.now.salePrice,
      marginChanged:
        mBefore != null && mNow != null && Math.abs(mNow - mBefore) >= 0.05,
    };
  });
  const month = localToday().slice(0, 7);
  const thisMonth = all.filter((c) => String(c.now.date).startsWith(month));
  const count = (test) => thisMonth.filter(test).length;
  const shown = all.filter(
    (c) =>
      (filter === "all" ||
        (filter === "buy" && c.buyChanged) ||
        (filter === "margin" && c.marginChanged) ||
        (filter === "sell" && c.sellChanged)) &&
      c.product.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  return (
    <div className="workspace">
      <div className="pageHead">
        <div>
          <small>REGISTRO</small>
          <h1>Cambios de precio</h1>
          <p>
            Cada vez que guardas un producto con otro precio de compra, otro
            porcentaje de ganancia u otro precio de venta, queda anotado aquí.
          </p>
        </div>
      </div>
      <div className="chgSummary">
        <div>
          <span>Cambios este mes</span>
          <strong>{thisMonth.length}</strong>
        </div>
        <div>
          <span>Subió el precio de compra</span>
          <strong className="bad">
            {count((c) => c.now.price > c.before.price)}
          </strong>
        </div>
        <div>
          <span>Bajó el precio de compra</span>
          <strong className="good">
            {count((c) => c.now.price < c.before.price)}
          </strong>
        </div>
        <div>
          <span>Subió el % de ganancia</span>
          <strong className="good">
            {count((c) => c.marginChanged && c.mNow > c.mBefore)}
          </strong>
        </div>
        <div>
          <span>Bajó el % de ganancia</span>
          <strong className="bad">
            {count((c) => c.marginChanged && c.mNow < c.mBefore)}
          </strong>
        </div>
      </div>
      <div className="chgFilters">
        {[
          ["all", "Todos"],
          ["buy", "Precio de compra"],
          ["margin", "% de ganancia"],
          ["sell", "Precio de venta"],
        ].map(([id, label]) => (
          <button
            type="button"
            key={id}
            className={filter === id ? "active" : ""}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <label className="clientSearch marginSearch">
        <Search />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar producto…"
        />
      </label>
      {loading ? (
        <div className="catalogEmpty">Cargando cambios…</div>
      ) : shown.length ? (
        <div className="chgTable">
          <div className="chgRow chgHead">
            <span>Foto</span>
            <span>Producto</span>
            <span>Precio de compra</span>
            <span>% de ganancia</span>
            <span>Precio de venta</span>
          </div>
          {shown.map((c, i) => (
            <div className="chgRow" key={c.product.id + "-" + c.order + "-" + i}>
              {c.product.image_url ? (
                <img src={c.product.image_url} alt="" loading="lazy" />
              ) : (
                <span className="compareNoPhoto">
                  <Package size={22} />
                </span>
              )}
              <div className="chgName">
                <b>{c.product.name}</b>
                <small>{shortDate(c.now.date)}</small>
              </div>
              <MoneyChange
                before={c.before.price}
                now={c.now.price}
                goodUp={false}
              />
              <div className={"chgCell" + (c.marginChanged ? "" : " same")}>
                {c.mNow == null ? (
                  "—"
                ) : c.marginChanged ? (
                  <>
                    <s>{c.mBefore.toFixed(1)} %</s>
                    <strong>{c.mNow.toFixed(1)} %</strong>
                    <i className={c.mNow > c.mBefore ? "good" : "bad"}>
                      {c.mNow > c.mBefore ? "▲ subió " : "▼ bajó "}
                      {Math.abs(c.mNow - c.mBefore).toFixed(1)} puntos
                    </i>
                  </>
                ) : (
                  <>
                    <strong>{c.mNow.toFixed(1)} %</strong>
                    <i>{c.mBefore == null ? "Sin dato anterior" : "Igual"}</i>
                  </>
                )}
              </div>
              <MoneyChange
                before={c.before.salePrice}
                now={c.now.salePrice}
                goodUp={true}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="catalogEmpty">
          <History />
          <b>Todavía no hay cambios anotados</b>
          <span>
            Cuando edites el precio o el porcentaje de un producto, aparecerá
            aquí con el valor de antes y el de ahora.
          </span>
        </div>
      )}
    </div>
  );
}
