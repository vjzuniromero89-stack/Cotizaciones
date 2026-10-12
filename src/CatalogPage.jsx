import React, { useEffect, useMemo, useState } from "react";
import {
  Search,
  X,
  ChevronRight,
  ChevronLeft,
  Package,
  MessageCircle,
} from "lucide-react";
import { DEFAULT_EXCHANGE_RATE } from "./calculate.js";
import { priceNoteOf } from "./specs.js";
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
const categoryOf = (p) => String(p.category || "").trim() || "Otros";
// Número dentro de "600ML", "1 L"… para ordenar los tamaños de menor a mayor.
const sizeNumber = (text) => {
  const match = String(text || "").replace(",", ".").match(/[\d.]+/);
  if (!match) return Infinity;
  const value = Number(match[0]);
  return /\bl\b|litro/i.test(text) && !/ml/i.test(text) ? value * 1000 : value;
};

// Nombre sin el tamaño: "THIN BOTTLE STAINLESS 600ML" -> "THIN BOTTLE STAINLESS".
const withoutSize = (name) =>
  String(name || "")
    .replace(/\b\d+([.,]\d+)?\s*(ml|lts?|litros?|l|oz)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim() || String(name || "");

// Junta en un solo producto los que tienen el mismo modelo (la misma botella
// en varios tamaños). Los que no tienen modelo quedan solos.
function groupProducts(items) {
  const groups = new Map();
  for (const p of items) {
    const model = String(p.model || "").trim(),
      family = String(p.family || "").trim();
    const key = model
      ? "m:" + model.toLowerCase()
      : family
        ? "f:" + family.toLowerCase()
        : "p:" + p.id;
    if (!groups.has(key))
      groups.set(key, { key, model, title: "", items: [] });
    const group = groups.get(key);
    group.items.push(p);
    // Título: el nombre de catálogo si alguno lo tiene; si no, el nombre del
    // producto sin el tamaño.
    if (family && !group.named) {
      group.title = family;
      group.named = true;
    } else if (!group.title) group.title = model || family ? withoutSize(p.name) : p.name;
  }
  return [...groups.values()].map((g) => {
    const sorted = [...g.items].sort(
      (a, b) => sizeNumber(a.size || a.name) - sizeNumber(b.size || b.name),
    );
    const prices = sorted.map((p) => p.salePrice).filter((n) => n > 0);
    return {
      ...g,
      items: sorted,
      category: categoryOf(sorted[0]),
      photo: sorted.find((p) => p.imageUrl)?.imageUrl || "",
      // Fotos de todos los tamaños, sin repetir, para el que no tenga propias.
      photos: [
        ...new Set(
          sorted.flatMap((p) =>
            p.images?.length ? p.images : p.imageUrl ? [p.imageUrl] : [],
          ),
        ),
      ],
      minPrice: prices.length ? Math.min(...prices) : 0,
      maxPrice: prices.length ? Math.max(...prices) : 0,
    };
  });
}

// Galería de la ficha: miniaturas a la izquierda y la foto grande con flechas.
function Gallery({ images, title, onZoom }) {
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [images.join("|")]);
  if (!images.length) return <span className="pubNoPhoto">Sin foto</span>;
  const current = images[Math.min(index, images.length - 1)];
  const move = (step) =>
    setIndex((i) => (i + step + images.length) % images.length);
  return (
    <div className={"pubGallery" + (images.length > 1 ? " many" : "")}>
      {images.length > 1 && (
        <div className="pubThumbs" role="tablist" aria-label="Fotos del producto">
          {images.map((url, i) => (
            <button
              type="button"
              key={url}
              role="tab"
              aria-selected={i === index}
              className={i === index ? "active" : ""}
              onClick={() => setIndex(i)}
            >
              <img src={url} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
      <div className="pubBig">
        <img
          src={current}
          alt={title}
          title="Tocar para ver la foto más grande"
          onClick={() => onZoom(current)}
        />
        {images.length > 1 && (
          <>
            <button
              type="button"
              className="pubArrow left"
              aria-label="Foto anterior"
              onClick={() => move(-1)}
            >
              <ChevronLeft />
            </button>
            <button
              type="button"
              className="pubArrow"
              aria-label="Foto siguiente"
              onClick={() => move(1)}
            >
              <ChevronRight />
            </button>
            <span className="pubCount">
              {Math.min(index, images.length - 1) + 1} / {images.length}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function Price({ value, big, note }) {
  return (
    <div className={"pubPrice" + (big ? " big" : "")}>
      {value > 0 ? (
        <>
          <span>Precio por unidad · puesto en Managua</span>
          <b>US{usd(value)}</b>
          <em>{cs(value)}</em>
          <i>{priceNoteOf(note)}</i>
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
  const [state, setState] = useState({
      loading: true,
      error: "",
      items: [],
      whatsapp: "",
    }),
    [quantity, setQuantity] = useState(""),
    [search, setSearch] = useState(""),
    [category, setCategory] = useState(""),
    [open, setOpen] = useState(null),
    [sizeIndex, setSizeIndex] = useState(0),
    [zoom, setZoom] = useState(null);
  useEffect(() => {
    document.title = "Catálogo · CotizacionesChina";
    fetch("/api/catalogo")
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "No se pudo cargar el catálogo");
        setState({
          loading: false,
          error: "",
          items: d.products || [],
          whatsapp: d.whatsapp || "",
        });
      })
      .catch((e) =>
        setState({ loading: false, error: e.message, items: [], whatsapp: "" }),
      );
  }, []);
  const groups = useMemo(() => groupProducts(state.items), [state.items]);
  // Una ficha por categoría, con la foto de uno de sus productos.
  const categories = useMemo(() => {
    const found = new Map();
    for (const g of groups) {
      const id = g.category.toLowerCase();
      if (!found.has(id)) found.set(id, { name: g.category, count: 0, photo: "" });
      const entry = found.get(id);
      entry.count += 1;
      if (!entry.photo && g.photo) entry.photo = g.photo;
    }
    return [...found.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [groups]);
  const shown = groups.filter(
    (g) =>
      (!category || same(g.category, category)) &&
      (g.title + " " + g.model + " " + g.category + " " + g.items.map((p) => p.name).join(" "))
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  // Mensaje listo para WhatsApp con el producto, el tamaño y la cantidad.
  const orderLink = (group, p, units) => {
    const lines = [
      "Hola, quiero pedir este producto del catálogo:",
      "• " + group.title + (group.model ? " (modelo " + group.model + ")" : ""),
      group.items.length > 1 ? "Tamaño: " + (p.size || p.name) : "",
      p.salePrice > 0 ? "Precio: US" + usd(p.salePrice) + " por unidad" : "",
      p.salePrice > 0 ? "Condición: " + priceNoteOf(p.priceNote) : "",
      Number(units) > 0 ? "Cantidad: " + Number(units).toLocaleString() : "",
    ].filter(Boolean);
    return (
      "https://wa.me/" +
      state.whatsapp +
      "?text=" +
      encodeURIComponent(lines.join("\n"))
    );
  };
  const choose = (name) => {
    setCategory((current) => (same(current, name) ? "" : name));
    document
      .querySelector(".pubSection")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const current = open ? open.items[sizeIndex] || open.items[0] : null;
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
            {shown.map((g) => {
              const first = g.items[0];
              const many = g.items.length > 1;
              return (
                <button
                  type="button"
                  className="pubCard"
                  key={g.key}
                  onClick={() => {
                    setQuantity("");
                    setSizeIndex(0);
                    setOpen(g);
                  }}
                >
                  {g.photo ? (
                    <img src={g.photo} alt={g.title} loading="lazy" />
                  ) : (
                    <span className="pubNoPhoto">Sin foto</span>
                  )}
                  <div className="pubBody">
                    <small>{g.category}</small>
                    <h3>{g.title}</h3>
                    {many && (
                      <div className="pubSizes">
                        {g.items.map((p) => (
                          <span key={p.id}>{p.size || p.name}</span>
                        ))}
                      </div>
                    )}
                    {many ? (
                      <div className="pubPrice">
                        {g.minPrice > 0 ? (
                          <>
                            <span>Precio por unidad · según el tamaño</span>
                            <b>
                              {g.minPrice === g.maxPrice ? "" : "Desde "}US
                              {usd(g.minPrice)}
                            </b>
                            <em>{cs(g.minPrice)}</em>
                            <i>{priceNoteOf(first.priceNote)}</i>
                          </>
                        ) : (
                          <>
                            <span>Precio</span>
                            <b className="ask">Consultar</b>
                          </>
                        )}
                      </div>
                    ) : (
                      <Price value={first.salePrice} note={first.priceNote} />
                    )}
                    <span className="pubMore">
                      {many ? "Elegir tamaño" : "Ver ficha"} <ChevronRight />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="pubEmpty">No hay productos que coincidan.</p>
        )}
      </section>
      {state.whatsapp && (
        <a
          className="pubWhats"
          href={
            "https://wa.me/" +
            state.whatsapp +
            "?text=" +
            encodeURIComponent("Hola, vi el catálogo y quiero hacer una consulta.")
          }
          target="_blank"
          rel="noopener noreferrer"
        >
          <MessageCircle /> Escríbenos por WhatsApp
        </a>
      )}
      <footer className="pubFoot">
        Precios sujetos a confirmación de disponibilidad. El envío hasta Managua
        está incluido en el precio.
      </footer>
      {open && current && (
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
              <Gallery
                images={
                  current.images?.length
                    ? current.images
                    : current.imageUrl
                      ? [current.imageUrl]
                      : open.photos
                }
                title={open.title}
                onZoom={(url) => setZoom({ imageUrl: url, name: open.title })}
              />
            </div>
            <div className="pubSheetInfo">
              <small>
                {open.category}
                {open.model ? " · Modelo " + open.model : ""}
              </small>
              <h2>{open.title}</h2>
              {open.items.length > 1 && (
                <div className="pubSizePick">
                  <span>Elige el tamaño</span>
                  <div role="group" aria-label="Tamaños disponibles">
                    {open.items.map((p, i) => (
                      <button
                        type="button"
                        key={p.id}
                        className={i === sizeIndex ? "active" : ""}
                        aria-pressed={i === sizeIndex}
                        onClick={() => setSizeIndex(i)}
                      >
                        <b>{p.size || p.name}</b>
                        <small>
                          {p.salePrice > 0 ? "US" + usd(p.salePrice) : "Consultar"}
                        </small>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <Price value={current.salePrice} note={current.priceNote} big />
              {state.whatsapp && (
                <div className="pubOrder">
                  <label>
                    <span>¿Cuántas unidades? (opcional)</span>
                    <input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={quantity}
                      placeholder="Ej. 500"
                      onChange={(e) => setQuantity(e.target.value)}
                    />
                  </label>
                  <a
                    href={orderLink(open, current, quantity)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle /> Pedir por WhatsApp
                  </a>
                </div>
              )}
              {current.specs?.length > 0 && (
                <>
                  <h4>Descripción</h4>
                  <dl>
                    {current.specs.map(([label, value]) => (
                      <div key={label}>
                        <dt>{label}:</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                </>
              )}
              {current.unitsPerBox > 0 && (
                <p className="pubPack">
                  Viene en cajas de <b>{current.unitsPerBox}</b> unidades.
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
