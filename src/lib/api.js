import { supabase } from "./supabase";

const BASE = import.meta.env.VITE_API_URL;

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

// Calls the Express backend with the current session token.
// Never fakes a result when offline.
export async function api(path, { method = "GET", body } = {}) {
  if (!navigator.onLine) {
    throw new ApiError("You are offline. Connect to the internet and try again.", 0);
  }
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Cannot reach the server. Check your connection.", 0);
  }

  const json = await res.json().catch(() => ({}));
  // Scan endpoints return meaningful JSON on 403/404/409, so callers read err.body
  if (!res.ok) throw new ApiError(json.error || json.result || "Request failed.", res.status, json);
  return json;
}
