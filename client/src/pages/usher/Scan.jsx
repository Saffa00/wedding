import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { AlertTriangle, Camera, Check, Flashlight, FlashlightOff, Image, RefreshCw, Search, SwitchCamera, WifiOff, X } from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

const serif = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600 };
const sideLabel = (s) => (s === "bride" ? "Bride’s side" : "Groom’s side");
const timeOf = (iso) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

const cameraProblem = (e) => {
  const s = `${e?.name || ""} ${e?.message || e || ""}`;
  if (/NotAllowed|Permission|denied|allowed by the user agent/i.test(s)) return "denied";
  if (/NotFound|no camera|device not found|Requested device not found/i.test(s)) return "none";
  if (/NotReadable|TrackStart|in use|could not start video source/i.test(s)) return "busy";
  return "other";
};

const CAMERA_HELP = {
  denied: [
    "Camera Access is Blocked",
    "Camera permission was denied. On iPhone: tap the 'aA' or lock/settings icon in the Safari address bar > Website Settings > Camera > Allow, then tap 'Try Again'.",
  ],
  none: [
    "No Camera Detected",
    "No usable camera feed was found. You can snap a photo of the QR code or search by guest name below.",
  ],
  busy: [
    "Camera is In Use",
    "Another app or browser tab is using the camera. Close other apps and tap 'Try Again'.",
  ],
  other: [
    "Camera Permission Needed",
    "Ensure your browser allows camera access. You can also take a photo or search by guest name.",
  ],
};

function useOnline() {
  const [on, setOn] = useState(navigator.onLine);
  useEffect(() => {
    const up = () => setOn(true), down = () => setOn(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  return on;
}

/* ---------- manual lookup sheet ---------- */

function LookupSheet({ onClose, onPick }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (q.trim().length < 2) {
      setRows([]);
      setMsg("");
      return;
    }
    const t = setTimeout(async () => {
      try {
        setRows(await api(`/api/guests/search?q=${encodeURIComponent(q.trim())}`));
        setMsg("");
      } catch (e) {
        setRows([]);
        setMsg(e.message);
      }
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
        aria-label="Find guest by name or reference"
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
          inputMode="search"
          autoComplete="off"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Type guest name or WED-..."
          className="w-full min-h-[52px] rounded-2xl border border-[#0B4D3A]/20 bg-white px-4 text-base focus:outline-none focus:ring-2 focus:ring-[#C9A961]"
        />
        <ul className="mt-3 overflow-y-auto space-y-2 max-h-96">
          {rows.map((r) => (
            <li key={r.guestId || r.reference}>
              <button
                disabled={!r.invitationId}
                onClick={() => onPick(r)}
                className="w-full text-left rounded-2xl bg-white px-4 py-3 shadow-sm disabled:opacity-50 min-h-[56px] border border-[#0B4D3A]/5 active:bg-[#FBF8F1]"
              >
                <div className="flex items-center justify-between">
                  <span className="block font-semibold text-[#12332A]">{r.name}</span>
                  {r.reference && <span className="text-xs font-mono text-[#0B4D3A] font-bold">{r.reference}</span>}
                </div>
                <span className="block text-xs text-[#12332A]/70 mt-0.5">
                  {sideLabel(r.side)}{r.table ? `, Table ${r.table}` : ", No table"}
                  {!r.invitationId
                    ? " • No invitation issued"
                    : r.status === "revoked"
                    ? " • Invitation cancelled"
                    : r.checkedInAt
                    ? ` • Checked in at ${timeOf(r.checkedInAt)}`
                    : " • Ready for check-in"}
                </span>
              </button>
            </li>
          ))}
          {q.trim().length >= 2 && !rows.length && (
            <li className="py-6 text-center text-[#12332A]/70">{msg || "No matching guests found."}</li>
          )}
        </ul>
      </div>
    </div>
  );
}

/* ---------- main scanner screen ---------- */

export default function Scan() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [params] = useSearchParams();
  const online = useOnline();

  const scannerRef = useRef(null);
  const chain = useRef(Promise.resolve());
  const locked = useRef(false);
  const fileInputRef = useRef(null);
  const captureInputRef = useRef(null);

  const [camState, setCamState] = useState("starting"); // starting | ready | error
  const [camError, setCamError] = useState("other");
  const [camErrorMsg, setCamErrorMsg] = useState("");
  const [cameras, setCameras] = useState([]);
  const [cameraId, setCameraId] = useState(null);
  const [torchOk, setTorchOk] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const [phase, setPhase] = useState("scan"); // scan | checking | review | confirming | success | problem
  const [guest, setGuest] = useState(null);
  const [problem, setProblem] = useState("");
  const [lookupOpen, setLookupOpen] = useState(false);

  // Return to appropriate dashboard
  const handleExit = () => {
    navigate(profile?.role === "admin" ? "/admin" : "/usher");
  };

  const onDecode = useCallback(async (text) => {
    if (locked.current) return;
    locked.current = true;
    try {
      scannerRef.current?.pause(true);
    } catch {}
    navigator.vibrate?.(35);
    setPhase("checking");

    try {
      const r = await api("/api/scan/verify", { method: "POST", body: { token: text } });
      setGuest({
        name: r.guest_name,
        side: r.side,
        table: r.table_number,
        reference: r.reference,
        state: r.result === "ready" ? "ready" : "already",
        checkedInAt: r.checked_in_at,
        token: text,
      });
      setPhase("review");
    } catch (e) {
      const code = e.body?.result;
      setProblem(
        code === "revoked"
          ? "This invitation was cancelled. Do not admit this guest."
          : code === "invalid"
          ? "This QR code is not recognized as a valid invitation."
          : e.message || "Could not verify this QR code."
      );
      setPhase("problem");
    }
  }, []);

  const startCamera = useCallback((id) => {
    chain.current = chain.current.then(async () => {
      setCamState("starting");
      setCamError("other");
      setCamErrorMsg("");
      setTorchOn(false);
      setTorchOk(false);

      try {
        if (scannerRef.current) {
          try {
            if (scannerRef.current.isScanning) {
              await scannerRef.current.stop();
            }
          } catch (e) {
            console.warn("Stop previous scanner error:", e);
          }
          try {
            scannerRef.current.clear();
          } catch {}
          scannerRef.current = null;
        }

        const s = new Html5Qrcode("qr-reader", { verbose: false });
        scannerRef.current = s;

        const scanConfig = {
          fps: 15,
          qrbox: (w, h) => {
            const size = Math.floor(Math.min(w, h) * 0.72);
            return { width: size, height: size };
          },
        };

        // If specific id passed, use it. Otherwise query cameras to find the back camera
        let targetCam = id;
        if (!targetCam) {
          try {
            const devices = await Html5Qrcode.getCameras();
            if (devices && devices.length > 0) {
              setCameras(devices);
              const rear = devices.find((d) => /back|rear|environment|world|outer/i.test(d.label)) || devices[devices.length - 1];
              targetCam = rear?.id;
            }
          } catch (listErr) {
            console.warn("getCameras upfront error:", listErr);
          }
        }

        // html5-qrcode strictly accepts a camera id string OR { facingMode: "environment" | "user" }
        try {
          if (targetCam) {
            await s.start(targetCam, scanConfig, onDecode, () => {});
          } else {
            await s.start({ facingMode: "environment" }, scanConfig, onDecode, () => {});
          }
        } catch (firstErr) {
          console.warn("Primary camera start failed, attempting environment fallback:", firstErr);
          try {
            await s.start({ facingMode: "environment" }, scanConfig, onDecode, () => {});
          } catch (secondErr) {
            console.warn("Environment camera failed, attempting user camera:", secondErr);
            await s.start({ facingMode: "user" }, scanConfig, onDecode, () => {});
          }
        }

        setCamState("ready");

        setTimeout(() => {
          const vid = document.querySelector("#qr-reader video");
          if (vid) {
            vid.setAttribute("playsinline", "true");
            vid.setAttribute("webkit-playsinline", "true");
            vid.muted = true;
            vid.play().catch(() => {});
          }
        }, 150);

        try {
          setCameraId(s.getRunningTrackSettings()?.deviceId || null);
        } catch {}
        try {
          setTorchOk(!!s.getRunningTrackCapabilities()?.torchFeature?.()?.isSupported?.());
        } catch {
          setTorchOk(false);
        }

        try {
          const devices = await Html5Qrcode.getCameras();
          if (devices && devices.length > 0) setCameras(devices);
        } catch {}
      } catch (e) {
        console.error("Camera startup error:", e);
        setCamError(cameraProblem(e));
        setCamErrorMsg(e?.message || String(e || ""));
        setCamState("error");
      }
    });
  }, [onDecode]);

  useEffect(() => {
    startCamera(null);
    return () => {
      chain.current = chain.current.then(async () => {
        const s = scannerRef.current;
        if (s?.isScanning) {
          try {
            await s.stop();
          } catch {}
        }
        try {
          s?.clear();
        } catch {}
        scannerRef.current = null;
      });
    };
  }, [startCamera]);

  const toggleTorch = async () => {
    try {
      await scannerRef.current.getRunningTrackCapabilities().torchFeature().apply(!torchOn);
      setTorchOn((t) => !t);
    } catch {
      setTorchOk(false);
    }
  };

  const switchCamera = () => {
    if (cameras.length < 2) return;
    const i = cameras.findIndex((c) => c.id === cameraId);
    startCamera(cameras[(i + 1) % cameras.length].id);
  };

  const scanNext = () => {
    setGuest(null);
    setProblem("");
    setPhase("scan");
    locked.current = false;
    try {
      scannerRef.current?.resume();
    } catch {}
  };

  const openLookup = () => {
    locked.current = true;
    try {
      scannerRef.current?.pause(true);
    } catch {}
    setLookupOpen(true);
  };

  useEffect(() => {
    if (params.get("lookup") === "1") openLookup();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const closeLookup = () => {
    setLookupOpen(false);
    if (phase === "scan") scanNext();
  };

  const pick = (r) => {
    setLookupOpen(false);
    setGuest({
      name: r.name,
      side: r.side,
      table: r.table,
      reference: r.reference,
      invitationId: r.invitationId,
      state: r.status === "revoked" ? "revoked" : r.checkedInAt ? "already" : "ready",
      checkedInAt: r.checkedInAt,
    });
    setPhase("review");
  };

  // Decode QR from uploaded image file or native camera photo
  const handleImageFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhase("checking");
    try {
      const helperScanner = new Html5Qrcode("qr-file-helper", { verbose: false });
      const decodedText = await helperScanner.scanFile(file, false);
      try { helperScanner.clear(); } catch {}
      onDecode(decodedText);
    } catch (err) {
      console.warn("QR file scan error:", err);
      setProblem("Could not detect a QR code in that image. Please ensure the QR is clear and well-lit.");
      setPhase("problem");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (captureInputRef.current) captureInputRef.current.value = "";
    }
  };

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

  const btn = "w-full min-h-[54px] rounded-2xl font-medium text-base active:scale-[0.98] transition-transform motion-reduce:transition-none";
  const round = "h-12 w-12 grid place-items-center rounded-full bg-black/55 text-white active:scale-95 shadow-md";

  return (
    <div className="fixed inset-0 bg-black text-white overflow-hidden select-none">
      <style>{`
        #qr-reader {
          position: absolute !important;
          inset: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          background: #000 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          overflow: hidden !important;
        }
        #qr-reader video {
          position: absolute !important;
          inset: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          object-fit: cover !important;
          display: block !important;
        }
        #qr-reader__scan_region {
          position: absolute !important;
          inset: 0 !important;
          width: 100% !important;
          height: 100% !important;
        }
        #qr-reader__scan_region video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
        }
        #qr-shaded-region { display: none !important; }
        #qr-reader__dashboard { display: none !important; }
        #qr-reader__header_message { display: none !important; }
        #qr-reader__status_span { display: none !important; }
        @keyframes draw{to{stroke-dashoffset:0}}
        @keyframes pop{0%{transform:scale(.6);opacity:0}100%{transform:scale(1);opacity:1}}
        @media (prefers-reduced-motion:reduce){.anim{animation:none!important;stroke-dashoffset:0!important}}
      `}</style>

      {/* Hidden container for file scan fallback */}
      <div id="qr-file-helper" className="hidden" />

      {/* Video stream container */}
      <div id="qr-reader" />

      {/* Camera Starting Loader (Never shows a blank screen) */}
      {camState === "starting" && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/85 px-6 text-center">
          <div className="h-12 w-12 rounded-full border-4 border-[#C9A961] border-t-transparent animate-spin mb-4" />
          <p className="text-lg font-medium text-[#FBF8F1]">Starting camera...</p>
          <p className="mt-1 text-sm text-[#FBF8F1]/70">Please allow camera permissions if prompted</p>
        </div>
      )}

      {/* QR Framing overlay */}
      {camState === "ready" && phase === "scan" && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center z-10">
          <div className="relative h-[68vmin] w-[68vmin] max-h-80 max-w-80">
            {["top-0 left-0 border-t-4 border-l-4 rounded-tl-3xl", "top-0 right-0 border-t-4 border-r-4 rounded-tr-3xl",
              "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-3xl", "bottom-0 right-0 border-b-4 border-r-4 rounded-br-3xl"]
              .map((c) => <span key={c} className={`absolute h-12 w-12 border-[#C9A961] ${c} shadow-md`} />)}
          </div>
          <p className="absolute bottom-36 px-8 text-center text-sm font-medium drop-shadow-md text-[#FBF8F1]">
            Point camera at the guest's QR code
          </p>
        </div>
      )}

      {/* Top bar controls */}
      <div
        className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
      >
        <button onClick={handleExit} aria-label="Close scanner" className={round}>
          <X size={22} />
        </button>
        <div className="flex gap-2">
          {torchOk && (
            <button onClick={toggleTorch} aria-label={torchOn ? "Torch off" : "Torch on"} className={round}>
              {torchOn ? <FlashlightOff size={22} /> : <Flashlight size={22} />}
            </button>
          )}
          {cameras.length > 1 && (
            <button onClick={switchCamera} aria-label="Switch camera" className={round}>
              <SwitchCamera size={22} />
            </button>
          )}
        </div>
      </div>

      {!online && (
        <div role="status" className="absolute inset-x-4 top-20 z-20 flex items-center gap-2 rounded-2xl bg-[#8A1F1F] px-4 py-3 text-sm shadow-lg">
          <WifiOff size={18} /> You are offline. Check-ins need an active connection.
        </div>
      )}

      {/* Bottom action controls */}
      {phase === "scan" && (
        <div
          className="absolute inset-x-0 bottom-0 z-20 px-5 flex flex-col gap-2"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.25rem)" }}
        >
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={openLookup}
              className={`${btn} bg-white/95 text-[#0B4D3A] flex items-center justify-center gap-2 shadow-lg backdrop-blur`}
            >
              <Search size={18} /> Find Guest
            </button>
            <label
              className={`${btn} bg-[#0B4D3A]/90 text-white flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-95 border border-[#C9A961]/40 backdrop-blur`}
            >
              <Image size={18} /> Upload QR
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageFile}
              />
            </label>
          </div>
        </div>
      )}

      {/* Camera error / blocked state */}
      {camState === "error" && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-[#FBF8F1] px-6 text-[#12332A] overflow-y-auto py-8">
          <div className="max-w-sm text-center space-y-4">
            <div className="mx-auto h-16 w-16 rounded-full bg-[#FFF4D6] grid place-items-center text-[#C9A961]">
              <Camera size={32} />
            </div>
            <h1 className="text-3xl text-[#0B4D3A]" style={serif}>{CAMERA_HELP[camError][0]}</h1>
            <p className="text-sm text-[#12332A]/75 leading-relaxed">{CAMERA_HELP[camError][1]}</p>
            {camErrorMsg && (
              <p className="text-xs text-[#12332A]/40 font-mono bg-black/5 rounded-lg p-2 overflow-x-auto text-left">
                Error: {camErrorMsg}
              </p>
            )}
            <div className="pt-2 space-y-2.5">
              <button onClick={() => startCamera(null)} className={`${btn} bg-[#0B4D3A] text-[#FBF8F1] flex items-center justify-center gap-2 shadow-md`}>
                <RefreshCw size={18} /> Try Camera Again
              </button>

              {/* Native phone camera snap */}
              <label className={`${btn} bg-[#C9A961] text-[#0B4D3A] font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-md`}>
                <Camera size={18} /> Snap Photo with Camera
                <input
                  ref={captureInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleImageFile}
                />
              </label>

              {/* Choose image from library */}
              <label className={`${btn} border-2 border-[#C9A961] text-[#0B4D3A] flex items-center justify-center gap-2 cursor-pointer bg-white`}>
                <Image size={18} /> Select QR from Photos
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageFile}
                />
              </label>

              <button onClick={openLookup} className={`${btn} bg-white text-[#12332A] border border-[#12332A]/20`}>
                <Search size={18} /> Find Guest by Name
              </button>

              <button onClick={handleExit} className="min-h-[44px] text-sm text-[#0B4D3A]/70 underline">
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checking spinner */}
      {phase === "checking" && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black/70" role="status">
          <div className="flex flex-col items-center gap-3">
            <div className="h-12 w-12 rounded-full border-4 border-[#C9A961] border-t-transparent animate-spin" />
            <p className="text-sm font-medium text-[#FBF8F1]">Verifying invitation...</p>
          </div>
        </div>
      )}

      {/* Verification screen */}
      {(phase === "review" || phase === "confirming") && guest && (
        <div className="absolute inset-0 z-30 flex flex-col justify-end bg-black/60">
          <div
            className="rounded-t-3xl bg-[#FBF8F1] p-6 text-[#12332A] shadow-2xl"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)" }}
          >
            <div className="flex items-center justify-between">
              <h1 className="text-4xl text-[#0B4D3A]" style={serif}>{guest.name}</h1>
              {guest.reference && <span className="font-mono text-sm font-bold text-[#0B4D3A]">{guest.reference}</span>}
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              {[["Side", sideLabel(guest.side)], ["Table", guest.table ? `Table ${guest.table}` : "Not assigned"],
                ["Status", guest.state === "ready" ? "Ready for check-in" : guest.state === "revoked" ? "Cancelled" : `Checked in at ${timeOf(guest.checkedInAt)}`]]
                .map(([k, v]) => (
                  <div key={k} className="rounded-2xl bg-white p-3 shadow-sm border border-[#0B4D3A]/5">
                    <dt className="text-xs text-[#12332A]/60">{k}</dt>
                    <dd className="mt-0.5 text-base font-semibold">{v}</dd>
                  </div>
                ))}
            </dl>

            {guest.state === "already" && (
              <p role="alert" className="mt-4 rounded-xl bg-[#FFF4D6] px-4 py-3 text-xs text-[#6B4E00] font-medium">
                This guest has already been checked in. Do not admit a duplicate QR code.
              </p>
            )}
            {guest.state === "revoked" && (
              <p role="alert" className="mt-4 rounded-xl bg-[#FBEAEA] px-4 py-3 text-xs text-[#8A1F1F] font-medium">
                This invitation was cancelled. Do not admit this guest.
              </p>
            )}

            <div className="mt-5 space-y-2">
              {guest.state === "ready" && (
                <button
                  onClick={confirm}
                  disabled={phase === "confirming"}
                  className={`${btn} bg-[#0B4D3A] text-[#FBF8F1] disabled:opacity-60 shadow-lg`}
                >
                  {phase === "confirming" ? "Confirming..." : "Confirm Guest Check-in"}
                </button>
              )}
              <button
                onClick={scanNext}
                className={`${btn} ${guest.state === "ready" ? "text-[#0B4D3A] bg-white border border-[#0B4D3A]/20" : "bg-[#0B4D3A] text-[#FBF8F1]"}`}
              >
                {guest.state === "ready" ? "Cancel" : "Scan Next Guest"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Problem error alert */}
      {phase === "problem" && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-[#FBF8F1] px-8 text-[#12332A]">
          <div className="max-w-sm text-center space-y-4">
            <AlertTriangle className="mx-auto text-[#8A1F1F]" size={48} />
            <h2 className="text-2xl text-[#8A1F1F]" style={serif}>Scan Problem</h2>
            <p className="text-base text-[#12332A]/80">{problem}</p>
            <div className="pt-2 space-y-2">
              <button onClick={scanNext} className={`${btn} bg-[#0B4D3A] text-[#FBF8F1]`}>Scan Again</button>
              <button onClick={openLookup} className={`${btn} border border-[#0B4D3A]/20 bg-white text-[#0B4D3A]`}>Find Guest Manually</button>
            </div>
          </div>
        </div>
      )}

      {/* Success animation */}
      {phase === "success" && guest && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-[#0B4D3A] px-8 text-center text-[#FBF8F1]" role="status">
          <div className="space-y-4 max-w-sm">
            <svg viewBox="0 0 100 100" className="mx-auto h-32 w-32 anim" style={{ animation: "pop .35s ease-out both" }} aria-hidden="true">
              <circle cx="50" cy="50" r="44" fill="none" stroke="#C9A961" strokeWidth="5" />
              <path d="M30 52 l15 15 26 -30" fill="none" stroke="#C9A961" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"
                    className="anim" strokeDasharray="70" strokeDashoffset="70" style={{ animation: "draw .45s .25s ease-out forwards" }} />
            </svg>
            <h1 className="text-4xl text-[#FBF8F1]" style={serif}>Welcome, {guest.name}!</h1>
            <p className="text-lg text-[#C9A961] font-semibold">Table {guest.table ?? "Not assigned"}, {sideLabel(guest.side)}</p>
            <button onClick={scanNext} className={`${btn} mt-4 bg-[#C9A961] text-[#12332A] font-semibold shadow-lg`}>
              Scan Next Guest
            </button>
          </div>
        </div>
      )}

      {lookupOpen && <LookupSheet onClose={closeLookup} onPick={pick} />}
    </div>
  );
}
