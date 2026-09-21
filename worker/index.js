const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

function supabaseConfig(env) {
  const url = String(env.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = String(
    env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || "",
  );
  if (!url || !key)
    throw new Error(
      "Falta configurar SUPABASE_URL y SUPABASE_SECRET_KEY en Cloudflare",
    );
  return { url, key };
}

async function supabaseFetch(env, path, options = {}) {
  const { url, key } = supabaseConfig(env);
  const headers = new Headers(options.headers || {});
  headers.set("apikey", key);
  // Las claves nuevas sb_secret_ no son JWT y deben viajar solo en apikey.
  // La clave service_role antigua sí requiere Authorization: Bearer.
  if (!key.startsWith("sb_secret_"))
    headers.set("authorization", `Bearer ${key}`);
  return fetch(url + path, { ...options, headers });
}

const normalizeUsername = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "");
const usernameEmail = (value) =>
  `${normalizeUsername(value)}@usuarios.cotizaciones.local`;
async function authAdmin(env, path, options = {}) {
  return supabaseFetch(env, "/auth/v1/admin" + path, options);
}
async function listAuthUsers(env) {
  const r = await authAdmin(env, "/users?page=1&per_page=100");
  if (!r.ok) throw new Error(await r.text());
  return ((await r.json()).users || []).filter(
    (user) => user.app_metadata?.application === "cotizaciones",
  );
}
async function createAuthUser(env, b, role = "user") {
  const username = normalizeUsername(b.username);
  if (username.length < 3)
    throw new Error("El usuario debe tener al menos 3 caracteres");
  if (String(b.password || "").length < 8)
    throw new Error("La contraseña debe tener al menos 8 caracteres");
  const r = await authAdmin(env, "/users", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: usernameEmail(username),
      password: b.password,
      email_confirm: true,
      app_metadata: {
        application: "cotizaciones",
        username,
        role,
        active: true,
      },
    }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function verifyUser(request, env) {
  if (env.AUTH_DISABLED === "true")
    return {
      id: "test",
      app_metadata: { username: "test", role: "admin", active: true },
    };
  const token = (request.headers.get("authorization") || "").replace(
    /^Bearer\s+/i,
    "",
  );
  if (!token) return null;
  const { url, key } = supabaseConfig(env);
  const headers = new Headers({
    apikey: key,
    authorization: `Bearer ${token}`,
  });
  const r = await fetch(url + "/auth/v1/user", { headers });
  if (!r.ok) return null;
  const sessionUser = await r.json();
  const fresh = await authAdmin(
    env,
    "/users/" + encodeURIComponent(sessionUser.id),
  );
  if (!fresh.ok) return null;
  const user = await fresh.json();
  return user.app_metadata?.application !== "cotizaciones" ||
    user.app_metadata?.active === false
    ? null
    : user;
}

async function rest(env, path, options = {}) {
  const response = await supabaseFetch(env, "/rest/v1/" + path, options);
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Supabase respondió ${response.status}`);
  }
  return response;
}

async function restRows(env, path, options = {}) {
  const response = await rest(env, path, options);
  return response.status === 204 ? [] : response.json();
}

async function listRecords(env, type) {
  const fields =
    "id,number,record_type,customer_name,phone,description,route,total,total_boxes,status,notes,totals,products,boxes,rates,created_at,updated_at";
  return restRows(
    env,
    `records?record_type=eq.${encodeURIComponent(type)}&select=${fields}&order=created_at.desc`,
  );
}

async function countRecords(env, type) {
  const response = await rest(
    env,
    `records?record_type=eq.${encodeURIComponent(type)}&select=id&limit=1`,
    { headers: { Prefer: "count=exact" } },
  );
  const total = (response.headers.get("content-range") || "").split("/").pop();
  return Number(total) || 0;
}

async function getRecord(env, id) {
  const rows = await restRows(
    env,
    `records?id=eq.${encodeURIComponent(id)}&select=*&limit=1`,
  );
  return rows[0] || null;
}

async function updateRecord(env, id, values, extraFilter = "") {
  const rows = await restRows(
    env,
    `records?id=eq.${encodeURIComponent(id)}${extraFilter}&select=*`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(values),
    },
  );
  return rows[0] || null;
}

async function createProductImagesBucket(env) {
  const response = await supabaseFetch(env, "/storage/v1/bucket", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id: "product-images",
      name: "product-images",
      public: false,
      file_size_limit: 5 * 1024 * 1024,
      allowed_mime_types: [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
      ],
    }),
  });
  if (!response.ok && response.status !== 409) {
    throw new Error(
      (await response.text()) || "No se pudo crear el contenedor de imágenes",
    );
  }
}

async function uploadProductImage(env, key, type, bytes) {
  const path = `/storage/v1/object/product-images/products/${key}`;
  const options = {
    method: "POST",
    headers: { "content-type": type, "x-upsert": "false" },
  };
  let response = await supabaseFetch(env, path, {
    ...options,
    body: bytes.slice(0),
  });
  if (response.status === 404) {
    await createProductImagesBucket(env);
    response = await supabaseFetch(env, path, {
      ...options,
      body: bytes.slice(0),
    });
  }
  return response;
}

async function handleApi(request, env, url) {
  try {
    if (url.pathname === "/api/auth/status" && request.method === "GET")
      return json({ needsSetup: (await listAuthUsers(env)).length === 0 });
    if (url.pathname === "/api/auth/bootstrap" && request.method === "POST") {
      if ((await listAuthUsers(env)).length)
        return json({ error: "El administrador inicial ya existe" }, 409);
      const user = await createAuthUser(env, await request.json(), "admin");
      return json({ id: user.id }, 201);
    }
    if (url.pathname === "/api/auth/login" && request.method === "POST") {
      const b = await request.json(),
        username = normalizeUsername(b.username);
      if (!username || !b.password)
        return json({ error: "Escribe usuario y contraseña" }, 400);
      const { url: base, key } = supabaseConfig(env);
      const headers = new Headers({
        "content-type": "application/json",
        apikey: key,
      });
      const r = await fetch(base + "/auth/v1/token?grant_type=password", {
        method: "POST",
        headers,
        body: JSON.stringify({
          email: usernameEmail(username),
          password: b.password,
        }),
      });
      if (!r.ok)
        return json({ error: "Usuario o contraseña incorrectos" }, 401);
      const session = await r.json();
      if (session.user?.app_metadata?.active === false)
        return json({ error: "Este usuario está desactivado" }, 403);
      return json({
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        user: {
          id: session.user.id,
          username: session.user.app_metadata?.username || username,
          role: session.user.app_metadata?.role || "user",
        },
      });
    }
    if (url.pathname === "/api/auth/refresh" && request.method === "POST") {
      const b = await request.json(),
        { url: base, key } = supabaseConfig(env),
        headers = new Headers({
          "content-type": "application/json",
          apikey: key,
        });
      const r = await fetch(base + "/auth/v1/token?grant_type=refresh_token", {
        method: "POST",
        headers,
        body: JSON.stringify({ refresh_token: b.refreshToken }),
      });
      if (!r.ok) return json({ error: "La sesión expiró" }, 401);
      const session = await r.json();
      return json({
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        user: {
          id: session.user.id,
          username: session.user.app_metadata?.username || "",
          role: session.user.app_metadata?.role || "user",
        },
      });
    }
    const publicFile =
      request.method === "GET" && /^\/api\/files\//.test(url.pathname);
    const currentUser = publicFile
      ? { id: "public-file", app_metadata: { role: "user", active: true } }
      : await verifyUser(request, env);
    if (!currentUser)
      return json({ error: "Inicia sesión para continuar" }, 401);
    if (url.pathname === "/api/auth/me" && request.method === "GET")
      return json({
        id: currentUser.id,
        username: currentUser.app_metadata?.username || "",
        role: currentUser.app_metadata?.role || "user",
      });
    if (url.pathname === "/api/users") {
      if (currentUser.app_metadata?.role !== "admin")
        return json(
          { error: "Solo el administrador puede gestionar usuarios" },
          403,
        );
      if (request.method === "GET")
        return json(
          (await listAuthUsers(env)).map((u) => ({
            id: u.id,
            username:
              u.app_metadata?.username || String(u.email || "").split("@")[0],
            role: u.app_metadata?.role || "user",
            active: u.app_metadata?.active !== false,
            createdAt: u.created_at,
            lastSignIn: u.last_sign_in_at,
          })),
        );
      if (request.method === "POST") {
        const b = await request.json(),
          user = await createAuthUser(
            env,
            b,
            b.role === "admin" ? "admin" : "user",
          );
        return json({ id: user.id }, 201);
      }
    }
    const userItem = url.pathname.match(/^\/api\/users\/([^/]+)$/);
    if (userItem && request.method === "PATCH") {
      if (currentUser.app_metadata?.role !== "admin")
        return json(
          { error: "Solo el administrador puede gestionar usuarios" },
          403,
        );
      const b = await request.json(),
        users = await listAuthUsers(env),
        target = users.find((u) => u.id === userItem[1]);
      if (!target) return json({ error: "Usuario no encontrado" }, 404);
      if (target.id === currentUser.id && b.active === false)
        return json({ error: "No puedes desactivar tu propia cuenta" }, 400);
      const body = {
        app_metadata: {
          ...(target.app_metadata || {}),
          role: b.role === "admin" ? "admin" : "user",
          active: b.active !== false,
        },
      };
      if (b.password) {
        if (String(b.password).length < 8)
          return json(
            { error: "La contraseña debe tener al menos 8 caracteres" },
            400,
          );
        body.password = b.password;
      }
      const r = await authAdmin(
        env,
        "/users/" + encodeURIComponent(target.id),
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!r.ok) throw new Error(await r.text());
      return json({ ok: true });
    }
    const upload = url.pathname.match(/^\/api\/uploads\/([^/]+)$/);
    if (upload && request.method === "PUT") {
      const type =
        request.headers.get("content-type") || "application/octet-stream";
      if (!type.startsWith("image/"))
        return json({ error: "Solo se permiten imágenes" }, 400);
      const declaredSize = Number(request.headers.get("content-length") || 0);
      if (declaredSize > 5 * 1024 * 1024)
        return json({ error: "La imagen supera 5 MB" }, 413);
      const bytes = await request.arrayBuffer();
      if (bytes.byteLength > 5 * 1024 * 1024)
        return json({ error: "La imagen supera 5 MB" }, 413);
      const key = encodeURIComponent(upload[1]);
      const response = await uploadProductImage(env, key, type, bytes);
      if (!response.ok)
        throw new Error(
          (await response.text()) || "Supabase Storage rechazó la imagen",
        );
      return json({ url: "/api/files/" + upload[1] }, 201);
    }

    const file = url.pathname.match(/^\/api\/files\/([^/]+)$/);
    if (file && request.method === "GET") {
      const key = encodeURIComponent(file[1]);
      const response = await supabaseFetch(
        env,
        `/storage/v1/object/authenticated/product-images/products/${key}`,
      );
      if (response.status === 404)
        return new Response("Not found", { status: 404 });
      if (!response.ok)
        throw new Error((await response.text()) || "No se pudo leer la imagen");
      return new Response(response.body, {
        headers: {
          "content-type":
            response.headers.get("content-type") || "application/octet-stream",
          "cache-control": "private, max-age=86400",
        },
      });
    }

    if (url.pathname === "/api/records" && request.method === "GET") {
      const requested = url.searchParams.get("type");
      const type =
        requested === "order"
          ? "order"
          : requested === "product"
            ? "product"
            : "quote";
      return json(await listRecords(env, type));
    }

    if (url.pathname === "/api/catalog-products" && request.method === "GET") {
      return json(
        await restRows(env, "catalog_products?select=*&order=created_at.desc"),
      );
    }

    if (url.pathname === "/api/catalog-products" && request.method === "POST") {
      const b = await request.json();
      if (!b.name?.trim())
        return json({ error: "Escribe el nombre del producto" }, 400);
      const rows = await restRows(env, "catalog_products?select=*", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          name: b.name.trim(),
          image_url: b.imageUrl || "",
          unit_price: Math.max(0, Number(b.price) || 0),
          default_quantity: Math.max(0, Number(b.qty) || 0),
          boxes: Array.isArray(b.boxes) ? b.boxes : [],
        }),
      });
      return json(rows[0], 201);
    }

    const catalogItem = url.pathname.match(
      /^\/api\/catalog-products\/([^/]+)$/,
    );
    if (catalogItem && request.method === "PUT") {
      const b = await request.json();
      if (!b.name?.trim())
        return json({ error: "Escribe el nombre del producto" }, 400);
      const rows = await restRows(
        env,
        `catalog_products?id=eq.${encodeURIComponent(catalogItem[1])}&select=*`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify({
            name: b.name.trim(),
            image_url: b.imageUrl || "",
            unit_price: Math.max(0, Number(b.price) || 0),
            default_quantity: Math.max(0, Number(b.qty) || 0),
            boxes: Array.isArray(b.boxes) ? b.boxes : [],
          }),
        },
      );
      if (!rows.length) return json({ error: "Producto no encontrado" }, 404);
      return json(rows[0]);
    }
    if (catalogItem && request.method === "DELETE") {
      const rows = await restRows(
        env,
        `catalog_products?id=eq.${encodeURIComponent(catalogItem[1])}&select=id`,
        { method: "DELETE", headers: { Prefer: "return=representation" } },
      );
      if (!rows.length) return json({ error: "Producto no encontrado" }, 404);
      return new Response(null, { status: 204 });
    }

    if (url.pathname === "/api/quotes" && request.method === "POST") {
      const b = await request.json();
      if (!b.customer?.trim())
        return json({ error: "El nombre del cliente es obligatorio" }, 400);
      const products = (b.products || []).map((p) => ({
        ...p,
        salePrice: Math.max(0, Number(p.salePrice) || 0),
      }));
      if (
        !products.length ||
        products.some((p) => !p.name?.trim() || !p.salePrice)
      )
        return json(
          { error: "Completa el producto y su precio de venta" },
          400,
        );
      const route = b.selectedRoute === "direct" ? "direct" : "miami";
      const internalTotal =
        route === "miami"
          ? Number(b.result?.landedMiami || 0)
          : Number(b.result?.landedDirect || 0);
      const saleTotal = products.reduce(
        (sum, p) => sum + (Number(p.qty) || 0) * p.salePrice,
        0,
      );
      const profit = saleTotal - internalTotal;
      const profitPercent =
        internalTotal > 0 ? (profit / internalTotal) * 100 : 0;
      const count = await countRecords(env, "quote");
      const id = crypto.randomUUID();
      const number =
        "COT-" +
        new Date().getFullYear() +
        "-" +
        String(count + 1).padStart(4, "0");
      await rest(env, "records", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          id,
          number,
          record_type: "quote",
          customer_name: b.customer.trim(),
          phone: b.phone || "",
          description: b.description || products.map((p) => p.name).join(", "),
          boxes: b.boxes || [],
          rates: b.rates || {},
          totals: {
            ...(b.result || {}),
            internalTotal,
            saleTotal,
            profit,
            profitPercent,
          },
          products,
          route,
          total: internalTotal,
          total_boxes: b.result?.totalBoxes || 0,
          status: "pending",
          notes: b.notes || "",
        }),
      });
      return json(
        { id, number, internalTotal, saleTotal, profit, profitPercent },
        201,
      );
    }

    if (url.pathname === "/api/products" && request.method === "POST") {
      const b = await request.json();
      if (!b.title?.trim())
        return json({ error: "El nombre del producto es obligatorio" }, 400);
      const count = await countRecords(env, "product");
      const id = crypto.randomUUID();
      const number =
        "PRO-" +
        new Date().getFullYear() +
        "-" +
        String(count + 1).padStart(4, "0");
      const route = b.selectedRoute === "direct" ? "direct" : "miami";
      const total =
        route === "miami" ? b.result.landedMiami : b.result.landedDirect;
      await rest(env, "records", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          id,
          number,
          record_type: "product",
          customer_name: b.title.trim(),
          phone: "",
          description: b.description || "",
          boxes: b.boxes || [],
          rates: b.rates || {},
          totals: { ...(b.result || {}), internalTotal: total },
          products: b.products || [],
          route,
          total,
          total_boxes: b.result.totalBoxes || 0,
          status: "pending",
          notes: b.notes || "",
        }),
      });
      const catalog = (b.products || [])
        .filter((p) => p.name?.trim())
        .map((p) => ({
          name: p.name.trim(),
          image_url: p.imageUrl || "",
          unit_price: Math.max(0, Number(p.price) || 0),
          default_quantity: Math.max(0, Number(p.qty) || 0),
          boxes: Array.isArray(p.boxes) ? p.boxes : [],
        }));
      if (catalog.length) {
        try {
          await rest(env, "catalog_products?on_conflict=name", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              Prefer: "resolution=merge-duplicates,return=minimal",
            },
            body: JSON.stringify(catalog),
          });
        } catch (error) {
          console.warn(
            "El catálogo aún no está disponible",
            String(error.message || error),
          );
        }
      }
      return json({ id, number }, 201);
    }

    const createQuote = url.pathname.match(/^\/api\/products\/([^/]+)\/quote$/);
    if (createQuote && request.method === "POST") {
      const b = await request.json();
      if (!b.customer?.trim())
        return json({ error: "El cliente es obligatorio" }, 400);
      const source = await getRecord(env, createQuote[1]);
      if (!source || source.record_type !== "product")
        return json({ error: "Producto no encontrado" }, 404);
      const products = (b.products || source.products || []).map((p) => ({
        ...p,
        salePrice: Math.max(0, Number(p.salePrice) || 0),
      }));
      if (products.some((p) => !p.salePrice))
        return json(
          { error: "Agrega el precio de venta de cada producto" },
          400,
        );
      const saleTotal = products.reduce(
        (sum, p) => sum + (Number(p.qty) || 0) * p.salePrice,
        0,
      );
      const internalTotal = Number(source.total) || 0;
      const profit = saleTotal - internalTotal;
      const profitPercent =
        internalTotal > 0 ? (profit / internalTotal) * 100 : 0;
      const count = await countRecords(env, "quote");
      const id = crypto.randomUUID();
      const number =
        "COT-" +
        new Date().getFullYear() +
        "-" +
        String(count + 1).padStart(4, "0");
      await rest(env, "records", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          id,
          number,
          record_type: "quote",
          customer_name: b.customer.trim(),
          phone: b.phone || "",
          description:
            b.description || source.description || source.customer_name,
          boxes: source.boxes || [],
          rates: source.rates || {},
          totals: {
            ...(source.totals || {}),
            internalTotal,
            saleTotal,
            profit,
            profitPercent,
            sourceProductId: source.id,
          },
          products,
          route: source.route,
          total: internalTotal,
          total_boxes: source.total_boxes || 0,
          status: "pending",
          notes: b.notes || source.notes || "",
        }),
      });
      return json({ id, number, saleTotal, internalTotal }, 201);
    }

    const promote = url.pathname.match(/^\/api\/records\/([^/]+)\/promote$/);
    if (promote && request.method === "POST") {
      const count = await countRecords(env, "order");
      const number =
        "ORD-" +
        new Date().getFullYear() +
        "-" +
        String(count + 1).padStart(4, "0");
      const row = await updateRecord(
        env,
        promote[1],
        {
          record_type: "order",
          number,
          status: "confirmed",
          confirmed_at: new Date().toISOString(),
        },
        "&record_type=eq.quote",
      );
      if (!row) return json({ error: "Cotización no encontrada" }, 404);
      return json({ id: promote[1], number });
    }

    const revert = url.pathname.match(/^\/api\/records\/([^/]+)\/revert$/);
    if (revert && request.method === "POST") {
      const current = await getRecord(env, revert[1]);
      if (!current || current.record_type !== "order")
        return json({ error: "Orden no encontrada" }, 404);
      const suffix =
        String(current.number || "").replace(/^ORD-?/, "") ||
        crypto.randomUUID().slice(0, 8);
      const number = "COT-R-" + suffix;
      await updateRecord(
        env,
        revert[1],
        {
          record_type: "quote",
          number,
          status: "returned",
          confirmed_at: null,
        },
        "&record_type=eq.order",
      );
      return json({ id: revert[1], number });
    }

    const item = url.pathname.match(/^\/api\/records\/([^/]+)$/);
    if (item && request.method === "GET") {
      const row = await getRecord(env, item[1]);
      if (!row) return json({ error: "Registro no encontrado" }, 404);
      return json(row);
    }
    if (item && request.method === "PATCH") {
      const b = await request.json();
      if (b.status) {
        const allowed = [
          "confirmed",
          "purchased",
          "transit",
          "delivered",
          "cancelled",
        ];
        if (!allowed.includes(b.status))
          return json({ error: "Estado inválido" }, 400);
        const row = await updateRecord(
          env,
          item[1],
          { status: b.status },
          "&record_type=eq.order",
        );
        if (!row) return json({ error: "Orden no encontrada" }, 404);
      } else {
        const route = b.route === "direct" ? "direct" : "miami";
        const values = {
          customer_name: String(b.customer_name || "").trim(),
          phone: b.phone || "",
          description: b.description || "",
          notes: b.notes || "",
          route,
          total: Number(b.total) || 0,
        };
        const row = await updateRecord(
          env,
          item[1],
          values,
          "&record_type=eq.quote",
        );
        if (!row)
          return json({ error: "Solo se pueden editar cotizaciones" }, 400);
      }
      return json({ ok: true });
    }
    if (item && request.method === "DELETE") {
      const rows = await restRows(
        env,
        `records?id=eq.${encodeURIComponent(item[1])}&select=id`,
        { method: "DELETE", headers: { Prefer: "return=representation" } },
      );
      if (!rows.length) return json({ error: "Registro no encontrado" }, 404);
      return new Response(null, { status: 204 });
    }
    return json({ error: "Ruta no encontrada" }, 404);
  } catch (e) {
    const detail = String(e.message || e);
    const missing = detail.includes("SUPABASE_URL");
    return json(
      {
        error: missing
          ? "Supabase no está configurado en Cloudflare"
          : "No se pudo guardar la información",
        detail,
      },
      500,
    );
  }
}
function staticResponse(path) {
  const item = STATIC[path] || STATIC["/index.html"];
  if (!item) return new Response("Not found", { status: 404 });
  const body = item.base64
    ? Uint8Array.from(atob(item.data), (c) => c.charCodeAt(0))
    : item.data;
  return new Response(body, {
    headers: {
      "content-type": item.type,
      "cache-control":
        path === "/index.html"
          ? "no-cache"
          : "public, max-age=31536000, immutable",
    },
  });
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return handleApi(request, env, url);
    const path = url.pathname === "/" ? "/index.html" : url.pathname;
    return staticResponse(path);
  },
};
