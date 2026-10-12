// Proveedores. El catálogo no tiene tabla propia para ellos, así que la lista
// (contacto, enlace, notas) se guarda en una fila reservada del catálogo que
// nunca se muestra como producto.
export const SUPPLIERS_ROW = "__proveedores__";
// La galería de fotos se guarda igual, en otra fila reservada.
export const PHOTOS_ROW = "__fotos__";
// Ajustes del catálogo público (por ahora, el WhatsApp para pedidos).
export const CONFIG_ROW = "__config__";
export const isRealProduct = (row) =>
  ![SUPPLIERS_ROW, PHOTOS_ROW, CONFIG_ROW].includes(row?.name);
export function configOf(rows) {
  const row = (Array.isArray(rows) ? rows : []).find(
    (r) => r.name === CONFIG_ROW,
  );
  return { row: row || null, whatsapp: String(row?.boxes?.[0]?.whatsapp || "") };
}
// Fotos de la galería más las que ya usan los productos, sin repetir.
export function galleryOf(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const row = list.find((r) => r.name === PHOTOS_ROW) || null;
  const saved = (row?.boxes || []).filter((p) => p?.url);
  const used = new Map();
  for (const product of list.filter(isRealProduct))
    if (product.image_url) used.set(product.image_url, product.name);
  const photos = saved.map((p) => ({ ...p, saved: true, product: used.get(p.url) || "" }));
  for (const [url, product] of used)
    if (!saved.some((p) => p.url === url))
      photos.push({ id: url, url, saved: false, product });
  return { row, saved, photos };
}
export const infoOf = (product) => product?.boxes?.[0]?.info || {};
const key = (text) => String(text || "").trim().toLowerCase();

// Separa lo que devuelve /api/catalog-products en productos y proveedores.
// Un proveedor escrito en un producto aparece aunque no tenga ficha propia.
export function splitCatalog(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const row = list.find((r) => r.name === SUPPLIERS_ROW) || null;
  const products = list.filter(isRealProduct);
  const suppliers = (row?.boxes || [])
    .filter((s) => s?.name)
    .map((s) => ({ ...s, saved: true }));
  for (const product of products) {
    const name = String(infoOf(product).supplier || "").trim();
    if (name && !suppliers.some((s) => key(s.name) === key(name)))
      suppliers.push({ id: "auto-" + key(name), name, saved: false });
  }
  suppliers.sort((a, b) => a.name.localeCompare(b.name, "es"));
  return { products, suppliers, row };
}
// Categorías ya usadas en los productos, sin repetir (no distingue mayúsculas).
export function categoriesOf(products) {
  const found = new Map();
  for (const product of products) {
    const name = String(infoOf(product).category || "").trim();
    if (name && !found.has(key(name))) found.set(key(name), name);
  }
  return [...found.values()].sort((a, b) => a.localeCompare(b, "es"));
}
export const productsOf = (products, supplierName) =>
  products.filter((p) => key(infoOf(p).supplier) === key(supplierName));

// Productos que son "el mismo" en varios proveedores: comparten el nombre
// escrito en "Comparar como".
export function comparisonGroups(products) {
  const groups = new Map();
  for (const product of products) {
    const name = String(infoOf(product).group || "").trim();
    if (!name) continue;
    const id = key(name);
    if (!groups.has(id)) groups.set(id, { name, products: [] });
    groups.get(id).products.push(product);
  }
  return [...groups.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "es"),
  );
}
