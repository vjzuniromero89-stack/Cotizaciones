import React, { useEffect, useRef, useState } from "react";
import { Images, Plus, Trash2, ClipboardPaste, X } from "lucide-react";
import { authFetch } from "./auth.js";
import { uploadImage, imagesFromPaste } from "./image.js";
import { PHOTOS_ROW, galleryOf } from "./suppliers.js";
import "./suppliers.css";

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

export default function PhotosPage({ refreshKey }) {
  const [gallery, setGallery] = useState({ row: null, saved: [], photos: [] }),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(0),
    [error, setError] = useState(""),
    [open, setOpen] = useState(null),
    [dragging, setDragging] = useState(false);
  // Siempre la lista más reciente, para no perder fotos al subir varias.
  const current = useRef(gallery);
  current.current = gallery;
  async function load() {
    try {
      setGallery(galleryOf(await api("/catalog-products")));
    } catch {
      setGallery({ row: null, saved: [], photos: [] });
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [refreshKey]);
  async function write(list) {
    const body = JSON.stringify({
      name: PHOTOS_ROW,
      imageUrl: "",
      price: 0,
      qty: 0,
      boxes: list,
    });
    const row = current.current.row;
    if (row) await api("/catalog-products/" + row.id, { method: "PUT", body });
    else await api("/catalog-products", { method: "POST", body });
    await load();
  }
  async function add(files) {
    const images = [...files].filter((f) => f.type.startsWith("image/"));
    if (!images.length) return;
    setError("");
    setBusy((n) => n + images.length);
    const added = [];
    for (const file of images) {
      try {
        const url = await uploadImage(file, authFetch);
        added.push({
          id: crypto.randomUUID(),
          url,
          name: file.name.replace(/\.[^.]+$/, ""),
          date: new Date().toISOString(),
        });
      } catch (e) {
        setError(e.message || "No se pudo subir la foto");
      } finally {
        setBusy((n) => n - 1);
      }
    }
    if (added.length) {
      try {
        await write([...added, ...current.current.saved]);
      } catch (e) {
        setError(e.message || "No se pudo guardar la galería");
      }
    }
  }
  async function remove(photo) {
    if (!window.confirm("¿Quitar esta foto de la galería?")) return;
    await write(current.current.saved.filter((p) => p.id !== photo.id));
    setOpen(null);
  }
  useEffect(() => {
    const onPaste = (event) => {
      const files = imagesFromPaste(event);
      if (!files.length) return;
      event.preventDefault();
      add(files);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);
  return (
    <div className="workspace">
      <div className="pageHead">
        <div>
          <small>GALERÍA</small>
          <h1>Fotos</h1>
          <p>
            Guarda aquí las fotos de tus productos para usarlas después al
            registrar un producto.
          </p>
        </div>
        <label className="newProduct photoAddButton">
          <Plus /> Agregar fotos
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => {
              add(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      <div
        className={"photoDrop" + (dragging ? " over" : "")}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          add(e.dataTransfer.files);
        }}
      >
        <ClipboardPaste />
        <div>
          <b>
            {busy > 0
              ? `Subiendo ${busy} ${busy === 1 ? "foto" : "fotos"}…`
              : "Pega una foto con Ctrl + V"}
          </b>
          <span>
            Recorta la pantalla con Windows + Shift + S y pégala aquí. También
            puedes arrastrar fotos a este cuadro.
          </span>
        </div>
      </div>
      {error && (
        <div className="saveError">
          <b>No se pudo subir</b>
          <span>{error}</span>
        </div>
      )}
      {loading ? (
        <div className="catalogEmpty">Cargando fotos…</div>
      ) : gallery.photos.length ? (
        <div className="photoGrid">
          {gallery.photos.map((photo) => (
            <button
              className="photoTile"
              key={photo.id}
              onClick={() => setOpen(photo)}
            >
              <img src={photo.url} alt={photo.name || "Foto"} loading="lazy" />
              <span>
                {photo.product
                  ? "En uso: " + photo.product
                  : photo.name || "Sin usar"}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="catalogEmpty">
          <Images />
          <b>La galería está vacía</b>
          <span>Pega, arrastra o agrega tu primera foto.</span>
        </div>
      )}
      {open && (
        <div
          className="overlay"
          onMouseDown={(e) => e.target === e.currentTarget && setOpen(null)}
        >
          <section className="dialog photoViewer">
            <div className="dialogHead">
              <div>
                <small>FOTO</small>
                <h2>{open.product || open.name || "Foto"}</h2>
              </div>
              <button type="button" onClick={() => setOpen(null)}>
                <X />
              </button>
            </div>
            <img src={open.url} alt="" />
            <p>
              {open.product
                ? `Es la foto del producto ${open.product}.`
                : "Todavía no la usa ningún producto. Elígela al registrar un producto con “Elegir de la galería”."}
            </p>
            {open.saved ? (
              <button className="photoRemove" onClick={() => remove(open)}>
                <Trash2 /> Quitar de la galería
              </button>
            ) : (
              <p className="photoNote">
                Aparece aquí porque un producto la usa; se quita cambiando la
                foto de ese producto.
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
