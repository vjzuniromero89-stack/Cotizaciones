import React, { useEffect, useState } from "react";
import { Users, Plus, ShieldCheck, User, KeyRound } from "lucide-react";
import { authFetch } from "./auth.js";
import "./users.css";
async function api(path, options) {
  const r = await authFetch("/api" + path, {
    headers: { "content-type": "application/json" },
    ...options,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || d.detail || "No se pudo completar");
  return d;
}
export default function UsersPage() {
  const [users, setUsers] = useState([]),
    [show, setShow] = useState(false),
    [form, setForm] = useState({ username: "", password: "", role: "user" }),
    [error, setError] = useState("");
  async function load() {
    try {
      setUsers(await api("/users"));
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function create(e) {
    e.preventDefault();
    setError("");
    try {
      await api("/users", { method: "POST", body: JSON.stringify(form) });
      setForm({ username: "", password: "", role: "user" });
      setShow(false);
      load();
    } catch (e) {
      setError(e.message);
    }
  }
  async function update(u, changes) {
    try {
      await api("/users/" + u.id, {
        method: "PATCH",
        body: JSON.stringify({ ...u, ...changes }),
      });
      load();
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <div className="workspace usersPage">
      <div className="pageHead">
        <div>
          <small>SEGURIDAD Y ACCESO</small>
          <h1>Usuarios</h1>
          <p>Administra quién puede entrar a la página y sus permisos.</p>
        </div>
        <button className="newProduct" onClick={() => setShow(!show)}>
          <Plus /> Crear usuario
        </button>
      </div>
      {show && (
        <form className="newUserPanel" onSubmit={create}>
          <label>
            <span>Usuario</span>
            <input
              required
              minLength="3"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
          </label>
          <label>
            <span>Contraseña inicial</span>
            <input
              type="password"
              required
              minLength="8"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </label>
          <label>
            <span>Permiso</span>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="user">Usuario</option>
              <option value="admin">Administrador</option>
            </select>
          </label>
          <button>Guardar usuario</button>
        </form>
      )}
      {error && (
        <div className="saveError">
          <b>No se pudo completar</b>
          <span>{error}</span>
        </div>
      )}
      <div className="userGrid">
        {users.map((u) => (
          <article className="userCard" key={u.id}>
            <div className={u.role === "admin" ? "userIcon admin" : "userIcon"}>
              {u.role === "admin" ? <ShieldCheck /> : <User />}
            </div>
            <div>
              <h3>{u.username}</h3>
              <p>{u.role === "admin" ? "Administrador" : "Usuario estándar"}</p>
              <small>
                {u.lastSignIn
                  ? `Último acceso: ${new Date(u.lastSignIn).toLocaleString()}`
                  : "Todavía no ha iniciado sesión"}
              </small>
            </div>
            <label className="userRole">
              <span>Rol</span>
              <select
                value={u.role}
                onChange={(e) => update(u, { role: e.target.value })}
              >
                <option value="user">Usuario</option>
                <option value="admin">Administrador</option>
              </select>
            </label>
            <label className="userActive">
              <input
                type="checkbox"
                checked={u.active}
                onChange={(e) => update(u, { active: e.target.checked })}
              />
              <span>{u.active ? "Activo" : "Desactivado"}</span>
            </label>
            <button
              className="resetPassword"
              onClick={() => {
                const password = prompt(
                  "Nueva contraseña (mínimo 8 caracteres)",
                );
                if (password) update(u, { password });
              }}
            >
              <KeyRound /> Cambiar contraseña
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
