import { useState } from "react";
import { Plus } from "lucide-react";
import { api } from "../../lib/api";
import { useLive } from "../usher/Home";
import Sheet from "../../components/Sheet";

const serif = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600 };
const sideLabel = (s) => (s === "bride" ? "Bride’s side" : "Groom’s side");
const field = "w-full min-h-[52px] rounded-2xl border border-[#0B4D3A]/20 bg-white px-4 text-base focus:outline-none focus:ring-2 focus:ring-[#C9A961]";
const btn = "w-full min-h-[52px] rounded-2xl font-medium active:scale-[0.98] transition-transform motion-reduce:transition-none";

function TableSheet({ table, guests, onClose, onChanged }) {
  const [f, setF] = useState({ number: table?.number ?? "", capacity: table?.capacity ?? 10, label: table?.label ?? "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [seatError, setSeatError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pick, setPick] = useState("");
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const seatedGuests = table ? guests.filter((g) => g.tableId === table.id) : [];
  const unassigned = guests.filter((g) => !g.tableId);
  const full = table ? table.seated >= table.capacity : false;

  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await api(table ? `/api/tables/${table.id}` : "/api/tables", { method: table ? "PATCH" : "POST", body: f });
      onChanged(true);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const remove = async () => {
    setBusy(true);
    try { await api(`/api/tables/${table.id}`, { method: "DELETE" }); onChanged(true); }
    catch (err) { setError(err.message); setConfirmDelete(false); } finally { setBusy(false); }
  };

  const move = async (guestId, tableId) => {
    setSeatError("");
    try { await api(`/api/guests/${guestId}`, { method: "PATCH", body: { tableId } }); setPick(""); onChanged(false); }
    catch (err) { setSeatError(err.message); }
  };

  if (confirmDelete) {
    return (
      <Sheet title="Delete table" onClose={onClose}>
        <p className="text-[#12332A]/80">
          Delete table {table.number}? {table.seated ? `The ${table.seated} guests seated here will have no table.` : "No guests are seated here."}
        </p>
        <div className="mt-5 space-y-3">
          <button onClick={remove} disabled={busy} className={`${btn} bg-[#8A1F1F] text-white disabled:opacity-60`}>{busy ? "Deleting" : "Delete table"}</button>
          <button onClick={() => setConfirmDelete(false)} className={`${btn} text-[#0B4D3A]`}>Keep table</button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title={table ? `Table ${table.number}` : "Add table"} onClose={onClose}>
      <form onSubmit={save} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="t-num" className="mb-1.5 block text-sm font-medium">Table number</label>
            <input id="t-num" type="number" inputMode="numeric" min="1" value={f.number} onChange={set("number")} className={field} />
          </div>
          <div>
            <label htmlFor="t-cap" className="mb-1.5 block text-sm font-medium">Seats</label>
            <input id="t-cap" type="number" inputMode="numeric" min="1" value={f.capacity} onChange={set("capacity")} className={field} />
          </div>
        </div>
        <div>
          <label htmlFor="t-label" className="mb-1.5 block text-sm font-medium">Label (optional)</label>
          <input id="t-label" value={f.label} onChange={set("label")} placeholder="Family, Friends, Colleagues" className={field} />
        </div>
        {error && <p role="alert" className="rounded-xl bg-[#FBEAEA] px-4 py-3 text-sm text-[#8A1F1F]">{error}</p>}
        <button type="submit" disabled={busy || !f.number || !f.capacity} className={`${btn} bg-[#0B4D3A] text-[#FBF8F1] disabled:opacity-50`}>
          {busy ? "Saving" : table ? "Save changes" : "Add table"}
        </button>
      </form>

      {table && (
        <section className="mt-6" aria-label="Seated guests">
          <h3 className="text-xl text-[#0B4D3A]" style={serif}>Seated guests ({table.seated}/{table.capacity})</h3>
          {seatedGuests.length ? (
            <ul className="mt-2 space-y-2">
              {seatedGuests.map((g) => (
                <li key={g.id} className="flex items-center justify-between rounded-2xl bg-white px-4 py-2 shadow-sm">
                  <span><span className="block font-medium">{g.name}</span><span className="text-sm text-[#12332A]/60">{sideLabel(g.side)}</span></span>
                  <button onClick={() => move(g.id, null)} className="min-h-[44px] px-2 text-sm text-[#8A1F1F]">Remove</button>
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-sm text-[#12332A]/70">No one is seated here yet.</p>}

          <div className="mt-4 space-y-2">
            <label htmlFor="t-pick" className="block text-sm font-medium">Seat a guest</label>
            <select id="t-pick" value={pick} onChange={(e) => setPick(e.target.value)} disabled={full || !unassigned.length} className={field}>
              <option value="">{full ? "This table is full" : unassigned.length ? "Choose a guest without a table" : "Every guest has a table"}</option>
              {unassigned.map((g) => <option key={g.id} value={g.id}>{g.name}, {sideLabel(g.side)}</option>)}
            </select>
            <button onClick={() => move(pick, table.id)} disabled={!pick} className={`${btn} border-2 border-[#C9A961] text-[#0B4D3A] disabled:opacity-50`}>Seat guest</button>
            {seatError && <p role="alert" className="rounded-xl bg-[#FBEAEA] px-4 py-3 text-sm text-[#8A1F1F]">{seatError}</p>}
          </div>
          <button onClick={() => setConfirmDelete(true)} className={`${btn} mt-4 text-[#8A1F1F]`}>Delete table</button>
        </section>
      )}
    </Sheet>
  );
}

export default function Tables() {
  const tables = useLive("/api/tables", 60000);
  const guests = useLive("/api/guests", 60000);
  const [sheet, setSheet] = useState(null); // null | "new" | table id

  const t = tables.data ?? [];
  const current = sheet && sheet !== "new" ? t.find((x) => x.id === sheet) : null;
  const seats = t.reduce((n, x) => n + x.capacity, 0);
  const seated = t.reduce((n, x) => n + x.seated, 0);
  const unassigned = (guests.data ?? []).filter((g) => !g.tableId).length;

  const changed = (close) => { if (close) setSheet(null); tables.reload(); guests.reload(); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-4xl text-[#0B4D3A]" style={serif}>Tables and seating</h1>
          {tables.data && <p className="text-sm text-[#12332A]/70">{t.length} tables, {seated} of {seats} seats assigned{guests.data ? `, ${unassigned} guests without a table` : ""}.</p>}
        </div>
        <button onClick={() => setSheet("new")} className="flex min-h-[48px] shrink-0 items-center gap-2 rounded-2xl bg-[#0B4D3A] px-4 font-medium text-[#FBF8F1]"><Plus size={20} />Add table</button>
      </div>

      {tables.error && <p role="alert" className="rounded-xl bg-[#FBEAEA] px-4 py-3 text-sm text-[#8A1F1F]">{tables.error} <button onClick={tables.reload} className="underline">Retry</button></p>}
      {tables.data && !t.length && (
        <div className="rounded-3xl bg-white p-6 text-center shadow-sm">
          <p className="text-xl" style={serif}>No tables yet</p>
          <p className="mt-1 text-[#12332A]/70">Add your first table, then seat guests at it.</p>
        </div>
      )}

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {t.map((x) => {
          const isFull = x.seated >= x.capacity;
          return (
            <li key={x.id}>
              <button onClick={() => setSheet(x.id)} className="w-full rounded-2xl bg-white p-4 text-left shadow-sm">
                <span className="flex items-baseline justify-between">
                  <span className="text-2xl text-[#0B4D3A]" style={serif}>Table {x.number}</span>
                  <span className={`text-sm ${isFull ? "font-medium text-[#8A1F1F]" : "text-[#12332A]/70"}`}>{x.seated}/{x.capacity}{isFull ? " full" : ""}</span>
                </span>
                {x.label && <span className="block text-sm text-[#12332A]/70">{x.label}</span>}
                <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-[#0B4D3A]/10">
                  <span className="block h-full rounded-full bg-[#0B4D3A]" style={{ width: `${Math.min(100, (x.seated / x.capacity) * 100)}%` }} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {sheet === "new" && <TableSheet table={null} guests={guests.data ?? []} onClose={() => setSheet(null)} onChanged={changed} />}
      {current && <TableSheet key={current.id} table={current} guests={guests.data ?? []} onClose={() => setSheet(null)} onChanged={changed} />}
    </div>
  );
}
