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
