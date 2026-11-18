import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { api } from "../../lib/api";
import { useLive } from "../usher/Home";
import Sheet from "../../components/Sheet";
import Chip from "../../components/Chip";

const serif = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600 };
const sideLabel = (s) => (s === "bride" ? "Bride’s side" : "Groom’s side");
const field = "w-full min-h-[52px] rounded-2xl border border-[#0B4D3A]/20 bg-white px-4 text-base focus:outline-none focus:ring-2 focus:ring-[#C9A961]";
const btn = "w-full min-h-[52px] rounded-2xl font-medium active:scale-[0.98] transition-transform motion-reduce:transition-none";

const when = (iso) => {
  const d = new Date(iso);
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return d.toDateString() === new Date().toDateString() ? time : `${d.toLocaleDateString([], { day: "numeric", month: "short" })}, ${time}`;
};

export default function Attendance() {
  const attendance = useLive("/api/attendance", 20000);
  const guests = useLive("/api/guests", 30000);
  const [tab, setTab] = useState("arrived");
  const [side, setSide] = useState("all");
  const [q, setQ] = useState("");
  const [undo, setUndo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const needle = q.trim().toLowerCase();
  const match = (name, s) => (side === "all" || s === side) && (!needle || name.toLowerCase().includes(needle));

  const arrived = useMemo(() => (attendance.data ?? []).filter((c) => match(c.name ?? "", c.side)), [attendance.data, side, needle]);
  const missing = useMemo(() => (guests.data ?? []).filter((g) => !g.checkedInAt && match(g.name, g.side)), [guests.data, side, needle]);

  const arrivedTotal = attendance.data?.length;
  const missingTotal = guests.data?.filter((g) => !g.checkedInAt).length;
  const reloadAll = () => { attendance.reload(); guests.reload(); };

  const confirmUndo = async () => {
    setBusy(true); setError("");
    try { await api(`/api/check-ins/${undo.id}`, { method: "DELETE" }); setUndo(null); reloadAll(); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const tabs = [["arrived", "Arrived", arrivedTotal], ["missing", "Yet to arrive", missingTotal]];
  const failed = attendance.error || guests.error;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-4xl text-[#0B4D3A]" style={serif}>Attendance</h1>
        <p className="text-sm text-[#12332A]/70">Updates every few seconds while you keep this screen open.</p>
      </div>

      <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="Attendance lists">
        {tabs.map(([v, l, n]) => (
          <button key={v} role="tab" aria-selected={tab === v} onClick={() => setTab(v)}
                  className={`min-h-[52px] rounded-2xl font-medium ${tab === v ? "bg-[#0B4D3A] text-[#FBF8F1]" : "bg-white shadow-sm"}`}>
            {l}{n !== undefined ? ` (${n})` : ""}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#12332A]/50" />
        <input type="search" inputMode="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name" aria-label="Search guests" className={`${field} pl-12`} />
      </div>
      <div className="flex gap-2 overflow-x-auto" role="group" aria-label="Filter by side">
        {[["all", "Both sides"], ["bride", "Bride’s side"], ["groom", "Groom’s side"]].map(([v, l]) => (
          <button key={v} onClick={() => setSide(v)} aria-pressed={side === v}
                  className={`min-h-[44px] shrink-0 rounded-full px-4 text-sm font-medium ${side === v ? "bg-[#0B4D3A] text-[#FBF8F1]" : "bg-white shadow-sm"}`}>{l}</button>
        ))}
      </div>

      {failed && <p role="alert" className="rounded-xl bg-[#FBEAEA] px-4 py-3 text-sm text-[#8A1F1F]">{failed} <button onClick={reloadAll} className="underline">Retry</button></p>}

      {tab === "arrived" ? (
        <>
          {attendance.data && !arrived.length && (
            <p className="py-8 text-center text-[#12332A]/60">{attendance.data.length ? "No arrived guests match." : "Nobody has checked in yet."}</p>
          )}
          <ul className="grid gap-2 lg:grid-cols-2">
            {arrived.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{c.name}</p>
                  <p className="text-sm text-[#12332A]/70">{sideLabel(c.side)}, {c.table ? `table ${c.table}` : "no table"}</p>
                  <p className="text-sm text-[#12332A]/60">{when(c.checkedInAt)}{c.usher ? `, by ${c.usher}` : ""}</p>
                </div>
                <button onClick={() => { setError(""); setUndo(c); }} className="min-h-[44px] shrink-0 px-2 text-sm text-[#8A1F1F]">Undo</button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          {guests.data && !missing.length && (
            <p className="py-8 text-center text-[#12332A]/60">{missingTotal ? "No waiting guests match." : "Everyone has arrived."}</p>
          )}
          <ul className="grid gap-2 lg:grid-cols-2">
            {missing.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{g.name}</p>
                  <p className="text-sm text-[#12332A]/70">{sideLabel(g.side)}, {g.table ? `table ${g.table}` : "no table"}</p>
                </div>
                {!g.invitation ? <Chip>No invitation</Chip> : g.invitation.status === "revoked" ? <Chip tone="bad">Cancelled</Chip> : null}
              </li>
            ))}
          </ul>
        </>
      )}

      {undo && (
        <Sheet title="Undo check-in" onClose={() => setUndo(null)}>
          <p className="text-[#12332A]/80">Undo the check-in for {undo.name}? They will show as not arrived and can be checked in again.</p>
          {error && <p role="alert" className="mt-3 rounded-xl bg-[#FBEAEA] px-4 py-3 text-sm text-[#8A1F1F]">{error}</p>}
          <div className="mt-5 space-y-3">
            <button onClick={confirmUndo} disabled={busy} className={`${btn} bg-[#8A1F1F] text-white disabled:opacity-60`}>{busy ? "Undoing" : "Undo check-in"}</button>
            <button onClick={() => setUndo(null)} className={`${btn} text-[#0B4D3A]`}>Keep check-in</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
