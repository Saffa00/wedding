import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { api } from "../lib/api";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export const roleHome = (role) => (role === "admin" ? "/admin" : "/usher");

export function AuthProvider({ children }) {
  const [profile, setProfile] = useState(null); // { id, full_name, role }
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    try {
      const p = await api("/api/me");
      setProfile(p);
      return p;
    } catch (e) {
      // Signed in to Supabase but not a staff account, or the session is invalid
      if (e.status === 401 || e.status === 403) await supabase.auth.signOut();
      setProfile(null);
      throw e;
    }
  }, []);

  useEffect(() => {
    let active = true;
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(async ({ data }) => {
      if (data?.session) {
        try {
          await loadProfile();
        } catch (e) {
          console.warn("Could not load staff profile:", e.message);
        }
      }
      if (active) setLoading(false);
    }).catch(() => {
      if (active) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") setProfile(null);
    });
    return () => {
      active = false;
      sub?.subscription?.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = async (email, password) => {
    if (!isSupabaseConfigured) {
      throw new Error("Supabase is not configured yet. Add your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env");
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    try {
      await loadProfile();
    } catch (err) {
      if (err.status === 403) {
        throw new Error("Signed in to Supabase, but this account is not in the 'profiles' table. Run the INSERT query in Supabase SQL editor.");
      }
      if (err.status === 0 || /fetch|network|reach the|cannot reach/i.test(err.message)) {
        throw new Error(err.message || "Signed in to Supabase, but cannot reach the backend API server. Check VITE_API_URL and verify Render is running.");
      }
      throw err;
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ profile, loading, signIn, signOut, loadProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
