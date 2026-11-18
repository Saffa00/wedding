import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, Image, RefreshCw, Search, X } from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

const serif = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600 };
const sideLabel = (s) => (s === "bride" ? "Bride's side" : "Groom's side");
const timeOf = (iso) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/* ---------- manual lookup sheet ---------- */
function LookupSheet({ onClose, onPick }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (q.trim().length < 2) { setRows([]); setMsg(""); return; }
    const t = setTimeout(async () => {
      try { setRows(await api(`/api/guests/search?q=${encodeURIComponent(q.trim())}`)); setMsg(""); }
      catch (e) { setRows([]); setMsg(e.message); }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/60" onClick={onClose}>
      <div
        className="max-h-[85vh] flex flex-col rounded-t-3xl bg-[#FBF8F1] p-5 shadow-2xl"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.25rem)" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Find guest by name"
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-2xl text-[#0B4D3A]" style={serif}>Find a guest</h2>
            <p className="text-xs text-[#12332A]/60">Search by name or reference code (e.g. WED-...)</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="h-11 w-11 grid place-items-center text-[#12332A]/70">
            <X size={22} />
          </button>
        </div>
        <input
          autoFocus
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Type a name..."
          className="w-full rounded-2xl border border-[#0B4D3A]/20 bg-white px-4 py-3 text-base text-[#12332A] outline-none focus:ring-2 focus:ring-[#C9A961]"
        />
        {msg && <p className="mt-2 text-xs text-red-600">{msg}</p>}
        <div className="mt-3 flex-1 overflow-y-auto space-y-2">
          {rows.length === 0 && q.trim().length >= 2 && !msg && (
            <p className="text-center text-sm text-[#12332A]/50 py-6">No guests found</p>
          )}
          {rows.map((r) => (
            <button
              key={r.invitationId || r.reference}
              onClick={() => onPick(r)}
              className="w-full text-left rounded-2xl bg-white border border-[#0B4D3A]/10 px-4 py-3 shadow-sm active:bg-[#FFF4D6] transition-colors"
            >
              <p className="font-semibold text-[#12332A]">{r.name}</p>
              <p className="text-xs text-[#12332A]/60 mt-0.5">
                {sideLabel(r.side)}{r.table ? ` · Table ${r.table}` : ""}{r.reference ? ` · ${r.reference}` : ""}
                {r.checkedInAt ? " · ✓ Checked in" : ""}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   MAIN COMPONENT — Native camera only, no getUserMedia
   ============================================================ */
export default function Scan() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [params] = useSearchParams();

  const scannerRef = useRef(null);        // Html5Qrcode instance for file decode
  const captureInputRef = useRef(null);   // <input capture="environment">
  const fileInputRef = useRef(null);      // <input> photo library

  const [phase, setPhase] = useState("idle"); // idle | scanning | checking | review | confirming | success | problem
  const [guest, setGuest] = useState(null);
  const [problem, setProblem] = useState("");
  const [lookupOpen, setLookupOpen] = useState(false);

  const handleExit = () => navigate(profile?.role === "admin" ? "/admin" : "/usher");

  // Open lookup if ?lookup=1 in URL
  useEffect(() => {
    if (params.get("lookup") === "1") setLookupOpen(true);
  }, []); // eslint-disable-line

  /* ---- API verify ---- */
  const onDecode = useCallback(async (text) => {
    setPhase("checking");
    try {
      const r = await api("/api/scan/verify", { method: "POST", body: { token: text } });
      setGuest({
        name: r.guest_name, side: r.side, table: r.table_number, reference: r.reference,
        state: r.result === "ready" ? "ready" : "already",
        checkedInAt: r.checked_in_at, token: text,
      });
      setPhase("review");
    } catch (e) {
      const code = e.body?.result;
      setProblem(
        code === "revoked" ? "This invitation was cancelled. Do not admit this guest."
        : code === "invalid" ? "This QR code is not recognized as a valid invitation."
        : e.message || "Could not verify this QR code."
      );
      setPhase("problem");
    }
  }, []);

  /* ---- decode image file via Html5Qrcode ---- */
  const decodeFile = async (file) => {
    if (!file) return;
    setPhase("scanning");
    try {
      // Create a hidden container for Html5Qrcode if needed
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode("qr-file-helper", { verbose: false });
      }
      const decoded = await scannerRef.current.scanFile(file, false);
      try { scannerRef.current.clear(); } catch {}
      onDecode(decoded);
    } catch (err) {
      console.warn("QR decode error:", err);
      setProblem("No QR code found in that photo. Make sure the QR code fills the frame and is well-lit.");
      setPhase("problem");
    } finally {
      if (captureInputRef.current) captureInputRef.current.value = "";
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFileChange = (e) => decodeFile(e.target.files?.[0]);

  /* ---- confirm check-in ---- */
  const confirm = async () => {
    setPhase("confirming");
    const byToken = !!guest.token;
    try {
      await api(byToken ? "/api/scan/check-in" : "/api/scan/check-in-manual", {
        method: "POST",
        body: byToken ? { token: guest.token } : { invitationId: guest.invitationId },
      });
      navigator.vibrate?.([40, 60, 40]);
      setPhase("success");
      setTimeout(() => { setGuest(null); setProblem(""); setPhase("idle"); }, 3000);
    } catch (e) {
      setProblem(e.body?.result === "revoked" ? "This invitation was cancelled. Do not admit this guest." : (e.message || "Check-in failed."));
      setPhase("problem");
    }
  };

  const reset = () => { setGuest(null); setProblem(""); setPhase("idle"); };

  /* ---- lookup pick ---- */
  const pick = (r) => {
    setLookupOpen(false);
    setGuest({
      name: r.name, side: r.side, table: r.table, reference: r.reference,
      invitationId: r.invitationId,
      state: r.status === "revoked" ? "revoked" : r.checkedInAt ? "already" : "ready",
      checkedInAt: r.checkedInAt,
    });
    setPhase("review");
  };

  const btn = "w-full min-h-[56px] rounded-2xl font-semibold text-base active:scale-[0.98] transition-transform motion-reduce:transition-none flex items-center justify-center gap-2.5 shadow-md";

  /* ======================================================
     IDLE — main scan screen
  ====================================================== */
  if (phase === "idle") {
    return (
      <div
        className="fixed inset-0 bg-[#FBF8F1] flex flex-col"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
      >
        {/* Hidden file helper */}
        <div id="qr-file-helper" className="hidden" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <button onClick={handleExit} aria-label="Back" className="h-11 w-11 grid place-items-center rounded-full bg-black/8 text-[#12332A]">
            <X size={22} />
          </button>
          <h1 className="text-xl text-[#0B4D3A] font-semibold" style={serif}>Scan Guest QR</h1>
          <div className="w-11" />
        </div>

        {/* Illustration area */}
        <div className="flex-1 flex flex-col items-center justify-center px-8 gap-6">
          {/* Camera icon circle */}
          <div className="h-32 w-32 rounded-full bg-[#0B4D3A] grid place-items-center shadow-xl">
            <Camera size={56} className="text-[#C9A961]" />
          </div>

          <div className="text-center space-y-2">
            <h2 className="text-3xl text-[#0B4D3A]" style={serif}>Ready to scan</h2>
            <p className="text-sm text-[#12332A]/65 leading-relaxed max-w-xs">
              Tap <strong>Open Camera</strong> to point your phone at a guest's QR code and take a photo — it will be verified instantly.
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="px-5 space-y-3">
          {/* PRIMARY — open native camera */}
          <label className={`${btn} bg-[#0B4D3A] text-[#FBF8F1] cursor-pointer`} aria-label="Open camera to scan QR">
            <Camera size={22} />
            Open Camera to Scan QR
            <input
              ref={captureInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>

          {/* SECONDARY — photo library */}
          <label className={`${btn} bg-white border-2 border-[#C9A961] text-[#0B4D3A] cursor-pointer`} aria-label="Choose QR from photo library">
            <Image size={20} />
            Choose from Photo Library
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>

          {/* TERTIARY — name search */}
          <button
            onClick={() => setLookupOpen(true)}
            className={`${btn} bg-[#FBF8F1] border border-[#0B4D3A]/20 text-[#0B4D3A]`}
          >
            <Search size={20} />
            Find Guest by Name
          </button>

          <button onClick={handleExit} className="w-full text-center text-sm text-[#0B4D3A]/50 py-2">
            Back to Dashboard
          </button>
        </div>

        {lookupOpen && <LookupSheet onClose={() => setLookupOpen(false)} onPick={pick} />}
      </div>
    );
  }

  /* ======================================================
     SCANNING — processing photo
  ====================================================== */
  if (phase === "scanning" || phase === "checking") {
    return (
      <div className="fixed inset-0 bg-[#FBF8F1] grid place-items-center">
        <div id="qr-file-helper" className="hidden" />
        <div className="flex flex-col items-center gap-4 px-8 text-center">
          <div className="h-14 w-14 rounded-full border-4 border-[#C9A961] border-t-transparent animate-spin" />
          <p className="text-xl text-[#0B4D3A] font-semibold" style={serif}>
            {phase === "scanning" ? "Reading QR code…" : "Verifying invitation…"}
          </p>
          <p className="text-sm text-[#12332A]/60">Please wait</p>
        </div>
      </div>
    );
  }

  /* ======================================================
     REVIEW — show guest details
  ====================================================== */
  if (phase === "review" || phase === "confirming") {
    return (
      <div className="fixed inset-0 bg-[#FBF8F1] flex flex-col"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)" }}
      >
        <div id="qr-file-helper" className="hidden" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <button onClick={reset} aria-label="Cancel" className="h-11 w-11 grid place-items-center rounded-full bg-black/8 text-[#12332A]">
            <X size={22} />
          </button>
          <h1 className="text-lg text-[#0B4D3A] font-semibold" style={serif}>Guest Details</h1>
          <div className="w-11" />
        </div>

        <div className="flex-1 overflow-y-auto px-5 pt-4">
          {/* Name banner */}
          <div className={`rounded-3xl p-6 mb-5 text-center shadow-sm ${
            guest.state === "ready" ? "bg-[#0B4D3A] text-[#FBF8F1]"
            : guest.state === "already" ? "bg-[#FFF4D6] text-[#6B4E00]"
            : "bg-[#FBEAEA] text-[#8A1F1F]"
          }`}>
            <p className="text-xs uppercase tracking-widest opacity-70 mb-1">
              {guest.state === "ready" ? "Ready to admit" : guest.state === "already" ? "Already checked in" : "Invitation cancelled"}
            </p>
            <h2 className="text-4xl" style={serif}>{guest.name}</h2>
          </div>

          {/* Details grid */}
          <dl className="grid grid-cols-2 gap-3 text-sm mb-5">
            {[
              ["Side", sideLabel(guest.side)],
              ["Table", guest.table ? `Table ${guest.table}` : "Not assigned"],
              ...(guest.reference ? [["Reference", guest.reference]] : []),
              ...(guest.checkedInAt ? [["Checked in", timeOf(guest.checkedInAt)]] : []),
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-white p-4 shadow-sm border border-[#0B4D3A]/5">
                <dt className="text-xs text-[#12332A]/55">{k}</dt>
                <dd className="mt-1 text-base font-semibold text-[#12332A]">{v}</dd>
              </div>
            ))}
          </dl>

          {guest.state === "already" && (
            <div role="alert" className="rounded-2xl bg-[#FFF4D6] px-4 py-3 text-sm text-[#6B4E00] font-medium mb-4 border border-[#C9A961]/30">
              ⚠️ This guest has already been checked in. Do not admit a duplicate QR code.
            </div>
          )}
          {guest.state === "revoked" && (
            <div role="alert" className="rounded-2xl bg-[#FBEAEA] px-4 py-3 text-sm text-[#8A1F1F] font-medium mb-4 border border-red-200">
              ⛔ This invitation was cancelled. Do not admit this guest.
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 space-y-2.5">
          {guest.state === "ready" && (
            <button
              onClick={confirm}
              disabled={phase === "confirming"}
              className={`${btn} bg-[#0B4D3A] text-[#FBF8F1] disabled:opacity-60`}
            >
              {phase === "confirming" ? (
                <><div className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" /> Confirming...</>
              ) : "✓ Confirm Check-in"}
            </button>
          )}
          <button
            onClick={reset}
            className={`${btn} ${guest.state === "ready" ? "bg-white border border-[#0B4D3A]/20 text-[#0B4D3A]" : "bg-[#0B4D3A] text-[#FBF8F1]"}`}
          >
            {guest.state === "ready" ? "Cancel" : "Scan Next Guest"}
          </button>
        </div>
      </div>
    );
  }

  /* ======================================================
     SUCCESS
  ====================================================== */
  if (phase === "success") {
    return (
      <div className="fixed inset-0 bg-[#0B4D3A] grid place-items-center px-8 text-center text-[#FBF8F1]" role="status">
        <div id="qr-file-helper" className="hidden" />
        <div className="space-y-5">
          <svg viewBox="0 0 100 100" className="mx-auto h-28 w-28" aria-hidden="true"
            style={{ animation: "pop .35s ease-out both" }}>
            <circle cx="50" cy="50" r="44" fill="none" stroke="#C9A961" strokeWidth="5" />
            <path d="M30 52 l15 15 26 -30" fill="none" stroke="#C9A961" strokeWidth="6"
              strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray="70" strokeDashoffset="70"
              style={{ animation: "draw .45s .25s ease-out forwards" }} />
          </svg>
          <div>
            <h1 className="text-4xl" style={serif}>Welcome!</h1>
            <p className="text-2xl mt-1 text-[#C9A961]" style={serif}>{guest?.name}</p>
          </div>
          <p className="text-base opacity-80">
            {guest?.table ? `Table ${guest.table}` : "No table assigned"} · {sideLabel(guest?.side)}
          </p>
          <button onClick={reset} className={`${btn} bg-[#C9A961] text-[#12332A] mt-4`}>
            Scan Next Guest
          </button>
        </div>
        <style>{`
          @keyframes draw { to { stroke-dashoffset: 0 } }
          @keyframes pop { 0% { transform: scale(.6); opacity: 0 } 100% { transform: scale(1); opacity: 1 } }
        `}</style>
      </div>
    );
  }

  /* ======================================================
     PROBLEM
  ====================================================== */
  if (phase === "problem") {
    return (
      <div className="fixed inset-0 bg-[#FBF8F1] flex flex-col items-center justify-center px-8 text-center"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)" }}
      >
        <div id="qr-file-helper" className="hidden" />
        <div className="max-w-sm w-full space-y-5">
          <div className="mx-auto h-20 w-20 rounded-full bg-[#FBEAEA] grid place-items-center text-[#8A1F1F]">
            <X size={36} />
          </div>
          <div>
            <h1 className="text-3xl text-[#0B4D3A] mb-2" style={serif}>Could not verify</h1>
            <p className="text-sm text-[#12332A]/75 leading-relaxed">{problem}</p>
          </div>
          <div className="space-y-2.5 w-full">
            {/* Re-open camera */}
            <label className={`${btn} bg-[#0B4D3A] text-[#FBF8F1] cursor-pointer`}>
              <Camera size={20} />
              Try Camera Again
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => { reset(); setTimeout(() => handleFileChange(e), 50); }}
              />
            </label>
            <label className={`${btn} border-2 border-[#C9A961] text-[#0B4D3A] bg-white cursor-pointer`}>
              <Image size={18} />
              Choose from Photos
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { reset(); setTimeout(() => handleFileChange(e), 50); }}
              />
            </label>
            <button onClick={() => { reset(); setLookupOpen(true); }}
              className={`${btn} bg-white border border-[#0B4D3A]/20 text-[#0B4D3A]`}>
              <Search size={18} />
              Find Guest by Name
            </button>
            <button onClick={reset} className="w-full text-sm text-[#0B4D3A]/50 py-2 underline">
              Back to Scanner
            </button>
          </div>
        </div>
        {lookupOpen && <LookupSheet onClose={() => setLookupOpen(false)} onPick={pick} />}
      </div>
    );
  }

  return null;
}
