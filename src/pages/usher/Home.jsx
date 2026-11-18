import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ScanLine, Search } from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

const serif = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600 };
const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };
const timeOf = (iso) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export function useLive(path, ms = 20000) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try { setData(await api(path)); setError(""); } catch (e) { setError(e.message); }
  }, [path]);
  useEffect(() => {
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), ms);
    const vis = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", vis); };
  }, [load, ms]);
  return { data, error, reload: load };
}

export function CheckInRow({ row }) {
  return (
    <li className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm">
      <div className="min-w-0">
        <p className="truncate font-medium">{row.guests?.full_name}</p>
        <p className="text-sm text-[#12332A]/60">
          {row.guests?.side === "bride" ? "Bride’s side" : "Groom’s side"}
          {row.profiles?.full_name ? `, by ${row.profiles.full_name}` : ""}
        </p>
      </div>
      <time className="ml-3 shrink-0 text-sm text-[#12332A]/70">{timeOf(row.checked_in_at)}</time>
    </li>
  );
}

export default function Home() {
  const { profile } = useAuth();
  const stats = useLive("/api/stats");
  const activity = useLive("/api/activity");
  const s = stats.data;
  const pct = s && s.total ? Math.round((s.checkedIn / s.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <section>
        <p className="text-[#12332A]/70">{greeting()}</p>
        <h1 className="text-4xl text-[#0B4D3A]" style={serif}>{profile.full_name}</h1>
      </section>

      <Link to="/usher/scan"
            className="flex min-h-[72px] items-center justify-center gap-3 rounded-3xl bg-[#0B4D3A] text-lg font-medium text-[#FBF8F1] shadow-md active:scale-[0.98] transition-transform motion-reduce:transition-none">
        <ScanLine size={26} /> Scan invitation
      </Link>
      <Link to="/usher/scan?lookup=1"
            className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border-2 border-[#C9A961] font-medium text-[#0B4D3A]">
        <Search size={20} /> Find guest by name
      </Link>

      <section aria-label="Today’s attendance" className="rounded-3xl bg-white p-5 shadow-sm">
        {s ? (
          <>
            <p className="text-[#12332A]/70">Checked in</p>
            <p className="text-5xl text-[#0B4D3A]" style={serif}>{s.checkedIn}<span className="text-2xl text-[#12332A]/50"> of {s.total}</span></p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#0B4D3A]/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-[#C9A961]" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-3 text-sm text-[#12332A]/70">
              {s.yetToArrive} yet to arrive. Bride’s side {s.bride}, groom’s side {s.groom}.
            </p>
          </>
        ) : stats.error ? (
          <p role="alert" className="text-sm text-[#8A1F1F]">{stats.error} <button onClick={stats.reload} className="underline">Retry</button></p>
        ) : <p className="text-[#12332A]/60">Loading attendance</p>}
      </section>

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-2xl text-[#0B4D3A]" style={serif}>Recent check-ins</h2>
          <Link to="/usher/activity" className="min-h-[44px] content-center text-sm text-[#0B4D3A] underline">See all</Link>
        </div>
        {activity.data?.length ? (
          <ul className="space-y-2">{activity.data.slice(0, 5).map((r) => <CheckInRow key={r.checked_in_at + r.guests?.full_name} row={r} />)}</ul>
        ) : (
          <p className="rounded-2xl bg-white px-4 py-6 text-center text-[#12332A]/60">
            {activity.error || (activity.data ? "No guests have checked in yet. Scan the first invitation to begin." : "Loading")}
          </p>
        )}
      </section>
    </div>
  );
}
