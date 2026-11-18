import { supabase } from "./supabase";

const BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

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
  if (!BASE) {
    throw new ApiError("VITE_API_URL is not set. Please add your Render backend URL to Vercel Environment Variables.", 0);
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
  } catch (err) {
    throw new ApiError(`Cannot reach the backend server at ${BASE}. Ensure Render is online.`, 0);
  }

  const text = await res.text();
  let json = {};
  try {
    json = JSON.parse(text);
  } catch {
    if (text.includes("<!doctype") || text.includes("<html") || text.includes("<head")) {
      throw new ApiError(
        `Received HTML instead of JSON from ${BASE}${path}. Check that VITE_API_URL points to your Render backend (https://...onrender.com).`,
        res.status
      );
    }
  }

  // Scan endpoints return meaningful JSON on 403/404/409, so callers read err.body
  if (!res.ok) {
    const errorMsg = json.error || json.result || (res.status === 401 ? "Unauthorized. Please sign in again." : `Request failed (status ${res.status}).`);
    throw new ApiError(errorMsg, res.status, json);
  }
  return json;
}
