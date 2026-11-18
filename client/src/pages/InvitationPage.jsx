import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Camera, CheckCircle2, Download, ExternalLink, Printer, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

const serif = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600 };
const sideLabel = (s) => (s === "bride" ? "Bride’s side" : "Groom’s side");

function Message({ title, body, onRetry }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#FBF8F1] px-8 text-center text-[#12332A]">
      <div className="max-w-sm space-y-4">
        <h1 className="text-3xl text-[#0B4D3A]" style={serif}>{title}</h1>
        <p className="text-[#12332A]/75">{body}</p>
        {onRetry && <button onClick={onRetry} className="min-h-[52px] w-full rounded-2xl bg-[#0B4D3A] font-medium text-[#FBF8F1]">Try again</button>}
      </div>
    </main>
  );
}

export default function InvitationPage() {
  const { token } = useParams();
  const { profile } = useAuth();
  const [state, setState] = useState({ status: "loading" });
  const [admitting, setAdmitting] = useState(false);
  const [admitMsg, setAdmitMsg] = useState("");

  const handleUsherCheckIn = async () => {
    setAdmitting(true);
    setAdmitMsg("");
    try {
      const cleanToken = (token || "").trim().replace(/[.,;!?)>]+$/, "");
      await api("/api/scan/check-in", {
        method: "POST",
        body: { token: cleanToken },
      });
      setState((prev) => ({
        ...prev,
        data: { ...prev.data, checkedIn: true },
      }));
      setAdmitMsg("Guest admitted successfully!");
    } catch (e) {
      setAdmitMsg(e.message || "Could not check in guest.");
    } finally {
      setAdmitting(false);
    }
  };

  const load = useCallback(async (signal) => {
    setState({ status: "loading" });
    try {
      // Public endpoint: no login and no auth header
      const baseUrl = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
      const cleanToken = (token || "").trim().replace(/[.,;!?)>]+$/, "");
      const res = await fetch(`${baseUrl}/api/public/invitation/${encodeURIComponent(cleanToken)}`, { cache: "no-store", signal });
      const json = await res.json().catch(() => ({}));
      if (res.status === 404) return setState({ status: "invalid", error: json.error });
      if (!res.ok) throw new Error(json.error || `Server returned error (${res.status})`);
      if (!json.qr) throw new Error("QR code image is missing from server response.");
      setState({ status: "ready", data: json });
    } catch (e) {
      if (e.name !== "AbortError") setState({ status: "error", message: e.message });
    }
  }, [token]);

  useEffect(() => {
    const c = new AbortController();
    load(c.signal);
    return () => c.abort();
  }, [load]);

  // Private page: keep it out of search engines and out of referrer headers
  useEffect(() => {
    const robots = document.createElement("meta");
    robots.name = "robots"; robots.content = "noindex, nofollow";
    const ref = document.createElement("meta");
    ref.name = "referrer"; ref.content = "no-referrer";
    document.head.append(robots, ref);
    return () => { robots.remove(); ref.remove(); };
  }, []);

  if (state.status === "loading") {
    return (
      <div className="fixed inset-0 grid place-items-center bg-[#FBF8F1]">
        <div role="status" aria-label="Loading invitation" className="h-10 w-10 animate-spin rounded-full border-4 border-[#C9A961] border-t-transparent motion-reduce:animate-none" />
      </div>
    );
  }
  if (state.status === "invalid") {
    return <Message title="Invitation not found" body={state.error || "This invitation link is not valid, or it has been replaced or cancelled. Please contact the hosts for a new one."} />;
  }
  if (state.status === "error") {
    return <Message title="Could not load invitation" body={state.message || "Please check your internet connection and try again. If the server is starting up, please wait a moment."} onRetry={() => load()} />;
  }

  const d = state.data;
  const when = new Date(d.eventDate);
  const tz = d.timezone || undefined; // venue time zone, so guests abroad see the venue's local time
  const date = when.toLocaleDateString(undefined, { timeZone: tz, weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const time = when.toLocaleTimeString([], { timeZone: tz, hour: "numeric", minute: "2-digit" });

  return (
    <main className="min-h-screen bg-[#FBF8F1] px-5 py-6 text-[#12332A] print:min-h-0 print:p-0"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1.25rem)", paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 2rem)" }}>
      <style>{`@page{size:A5;margin:12mm}@media print{body{background:#fff}}`}</style>

      {/* Top Header Bar */}
      <header className="mx-auto max-w-md flex items-center justify-between pb-4 print:hidden">
        <span className="text-xl font-bold tracking-widest text-[#0B4D3A]" style={serif}>
          BERCHELLE
        </span>
        <Link
          to={profile ? (profile.role === "admin" ? "/admin" : "/usher") : "/login"}
          className="text-xs font-semibold px-3 py-1.5 rounded-full bg-[#0B4D3A] text-[#FBF8F1] flex items-center gap-1.5 shadow-sm active:scale-95"
        >
          <Camera size={13} /> {profile ? "Open Scanner App" : "Staff Check-in"}
        </Link>
      </header>

      {/* Staff Usher Direct Check-in Banner */}
      {profile && (
        <div className="mx-auto mb-4 max-w-md rounded-2xl bg-[#0B4D3A] p-4 text-[#FBF8F1] shadow-lg print:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="text-[#C9A961]" size={18} />
              <span className="text-xs font-semibold uppercase tracking-wider text-[#C9A961]">
                Staff Check-in Mode ({profile.role})
              </span>
            </div>
            <Link to="/usher/scan" className="text-xs underline text-[#FBF8F1]/80 hover:text-white flex items-center gap-1">
              <Camera size={13} /> Camera
            </Link>
          </div>
          <div className="mt-3">
            {d.checkedIn ? (
              <div className="rounded-xl bg-[#12332A] px-3 py-2.5 text-center text-sm font-medium text-[#C9A961] flex items-center justify-center gap-2">
                <CheckCircle2 size={16} /> Guest already admitted
              </div>
            ) : (
              <button
                onClick={handleUsherCheckIn}
                disabled={admitting}
                className="w-full min-h-[46px] rounded-xl bg-[#C9A961] text-[#0B4D3A] font-bold text-sm flex items-center justify-center gap-2 shadow active:scale-95 disabled:opacity-60"
              >
                {admitting ? "Checking In..." : `Admit ${d.guestName} Now`}
              </button>
            )}
            {admitMsg && <p className="mt-2 text-center text-xs text-[#FFF4D6]">{admitMsg}</p>}
          </div>
        </div>
      )}

      <article className="mx-auto max-w-md rounded-[2rem] border border-[#C9A961] bg-white p-1.5 shadow-[0_10px_40px_rgba(11,77,58,0.10)] print:shadow-none">
        <div className="rounded-[1.6rem] border border-[#C9A961]/50 px-6 py-10 text-center">
          <p className="text-[#12332A]/70">You are invited to the wedding of</p>
          <h1 className="mt-3 text-5xl leading-tight text-[#0B4D3A]" style={serif}>
            {d.brideName}<span className="block text-3xl text-[#C9A961]">and</span>{d.groomName}
          </h1>
          <p className="mt-6 text-lg">{date}</p>
          <p className="text-[#12332A]/80">{time}</p>
          <p className="mt-1 text-[#12332A]/80">{d.venue}</p>

          <hr className="mx-auto my-8 w-16 border-[#C9A961]" />

          <p className="text-[#12332A]/70">Invitation for</p>
          <p className="mt-1 text-3xl text-[#0B4D3A]" style={serif}>{d.guestName}</p>
          <p className="mt-1 text-[#12332A]/80">{sideLabel(d.side)}, {d.table ? `table ${d.table}` : "table to be confirmed"}</p>

          <img src={d.qr} alt={`Entry QR code for ${d.guestName}`} width="192" height="192" className="mx-auto mt-6 h-48 w-48 rounded-2xl border border-[#0B4D3A]/10" />
          <p className="mt-3 text-sm text-[#12332A]/70">Show this code at the entrance</p>
          <p className="mt-1 text-sm font-medium tracking-wide">{d.reference}</p>
        </div>
      </article>

      <div className="mx-auto mt-6 max-w-md space-y-3 print:hidden">
        <button onClick={() => window.print()} className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-[#0B4D3A] font-medium text-[#FBF8F1]">
          <Printer size={20} />Print or save as PDF
        </button>
        <a href={d.qr} download={`invitation-${d.reference}.png`} className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-[#C9A961] font-medium text-[#0B4D3A]">
          <Download size={20} />Save QR code image
        </a>

        {/* Mobile / PWA Info */}
        <div className="rounded-2xl border border-[#C9A961]/30 bg-white/70 p-4 text-center text-xs text-[#12332A]/70 space-y-1">
          <p className="font-semibold text-[#0B4D3A]">Using on iPhone or Android?</p>
          <p>
            Tap the browser <strong>Share</strong> button and choose <strong>"Add to Home Screen"</strong> to open Berchelle as a standalone app icon.
          </p>
        </div>

        <p className="text-center text-sm text-[#12332A]/60">Keep this page or a screenshot of the QR code ready on the day. The guest list is checked at the door.</p>
      </div>
    </main>
  );
}
