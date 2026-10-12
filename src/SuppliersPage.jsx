import React, { useEffect, useState } from "react";
import {
  Factory,
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  Phone,
  ExternalLink,
  Trophy,
  Package,
} from "lucide-react";
import { authFetch } from "./auth.js";
import { RegisterProductDialog } from "./ProductsPage.jsx";
import { DEFAULT_EXCHANGE_RATE, estimateLandedUnit } from "./calculate.js";
import {
  SUPPLIERS_ROW,
  splitCatalog,
  productsOf,
  comparisonGroups,
  infoOf,
  categoriesOf,
  familiesOf,
  modelsOf,
} from "./suppliers.js";
import "./suppliers.css";

const money = (n) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  }).format(n || 0);
const cordobas = (n) =>
  "C$ " +
  ((Number(n) || 0) * DEFAULT_EXCHANGE_RATE).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const link = (url) => {
  const text = String(url || "").trim();
  if (!text) return "";
  return /^https?:\/\//i.test(text) ? text : "https://" + text;
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

function SupplierDialog({ supplier, onClose, onSave }) {
  const [form, setForm] = useState({
      name: supplier?.name || "",
      contact: supplier?.contact || "",
      url: supplier?.url || "",
      notes: supplier?.notes || "",
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const update = (k, v) => setForm((x) => ({ ...x, [k]: v }));
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSave({
        name: form.name.trim(),
        contact: form.contact.trim(),
        url: form.url.trim(),
        notes: form.notes.trim(),
      });
      onClose();
    } catch (err) {
      setError(err.message || "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="overlay"
    >
      <form className="dialog supplierDialog" onSubmit={submit}>
        <div className="dialogHead">
          <div>
            <small>PROVEEDORES</small>
            <h2>{supplier?.saved ? "Editar proveedor" : "Agregar proveedor"}</h2>
          </div>
          <button type="button" onClick={onClose}>
            <X />
          </button>
        </div>
        <div className="supplierForm">
          <label className="rpField">
            <span>Nombre del proveedor *</span>
            <input
              required
              value={form.name}
              placeholder="Fábrica o tienda"
              onChange={(e) => update("name", e.target.value)}
            />
          </label>
          <label className="rpField">
            <span>Contacto</span>
            <input
              value={form.contact}
              placeholder="Persona, WhatsApp o WeChat"
              onChange={(e) => update("contact", e.target.value)}
            />
          </label>
          <label className="rpField">
            <span>Enlace de su tienda</span>
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
              placeholder="Tiempo de producción, forma de pago…"
              onChange={(e) => update("notes", e.target.value)}
            />
          </label>
        </div>
        {error && (
          <div className="saveError">
            <b>No se pudo guardar</b>
            <span>{error}</span>
          </div>
        )}
        <button className="primary" disabled={busy || !form.name.trim()}>
          <Save /> {busy ? "Guardando…" : "Guardar proveedor"}
        </button>
      </form>
    </div>
  );
}

function Comparison({ group }) {
  const rows = group.products
    .map((product) => ({
      product,
      info: infoOf(product),
      cost: estimateLandedUnit({
        price: product.unit_price,
        box: product.boxes?.[0],
      }),
    }))
    .sort(
      (a, b) =>
        (a.cost?.total ?? Infinity) - (b.cost?.total ?? Infinity) ||
        Number(a.product.unit_price) - Number(b.product.unit_price),
    );
  const best = rows[0]?.cost?.total;
  const cheapestPrice = Math.min(
    ...rows.map((r) => Number(r.product.unit_price) || Infinity),
  );
  return (
    <article className="compareCard">
      <header>
        <div>
          <small>MISMO PRODUCTO</small>
          <h3>{group.name}</h3>
        </div>
        <span>
          {rows.length} {rows.length === 1 ? "proveedor" : "proveedores"}
        </span>
      </header>
      {rows.length < 2 && (
        <p className="compareHint">
          Solo hay un proveedor con este producto. Registra el mismo producto
          en otro proveedor, con “Comparar como: {group.name}”, para ver cuál
          conviene.
        </p>
      )}
      <div className="compareTable">
        <div className="compareRow compareHead">
          <span />
          <span>Proveedor</span>
          <span>Precio de compra</span>
          <span>Por caja</span>
          <span>Flete por unidad</span>
          <span>Costo estimado en Nicaragua</span>
          <span>Diferencia</span>
        </div>
        {rows.map(({ product, info, cost }, i) => {
          const isBest = cost && best != null && cost.total === best;
          const extra = cost && best != null ? cost.total - best : null;
          return (
            <div
              className={"compareRow" + (isBest ? " best" : "")}
              key={product.id}
            >
              {product.image_url ? (
                <img src={product.image_url} alt="" />
              ) : (
                <span className="compareNoPhoto">
                  <Package size={18} />
                </span>
              )}
              <div>
                <b>{info.supplier || "Sin proveedor"}</b>
                <small>{product.name}</small>
              </div>
              <div>
                <span className="compareLabel">Precio de compra</span>
                <b>{money(product.unit_price)}</b>
                {Number(product.unit_price) === cheapestPrice &&
                  rows.length > 1 && <small>precio más bajo</small>}
              </div>
              <div>
                <span className="compareLabel">Por caja</span>
                <b>{product.boxes?.[0]?.unitsPerBox || "—"}</b>
              </div>
              <div>
                <span className="compareLabel">Flete por unidad</span>
                <b>{cost ? money(cost.freight) : "—"}</b>
              </div>
              <div className="compareTotal">
                <span className="compareLabel">Costo estimado en Nicaragua</span>
                <b>{cost ? money(cost.total) : "Faltan datos"}</b>
                <small>
                  {cost ? cordobas(cost.total) : "precio o productos por caja"}
                </small>
              </div>
              <div>
                <span className="compareLabel">Diferencia</span>
                {isBest && rows.length > 1 ? (
                  <em className="compareBest">
                    <Trophy size={14} /> Mejor opción
                  </em>
                ) : extra != null && i > 0 ? (
                  <b className="compareExtra">
                    +{money(extra)} ·{" "}
                    {best > 0 ? ((extra / best) * 100).toFixed(1) : "0"}%
                  </b>
                ) : (
                  <b>—</b>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}

export default function SuppliersPage({ refreshKey, onChange, onQuote }) {
  const [catalog, setCatalog] = useState({
      products: [],
      suppliers: [],
      row: null,
    }),
    [loading, setLoading] = useState(true),
    [editing, setEditing] = useState(null),
    [adding, setAdding] = useState(false),
    [productFor, setProductFor] = useState(null),
    [productEdit, setProductEdit] = useState(null),
    [picked, setPicked] = useState([]);
  const togglePick = (id) =>
    setPicked((x) => (x.includes(id) ? x.filter((v) => v !== id) : [...x, id]));
  async function load() {
    try {
      setCatalog(splitCatalog(await api("/catalog-products")));
    } catch {
      setCatalog({ products: [], suppliers: [], row: null });
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [refreshKey]);
  const groups = comparisonGroups(catalog.products);
  const options = {
    suppliers: catalog.suppliers.map((s) => s.name),
    groups: groups.map((g) => g.name),
    categories: categoriesOf(catalog.products),
    families: familiesOf(catalog.products),
    models: modelsOf(catalog.products),
  };
  async function writeSuppliers(list) {
    const body = JSON.stringify({
      name: SUPPLIERS_ROW,
      imageUrl: "",
      price: 0,
      qty: 0,
      boxes: list.map(({ saved, ...s }) => s),
    });
    if (catalog.row)
      await api("/catalog-products/" + catalog.row.id, { method: "PUT", body });
    else await api("/catalog-products", { method: "POST", body });
    await load();
  }
  const savedList = () => catalog.suppliers.filter((s) => s.saved);
  async function saveSupplier(previous, data) {
    const same = (a, b) =>
      String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
    const others = savedList().filter(
      (s) => !previous || !same(s.name, previous.name),
    );
    if (others.some((s) => same(s.name, data.name)))
      throw new Error("Ya existe un proveedor con ese nombre");
    await writeSuppliers([
      ...others,
      { id: previous?.saved ? previous.id : crypto.randomUUID(), ...data },
    ]);
    // Si cambió el nombre, sus productos lo siguen.
    if (previous && !same(previous.name, data.name)) {
      for (const p of productsOf(catalog.products, previous.name)) {
        const [box, ...rest] = p.boxes || [];
        await api("/catalog-products/" + p.id, {
          method: "PUT",
          body: JSON.stringify({
            name: p.name,
            imageUrl: p.image_url,
            price: p.unit_price,
            qty: 0,
            boxes: [
              { ...box, info: { ...(box?.info || {}), supplier: data.name } },
              ...rest,
            ],
          }),
        });
      }
      await load();
    }
    onChange?.();
  }
  async function removeSupplier(supplier) {
    const count = productsOf(catalog.products, supplier.name).length;
    if (
      !window.confirm(
        count
          ? `¿Quitar la ficha de ${supplier.name}? Sus ${count} productos se conservan en el catálogo.`
          : `¿Quitar el proveedor ${supplier.name}?`,
      )
    )
      return;
    await writeSuppliers(
      savedList().filter((s) => s.name !== supplier.name),
    );
  }
  return (
    <div className="workspace">
      <div className="pageHead">
        <div>
          <small>COMPRAS</small>
          <h1>Proveedores</h1>
          <p>
            Guarda a quién le compras, sus productos, y compara cuál proveedor
            conviene para un mismo producto.
          </p>
        </div>
        <button className="newProduct" onClick={() => setAdding(true)}>
          <Plus /> Agregar proveedor
        </button>
      </div>

      <section className="supplierSection">
        <div className="supplierTitle">
          <h2>Comparar precios</h2>
          <p>
            Se comparan los productos que tienen el mismo texto en “Comparar
            como”. El costo estimado suma compra, comisión de 3 % y flete por la
            ruta directa a US$ 550 por CBM.
          </p>
        </div>
        {groups.length ? (
          groups.map((g) => <Comparison group={g} key={g.name} />)
        ) : (
          <div className="catalogEmpty">
            <Trophy />
            <b>Todavía no hay productos para comparar</b>
            <span>
              Al registrar un producto, escribe en “Comparar como” un nombre
              común (por ejemplo “Botella 700ml”) y usa el mismo en el producto
              del otro proveedor.
            </span>
          </div>
        )}
      </section>

      <section className="supplierSection">
        <div className="supplierTitle">
          <h2>Mis proveedores</h2>
          <p>{catalog.suppliers.length} registrados</p>
        </div>
        {loading ? (
          <div className="catalogEmpty">Cargando proveedores…</div>
        ) : catalog.suppliers.length ? (
          catalog.suppliers.map((s) => {
            const items = productsOf(catalog.products, s.name);
            return (
              <article className="supplierCard" key={s.id}>
                <header>
                  <span className="supplierIcon">
                    <Factory />
                  </span>
                  <div>
                    <h3>{s.name}</h3>
                    <p>
                      {s.contact && (
                        <span>
                          <Phone size={13} /> {s.contact}
                        </span>
                      )}
                      {s.url && (
                        <a
                          href={link(s.url)}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          <ExternalLink size={13} /> Ver su tienda
                        </a>
                      )}
                      {!s.contact && !s.url && (
                        <span>
                          {s.saved
                            ? "Sin contacto guardado"
                            : "Tomado de sus productos; agrégale contacto con Editar"}
                        </span>
                      )}
                    </p>
                    {s.notes && <p className="supplierNotes">{s.notes}</p>}
                  </div>
                  <div className="supplierActions">
                    <button onClick={() => setProductFor(s)}>
                      <Plus /> Agregar producto
                    </button>
                    <button onClick={() => setEditing(s)} title="Editar proveedor">
                      <Pencil />
                    </button>
                    {s.saved && (
                      <button
                        className="danger"
                        onClick={() => removeSupplier(s)}
                        title="Quitar proveedor"
                      >
                        <Trash2 />
                      </button>
                    )}
                  </div>
                </header>
                {items.length ? (
                  <div className="supplierProducts">
                    {items.map((p) => {
                      const info = infoOf(p);
                      return (
                        <div
                          className={
                            "supplierProduct" +
                            (picked.includes(p.id) ? " picked" : "")
                          }
                          key={p.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => togglePick(p.id)}
                          onKeyDown={(e) =>
                            (e.key === "Enter" || e.key === " ") &&
                            togglePick(p.id)
                          }
                          title="Tocar para seleccionar"
                        >
                          <span className="supplierCheck">
                            {picked.includes(p.id) ? "✓" : ""}
                          </span>
                          {p.image_url ? (
                            <img src={p.image_url} alt="" />
                          ) : (
                            <span className="compareNoPhoto">
                              <Package size={18} />
                            </span>
                          )}
                          <span>
                            <b>{p.name}</b>
                            <small>
                              {info.group
                                ? "Se compara como: " + info.group
                                : "Sin comparar"}
                            </small>
                          </span>
                          <span className="supplierPrice">
                            <b>{money(p.unit_price)}</b>
                            <small>{cordobas(p.unit_price)}</small>
                            <button
                              type="button"
                              className="supplierEdit"
                              onClick={(e) => {
                                e.stopPropagation();
                                setProductEdit(p);
                              }}
                            >
                              <Pencil /> Editar
                            </button>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="supplierEmpty">
                    Este proveedor todavía no tiene productos.
                  </p>
                )}
              </article>
            );
          })
        ) : (
          <div className="catalogEmpty">
            <Factory />
            <b>Aún no hay proveedores</b>
            <span>Pulsa “Agregar proveedor” para guardar el primero.</span>
          </div>
        )}
      </section>

      {picked.length > 0 && (
        <div className="pickBar">
          <b>
            {picked.length}{" "}
            {picked.length === 1
              ? "producto seleccionado"
              : "productos seleccionados"}
          </b>
          <button className="pickClear" onClick={() => setPicked([])}>
            Quitar selección
          </button>
          <button className="pickGo" onClick={() => onQuote?.(picked)}>
            <Plus /> Crear cotización con{" "}
            {picked.length === 1 ? "este producto" : "estos productos"}
          </button>
        </div>
      )}
      {(adding || editing) && (
        <SupplierDialog
          supplier={editing}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSave={(data) => saveSupplier(editing, data)}
        />
      )}
      {(productFor || productEdit) && (
        <RegisterProductDialog
          product={productEdit}
          defaults={{ supplier: productFor?.name }}
          options={options}
          onClose={() => {
            setProductFor(null);
            setProductEdit(null);
          }}
          onSaved={() => {
            load();
            onChange?.();
          }}
        />
      )}
    </div>
  );
}
