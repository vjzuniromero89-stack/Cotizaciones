import React, { useEffect, useMemo, useState } from "react";
import {
  Search,
  Users,
  Phone,
  FileText,
  Plus,
  X,
  CalendarDays,
} from "lucide-react";
import "./clients.css";
import { authFetch } from "./auth.js";

const money = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    n || 0,
  );
async function api(path) {
  const r = await authFetch("/api" + path);
  if (!r.ok) throw new Error("No se pudieron cargar los clientes");
  return r.json();
}
const quoteTotal = (q) =>
  Number(q.totals?.saleTotal ?? q.sale_total ?? q.total ?? 0);

function ClientDetail({ client, onClose, onCreate }) {
  return (
    <div
      className="overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section className="clientDetail">
        <div className="clientDetailHead">
          <div className="clientAvatar">
            {client.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <small>EXPEDIENTE DEL CLIENTE</small>
            <h2>{client.name}</h2>
            <p>
              <Phone /> {client.phone || "Sin teléfono registrado"}
            </p>
          </div>
          <button onClick={onClose}>
            <X />
          </button>
        </div>
        <button className="newClientQuote" onClick={() => onCreate(client)}>
          <Plus /> Crear nueva cotización para este cliente
        </button>
        <div className="clientStats">
          <div>
            <span>Cotizaciones</span>
            <b>{client.quotes.length}</b>
          </div>
          <div>
            <span>Valor cotizado</span>
            <b>{money(client.total)}</b>
          </div>
        </div>
        <div className="clientHistory">
          <h3>
            <FileText /> Historial de cotizaciones
          </h3>
          {client.quotes.map((q) => (
            <article key={q.id}>
              <div>
                <b>{q.number || "Cotización"}</b>
                <span>{q.description || "Sin descripción"}</span>
              </div>
              <div>
                <span>
                  <CalendarDays /> {new Date(q.created_at).toLocaleDateString()}
                </span>
                <strong>{money(quoteTotal(q))}</strong>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function ClientsPage({ refreshKey, onCreateQuote }) {
  const [records, setRecords] = useState([]),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    api("/records?type=quote")
      .then(setRecords)
      .catch((e) => setError(e.message));
  }, [refreshKey]);
  const clients = useMemo(() => {
    const groups = new Map();
    for (const q of records) {
      const name = (
          q.customer_name ||
          q.customer ||
          "Cliente sin nombre"
        ).trim(),
        phone = (q.phone || "").trim(),
        key = (name + "|" + phone).toLowerCase();
      if (!groups.has(key))
        groups.set(key, {
          name,
          phone,
          quotes: [],
          total: 0,
          last: q.created_at,
        });
      const c = groups.get(key);
      c.quotes.push(q);
      c.total += quoteTotal(q);
      if (new Date(q.created_at) > new Date(c.last)) c.last = q.created_at;
    }
    return [...groups.values()].sort(
      (a, b) => new Date(b.last) - new Date(a.last),
    );
  }, [records]);
  const shown = clients.filter((c) =>
    (c.name + " " + c.phone).toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="workspace clientsPage">
      <div className="pageHead">
        <div>
          <small>DIRECTORIO COMERCIAL</small>
          <h1>Clientes</h1>
          <p>
            Cada cliente conserva automáticamente su historial de cotizaciones.
          </p>
        </div>
        <button className="newProduct" onClick={() => onCreateQuote(null)}>
          <Plus /> Crear cotización
        </button>
      </div>
      <div className="clientSummary">
        <div>
          <Users />
          <span>Clientes registrados</span>
          <b>{clients.length}</b>
        </div>
        <div>
          <FileText />
          <span>Cotizaciones</span>
          <b>{records.length}</b>
        </div>
        <div>
          <span>Valor total cotizado</span>
          <b>{money(clients.reduce((s, c) => s + c.total, 0))}</b>
        </div>
      </div>
      <label className="clientSearch">
        <Search />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar cliente o teléfono…"
        />
      </label>
      {error ? (
        <div className="catalogEmpty">{error}</div>
      ) : shown.length ? (
        <div className="clientGrid">
          {shown.map((c) => (
            <button
              key={(c.name + "|" + c.phone).toLowerCase()}
              className="clientCard"
              onClick={() => setSelected(c)}
            >
              <span className="clientAvatar">
                {c.name.slice(0, 2).toUpperCase()}
              </span>
              <div>
                <h3>{c.name}</h3>
                <p>
                  <Phone /> {c.phone || "Sin teléfono"}
                </p>
                <small>
                  {c.quotes.length}{" "}
                  {c.quotes.length === 1 ? "cotización" : "cotizaciones"} ·
                  Última {new Date(c.last).toLocaleDateString()}
                </small>
              </div>
              <strong>{money(c.total)}</strong>
            </button>
          ))}
        </div>
      ) : (
        <div className="catalogEmpty">
          <Users />
          <b>No hay clientes todavía</b>
          <span>
            Los clientes aparecerán aquí al guardar su primera cotización.
          </span>
          <button className="newProduct" onClick={() => onCreateQuote(null)}>
            <Plus /> Crear primera cotización
          </button>
        </div>
      )}
      {selected && (
        <ClientDetail
          client={selected}
          onClose={() => setSelected(null)}
          onCreate={onCreateQuote}
        />
      )}
    </div>
  );
}
