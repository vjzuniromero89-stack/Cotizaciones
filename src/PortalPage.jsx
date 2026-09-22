import React, { useEffect, useState } from "react";
import { Ship, Phone, FileText, CalendarDays, PackageSearch } from "lucide-react";
import { ClientQuote } from "./RecordsPage.jsx";
import "./portal.css";

const money = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    n || 0,
  );
const quoteTotal = (q) => Number(q.totals?.saleTotal ?? q.total ?? 0);
const statusLabel = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  purchased: "Comprada",
  transit: "En tránsito",
  delivered: "Entregada",
  cancelled: "Cancelada",
  returned: "Devuelta",
};

export default function PortalPage({ token }) {
  const [state, setState] = useState({ loading: true, error: "", data: null }),
    [openId, setOpenId] = useState(null);
  useEffect(() => {
    fetch("/api/portal/" + encodeURIComponent(token))
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "Enlace no válido");
        setState({ loading: false, error: "", data: d });
      })
      .catch((e) =>
        setState({ loading: false, error: e.message, data: null }),
      );
  }, [token]);

  if (state.loading)
    return (
      <div className="portalLoading">
        <Ship /> Cargando tu casillero…
      </div>
    );
  if (state.error)
    return (
      <div className="portalLoading portalError">
        <PackageSearch />
        <h2>No pudimos abrir este enlace</h2>
        <p>{state.error}</p>
      </div>
    );

  const { client, quotes } = state.data,
    openQuote = quotes.find((q) => q.id === openId);
  if (openQuote)
    return (
      <ClientQuote
        data={openQuote}
        publicMode
        closeLabel="Volver a mi casillero"
        onClose={() => setOpenId(null)}
        onDeleted={() => setOpenId(null)}
      />
    );

  const total = quotes.reduce((s, q) => s + quoteTotal(q), 0);
  return (
    <div className="portalPage">
      <div className="portalHeader">
        <div className="portalBrand">
          <Ship />
          <div>
            <b>CotizacionesChina</b>
            <small>Compras y logística internacional</small>
          </div>
        </div>
      </div>
      <div className="portalIntro">
        <small>TU CASILLERO</small>
        <h1>{client.name}</h1>
        {client.phone && (
          <p>
            <Phone /> {client.phone}
          </p>
        )}
      </div>
      <div className="portalStats">
        <div>
          <span>Cotizaciones</span>
          <b>{quotes.length}</b>
        </div>
        <div>
          <span>Valor total</span>
          <b>{money(total)}</b>
        </div>
      </div>
      <div className="portalList">
        <h3>
          <FileText /> Tus cotizaciones
        </h3>
        {quotes.length === 0 ? (
          <div className="portalEmpty">
            Todavía no tienes cotizaciones aquí.
          </div>
        ) : (
          quotes.map((q) => (
            <article
              key={q.id}
              className="portalRow"
              onClick={() => setOpenId(q.id)}
            >
              <div>
                <b>{q.number || "Cotización"}</b>
                <span>{q.description || "Sin descripción"}</span>
              </div>
              <div>
                <span className={"portalBadge " + (q.status || "pending")}>
                  {statusLabel[q.status] || "Pendiente"}
                </span>
                <span>
                  <CalendarDays />{" "}
                  {new Date(q.created_at).toLocaleDateString()}
                </span>
                <strong>{money(quoteTotal(q))}</strong>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
