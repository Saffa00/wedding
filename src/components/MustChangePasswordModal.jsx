import { useState } from "react";
import { Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

const serif = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600 };
const field = "w-full min-h-[52px] rounded-2xl border border-[#0B4D3A]/20 bg-white px-4 text-base focus:outline-none focus:ring-2 focus:ring-[#C9A961]";
const btn = "w-full min-h-[52px] rounded-2xl font-medium active:scale-[0.98] transition-transform motion-reduce:transition-none";

export default function MustChangePasswordModal() {
  const { profile, loadProfile } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!profile || profile.role !== "usher" || !profile.must_change_password) {
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!password || password.length < 10 || password.length > 72) {
      return setError("Your new password must be at least 10 characters long.");
    }
    if (password !== confirmPassword) {
      return setError("Passwords do not match. Please retype them carefully.");
    }

    setBusy(true);
    try {
      await api("/api/me/password", {
        method: "POST",
        body: { password },
      });
      await loadProfile();
    } catch (err) {
      setError(err.message || "Failed to update password. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="w-full max-w-md rounded-3xl bg-[#FBF8F1] p-6 shadow-2xl space-y-5 text-[#12332A] animate-in fade-in zoom-in-95 duration-200">
        <div className="text-center space-y-2">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#0B4D3A] text-[#C9A961] shadow-sm">
            <KeyRound size={28} />
          </div>
          <h2 id="modal-title" className="text-3xl text-[#0B4D3A]" style={serif}>
            Create your password
          </h2>
          <p className="text-sm text-[#12332A]/75">
            Welcome, <strong>{profile.full_name}</strong>! You are using a temporary password. For security, please choose your own private password to continue.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="modal-new-pass" className="mb-1.5 block text-sm font-medium">
              New password
            </label>
            <div className="relative">
              <input
                id="modal-new-pass"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 10 characters"
                className={`${field} pr-12`}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 -translate-y-1/2 grid h-10 w-10 place-items-center text-[#12332A]/50 hover:text-[#0B4D3A]"
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="modal-confirm-pass" className="mb-1.5 block text-sm font-medium">
              Confirm new password
            </label>
            <input
              id="modal-confirm-pass"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              className={field}
            />
          </div>

          <div className="rounded-xl bg-white/70 p-3 text-xs text-[#12332A]/70 space-y-1">
            <p className="flex items-center gap-1.5">
              <ShieldCheck size={16} className={password.length >= 10 ? "text-[#0B4D3A]" : "text-[#12332A]/40"} />
              Minimum 10 characters ({password.length}/10)
            </p>
          </div>

          {error && (
            <p role="alert" className="rounded-xl bg-[#FBEAEA] px-4 py-3 text-sm text-[#8A1F1F]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || password.length < 10 || !confirmPassword}
            className={`${btn} bg-[#0B4D3A] text-[#FBF8F1] disabled:opacity-50`}
          >
            {busy ? "Updating password..." : "Set new password & continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
