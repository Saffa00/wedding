import { useMemo, useState } from "react";
import { Copy, Mail, MessageCircle, MessageSquare, Search, Share2 } from "lucide-react";
import { api } from "../../lib/api";
import { useLive } from "../usher/Home";
import Sheet from "../../components/Sheet";
import Chip from "../../components/Chip";

const serif = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600 };
const sideLabel = (s) => (s === "bride" ? "Bride’s side" : "Groom’s side");
const field = "w-full min-h-[52px] rounded-2xl border border-[#0B4D3A]/20 bg-white px-4 text-base focus:outline-none focus:ring-2 focus:ring-[#C9A961]";
const btn = "flex w-full min-h-[52px] items-center justify-center gap-2 rounded-2xl font-medium active:scale-[0.98] transition-transform motion-reduce:transition-none";

const statusOf = (g) => (!g.invitation ? "none" : g.invitation.status === "revoked" ? "cancelled" : "issued");

function InvitationSheet({ guest, onClose, onChanged }) {
  const [result, setResult] = useState(null); // shown once: only the token hash is stored
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [emailIt, setEmailIt] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const status = statusOf(guest);

  const generate = async () => {
    setBusy(true); setError("");
    try {
      setResult(await api(`/api/invitations/${guest.id}/issue`, { method: "POST", body: { sendEmail: emailIt && !!guest.email } }));
      onChanged();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const cancel = async () => {
    setBusy(true); setError("");
    try {
      await api(`/api/invitations/${guest.invitation.id}/revoke`, { method: "POST" });
      setResult(null); setConfirmCancel(false); onChanged();
    } catch (e) { setError(e.message); setConfirmCancel(false); } finally { setBusy(false); }
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(result.link); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { setError("Could not copy. Press and hold the link to copy it."); }
  };

  const nativeShare = () => navigator.share({ title: "Wedding invitation", text: `Invitation for ${guest.name}`, url: result.link }).catch(() => {});

  if (confirmCancel) {
    return (
      <Sheet title="Cancel invitation" onClose={onClose}>
        <p className="text-[#12332A]/80">Cancel the invitation for {guest.name}? Their QR code will be refused at the door. You can create a new invitation later.</p>
        <div className="mt-5 space-y-3">
          <button onClick={cancel} disabled={busy} className={`${btn} bg-[#8A1F1F] text-white disabled:opacity-60`}>{busy ? "Cancelling" : "Cancel invitation"}</button>
          <button onClick={() => setConfirmCancel(false)} className={`${btn} text-[#0B4D3A]`}>Keep invitation</button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title={guest.name} onClose={onClose}>
      <p className="text-sm text-[#12332A]/70">{sideLabel(guest.side)}, {guest.table ? `table ${guest.table}` : "no table yet"}</p>

      {result ? (
        <section className="mt-4 space-y-3" aria-label="Share invitation">
          <p className="rounded-2xl bg-white p-4 shadow-sm">
            <span className="block text-sm text-[#12332A]/60">Reference</span>
            <span className="text-2xl text-[#0B4D3A]" style={serif}>{result.reference}</span>
          </p>
          <p role="status" className="rounded-xl bg-[#FFF4D6] px-4 py-3 text-sm text-[#6B4E00]">
            Copy or share this link now. For security it cannot be shown again; you can only create a new link, which replaces this one.
          </p>
          {emailIt && guest.email && (
            <p role="status" className={`rounded-xl px-4 py-3 text-sm ${result.emailed ? "bg-[#0B4D3A]/10 text-[#0B4D3A]" : "bg-[#FBEAEA] text-[#8A1F1F]"}`}>
              {result.emailed ? `Email sent to ${guest.email}.` : "Email was not sent because email delivery is not set up. Use one of the share options instead."}
            </p>
          )}
          <input readOnly value={result.link} aria-label="Invitation link" onFocus={(e) => e.target.select()} className={field} />
          <button onClick={copy} className={`${btn} bg-[#0B4D3A] text-[#FBF8F1]`}><Copy size={20} />{copied ? "Copied" : "Copy link"}</button>
          <a href={result.share.whatsapp} className={`${btn} border-2 border-[#C9A961] text-[#0B4D3A]`}><MessageCircle size={20} />Share on WhatsApp App</a>
          {result.share.whatsappWeb && (
            <div className="text-center">
              <a href={result.share.whatsappWeb} target="_blank" rel="noopener noreferrer" className="text-xs text-[#0B4D3A] underline">
                Or share on WhatsApp Web
              </a>
            </div>
          )}
          <a href={result.share.sms} className={`${btn} border-2 border-[#C9A961] text-[#0B4D3A]`}><MessageSquare size={20} />Send by SMS</a>
          <a href={result.share.mailto} className={`${btn} border-2 border-[#C9A961] text-[#0B4D3A]`}><Mail size={20} />Send by email app</a>
          {typeof navigator.share === "function" && <button onClick={nativeShare} className={`${btn} text-[#0B4D3A]`}><Share2 size={20} />More share options</button>}
          <a href={result.link} target="_blank" rel="noopener noreferrer" className={`${btn} text-[#0B4D3A]`}>Open printable invitation</a>
        </section>
      ) : (
        <section className="mt-4 space-y-3">
          <div className="flex items-center gap-2">
            {status === "none" && <Chip>No invitation</Chip>}
            {status === "issued" && <Chip tone="warn">Invitation issued, {guest.invitation.reference}</Chip>}
            {status === "cancelled" && <Chip tone="bad">Invitation cancelled</Chip>}
            {guest.checkedInAt && <Chip tone="good">Checked in</Chip>}
          </div>
          {status === "issued" && <p className="text-sm text-[#12332A]/75">Creating a new link replaces the current one. The old QR code will stop working.</p>}
          {guest.email && (
            <label className="flex min-h-[44px] items-center gap-3">
              <input type="checkbox" checked={emailIt} onChange={(e) => setEmailIt(e.target.checked)} className="h-5 w-5 accent-[#0B4D3A]" />
              <span className="text-sm">Also email it to {guest.email}</span>
            </label>
          )}
          {error && <p role="alert" className="rounded-xl bg-[#FBEAEA] px-4 py-3 text-sm text-[#8A1F1F]">{error}</p>}
          <button onClick={generate} disabled={busy} className={`${btn} bg-[#0B4D3A] text-[#FBF8F1] disabled:opacity-60`}>
            {busy ? "Creating" : status === "none" ? "Create invitation" : status === "cancelled" ? "Create new invitation" : "Create new link"}
          </button>
          {status === "issued" && <button onClick={() => setConfirmCancel(true)} className={`${btn} text-[#8A1F1F]`}>Cancel invitation</button>}
        </section>
      )}
      {result && error && <p role="alert" className="mt-3 rounded-xl bg-[#FBEAEA] px-4 py-3 text-sm text-[#8A1F1F]">{error}</p>}
    </Sheet>
  );
}

export default function Invitations() {
  const guests = useLive("/api/guests", 60000);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [openId, setOpenId] = useState(null);

  const all = guests.data ?? [];
  const counts = useMemo(() => ({
    none: all.filter((g) => statusOf(g) === "none").length,
    issued: all.filter((g) => statusOf(g) === "issued").length,
    cancelled: all.filter((g) => statusOf(g) === "cancelled").length,
  }), [all]);
  const list = all.filter((g) => (filter === "all" || statusOf(g) === filter) && (!q.trim() || g.name.toLowerCase().includes(q.trim().toLowerCase())));
  const current = openId ? all.find((g) => g.id === openId) : null;
  const filters = [["all", "All"], ["none", `Not created (${counts.none})`], ["issued", `Issued (${counts.issued})`], ["cancelled", `Cancelled (${counts.cancelled})`]];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-4xl text-[#0B4D3A]" style={serif}>Invitations</h1>
        <p className="text-sm text-[#12332A]/70">Create a unique QR invitation for each guest and share it.</p>
      </div>
      <div className="relative">
        <Search size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#12332A]/50" />
        <input type="search" inputMode="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name" aria-label="Search guests" className={`${field} pl-12`} />
      </div>
      <div className="flex gap-2 overflow-x-auto" role="group" aria-label="Filter by invitation status">
        {filters.map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)} aria-pressed={filter === v}
                  className={`min-h-[44px] shrink-0 rounded-full px-4 text-sm font-medium ${filter === v ? "bg-[#0B4D3A] text-[#FBF8F1]" : "bg-white shadow-sm"}`}>{l}</button>
        ))}
      </div>

      {guests.error && <p role="alert" className="rounded-xl bg-[#FBEAEA] px-4 py-3 text-sm text-[#8A1F1F]">{guests.error} <button onClick={guests.reload} className="underline">Retry</button></p>}
      {guests.data && !all.length && <p className="rounded-3xl bg-white p-6 text-center text-[#12332A]/70 shadow-sm">Add guests first, then create their invitations here.</p>}
      {all.length > 0 && !list.length && <p className="py-8 text-center text-[#12332A]/60">No guests match.</p>}

      <ul className="grid gap-2 lg:grid-cols-2">
        {list.map((g) => {
          const s = statusOf(g);
          return (
            <li key={g.id}>
              <button onClick={() => setOpenId(g.id)} className="flex w-full items-center justify-between rounded-2xl bg-white px-4 py-3 text-left shadow-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{g.name}</span>
                  <span className="block text-sm text-[#12332A]/70">{sideLabel(g.side)}, {g.table ? `table ${g.table}` : "no table"}</span>
                </span>
                <span className="ml-3 shrink-0">
                  {s === "none" && <Chip>Not created</Chip>}
                  {s === "issued" && <Chip tone="warn">Issued</Chip>}
                  {s === "cancelled" && <Chip tone="bad">Cancelled</Chip>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {current && <InvitationSheet key={current.id} guest={current} onClose={() => setOpenId(null)} onChanged={guests.reload} />}
    </div>
  );
}
