const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
let csrfToken = "";

async function request(path, options = {}) {
  const method = (options.method ?? "GET").toUpperCase();
  const headers = {
    ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
    ...(options.headers ?? {}),
  };

  if (!SAFE_METHODS.has(method) && csrfToken) {
    headers["X-CSRF-Token"] = csrfToken;
  }

  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    method,
    headers,
  });

  if (response.status === 204) {
    return null;
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      csrfToken = "";
    }

    const error = new Error(payload.message || "Request failed.");
    error.status = response.status;
    throw error;
  }

  if (typeof payload.csrfToken === "string" && payload.csrfToken.length > 0) {
    csrfToken = payload.csrfToken;
  }

  return payload;
}

export const api = {
  getSession() {
    return request("/api/auth/session");
  },
  register(values) {
    return request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(values),
    });
  },
  login(values) {
    return request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(values),
    });
  },
  logout() {
    return request("/api/auth/logout", {
      method: "POST",
    });
  },
  saveAppData(appData) {
    return request("/api/app-data", {
      method: "PUT",
      body: JSON.stringify(appData),
    });
  },
  clearSession() {
    csrfToken = "";
  },
};
