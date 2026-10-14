import { estimateLandedUnit } from "./calculate.js";
// Ficha del producto: cada dato con su nombre, como en la cotización del
// proveedor (Material, Capacity, Weight, Product dimensions, Quantity).
export const SPEC_FIELDS = [
  ["material", "Material", "Material", /^(product\s+)?material|^cup body material/i],
  ["capacity", "Capacidad", "Capacity", /capacity|capacidad/i],
  ["weight", "Peso del producto", "Weight", /weight|peso/i],
  ["size", "Medidas del producto", "Product dimensions", /dimension|specification|medida|size/i],
  ["colors", "Colores y cantidad por color", "Quantity", /quantity|colou?r|cantidad/i],
];
// Convierte un texto libre en la ficha: reconoce "Material: PS" y, si las
// líneas no traen nombre, las reparte en el orden de la ficha.
export const specsFromText = (text) => {
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
export const specsOfInfo = (info = {}) =>
  info.specs
    ? { specs: info.specs, rest: info.description || "" }
    : specsFromText(info.description);
// Lo que puede ver el cliente en su cotización: material, capacidad, peso y
// medidas. Los colores disponibles y "otros detalles" se quedan en el catálogo;
// lo que el cliente pidió va en el detalle del pedido.
const PUBLIC_SPECS = ["material", "capacity", "weight", "size"];
export const publicSpecs = (info) => {
  const { specs } = specsOfInfo(info);
  return SPEC_FIELDS.filter(
    ([key]) => PUBLIC_SPECS.includes(key) && String(specs[key] || "").trim(),
  ).map(([key, label]) => [label, String(specs[key]).trim()]);
};

// Condición del precio que ve el cliente. Todos los productos usan la misma
// por defecto; un producto puede llevar otra escrita a mano.
export const DEFAULT_PRICE_NOTE = "2 colores x 1000 piezas";
export const priceNoteOf = (note) =>
  String(note || "").trim() || DEFAULT_PRICE_NOTE;

// Fecha de hoy según el reloj de quien usa la aplicación (no la hora UTC,
// que de noche en Nicaragua ya marca el día siguiente).
export const localToday = () => {
  const d = new Date();
  const two = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + two(d.getMonth() + 1) + "-" + two(d.getDate());
};
// Costo por unidad que tenía el producto guardado (compra + comisión + flete).
function oldCostOf(product) {
  const box = product?.boxes?.[0] || {},
    buy = Number(product?.unit_price) || 0;
  const hasBox =
    (Number(box.l) > 0 && Number(box.w) > 0 && Number(box.h) > 0) ||
    Number(box.weight) > 0;
  const landed = hasBox ? estimateLandedUnit({ price: buy, box }) : null;
  return Math.round((landed?.total || buy) * 1000) / 1000;
}
// Porcentaje de ganancia de un renglón del historial: (venta − costo) ÷ costo.
// null si el renglón es viejo y no guardó el costo.
export function marginOf(entry) {
  const cost = Number(entry?.cost) || 0,
    sale = Number(entry?.salePrice) || 0;
  return cost > 0 && sale > 0 ? ((sale - cost) / cost) * 100 : null;
}
// Todos los cambios de todos los productos, del más nuevo al más viejo.
export function priceChanges(products) {
  const list = [];
  for (const product of products || []) {
    const history = product?.boxes?.[0]?.info?.history;
    if (!Array.isArray(history)) continue;
    for (let i = 1; i < history.length; i++)
      list.push({ product, before: history[i - 1], now: history[i], order: i });
  }
  return list.sort(
    (a, b) =>
      String(b.now.date).localeCompare(String(a.now.date)) || b.order - a.order,
  );
}
// Historial de precios de un producto. Cada vez que cambia el precio de compra
// o el de venta se agrega un renglón; nunca se borra lo anterior.
export function nextPriceHistory(product, price, salePrice, supplier, cost) {
  const info = product?.boxes?.[0]?.info || {};
  const history = Array.isArray(info.history) ? [...info.history] : [];
  const buy = Number(price) || 0,
    sell = Number(salePrice) || 0;
  // Costo por unidad puesto en Nicaragua; sin caja se usa el precio de compra.
  const landed = Math.round((Number(cost) || buy) * 1000) / 1000;
  // Producto que ya existía sin historial: se guarda primero lo que tenía.
  if (product && !history.length) {
    const oldBuy = Number(product.unit_price) || 0,
      oldSell = Number(info.salePrice) || 0;
    if (oldBuy > 0 || oldSell > 0)
      history.push({
        date: String(product.updated_at || product.created_at || "").slice(0, 10),
        price: oldBuy,
        salePrice: oldSell,
        cost: oldCostOf(product),
        supplier: String(info.supplier || ""),
      });
  }
  const last = history[history.length - 1];
  const costChanged =
    last && Number(last.cost) > 0 && Math.abs(last.cost - landed) > 0.005;
  if (!last || last.price !== buy || last.salePrice !== sell || costChanged) {
    if (buy > 0 || sell > 0)
      history.push({
        date: localToday(),
        price: buy,
        salePrice: sell,
        cost: landed,
        supplier: String(supplier || ""),
      });
  }
  return history;
}

// Último cambio de un precio ("price" = compra, "salePrice" = venta): cuánto
// era antes, cuánto es ahora y desde cuándo. null si nunca ha cambiado.
export function lastChange(info, field) {
  const history = Array.isArray(info?.history) ? info.history : [];
  if (history.length < 2) return null;
  const now = Number(history[history.length - 1][field]) || 0;
  for (let i = history.length - 2; i >= 0; i--) {
    const before = Number(history[i][field]) || 0;
    if (before !== now) {
      return {
        before,
        now,
        date: history[i + 1].date,
        percent: before > 0 ? ((now - before) / before) * 100 : null,
      };
    }
  }
  return null;
}
