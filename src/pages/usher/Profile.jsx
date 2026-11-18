import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound, LogOut, Check } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { resetOnboarding } from "../Onboarding";
import ConnectionStatus from "../../components/ConnectionStatus";
import Sheet from "../../components/Sheet";
import { api } from "../../lib/api";

const field = "w-full min-h-[52px] rounded-2xl border border-[#0B4D3A]/20 bg-white px-4 text-base focus:outline-none focus:ring-2 focus:ring-[#C9A961]";
const btn = "w-full min-h-[52px] rounded-2xl font-medium active:scale-[0.98] transition-transform motion-reduce:transition-none";

function ChangePasswordSheet({ onClose }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const { loadProfile } = useAuth();

  const save = async (e) => {
    e.preventDefault();
    if (password.length < 10) return setError("Password must be at least 10 characters.");
    if (password !== confirm) return setError("Passwords do not match.");
    setBusy(true); setError("");
    try {
      await api("/api/me/password", { method: "POST", body: { password } });
      await loadProfile();
      setSaved(true);
      setTimeout(onClose, 1200);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="Change password" onClose={onClose}>
      {saved ? (
        <div className="py-8 text-center space-y-2">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#0B4D3A] text-white">
            <Check size={24} />
          </div>
          <p className="font-semibold text-lg text-[#0B4D3A]">Password updated!</p>
        </div>
      ) : (
        <form onSubmit={save} className="space-y-4">
          <div>
            <label htmlFor="p-new" className="mb-1.5 block text-sm font-medium">New password</label>
            <input id="p-new" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 10 characters" className={field} />
          </div>
          <div>
            <label htmlFor="p-conf" className="mb-1.5 block text-sm font-medium">Confirm new password</label>
            <input id="p-conf" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Retype password" className={field} />
          </div>
          {error && <p role="alert" className="rounded-xl bg-[#FBEAEA] px-4 py-3 text-sm text-[#8A1F1F]">{error}</p>}
          <button type="submit" disabled={busy || password.length < 10 || !confirm} className={`${btn} bg-[#0B4D3A] text-[#FBF8F1] disabled:opacity-50`}>
            {busy ? "Updating..." : "Update password"}
          </button>
        </form>
      )}
    </Sheet>
  );
}

export default function Profile() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [changePass, setChangePass] = useState(false);
  const out = async () => { await signOut(); navigate("/login", { replace: true }); };
  const row = "w-full min-h-[56px] rounded-2xl bg-white px-4 text-left font-medium shadow-sm hover:shadow transition-shadow";

  return (
    <div className="space-y-5">
      <h1 className="text-4xl text-[#0B4D3A]" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600 }}>Profile</h1>
      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <p className="text-xl font-medium">{profile?.full_name}</p>
        <p className="mt-1 text-[#12332A]/70">Usher • Check in guests from bride and groom sides.</p>
        <div className="mt-3"><ConnectionStatus /></div>
      </section>

      <button className={`${row} flex items-center justify-between`} onClick={() => setChangePass(true)}>
        <span>Change password</span>
        <KeyRound size={18} className="text-[#0B4D3A]" />
      </button>

      <button className={row} onClick={() => { resetOnboarding(); navigate("/onboarding"); }}>Replay intro slides</button>

      <section className="rounded-2xl bg-white p-4 text-sm text-[#12332A]/75 shadow-sm">
        <p className="font-medium text-[#12332A]">Install on your phone</p>
        <p className="mt-1">Android: open the browser menu and tap Install app. iPhone: in Safari, tap Share, then Add to Home Screen.</p>
      </section>

      <button onClick={out} className={`${row} flex items-center gap-2 text-[#8A1F1F]`}>
        <LogOut size={20} /> Sign out
      </button>

      {changePass && <ChangePasswordSheet onClose={() => setChangePass(false)} />}
    </div>
  );
}
