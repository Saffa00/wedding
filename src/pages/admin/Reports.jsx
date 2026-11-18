import { useMemo } from "react";
import { Download } from "lucide-react";
import { useLive } from "../usher/Home";
import { downloadCsv, toCsv } from "../../lib/csv";

const serif = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600 };
const card = "rounded-3xl bg-white p-5 shadow-sm";
const sideLabel = (s) => (s === "bride" ? "Bride’s side" : "Groom’s side");
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const stamp = () => new Date().toISOString().slice(0, 10);
const hourLabel = (h) => new Date(2000, 0, 1, h).toLocaleTimeString([], { hour: "numeric" });

function Bar({ value, total, tone = "#0B4D3A" }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-[#0B4D3A]/10" role="progressbar" aria-valuenow={pct(value, total)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full" style={{ width: `${pct(value, total)}%`, background: tone }} />
    </div>
  );
}

export default function Reports() {
  const guests = useLive("/api/guests", 30000);
  const attendance = useLive("/api/attendance", 30000);
  const tables = useLive("/api/tables", 60000);

  const g = guests.data;
  const arrived = g?.filter((x) => x.checkedInAt).length ?? 0;

  const bySide = useMemo(() => ["bride", "groom"].map((s) => {
    const list = (g ?? []).filter((x) => x.side === s);
    return { side: s, total: list.length, arrived: list.filter((x) => x.checkedInAt).length };
  }), [g]);

  const byTable = useMemo(() => {
    if (!g) return [];
    const rows = (tables.data ?? []).map((t) => {
      const list = g.filter((x) => x.tableId === t.id);
      return { key: t.id, label: `Table ${t.number}${t.label ? `, ${t.label}` : ""}`, total: list.length, arrived: list.filter((x) => x.checkedInAt).length };
    });
    const loose = g.filter((x) => !x.tableId);
    if (loose.length) rows.push({ key: "none", label: "No table", total: loose.length, arrived: loose.filter((x) => x.checkedInAt).length });
    return rows;
  }, [g, tables.data]);

  const byHour = useMemo(() => {
    const counts = {};
    (attendance.data ?? []).forEach((c) => { const h = new Date(c.checkedInAt).getHours(); counts[h] = (counts[h] ?? 0) + 1; });
    return Object.entries(counts).map(([h, n]) => ({ h: Number(h), n })).sort((a, b) => a.h - b.h);
  }, [attendance.data]);
  const peak = Math.max(1, ...byHour.map((x) => x.n));

  const exportGuests = () => downloadCsv(`guest-list-${stamp()}.csv`, toCsv(g, [
    { label: "Name", value: (x) => x.name },
    { label: "Side", value: (x) => sideLabel(x.side) },
    { label: "Table", value: (x) => x.table ?? "" },
    { label: "Phone", value: (x) => x.phone ?? "" },
    { label: "Email", value: (x) => x.email ?? "" },
    { label: "Invitation", value: (x) => (!x.invitation ? "Not created" : x.invitation.status === "revoked" ? "Cancelled" : "Issued") },
    { label: "Reference", value: (x) => x.invitation?.reference ?? "" },
    { label: "Checked in", value: (x) => (x.checkedInAt ? "Yes" : "No") },
    { label: "Checked in at", value: (x) => x.checkedInAt ?? "" },
  ]));

  const exportLog = () => downloadCsv(`check-in-log-${stamp()}.csv`, toCsv([...attendance.data].reverse(), [
    { label: "Checked in at", value: (c) => c.checkedInAt },
    { label: "Guest", value: (c) => c.name ?? "" },
    { label: "Side", value: (c) => (c.side ? sideLabel(c.side) : "") },
    { label: "Table", value: (c) => c.table ?? "" },
    { label: "Usher", value: (c) => c.usher ?? "" },
  ]));

  const failed = guests.error || attendance.error || tables.error;
  const btn = "flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-[#C9A961] font-medium text-[#0B4D3A] disabled:opacity-50";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl text-[#0B4D3A]" style={serif}>Reports</h1>
        <p className="text-sm text-[#12332A]/70">Attendance at a glance, with spreadsheet exports.</p>
      </div>

      {failed && <p role="alert" className="rounded-xl bg-[#FBEAEA] px-4 py-3 text-sm text-[#8A1F1F]">{failed}</p>}
      {g && !g.length && <p className={`${card} text-center text-[#12332A]/70`}>There are no guests yet, so there is nothing to report.</p>}

      {g?.length > 0 && (
        <>
          <section className={card} aria-label="Overall attendance">
            <p className="text-[#12332A]/70">Overall attendance</p>
            <p className="text-5xl text-[#0B4D3A]" style={serif}>{pct(arrived, g.length)}%<span className="text-2xl text-[#12332A]/50"> {arrived} of {g.length}</span></p>
            <div className="mt-3"><Bar value={arrived} total={g.length} tone="#C9A961" /></div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section aria-label="Attendance by side">
              <h2 className="mb-2 text-2xl text-[#0B4D3A]" style={serif}>By side</h2>
              <div className={`${card} space-y-4`}>
                {bySide.map((s) => (
                  <div key={s.side}>
                    <div className="mb-1 flex justify-between text-sm"><span className="font-medium">{sideLabel(s.side)}</span><span className="text-[#12332A]/70">{s.arrived} of {s.total} ({pct(s.arrived, s.total)}%)</span></div>
                    <Bar value={s.arrived} total={s.total} />
                  </div>
                ))}
              </div>
            </section>

            <section aria-label="Arrivals by hour">
              <h2 className="mb-2 text-2xl text-[#0B4D3A]" style={serif}>Arrivals by hour</h2>
              <div className={card}>
                {byHour.length ? (
                  <ul className="space-y-2">
                    {byHour.map(({ h, n }) => (
                      <li key={h} className="flex items-center gap-3 text-sm">
                        <span className="w-14 shrink-0 text-[#12332A]/70">{hourLabel(h)}</span>
                        <div className="h-3 flex-1 overflow-hidden rounded-full bg-[#0B4D3A]/10"><div className="h-full rounded-full bg-[#0B4D3A]" style={{ width: `${(n / peak) * 100}%` }} /></div>
                        <span className="w-8 shrink-0 text-right font-medium">{n}</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-[#12332A]/60">No arrivals yet.</p>}
              </div>
            </section>
          </div>

          <section aria-label="Attendance by table">
            <h2 className="mb-2 text-2xl text-[#0B4D3A]" style={serif}>By table</h2>
            <ul className="grid gap-2 lg:grid-cols-2">
              {byTable.map((t) => (
                <li key={t.key} className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                  <div className="mb-1.5 flex justify-between text-sm"><span className="font-medium">{t.label}</span><span className="text-[#12332A]/70">{t.arrived} of {t.total} arrived</span></div>
                  <Bar value={t.arrived} total={t.total} />
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <section className={`${card} space-y-3`} aria-label="Exports">
        <h2 className="text-2xl text-[#0B4D3A]" style={serif}>Export</h2>
        <button onClick={exportGuests} disabled={!g?.length} className={btn}><Download size={20} />Guest list (CSV)</button>
        <button onClick={exportLog} disabled={!attendance.data?.length} className={btn}><Download size={20} />Check-in log (CSV)</button>
        <p className="text-sm text-[#12332A]/60">Exports include phone numbers and emails. Keep the files private.</p>
      </section>
    </div>
  );
}
