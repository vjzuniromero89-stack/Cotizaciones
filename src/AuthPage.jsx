import React, { useState } from "react";
import { Ship, User, Lock, LogIn, ShieldCheck } from "lucide-react";
import { saveSession } from "./auth.js";
import "./auth.css";

export default function AuthPage({ needsSetup, onAuthenticated }) {
  const [form, setForm] = useState({ username: "", password: "", confirm: "" }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    if (needsSetup && form.password !== form.confirm) {
      setError("Las contraseñas no coinciden");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (needsSetup) {
        const setup = await fetch("/api/auth/bootstrap", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(form),
        });
        const d = await setup.json();
        if (!setup.ok) throw new Error(d.error || d.detail);
      }
      const r = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(form),
        }),
        data = await r.json();
      if (!r.ok) throw new Error(data.error || data.detail);
      saveSession(data);
      onAuthenticated(data);
    } catch (e) {
      setError(e.message || "No se pudo iniciar sesión");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="authScreen">
      <section className="authCard">
        <div className="authBrand">
          <span>
            <Ship />
          </span>
          <div>
            <h1>CotizacionesChina</h1>
            <p>Compras y logística internacional</p>
          </div>
        </div>
        <div className="authIntro">
          {needsSetup ? (
            <>
              <ShieldCheck />
              <h2>Crear administrador</h2>
              <p>
                Configura la primera cuenta que administrará todos los usuarios.
              </p>
            </>
          ) : (
            <>
              <LogIn />
              <h2>Iniciar sesión</h2>
              <p>Ingresa con tu usuario y contraseña.</p>
            </>
          )}
        </div>
        <form onSubmit={submit}>
          <label>
            <span>Usuario</span>
            <div>
              <User />
              <input
                autoComplete="username"
                required
                minLength="3"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </div>
          </label>
          <label>
            <span>Contraseña</span>
            <div>
              <Lock />
              <input
                type="password"
                autoComplete={needsSetup ? "new-password" : "current-password"}
                required
                minLength="8"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
          </label>
          {needsSetup && (
            <label>
              <span>Confirmar contraseña</span>
              <div>
                <Lock />
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength="8"
                  value={form.confirm}
                  onChange={(e) =>
                    setForm({ ...form, confirm: e.target.value })
                  }
                />
              </div>
            </label>
          )}
          {error && <div className="authError">{error}</div>}
          <button disabled={busy}>
            {busy
              ? "Procesando…"
              : needsSetup
                ? "Crear administrador y entrar"
                : "Entrar"}
          </button>
        </form>
      </section>
    </main>
  );
}
