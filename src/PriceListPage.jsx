import React, { useEffect, useState } from "react";
import { Tag, Package, Search } from "lucide-react";
import { authFetch } from "./auth.js";
import { DEFAULT_EXCHANGE_RATE } from "./calculate.js";
import { isRealProduct, infoOf } from "./suppliers.js";
import { lastChange } from "./specs.js";
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

// Lista de precios: solo la foto, el nombre y el precio de venta. Sirve para
// mostrar o dictar precios sin que se vea ningún costo.
export default function PriceListPage({ refreshKey }) {
  const [products, setProducts] = useState([]),
    [loading, setLoading] = useState(true),
    [search, setSearch] = useState("");
  useEffect(() => {
    authFetch("/api/catalog-products")
      .then((r) => r.json())
      .then((rows) =>
        setProducts(
          (Array.isArray(rows) ? rows : [])
            .filter(isRealProduct)
            .sort((a, b) => a.name.localeCompare(b.name, "es")),
        ),
      )
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [refreshKey]);
  const shown = products.filter((p) =>
    (p.name + " " + (infoOf(p).category || ""))
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  return (
    <div className="workspace">
      <div className="pageHead">
        <div>
          <small>PRECIOS</small>
          <h1>Lista de precios</h1>
          <p>
            Solo la foto, el producto y su precio. Aquí no aparece ningún
            costo, proveedor ni ganancia.
          </p>
        </div>
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
        <div className="catalogEmpty">Cargando productos…</div>
      ) : shown.length ? (
        <div className="priceTable">
          <div className="priceRow priceHead">
            <span>Foto</span>
            <span>Producto</span>
            <span>Precio (US$)</span>
            <span>Precio (C$)</span>
            <span>Precio anterior</span>
          </div>
          {shown.map((p) => {
            const price = Number(infoOf(p).salePrice) || 0;
            const change = lastChange(infoOf(p), "salePrice");
            return (
              <div className="priceRow" key={p.id}>
                {p.image_url ? (
                  <img src={p.image_url} alt="" loading="lazy" />
                ) : (
                  <span className="compareNoPhoto">
                    <Package size={22} />
                  </span>
                )}
                <b>{p.name}</b>
                <strong>{price > 0 ? usd(price) : "Sin precio"}</strong>
                <em>{price > 0 ? cs(price) : "—"}</em>
                <div className="priceBefore">
                  {change ? (
                    <>
                      <s>{usd(change.before)}</s>
                      <s>{cs(change.before)}</s>
                      {change.percent != null && (
                        <i className={change.percent > 0 ? "up" : "down"}>
                          {change.percent > 0 ? "▲ subió " : "▼ bajó "}
                          {Math.abs(change.percent).toFixed(1)} %
                        </i>
                      )}
                      <small>
                        desde el{" "}
                        {new Date(change.date + "T12:00:00").toLocaleDateString(
                          "es-NI",
                          { day: "numeric", month: "short", year: "numeric" },
                        )}
                      </small>
                    </>
                  ) : (
                    <small>Sin cambios</small>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="catalogEmpty">
          <Tag />
          <b>No hay productos para mostrar</b>
          <span>Registra productos con su precio de venta.</span>
        </div>
      )}
    </div>
  );
}
