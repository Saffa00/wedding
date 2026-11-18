import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Heart,
  LayoutGrid,
  Mail,
  MapPin,
  RefreshCw,
  UserCheck,
  UserPlus,
  Users,
  Utensils,
  AlertCircle
} from "lucide-react";
import { CheckInRow, useLive } from "../usher/Home";

const serif = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600 };
const card = "rounded-3xl bg-white p-5 shadow-sm border border-[#0B4D3A]/5";

function StatCard({ label, value, subtext, icon: Icon, tone = "default" }) {
  const toneClasses = {
    default: "text-[#0B4D3A] bg-[#0B4D3A]/5",
    gold: "text-[#6B4E00] bg-[#FFF4D6]",
    amber: "text-[#8A501F] bg-[#FDF0E2]",
  };

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm border border-[#0B4D3A]/5 flex items-start justify-between">
      <div>
        <p className="text-xs font-medium text-[#12332A]/60 uppercase tracking-wider">{label}</p>
        <p className="mt-1 text-3xl font-semibold text-[#0B4D3A]" style={serif}>{value ?? "…"}</p>
        {subtext && <p className="mt-0.5 text-xs text-[#12332A]/70">{subtext}</p>}
      </div>
      {Icon && (
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${toneClasses[tone]}`}>
          <Icon size={20} />
        </div>
      )}
    </div>
  );
}

function daysCountdown(iso) {
  if (!iso) return null;
  const target = new Date(iso);
  if (isNaN(target.getTime())) return null;
  const now = new Date();
  const diffDays = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today is the wedding day!";
  if (diffDays === 1) return "Tomorrow is the big day!";
  if (diffDays > 1) return `${diffDays} days to go`;
  return "Wedding completed";
}

export default function Dashboard() {
  const stats = useLive("/api/stats", 15000);
  const activity = useLive("/api/activity", 15000);
  const tables = useLive("/api/tables", 20000);
  const settings = useLive("/api/settings", 60000);
  const guests = useLive("/api/guests", 30000);

  const s = stats.data;
  const set = settings.data;
  const t = tables.data ?? [];
  const gList = guests.data ?? [];

  const reloadAll = () => {
    stats.reload();
    activity.reload();
    tables.reload();
    settings.reload();
    guests.reload();
  };

  const pct = s?.total ? Math.round((s.checkedIn / s.total) * 100) : 0;
  const seats = t.reduce((n, x) => n + x.capacity, 0);
  const seated = t.reduce((n, x) => n + x.seated, 0);

  // Invitation metrics
  const invStats = useMemo(() => {
    if (!gList.length) return { issued: 0, pending: 0, revoked: 0 };
    let issued = 0, pending = 0, revoked = 0;
    for (const g of gList) {
      if (!g.invitation) pending++;
      else if (g.invitation.status === "revoked") revoked++;
      else issued++;
    }
    return { issued, pending, revoked };
  }, [gList]);

  // Guests without a table
  const unassignedGuests = useMemo(() => {
    return gList.filter((g) => !g.tableId).length;
  }, [gList]);

  const weddingDateStr = useMemo(() => {
    if (!set?.eventDate) return null;
    const d = new Date(set.eventDate);
    const tz = set.timezone || undefined;
    return d.toLocaleDateString(undefined, {
      timeZone: tz,
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, [set]);

  const countdown = useMemo(() => daysCountdown(set?.eventDate), [set]);

  return (
    <div className="space-y-6">
      {/* Hero Wedding Header */}
      <div className="rounded-3xl bg-gradient-to-br from-[#0B4D3A] to-[#12332A] p-6 text-[#FBF8F1] shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 opacity-10 pointer-events-none">
          <Heart size={200} />
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4 relative z-10">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-[#C9A961]">
              <Heart size={14} /> Wedding Dashboard
            </span>
            <h1 className="mt-2 text-3xl sm:text-4xl" style={serif}>
              {set ? `${set.brideName} & ${set.groomName}` : "Wedding Overview"}
            </h1>
            {weddingDateStr ? (
              <div className="mt-2 flex flex-wrap items-center gap-4 text-xs sm:text-sm text-[#FBF8F1]/80">
                <span className="flex items-center gap-1.5"><Calendar size={15} className="text-[#C9A961]" /> {weddingDateStr}</span>
                {set.venue && <span className="flex items-center gap-1.5"><MapPin size={15} className="text-[#C9A961]" /> {set.venue}</span>}
              </div>
            ) : (
              <p className="mt-1 text-sm text-[#FBF8F1]/70">
                <Link to="/admin/settings" className="underline text-[#C9A961]">Configure wedding details in Settings</Link>
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {countdown && (
              <span className="rounded-full bg-[#C9A961]/20 border border-[#C9A961]/40 px-3.5 py-1.5 text-xs font-semibold text-[#FBF8F1]">
                {countdown}
              </span>
            )}
            <button
              onClick={reloadAll}
              aria-label="Refresh dashboard"
              title="Refresh dashboard"
              className="grid h-10 w-10 place-items-center rounded-full bg-white/10 hover:bg-white/20 text-[#FBF8F1] transition-colors"
            >
              <RefreshCw size={17} />
            </button>
          </div>
        </div>
      </div>

      {/* Quick Action Navigation Buttons */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Link
          to="/admin/guests"
          className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-white p-4 shadow-sm hover:shadow transition-all border border-[#0B4D3A]/5 active:scale-95"
        >
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#0B4D3A]/10 text-[#0B4D3A]">
            <UserPlus size={22} />
          </div>
          <span className="text-sm font-semibold text-[#12332A]">Add Guests</span>
        </Link>

        <Link
          to="/admin/invitations"
          className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-white p-4 shadow-sm hover:shadow transition-all border border-[#0B4D3A]/5 active:scale-95"
        >
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#C9A961]/20 text-[#6B4E00]">
            <Mail size={22} />
          </div>
          <span className="text-sm font-semibold text-[#12332A]">Invitations</span>
        </Link>

        <Link
          to="/admin/attendance"
          className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-white p-4 shadow-sm hover:shadow transition-all border border-[#0B4D3A]/5 active:scale-95"
        >
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#0B4D3A]/10 text-[#0B4D3A]">
            <UserCheck size={22} />
          </div>
          <span className="text-sm font-semibold text-[#12332A]">Live Check-in</span>
        </Link>

        <Link
          to="/admin/tables"
          className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-white p-4 shadow-sm hover:shadow transition-all border border-[#0B4D3A]/5 active:scale-95"
        >
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#0B4D3A]/10 text-[#0B4D3A]">
            <LayoutGrid size={22} />
          </div>
          <span className="text-sm font-semibold text-[#12332A]">Seating Tables</span>
        </Link>
      </div>

      {/* Main Attendance Progress Section */}
      <section className={card} aria-label="Attendance tracker">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#12332A]/60">Total Guest Attendance</p>
            <div className="mt-1 flex items-baseline gap-3">
              <span className="text-5xl text-[#0B4D3A]" style={serif}>{s?.checkedIn ?? 0}</span>
              <span className="text-2xl text-[#12332A]/50">of {s?.total ?? 0} arrived</span>
              <span className="rounded-full bg-[#0B4D3A]/10 px-2.5 py-0.5 text-xs font-semibold text-[#0B4D3A]">
                {pct}% checked in
              </span>
            </div>
          </div>
          <div className="text-left sm:text-right">
            <span className="text-sm text-[#12332A]/70">Yet to arrive:</span>
            <p className="text-2xl font-semibold text-[#6B4E00]" style={serif}>{s?.yetToArrive ?? 0} guests</p>
          </div>
        </div>

        {/* Big Progress Bar */}
        <div className="mt-4 h-3.5 w-full overflow-hidden rounded-full bg-[#0B4D3A]/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#0B4D3A] to-[#C9A961] transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Side-by-side Arrival Breakdown */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 pt-4 border-t border-[#0B4D3A]/10">
          <div className="rounded-2xl bg-[#FBF8F1] p-3.5">
            <div className="flex justify-between items-center text-sm font-medium">
              <span className="text-[#0B4D3A]">Bride’s Side</span>
              <span>{s?.bride ? `${Math.round(((s?.brideCheckIns ?? s?.checkedIn ?? 0) / s.bride) * 100)}%` : "0%"}</span>
            </div>
            <p className="mt-1 text-2xl font-bold text-[#0B4D3A]" style={serif}>
              {s?.bride ?? 0} <span className="text-xs font-normal text-[#12332A]/60">invited guests</span>
            </p>
          </div>

          <div className="rounded-2xl bg-[#FBF8F1] p-3.5">
            <div className="flex justify-between items-center text-sm font-medium">
              <span className="text-[#0B4D3A]">Groom’s Side</span>
              <span>{s?.groom ? `${Math.round(((s?.groomCheckIns ?? s?.checkedIn ?? 0) / s.groom) * 100)}%` : "0%"}</span>
            </div>
            <p className="mt-1 text-2xl font-bold text-[#0B4D3A]" style={serif}>
              {s?.groom ?? 0} <span className="text-xs font-normal text-[#12332A]/60">invited guests</span>
            </p>
          </div>
        </div>
      </section>

      {/* Stats Quick Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total Guests" value={s?.total} subtext="On master guest list" icon={Users} />
        <StatCard label="Arrived" value={s?.checkedIn} subtext={`${pct}% checked in`} icon={CheckCircle2} />
        <StatCard label="Waiting" value={s?.yetToArrive} subtext="Expected arrivals" icon={Clock} tone="gold" />
        <StatCard label="Seats" value={`${seated}/${seats || 0}`} subtext={unassignedGuests > 0 ? `${unassignedGuests} unseated` : "All seated"} icon={Utensils} tone={unassignedGuests > 0 ? "amber" : "default"} />
      </div>

      {/* Grid: Seating Tables & Live Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Table Seating Summary */}
        <section className={card} aria-label="Table seating summary">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-2xl text-[#0B4D3A]" style={serif}>Table Seating</h2>
            <Link to="/admin/tables" className="text-sm font-medium text-[#0B4D3A] underline">
              Manage Tables
            </Link>
          </div>

          {unassignedGuests > 0 && (
            <div className="mb-4 flex items-center gap-2 rounded-2xl bg-[#FFF4D6] p-3 text-xs text-[#6B4E00]">
              <AlertCircle size={17} className="shrink-0" />
              <span>
                <strong>{unassignedGuests} {unassignedGuests === 1 ? "guest has" : "guests have"} no table assigned.</strong> Assign them in Guests.
              </span>
            </div>
          )}

          {t.length ? (
            <div className="space-y-3">
              <p className="text-xs text-[#12332A]/70">
                {t.length} {t.length === 1 ? "table" : "tables"} configured • {seated} of {seats} seats occupied ({seats ? Math.round((seated / seats) * 100) : 0}%)
              </p>
              <ul className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {t.map((table) => {
                  const full = table.seated >= table.capacity;
                  const ratio = Math.min(100, Math.round((table.seated / table.capacity) * 100));
                  return (
                    <li key={table.id} className="rounded-2xl bg-[#FBF8F1] p-3 space-y-1.5">
                      <div className="flex justify-between items-center text-sm">
                        <span className="font-semibold text-[#12332A]">
                          Table {table.number}{table.label ? ` • ${table.label}` : ""}
                        </span>
                        <span className={`text-xs font-medium ${full ? "text-[#8A1F1F]" : "text-[#12332A]/70"}`}>
                          {table.seated}/{table.capacity} seats {full ? "(Full)" : ""}
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-[#0B4D3A]/10">
                        <div
                          className={`h-full rounded-full ${full ? "bg-[#8A1F1F]" : "bg-[#0B4D3A]"}`}
                          style={{ width: `${ratio}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-[#12332A]/60">
              No seating tables created yet. <Link to="/admin/tables" className="underline text-[#0B4D3A]">Create your first table</Link>.
            </p>
          )}
        </section>

        {/* Live Check-In Activity Feed */}
        <section className={card} aria-label="Recent check-in activity">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-2xl text-[#0B4D3A]" style={serif}>Recent Arrivals</h2>
            <Link to="/admin/attendance" className="text-sm font-medium text-[#0B4D3A] underline">
              View All ({s?.checkedIn ?? 0})
            </Link>
          </div>

          {activity.data?.length ? (
            <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {activity.data.slice(0, 6).map((r) => (
                <CheckInRow key={r.checked_in_at + (r.guests?.full_name || "")} row={r} />
              ))}
            </ul>
          ) : (
            <div className="py-12 text-center text-[#12332A]/60">
              <Clock className="mx-auto mb-2 text-[#C9A961]" size={32} />
              <p className="font-medium">No check-ins yet</p>
              <p className="mt-1 text-xs">When ushers scan guest QR invitations at the entrance, arrivals will stream here in real-time.</p>
            </div>
          )}
        </section>
      </div>

      {/* Invitations Dispatch Summary */}
      <section className={card} aria-label="Invitations dispatch overview">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-2xl text-[#0B4D3A]" style={serif}>Invitation Status</h2>
            <p className="text-xs text-[#12332A]/70">Track which guests have received their entry QR code.</p>
          </div>
          <Link to="/admin/invitations" className="text-sm font-medium text-[#0B4D3A] underline">
            Manage Invitations
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-2.5 sm:gap-4 text-center">
          <div className="rounded-2xl bg-[#0B4D3A]/5 p-3.5">
            <span className="block text-2xl font-bold text-[#0B4D3A]" style={serif}>{invStats.issued}</span>
            <span className="text-xs font-medium text-[#0B4D3A]">Active Invitations</span>
          </div>

          <div className="rounded-2xl bg-[#FFF4D6] p-3.5">
            <span className="block text-2xl font-bold text-[#6B4E00]" style={serif}>{invStats.pending}</span>
            <span className="text-xs font-medium text-[#6B4E00]">Not Issued Yet</span>
          </div>

          <div className="rounded-2xl bg-[#FBEAEA] p-3.5">
            <span className="block text-2xl font-bold text-[#8A1F1F]" style={serif}>{invStats.revoked}</span>
            <span className="text-xs font-medium text-[#8A1F1F]">Cancelled</span>
          </div>
        </div>
      </section>
    </div>
  );
}
