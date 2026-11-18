import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import Sheet from "../../components/Sheet";
import Chip from "../../components/Chip";
import { api } from "../../lib/api";
import { useLive } from "../usher/Home";

const serif = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600 };
const sideLabel = (s) => (s === "bride" ? "Bride’s side" : "Groom’s side");
const field = "w-full min-h-[52px] rounded-2xl border border-[#0B4D3A]/20 bg-white px-4 text-base focus:outline-none focus:ring-2 focus:ring-[#C9A961]";
const btn = "w-full min-h-[52px] rounded-2xl font-medium active:scale-[0.98] transition-transform motion-reduce:transition-none";

function GuestSheet({ guest, tables, onClose, onSaved }) {
  const [f, setF] = useState({
    name: guest?.name ?? "", side: guest?.side ?? "", phone: guest?.phone ?? "", email: guest?.email ?? "", tableId: guest?.tableId ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await api(guest ? `/api/guests/${guest.id}` : "/api/guests", { method: guest ? "PATCH" : "POST", body: { ...f, tableId: f.tableId || null } });
      onSaved();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const remove = async () => {
    setBusy(true); setError("");
    try { await api(`/api/guests/${guest.id}`, { method: "DELETE" }); onSaved(); }
    catch (err) { setError(err.message); setConfirmDelete(false); } finally { setBusy(false); }
  };

  if (confirmDelete) {
    return (
      <Sheet title="Delete guest" onClose={onClose}>
        <p className="text-[#12332A]/80">
          Delete {guest.name}? Their invitation will stop working{guest.checkedInAt ? " and their check-in record will be removed" : ""}. This cannot be undone.
        </p>
        <div className="mt-5 space-y-3">
          <button onClick={remove} disabled={busy} className={`${btn} bg-[#8A1F1F] text-white disabled:opacity-60`}>{busy ? "Deleting" : "Delete guest"}</button>
          <button onClick={() => setConfirmDelete(false)} className={`${btn} text-[#0B4D3A]`}>Keep guest</button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title={guest ? "Edit guest" : "Add guest"} onClose={onClose}>
      <form onSubmit={save} className="space-y-4" noValidate>
        <div>
          <label htmlFor="g-name" className="mb-1.5 block text-sm font-medium">Full name</label>
          <input id="g-name" value={f.name} onChange={set("name")} autoComplete="off" autoCapitalize="words" className={field} />
        </div>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Side</legend>
          <div className="grid grid-cols-2 gap-2">
            {["bride", "groom"].map((s) => (
              <label key={s} className={`grid min-h-[52px] cursor-pointer place-items-center rounded-2xl border-2 font-medium ${f.side === s ? "border-[#0B4D3A] bg-[#0B4D3A] text-[#FBF8F1]" : "border-[#0B4D3A]/20 bg-white"}`}>
                <input type="radio" name="side" value={s} checked={f.side === s} onChange={set("side")} className="sr-only" />
                {sideLabel(s)}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor="g-phone" className="mb-1.5 block text-sm font-medium">Phone for WhatsApp and SMS (optional)</label>
          <input id="g-phone" type="tel" inputMode="tel" autoComplete="off" placeholder="+232 76 000000" value={f.phone} onChange={set("phone")} className={field} />
        </div>
        <div>
          <label htmlFor="g-email" className="mb-1.5 block text-sm font-medium">Email (optional)</label>
          <input id="g-email" type="email" inputMode="email" autoComplete="off" autoCapitalize="none" value={f.email} onChange={set("email")} className={field} />
        </div>
        <div>
          <label htmlFor="g-table" className="mb-1.5 block text-sm font-medium">Table</label>
          <select id="g-table" value={f.tableId} onChange={set("tableId")} className={field}>
            <option value="">No table yet</option>
            {tables.map((t) => {
              const full = t.seated >= t.capacity && t.id !== guest?.tableId;
              return <option key={t.id} value={t.id} disabled={full}>Table {t.number}{t.label ? `, ${t.label}` : ""} ({t.seated}/{t.capacity}{full ? ", full" : ""})</option>;
            })}
          </select>
        </div>
        {error && <p role="alert" className="rounded-xl bg-[#FBEAEA] px-4 py-3 text-sm text-[#8A1F1F]">{error}</p>}
        <button type="submit" disabled={busy || !f.name.trim() || !f.side} className={`${btn} bg-[#0B4D3A] text-[#FBF8F1] disabled:opacity-50`}>
          {busy ? "Saving" : guest ? "Save changes" : "Add guest"}
        </button>
        {guest && <button type="button" onClick={() => setConfirmDelete(true)} className={`${btn} text-[#8A1F1F]`}>Delete guest</button>}
      </form>
    </Sheet>
  );
}

export default function Guests() {
  const guests = useLive("/api/guests", 60000);
  const tables = useLive("/api/tables", 60000);
  const [q, setQ] = useState("");
  const [side, setSide] = useState("all");
  const [sheet, setSheet] = useState(null); // null | "new" | guest

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (guests.data ?? []).filter((g) => (side === "all" || g.side === side) && (!needle || g.name.toLowerCase().includes(needle)));
  }, [guests.data, q, side]);

  const saved = () => { setSheet(null); guests.reload(); tables.reload(); };
  const filters = [["all", "All"], ["bride", "Bride’s side"], ["groom", "Groom’s side"]];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-4xl text-[#0B4D3A]" style={serif}>Guests</h1>
          {guests.data && <p className="text-sm text-[#12332A]/70">{guests.data.length} invited</p>}
        </div>
        <button onClick={() => setSheet("new")} className="flex min-h-[48px] items-center gap-2 rounded-2xl bg-[#0B4D3A] px-4 font-medium text-[#FBF8F1]"><Plus size={20} />Add guest</button>
      </div>

      <div className="relative">
        <Search size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#12332A]/50" />
        <input type="search" inputMode="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name" aria-label="Search guests" className={`${field} pl-12`} />
      </div>
      <div className="flex gap-2 overflow-x-auto" role="group" aria-label="Filter by side">
        {filters.map(([v, l]) => (
          <button key={v} onClick={() => setSide(v)} aria-pressed={side === v}
                  className={`min-h-[44px] shrink-0 rounded-full px-4 text-sm font-medium ${side === v ? "bg-[#0B4D3A] text-[#FBF8F1]" : "bg-white shadow-sm"}`}>{l}</button>
        ))}
      </div>

      {guests.error && <p role="alert" className="rounded-xl bg-[#FBEAEA] px-4 py-3 text-sm text-[#8A1F1F]">{guests.error} <button onClick={guests.reload} className="underline">Retry</button></p>}

      {guests.data && !guests.data.length && (
        <div className="rounded-3xl bg-white p-6 text-center shadow-sm">
          <p className="text-xl" style={serif}>No guests yet</p>
          <p className="mt-1 text-[#12332A]/70">Add the first guest to start building your list.</p>
        </div>
      )}
      {guests.data?.length > 0 && !list.length && <p className="py-8 text-center text-[#12332A]/60">No guests match your search.</p>}

      <ul className="grid gap-2 lg:grid-cols-2">
        {list.map((g) => (
          <li key={g.id}>
            <button onClick={() => setSheet(g)} className="w-full rounded-2xl bg-white px-4 py-3 text-left shadow-sm">
              <span className="block font-medium">{g.name}</span>
              <span className="block text-sm text-[#12332A]/70">{sideLabel(g.side)}, {g.table ? `table ${g.table}` : "no table"}</span>
              <span className="mt-2 flex flex-wrap gap-1.5">
                {!g.invitation && <Chip>No invitation</Chip>}
                {g.invitation?.status === "active" && <Chip tone="warn">Invitation issued</Chip>}
                {g.invitation?.status === "revoked" && <Chip tone="bad">Invitation cancelled</Chip>}
                {g.checkedInAt && <Chip tone="good">Checked in</Chip>}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {sheet && <GuestSheet guest={sheet === "new" ? null : sheet} tables={tables.data ?? []} onClose={() => setSheet(null)} onSaved={saved} />}
    </div>
  );
}
