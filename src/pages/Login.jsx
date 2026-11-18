import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { roleHome, useAuth } from "../context/AuthContext";
import { Splash } from "../components/ProtectedRoute";
import { isSupabaseConfigured } from "../lib/supabase";

export default function Login() {
  const { profile, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return <Splash />;
  if (profile) return <Navigate to={roleHome(profile.role)} replace />;

  const submit = async (e) => {
    e.preventDefault();
    if (!navigator.onLine) return setError("You are offline. Connect to the internet to sign in.");
    setBusy(true);
    setError("");
    try {
      await signIn(email.trim().toLowerCase(), password.trim());
      navigate(location.state?.from?.pathname || "/", { replace: true });
    } catch (err) {
      console.error("Sign in error:", err);
      setError(err.message || "Email or password is incorrect.");
    } finally {
      setBusy(false);
    }
  };

  const field =
    "w-full min-h-[52px] rounded-2xl border border-[#0B4D3A]/20 bg-white px-4 text-base text-[#12332A] " +
    "focus:outline-none focus:ring-2 focus:ring-[#C9A961]";

  return (
    <main
      className="min-h-screen flex flex-col justify-center bg-[#FBF8F1] px-6"
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <form onSubmit={submit} className="mx-auto w-full max-w-sm space-y-5" noValidate>
        <header className="text-center mb-4">
          <h1 className="text-4xl text-[#0B4D3A]" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600 }}>
            Staff sign in
          </h1>
          <p className="mt-2 text-[#12332A]/70">Administrators and ushers only.</p>
        </header>

        {!isSupabaseConfigured && (
          <div role="alert" className="rounded-2xl border border-[#C9A961] bg-[#FFF4D6] p-4 text-xs text-[#6B4E00] space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-sm">
              <AlertCircle size={18} className="shrink-0 text-[#C9A961]" />
              Supabase setup required
            </div>
            <p>
              Please configure <code className="bg-black/10 px-1 py-0.5 rounded">VITE_SUPABASE_URL</code> and{" "}
              <code className="bg-black/10 px-1 py-0.5 rounded">VITE_SUPABASE_ANON_KEY</code> in your root <code className="bg-black/10 px-1 py-0.5 rounded">.env</code> file.
            </p>
          </div>
        )}

        <div>
          <label htmlFor="email" className="block mb-1.5 text-sm font-medium text-[#12332A]">Email</label>
          <input id="email" type="email" inputMode="email" autoComplete="username" autoCapitalize="none"
                 required value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
        </div>

        <div>
          <label htmlFor="password" className="block mb-1.5 text-sm font-medium text-[#12332A]">Password</label>
          <div className="relative">
            <input id="password" type={show ? "text" : "password"} autoComplete="current-password"
                   required value={password} onChange={(e) => setPassword(e.target.value)} className={`${field} pr-14`} />
            <button type="button" onClick={() => setShow((s) => !s)}
                    aria-label={show ? "Hide password" : "Show password"}
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-11 w-11 grid place-items-center text-[#0B4D3A]/70">
              {show ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-[#FBEAEA] px-4 py-3 text-sm text-[#8A1F1F]">{error}</p>
        )}

        <button type="submit" disabled={busy || !email || !password}
                className="w-full min-h-[52px] rounded-2xl bg-[#0B4D3A] text-[#FBF8F1] font-medium disabled:opacity-50 active:scale-[0.98] transition-transform motion-reduce:transition-none">
          {busy ? "Signing in" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
