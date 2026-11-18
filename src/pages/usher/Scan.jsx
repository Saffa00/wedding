import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { AlertTriangle, Flashlight, FlashlightOff, Search, SwitchCamera, WifiOff, X } from "lucide-react";
import { api } from "../../lib/api";

const serif = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600 };
const sideLabel = (s) => (s === "bride" ? "Bride’s side" : "Groom’s side");
const timeOf = (iso) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

const cameraProblem = (e) => {
  const s = `${e?.name || ""} ${e?.message || e || ""}`;
  if (/NotAllowed|Permission/i.test(s)) return "denied";
  if (/NotFound|Overconstrained|no camera|device not found/i.test(s)) return "none";
  if (/NotReadable|TrackStart|in use/i.test(s)) return "busy";
  return "other";
};

const CAMERA_HELP = {
  denied: ["Camera access is blocked", "Allow camera access for this app, then try again. On iPhone: Settings > Safari > Camera. On Android: tap the lock icon by the address bar > Permissions > Camera."],
  none: ["No camera found", "This device has no usable camera. Use the name search to check guests in."],
  busy: ["Camera is in use", "Close other apps or tabs that are using the camera, then try again."],
  other: ["Camera could not start", "Check that the page is open over HTTPS, then try again."],
};

function useOnline() {
  const [on, setOn] = useState(navigator.onLine);
  useEffect(() => {
    const up = () => setOn(true), down = () => setOn(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);
  return on;
}

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
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/50" onClick={onClose}>
      <div className="max-h-[85vh] flex flex-col rounded-t-3xl bg-[#FBF8F1] p-5"
           style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.25rem)" }}
           onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Find guest by name">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-2xl text-[#0B4D3A]" style={serif}>Find a guest</h2>
          <button onClick={onClose} aria-label="Close" className="h-11 w-11 grid place-items-center"><X size={22} /></button>
        </div>
        <input autoFocus type="search" inputMode="search" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)}
               placeholder="Type at least 2 letters of the name"
               className="w-full min-h-[52px] rounded-2xl border border-[#0B4D3A]/20 bg-white px-4 text-base focus:outline-none focus:ring-2 focus:ring-[#C9A961]" />
        <ul className="mt-3 overflow-y-auto space-y-2">
          {rows.map((r) => (
            <li key={r.guestId}>
              <button disabled={!r.invitationId} onClick={() => onPick(r)}
                      className="w-full text-left rounded-2xl bg-white px-4 py-3 shadow-sm disabled:opacity-50 min-h-[56px]">
                <span className="block font-medium text-[#12332A]">{r.name}</span>
                <span className="block text-sm text-[#12332A]/70">
                  {sideLabel(r.side)}{r.table ? `, table ${r.table}` : ""}
                  {!r.invitationId ? ", no invitation issued" : r.status === "revoked" ? ", cancelled" : r.checkedInAt ? ", already checked in" : ""}
                </span>
              </button>
            </li>
          ))}
          {q.trim().length >= 2 && !rows.length && <li className="py-6 text-center text-[#12332A]/70">{msg || "No guests match that name."}</li>}
        </ul>
      </div>
    </div>
  );
}

/* ---------- main screen ---------- */

export default function Scan() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const online = useOnline();
  const scannerRef = useRef(null);
  const chain = useRef(Promise.resolve()); // serialises start/stop so React strict mode cannot overlap them
  const locked = useRef(false);            // blocks repeated detection of the same QR

  const [camState, setCamState] = useState("starting");
  const [camError, setCamError] = useState("other");
  const [cameras, setCameras] = useState([]);
  const [cameraId, setCameraId] = useState(null);
  const [torchOk, setTorchOk] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [phase, setPhase] = useState("scan"); // scan | checking | review | confirming | success | problem
  const [guest, setGuest] = useState(null);
  const [problem, setProblem] = useState("");
  const [lookupOpen, setLookupOpen] = useState(false);

  const onDecode = useCallback(async (text) => {
    if (locked.current) return;
    locked.current = true;
    try { scannerRef.current?.pause(true); } catch { /* not scanning */ }
    navigator.vibrate?.(30);
    setPhase("checking");
    try {
      const r = await api("/api/scan/verify", { method: "POST", body: { token: text } });
      setGuest({ name: r.guest_name, side: r.side, table: r.table_number, reference: r.reference,
                 state: r.result === "ready" ? "ready" : "already", checkedInAt: r.checked_in_at, token: text });
      setPhase("review");
    } catch (e) {
      const code = e.body?.result;
      setProblem(code === "revoked" ? "This invitation was cancelled. Do not admit this guest."
        : code === "invalid" ? "This QR code is not a valid invitation." : e.message);
      setPhase("problem");
    }
  }, []);

  const startCamera = useCallback((id) => {
    chain.current = chain.current.then(async () => {
      setCamState("starting"); setTorchOn(false); setTorchOk(false);
      try {
        if (!scannerRef.current) scannerRef.current = new Html5Qrcode("qr-reader", { verbose: false });
        const s = scannerRef.current;
        if (s.isScanning) await s.stop();
        await s.start(
          id ? { deviceId: { exact: id } } : { facingMode: "environment" },
          { fps: 10, qrbox: (w, h) => { const m = Math.floor(Math.min(w, h) * 0.7); return { width: m, height: m }; } },
          onDecode, () => {}
        );
        setCamState("ready");
        try { setCameraId(s.getRunningTrackSettings().deviceId || null); } catch { /* optional */ }
        try { setTorchOk(!!s.getRunningTrackCapabilities().torchFeature().isSupported()); } catch { setTorchOk(false); }
        setCameras(await Html5Qrcode.getCameras().catch(() => []));
      } catch (e) {
        setCamError(cameraProblem(e));
        setCamState("error");
      }
    });
  }, [onDecode]);

  useEffect(() => {
    startCamera(null);
    return () => { // stop the camera whenever the user leaves the scanner
      chain.current = chain.current.then(async () => {
        const s = scannerRef.current;
        if (s?.isScanning) { try { await s.stop(); } catch { /* already stopped */ } }
        try { s?.clear(); } catch { /* nothing to clear */ }
        scannerRef.current = null;
      });
    };
  }, [startCamera]);

  const toggleTorch = async () => {
    try {
      await scannerRef.current.getRunningTrackCapabilities().torchFeature().apply(!torchOn);
      setTorchOn((t) => !t);
    } catch { setTorchOk(false); }
  };

  const switchCamera = () => {
    if (cameras.length < 2) return;
    const i = cameras.findIndex((c) => c.id === cameraId);
    startCamera(cameras[(i + 1) % cameras.length].id);
  };

  const scanNext = () => {
    setGuest(null); setProblem(""); setPhase("scan");
    locked.current = false;
    try { scannerRef.current?.resume(); } catch { /* not paused */ }
  };

  const openLookup = () => {
    locked.current = true;
    try { scannerRef.current?.pause(true); } catch { /* not scanning */ }
    setLookupOpen(true);
  };
  useEffect(() => { if (params.get("lookup") === "1") openLookup(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const closeLookup = () => { setLookupOpen(false); if (phase === "scan") scanNext(); };

  const pick = (r) => {
    setLookupOpen(false);
    setGuest({ name: r.name, side: r.side, table: r.table, reference: r.reference, invitationId: r.invitationId,
               state: r.status === "revoked" ? "revoked" : r.checkedInAt ? "already" : "ready", checkedInAt: r.checkedInAt });
    setPhase("review");
  };

  const confirm = async () => {
    setPhase("confirming");
    const byToken = !!guest.token;
    try {
      await api(byToken ? "/api/scan/check-in" : "/api/scan/check-in-manual", {
        method: "POST", body: byToken ? { token: guest.token } : { invitationId: guest.invitationId },
      });
      navigator.vibrate?.([40, 60, 40]);
      setPhase("success");
    } catch (e) {
      if (e.body?.result === "already_checked_in") {
        setGuest((g) => ({ ...g, state: "already", checkedInAt: e.body.checked_in_at }));
        setPhase("review");
      } else {
        setProblem(e.body?.result === "revoked" ? "This invitation was cancelled. Do not admit this guest." : e.message);
        setPhase("problem");
      }
    }
  };

  const btn = "w-full min-h-[56px] rounded-2xl font-medium text-base active:scale-[0.98] transition-transform motion-reduce:transition-none";
  const round = "h-12 w-12 grid place-items-center rounded-full bg-black/45 text-white";

  return (
    <div className="fixed inset-0 bg-black text-white overflow-hidden">
      <style>{`
        #qr-reader{width:100%;height:100%} #qr-reader video{object-fit:cover;width:100%!important;height:100%!important}
        #qr-reader__scan_region{height:100%} #qr-shaded-region{display:none!important}
        @keyframes draw{to{stroke-dashoffset:0}} @keyframes pop{0%{transform:scale(.6);opacity:0}100%{transform:scale(1);opacity:1}}
        @media (prefers-reduced-motion:reduce){.anim{animation:none!important;stroke-dashoffset:0!important}}
      `}</style>

      <div id="qr-reader" />

      {/* frame + instructions */}
      {camState === "ready" && phase === "scan" && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="relative h-[70vmin] w-[70vmin] max-h-80 max-w-80">
            {["top-0 left-0 border-t-4 border-l-4 rounded-tl-3xl", "top-0 right-0 border-t-4 border-r-4 rounded-tr-3xl",
              "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-3xl", "bottom-0 right-0 border-b-4 border-r-4 rounded-br-3xl"]
              .map((c) => <span key={c} className={`absolute h-12 w-12 border-[#C9A961] ${c}`} />)}
          </div>
          <p className="absolute bottom-40 px-8 text-center text-base drop-shadow">Position the QR code inside the frame</p>
        </div>
      )}

      {/* top bar */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4"
           style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}>
        <button onClick={() => navigate("/usher")} aria-label="Close scanner" className={round}><X size={22} /></button>
        <div className="flex gap-3">
          {torchOk && (
            <button onClick={toggleTorch} aria-label={torchOn ? "Turn torch off" : "Turn torch on"} aria-pressed={torchOn} className={round}>
              {torchOn ? <FlashlightOff size={22} /> : <Flashlight size={22} />}
            </button>
          )}
          {cameras.length > 1 && (
            <button onClick={switchCamera} aria-label="Switch camera" className={round}><SwitchCamera size={22} /></button>
          )}
        </div>
      </div>

      {!online && (
        <div role="status" className="absolute inset-x-4 top-24 flex items-center gap-2 rounded-2xl bg-[#8A1F1F] px-4 py-3 text-sm">
          <WifiOff size={18} /> You are offline. Check-ins need a connection.
        </div>
      )}

      {/* bottom action */}
      {phase === "scan" && (
        <div className="absolute inset-x-0 bottom-0 px-5" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.25rem)" }}>
          <button onClick={openLookup} className={`${btn} bg-white/95 text-[#0B4D3A] flex items-center justify-center gap-2`}>
            <Search size={20} /> Find guest by name
          </button>
        </div>
      )}

      {/* camera problems */}
      {camState === "error" && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-[#FBF8F1] px-8 text-[#12332A]">
          <div className="max-w-sm text-center space-y-4">
            <AlertTriangle className="mx-auto text-[#C9A961]" size={40} />
            <h1 className="text-3xl text-[#0B4D3A]" style={serif}>{CAMERA_HELP[camError][0]}</h1>
            <p className="text-[#12332A]/75">{CAMERA_HELP[camError][1]}</p>
            {camError !== "none" && <button onClick={() => startCamera(null)} className={`${btn} bg-[#0B4D3A] text-[#FBF8F1]`}>Try again</button>}
            <button onClick={openLookup} className={`${btn} border-2 border-[#C9A961] text-[#0B4D3A]`}>Find guest by name</button>
            <button onClick={() => navigate("/usher")} className="min-h-[44px] text-[#0B4D3A]/70">Back</button>
          </div>
        </div>
      )}

      {phase === "checking" && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/60" role="status">
          <div className="h-10 w-10 rounded-full border-4 border-[#C9A961] border-t-transparent animate-spin motion-reduce:animate-none" />
        </div>
      )}

      {/* verification screen */}
      {(phase === "review" || phase === "confirming") && guest && (
        <div className="absolute inset-0 z-30 flex flex-col justify-end bg-black/50">
          <div className="rounded-t-3xl bg-[#FBF8F1] p-6 text-[#12332A]"
               style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)" }}>
            <h1 className="text-4xl text-[#0B4D3A]" style={serif}>{guest.name}</h1>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              {[["Side", sideLabel(guest.side)], ["Table", guest.table ?? "Not assigned"], ["Reference", guest.reference],
                ["Status", guest.state === "ready" ? "Not checked in" : guest.state === "revoked" ? "Cancelled"
                  : `Checked in at ${timeOf(guest.checkedInAt)}`]].map(([k, v]) => (
                <div key={k} className="rounded-2xl bg-white p-3 shadow-sm">
                  <dt className="text-[#12332A]/60">{k}</dt><dd className="mt-0.5 text-base font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            {guest.state === "already" && <p role="alert" className="mt-4 rounded-xl bg-[#FFF4D6] px-4 py-3 text-sm">This guest has already been checked in. Do not check them in again.</p>}
            {guest.state === "revoked" && <p role="alert" className="mt-4 rounded-xl bg-[#FBEAEA] px-4 py-3 text-sm text-[#8A1F1F]">This invitation was cancelled. Do not admit this guest.</p>}
            <div className="mt-5 space-y-3">
              {guest.state === "ready" && (
                <button onClick={confirm} disabled={phase === "confirming"} className={`${btn} bg-[#0B4D3A] text-[#FBF8F1] disabled:opacity-60`}>
                  {phase === "confirming" ? "Confirming" : "Confirm attendance"}
                </button>
              )}
              <button onClick={scanNext} className={`${btn} ${guest.state === "ready" ? "text-[#0B4D3A]" : "bg-[#0B4D3A] text-[#FBF8F1]"}`}>
                {guest.state === "ready" ? "Cancel" : "Scan next guest"}
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === "problem" && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-[#FBF8F1] px-8 text-[#12332A]">
          <div className="max-w-sm text-center space-y-5">
            <AlertTriangle className="mx-auto text-[#8A1F1F]" size={44} />
            <p className="text-xl" style={serif}>{problem}</p>
            <button onClick={scanNext} className={`${btn} bg-[#0B4D3A] text-[#FBF8F1]`}>Scan again</button>
          </div>
        </div>
      )}

      {phase === "success" && guest && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-[#0B4D3A] px-8 text-center text-[#FBF8F1]" role="status">
          <div className="space-y-4">
            <svg viewBox="0 0 100 100" className="mx-auto h-32 w-32 anim" style={{ animation: "pop .35s ease-out both" }} aria-hidden="true">
              <circle cx="50" cy="50" r="44" fill="none" stroke="#C9A961" strokeWidth="5" />
              <path d="M30 52 l15 15 26 -30" fill="none" stroke="#C9A961" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"
                    className="anim" strokeDasharray="70" strokeDashoffset="70" style={{ animation: "draw .45s .25s ease-out forwards" }} />
            </svg>
            <h1 className="text-4xl" style={serif}>Welcome, {guest.name}</h1>
            <p className="text-lg opacity-90">Table {guest.table ?? "not assigned"}, {sideLabel(guest.side)}</p>
            <button onClick={scanNext} className={`${btn} mt-6 bg-[#C9A961] text-[#12332A]`}>Scan next guest</button>
          </div>
        </div>
      )}

      {lookupOpen && <LookupSheet onClose={closeLookup} onPick={pick} />}
    </div>
  );
}
