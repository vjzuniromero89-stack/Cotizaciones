const KEY = "cotizaciones_session";
export function getSession() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
}
export function saveSession(session) {
  localStorage.setItem(KEY, JSON.stringify(session));
}
export function clearSession() {
  localStorage.removeItem(KEY);
}
export function authHeaders(extra = {}) {
  const session = getSession();
  return {
    ...extra,
    ...(session?.accessToken
      ? { authorization: `Bearer ${session.accessToken}` }
      : {}),
  };
}
export async function authFetch(path, options = {}) {
  return fetch(path, {
    ...options,
    headers: authHeaders(options.headers || {}),
  });
}
