import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../worker/index.js";

describe("almacenamiento de fotografías", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("crea el bucket privado cuando todavía no existe y reintenta la carga", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('{"code":"NoSuchBucket"}', { status: 404 }),
      )
      .mockResolvedValueOnce(new Response("{}", { status: 200 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));

    vi.stubGlobal("fetch", fetchMock);

    const response = await worker.fetch(
      new Request("https://cotizaciones.test/api/uploads/producto.png", {
        method: "PUT",
        headers: { "content-type": "image/png" },
        body: new Uint8Array([1, 2, 3]),
      }),
      {
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SECRET_KEY: "sb_secret_test",
        AUTH_DISABLED: "true",
      },
    );

    expect(response.status).toBe(201);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toContain(
      "/storage/v1/object/product-images/",
    );
    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://example.supabase.co/storage/v1/bucket",
    );
    expect(fetchMock.mock.calls[2][0]).toContain(
      "/storage/v1/object/product-images/",
    );
    expect(fetchMock.mock.calls[0][1].headers.get("apikey")).toBe(
      "sb_secret_test",
    );
    expect(fetchMock.mock.calls[0][1].headers.get("authorization")).toBeNull();
  });
});
