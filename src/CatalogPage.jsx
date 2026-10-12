import React, { useEffect, useMemo, useState } from "react";
import { Search, X, ChevronRight, Package } from "lucide-react";
import { DEFAULT_EXCHANGE_RATE } from "./calculate.js";
import "./catalog-public.css";

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
const same = (a, b) =>
  String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

function Price({ value, big }) {
  return (
    <div className={"pubPrice" + (big ? " big" : "")}>
      {value > 0 ? (
        <>
          <span>Precio por unidad · puesto en Managua</span>
          <b>US{usd(value)}</b>
          <em>{cs(value)}</em>
        </>
      ) : (
        <>
          <span>Precio</span>
          <b className="ask">Consultar</b>
        </>
      )}
    </div>
  );
}

// Catálogo público para clientes: portada con categorías, tarjetas y ficha
// de cada producto. El servidor nunca envía aquí costos, proveedor ni notas.
export default function CatalogPage() {
  const [state, setState] = useState({ loading: true, error: "", items: [] }),
    [search, setSearch] = useState(""),
    [category, setCategory] = useState(""),
    [open, setOpen] = useState(null),
    [zoom, setZoom] = useState(null);
  useEffect(() => {
    document.title = "Catálogo · CotizacionesChina";
    fetch("/api/catalogo")
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "No se pudo cargar el catálogo");
        setState({ loading: false, error: "", items: d.products || [] });
      })
      .catch((e) => setState({ loading: false, error: e.message, items: [] }));
  }, []);
  // Una ficha por categoría, con la foto de uno de sus productos.
  const categories = useMemo(() => {
    const found = new Map();
    for (const p of state.items) {
      const name = String(p.category || "").trim() || "Otros";
      const id = name.toLowerCase();
      if (!found.has(id)) found.set(id, { name, count: 0, photo: "" });
      const group = found.get(id);
      group.count += 1;
      if (!group.photo && p.imageUrl) group.photo = p.imageUrl;
    }
    return [...found.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [state.items]);
  const shown = state.items.filter(
    (p) =>
      (!category || same(String(p.category || "").trim() || "Otros", category)) &&
      (p.name + " " + (p.category || ""))
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  const choose = (name) => {
    setCategory((current) => (same(current, name) ? "" : name));
    document
      .querySelector(".pubSection")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <div className="pubCatalog">
      <header className="pubCover">
        <div className="pubBrand">
          <span>CC</span>
          <b>CotizacionesChina</b>
        </div>
        <h1>Importamos lo que necesitas</h1>
        <p>
          Productos traídos de China, con el precio ya puesto en Managua,
          Nicaragua. Elige una categoría o busca un producto.
        </p>
        <label className="pubSearch">
          <Search />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto…"
          />
        </label>
        {categories.length > 0 && (
          <div className="pubCats">
            {categories.map((c) => (
              <button
                type="button"
                key={c.name}
                className={same(category, c.name) ? "active" : ""}
                aria-pressed={same(category, c.name)}
                onClick={() => choose(c.name)}
              >
                {c.photo ? (
                  <img src={c.photo} alt="" loading="lazy" />
                ) : (
                  <i>
                    <Package />
                  </i>
                )}
                <span>
                  <b>{c.name}</b>
                  <small>
                    {c.count} {c.count === 1 ? "producto" : "productos"}
                  </small>
                </span>
                <ChevronRight />
              </button>
            ))}
          </div>
        )}
      </header>
      <section className="pubSection">
        <div className="pubSectionHead">
          <h2>{category || "Todos los productos"}</h2>
          <span>
            {shown.length} {shown.length === 1 ? "producto" : "productos"}
          </span>
          {category && (
            <button type="button" onClick={() => setCategory("")}>
              Ver todos
            </button>
          )}
        </div>
        {state.loading ? (
          <p className="pubEmpty">Cargando catálogo…</p>
        ) : state.error ? (
          <p className="pubEmpty">{state.error}</p>
        ) : shown.length ? (
          <div className="pubGrid">
            {shown.map((p) => (
              <button
                type="button"
                className="pubCard"
                key={p.id}
                onClick={() => setOpen(p)}
              >
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.name} loading="lazy" />
                ) : (
                  <span className="pubNoPhoto">Sin foto</span>
                )}
                <div className="pubBody">
                  <small>{String(p.category || "").trim() || "Otros"}</small>
                  <h3>{p.name}</h3>
                  <Price value={p.salePrice} />
                  <span className="pubMore">
                    Ver ficha <ChevronRight />
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="pubEmpty">No hay productos que coincidan.</p>
        )}
      </section>
      <footer className="pubFoot">
        Precios sujetos a confirmación de disponibilidad. El envío hasta Managua
        está incluido en el precio.
      </footer>
      {open && (
        <div
          className="pubSheetBack"
          onMouseDown={(e) => e.target === e.currentTarget && setOpen(null)}
        >
          <article className="pubSheet" role="dialog" aria-modal="true">
            <button
              type="button"
              className="pubClose"
              aria-label="Cerrar ficha"
              onClick={() => setOpen(null)}
            >
              <X />
            </button>
            <div className="pubSheetPhoto">
              {open.imageUrl ? (
                <img
                  src={open.imageUrl}
                  alt={open.name}
                  title="Tocar para ver la foto más grande"
                  onClick={() => setZoom(open)}
                />
              ) : (
                <span className="pubNoPhoto">Sin foto</span>
              )}
            </div>
            <div className="pubSheetInfo">
              <small>{String(open.category || "").trim() || "Otros"}</small>
              <h2>{open.name}</h2>
              <Price value={open.salePrice} big />
              {open.specs?.length > 0 && (
                <>
                  <h4>Descripción</h4>
                  <dl>
                    {open.specs.map(([label, value]) => (
                      <div key={label}>
                        <dt>{label}:</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                </>
              )}
              {open.unitsPerBox > 0 && (
                <p className="pubPack">
                  Viene en cajas de <b>{open.unitsPerBox}</b> unidades.
                </p>
              )}
            </div>
          </article>
        </div>
      )}
      {zoom && (
        <div className="pubZoom" onClick={() => setZoom(null)}>
          <button type="button" aria-label="Cerrar foto">
            <X />
          </button>
          <img src={zoom.imageUrl} alt={zoom.name} />
          <span>{zoom.name}</span>
        </div>
      )}
    </div>
  );
}
