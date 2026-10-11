// Reduce la foto en el navegador antes de subirla: las fotos de teléfono
// suelen pasar de 5 MB y el servidor las rechaza.
const MAX_SIDE = 1600;
export async function shrinkImage(file) {
  if (!file?.type?.startsWith("image/") || file.type === "image/gif")
    return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= 1024 * 1024) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", {
      type: "image/jpeg",
    });
  } catch {
    return file;
  }
}

// Sube una foto (ya reducida) y devuelve su dirección dentro de la aplicación.
export async function uploadImage(original, authFetch) {
  const file = await shrinkImage(original);
  if (file.size > 5 * 1024 * 1024)
    throw new Error("La foto debe pesar menos de 5 MB");
  const name = (file.name || "foto.png").replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = crypto.randomUUID() + "-" + name;
  const r = await authFetch("/api/uploads/" + key, {
    method: "PUT",
    headers: { "content-type": file.type || "application/octet-stream" },
    body: file,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok)
    throw new Error(data.error || data.detail || "No se pudo subir la foto");
  return data.url || "/api/files/" + key;
}

// Fotos que vienen en un "pegar" (Ctrl+V), por ejemplo un recorte de pantalla.
export function imagesFromPaste(event) {
  const items = [...(event.clipboardData?.items || [])];
  return items
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter(Boolean)
    .map(
      (file) =>
        new File([file], file.name && file.name !== "image.png" ? file.name : `recorte-${Date.now()}.png`, {
          type: file.type,
        }),
    );
}
