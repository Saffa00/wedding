import { useState } from "react";
import { Check, Copy, MessageCircle, Plus, RefreshCw, Send, ShieldCheck, UserCheck } from "lucide-react";
import { api } from "../../lib/api";
import { useLive } from "../usher/Home";
import Sheet from "../../components/Sheet";
import Chip from "../../components/Chip";

const serif = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600 };
const field = "w-full min-h-[52px] rounded-2xl border border-[#0B4D3A]/20 bg-white px-4 text-base focus:outline-none focus:ring-2 focus:ring-[#C9A961]";
const btn = "flex w-full min-h-[52px] items-center justify-center gap-2 rounded-2xl font-medium active:scale-[0.98] transition-transform motion-reduce:transition-none";

// 12 characters, no look-alikes (0/O, 1/l/I)
const generate = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  return Array.from(crypto.getRandomValues(new Uint32Array(12)), (n) => chars[n % chars.length]).join("");
};

function PasswordField({ id, label, value, onChange, hint }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">{label}</label>
      <div className="flex gap-2">
        <input id={id} type="text" autoComplete="off" autoCapitalize="none" spellCheck="false" value={value} onChange={(e) => onChange(e.target.value)} className={field} />
        <button type="button" onClick={() => onChange(generate())} aria-label="Generate a password" className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-2xl border-2 border-[#C9A961] text-[#0B4D3A]"><RefreshCw size={20} /></button>
      </div>
      <p className="mt-1 text-sm text-[#12332A]/60">{hint}</p>
    </div>
  );
}

function CredentialShareCard({ creds, onDone }) {
  const [copied, setCopied] = useState(false);
  const [phone, setPhone] = useState(creds.phone || "");

  const appUrl = window.location.origin;
  const loginUrl = `${appUrl}/login`;
  const shareMessage = `Hello ${creds.name}! You have been added as an usher for the wedding check-in app.\n\n📲 App Login: ${loginUrl}\n📧 Email: ${creds.email}\n🔑 Temporary Password: ${creds.password}\n\nPlease sign in with these temporary credentials. The app will prompt you to set your own private password immediately upon logging in.`;

  const cleanPhone = phone.replace(/\D/g, "");
  const waAppUrl = cleanPhone
    ? `whatsapp://send?phone=${cleanPhone}&text=${encodeURIComponent(shareMessage)}`
    : `whatsapp://send?text=${encodeURIComponent(shareMessage)}`;
  const waWebUrl = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(shareMessage)}`
    : `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#C9A961]/40 bg-[#FFFDF9] p-4 space-y-2">
        <div className="flex items-center gap-2 text-[#0B4D3A] font-semibold">
          <ShieldCheck size={20} className="text-[#0B4D3A]" />
          Usher credentials ready
        </div>
        <p className="text-sm text-[#12332A]/80">
          Share these temporary login details with <strong>{creds.name}</strong>. They will be prompted to choose their own password as soon as they log in.
        </p>

        <div className="rounded-xl bg-white p-3 font-mono text-sm border border-[#0B4D3A]/10 space-y-1">
          <p><span className="text-[#12332A]/60 select-none">Email: </span><span className="font-semibold text-[#0B4D3A]">{creds.email}</span></p>
          <p><span className="text-[#12332A]/60 select-none">Password: </span><span className="font-semibold text-[#0B4D3A]">{creds.password}</span></p>
        </div>
      </div>

      <div>
        <label htmlFor="wa-phone" className="mb-1.5 block text-sm font-medium">
          Usher’s WhatsApp number (optional)
        </label>
        <input
          id="wa-phone"
          type="tel"
          inputMode="tel"
          placeholder="e.g. +232 76 000000"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className={field}
        />
        <p className="mt-1 text-xs text-[#12332A]/60">
          If provided, opens directly to their chat in WhatsApp. Otherwise, WhatsApp prompts you to select a contact.
        </p>
      </div>

      <div className="space-y-2.5 pt-2">
        <a
          href={waAppUrl}
          className={`${btn} bg-[#25D366] text-white hover:bg-[#20ba59] shadow-sm`}
        >
          <MessageCircle size={20} /> Open in WhatsApp App
        </a>

        <div className="text-center">
          <a
            href={waWebUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#0B4D3A] underline"
          >
            Or open in WhatsApp Web
          </a>
        </div>

        <button
          onClick={copyToClipboard}
          className={`${btn} border-2 border-[#C9A961] text-[#0B4D3A] bg-white`}
        >
          {copied ? <Check size={20} className="text-[#0B4D3A]" /> : <Copy size={20} />}
          {copied ? "Copied credentials to clipboard!" : "Copy login details"}
        </button>

        <button
          onClick={onDone}
          className={`${btn} bg-[#0B4D3A] text-[#FBF8F1]`}
        >
          Done
        </button>
      </div>
    </div>
  );
}

function UsherSheet({ usher, onClose, onChanged }) {
  const [f, setF] = useState({ name: usher?.name ?? "", email: "", password: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [creds, setCreds] = useState(null);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const run = async (fn) => {
    setBusy(true); setError("");
    try { await fn(); onChanged(); } catch (e) { setError(e.message); setConfirmRemove(false); } finally { setBusy(false); }
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      if (usher) {
        await api(`/api/ushers/${usher.id}`, { method: "PATCH", body: { name: f.name, ...(f.password ? { password: f.password } : {}) } });
        if (f.password) {
          setCreds({ name: f.name, email: usher.email, password: f.password, phone: f.phone });
        } else {
          onChanged();
        }
      } else {
        await api("/api/ushers", { method: "POST", body: { name: f.name, email: f.email, password: f.password } });
        setCreds({ name: f.name, email: f.email, password: f.password, phone: f.phone });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const toggle = () => run(() => api(`/api/ushers/${usher.id}`, { method: "PATCH", body: { disabled: !usher.disabled } }));
  const remove = () => run(() => api(`/api/ushers/${usher.id}`, { method: "DELETE" }));

  if (confirmRemove) {
    return (
      <Sheet title="Remove usher" onClose={onClose}>
        <p className="text-[#12332A]/80">Remove {usher.name}? Their login will be deleted. This cannot be undone.</p>
        {error && <p role="alert" className="mt-3 rounded-xl bg-[#FBEAEA] px-4 py-3 text-sm text-[#8A1F1F]">{error}</p>}
        <div className="mt-5 space-y-3">
          <button onClick={remove} disabled={busy} className={`${btn} bg-[#8A1F1F] text-white disabled:opacity-60`}>{busy ? "Removing" : "Remove usher"}</button>
          <button onClick={() => setConfirmRemove(false)} className={`${btn} text-[#0B4D3A]`}>Keep usher</button>
        </div>
      </Sheet>
    );
  }

  if (creds) {
    return (
      <Sheet title="Share usher login" onClose={onChanged}>
        <CredentialShareCard creds={creds} onDone={onChanged} />
      </Sheet>
    );
  }

  return (
    <Sheet title={usher ? usher.name : "Add usher"} onClose={onClose}>
      <form onSubmit={save} className="space-y-4" noValidate>
        <div>
          <label htmlFor="u-name" className="mb-1.5 block text-sm font-medium">Name</label>
          <input id="u-name" value={f.name} onChange={set("name")} autoComplete="off" autoCapitalize="words" className={field} />
        </div>
        {usher ? <p className="text-sm text-[#12332A]/70">Signs in with <strong>{usher.email}</strong></p> : (
          <div>
            <label htmlFor="u-email" className="mb-1.5 block text-sm font-medium">Email</label>
            <input id="u-email" type="email" inputMode="email" autoComplete="off" autoCapitalize="none" value={f.email} onChange={set("email")} className={field} />
          </div>
        )}
        <div>
          <label htmlFor="u-phone" className="mb-1.5 block text-sm font-medium">WhatsApp phone number (optional)</label>
          <input id="u-phone" type="tel" inputMode="tel" placeholder="+232 76 000000" value={f.phone} onChange={set("phone")} className={field} />
        </div>
        <PasswordField id="u-pass" label={usher ? "Reset temporary password (optional)" : "Temporary password"} value={f.password} onChange={(v) => setF((x) => ({ ...x, password: v }))}
                       hint={usher ? "Leave blank to keep current password. Setting a new password will require them to change it again on next login." : "At least 10 characters. The usher will be prompted to change it upon first login."} />
        {error && <p role="alert" className="rounded-xl bg-[#FBEAEA] px-4 py-3 text-sm text-[#8A1F1F]">{error}</p>}
        <button type="submit" disabled={busy || !f.name.trim() || (!usher && (!f.email || f.password.length < 10)) || (usher && f.password && f.password.length < 10)}
                className={`${btn} bg-[#0B4D3A] text-[#FBF8F1] disabled:opacity-50`}>
          {busy ? "Saving..." : usher ? (f.password ? "Reset password & share" : "Save changes") : "Create usher & share"}
        </button>
      </form>
      {usher && (
        <div className="mt-4 space-y-3">
          <button onClick={toggle} disabled={busy} className={`${btn} border-2 border-[#C9A961] text-[#0B4D3A]`}>{usher.disabled ? "Enable account" : "Disable account"}</button>
          <button onClick={() => setConfirmRemove(true)} className={`${btn} text-[#8A1F1F]`}>Remove usher</button>
        </div>
      )}
    </Sheet>
  );
}

export default function Ushers() {
  const ushers = useLive("/api/ushers", 60000);
  const [sheet, setSheet] = useState(null); // null | "new" | usher id
  const list = ushers.data ?? [];
  const current = sheet && sheet !== "new" ? list.find((u) => u.id === sheet) : null;
  const done = () => { setSheet(null); ushers.reload(); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-4xl text-[#0B4D3A]" style={serif}>Usher accounts</h1>
          <p className="text-sm text-[#12332A]/70">Up to two ushers can scan and check in guests from both sides.</p>
        </div>
        {ushers.data && list.length < 2 && (
          <button onClick={() => setSheet("new")} className="flex min-h-[48px] shrink-0 items-center gap-2 rounded-2xl bg-[#0B4D3A] px-4 font-medium text-[#FBF8F1]"><Plus size={20} />Add usher</button>
        )}
      </div>

      {ushers.error && <p role="alert" className="rounded-xl bg-[#FBEAEA] px-4 py-3 text-sm text-[#8A1F1F]">{ushers.error} <button onClick={ushers.reload} className="underline">Retry</button></p>}
      {ushers.data && !list.length && (
        <div className="rounded-3xl bg-white p-6 text-center shadow-sm">
          <p className="text-xl" style={serif}>No ushers yet</p>
          <p className="mt-1 text-[#12332A]/70">Add the ushers who will check in guests. You can send them their temporary passwords directly via WhatsApp.</p>
        </div>
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        {list.map((u) => (
          <li key={u.id}>
            <button onClick={() => setSheet(u.id)} className="w-full rounded-2xl bg-white p-4 text-left shadow-sm hover:shadow transition-shadow">
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-xl text-[#0B4D3A]" style={serif}>{u.name}</span>
                {u.disabled ? <Chip tone="bad">Disabled</Chip> : <Chip tone="good">Active</Chip>}
              </span>
              <span className="mt-1 block truncate text-sm text-[#12332A]/70">{u.email}</span>
            </button>
          </li>
        ))}
      </ul>
      {ushers.data && list.length >= 2 && <p className="text-sm text-[#12332A]/60">Both usher accounts are set up.</p>}

      {sheet === "new" && <UsherSheet usher={null} onClose={() => setSheet(null)} onChanged={done} />}
      {current && <UsherSheet key={current.id} usher={current} onClose={() => setSheet(null)} onChanged={done} />}
    </div>
  );
}
