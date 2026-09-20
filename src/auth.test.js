import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../worker/index.js";
const env = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SECRET_KEY: "sb_secret_test",
};
describe("seguridad de usuarios", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("bloquea los datos cuando no existe una sesión", async () => {
    const response = await worker.fetch(
      new Request("https://cotizaciones.test/api/records?type=quote"),
      env,
    );
    expect(response.status).toBe(401);
  });
  it("permite crear únicamente el primer administrador", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ users: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "admin-1",
            app_metadata: { username: "victor", role: "admin", active: true },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const response = await worker.fetch(
      new Request("https://cotizaciones.test/api/auth/bootstrap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "victor", password: "segura123" }),
      }),
      env,
    );
    expect(response.status).toBe(201);
    const created = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(created.app_metadata.role).toBe("admin");
    expect(created.email).toBe("victor@usuarios.cotizaciones.local");
  });
});
