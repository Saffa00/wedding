import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const FLAG = "onboarding_completed";

export const hasSeenOnboarding = () => {
  try {
    return localStorage.getItem(FLAG) === "1";
  } catch {
    return false;
  }
};

export const resetOnboarding = () => {
  try {
    localStorage.removeItem(FLAG);
  } catch {
    /* storage unavailable */
  }
};

/* ---------- install helpers ---------- */

const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches ||
  window.navigator.standalone === true;

const isIOS = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);

function useInstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      setDeferred(e);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);
  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };
  return { canInstall: !!deferred, install };
}

/* ---------- custom icons (emerald + champagne gold) ---------- */

const GOLD = "#C9A961";
const EMERALD = "#0B4D3A";

const RingsArt = () => (
  <svg viewBox="0 0 200 140" className="w-56 h-40" aria-hidden="true">
    <circle cx="80" cy="80" r="38" fill="none" stroke={EMERALD} strokeWidth="6" />
    <circle cx="120" cy="80" r="38" fill="none" stroke={GOLD} strokeWidth="6" />
    <path d="M100 30 l8 12 -8 12 -8 -12z" fill={GOLD} />
  </svg>
);

const TableArt = () => (
  <svg viewBox="0 0 200 140" className="w-56 h-40" aria-hidden="true">
    <circle cx="100" cy="70" r="30" fill="none" stroke={EMERALD} strokeWidth="6" />
    {[0, 60, 120, 180, 240, 300].map((a) => (
      <circle
        key={a}
        cx={100 + 52 * Math.cos((a * Math.PI) / 180)}
        cy={70 + 52 * Math.sin((a * Math.PI) / 180)}
        r="9"
        fill={GOLD}
      />
    ))}
  </svg>
);

const ScanArt = () => (
  <svg viewBox="0 0 200 140" className="w-56 h-40" aria-hidden="true">
    {[
      "M60 40 V28 H72",
      "M140 40 V28 H128",
      "M60 100 V112 H72",
      "M140 100 V112 H128",
    ].map((d) => (
      <path key={d} d={d} fill="none" stroke={GOLD} strokeWidth="6" strokeLinecap="round" />
    ))}
    <rect x="80" y="48" width="16" height="16" fill={EMERALD} />
    <rect x="104" y="48" width="16" height="16" fill={EMERALD} />
    <rect x="80" y="72" width="16" height="16" fill={EMERALD} />
    <rect x="108" y="76" width="8" height="8" fill={GOLD} />
  </svg>
);

const SLIDES = [
  {
    Art: RingsArt,
    title: "Welcome to the celebration",
    body: "Manage your guest list and track arrivals from one place.",
  },
  {
    Art: TableArt,
    title: "Invite and seat every guest",
    body: "Create a unique QR invitation for each guest and assign their table.",
  },
  {
    Art: ScanArt,
    title: "Verify guests at the door",
    body: "Scan an invitation to confirm attendance in seconds. We ask for camera access only when you open the scanner.",
  },
];

/* ---------- screen ---------- */

export default function Onboarding({ onFinish }) {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const startX = useRef(null);
  const { canInstall, install } = useInstallPrompt();

  const last = index === SLIDES.length - 1;
  const showIOSHint = last && isIOS() && !isStandalone();
  const showInstall = last && canInstall && !isStandalone();

  const finish = () => {
    try {
      localStorage.setItem(FLAG, "1");
    } catch {
      /* storage unavailable */
    }
    if (onFinish) onFinish();
    else navigate("/login", { replace: true });
  };

  const go = (i) => setIndex(Math.max(0, Math.min(SLIDES.length - 1, i)));

  const onPointerDown = (e) => {
    startX.current = e.clientX;
  };
  const onPointerMove = (e) => {
    if (startX.current !== null) setDragX(e.clientX - startX.current);
  };
  const onPointerUp = () => {
    if (startX.current === null) return;
    if (dragX < -50) go(index + 1);
    else if (dragX > 50) go(index - 1);
    startX.current = null;
    setDragX(0);
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowRight") go(index + 1);
    if (e.key === "ArrowLeft") go(index - 1);
  };

  return (
    <main
      className="fixed inset-0 flex flex-col bg-[#FBF8F1] text-[#12332A] overflow-hidden"
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        touchAction: "pan-y",
      }}
      onKeyDown={onKeyDown}
    >
      <div className="flex justify-end px-5 pt-4 h-14">
        {!last && (
          <button
            onClick={finish}
            className="px-3 min-h-[44px] text-sm text-[#0B4D3A]/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C9A961] rounded-lg"
          >
            Skip
          </button>
        )}
      </div>

      <div
        className="flex-1 overflow-hidden"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className="flex h-full transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{
            width: `${SLIDES.length * 100}%`,
            transform: `translateX(calc(${(-index * 100) / SLIDES.length}% + ${dragX}px))`,
            transitionDuration: startX.current !== null ? "0ms" : undefined,
          }}
        >
          {SLIDES.map(({ Art, title, body }, i) => (
            <section
              key={title}
              className="flex flex-col items-center justify-center text-center px-8"
              style={{ width: `${100 / SLIDES.length}%` }}
              aria-hidden={i !== index}
            >
              <div className="mb-10 rounded-[2rem] bg-white shadow-[0_8px_30px_rgba(11,77,58,0.08)] px-6 py-8">
                <Art />
              </div>
              <h1
                className="text-3xl leading-tight mb-3"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600 }}
              >
                {title}
              </h1>
              <p className="max-w-xs text-base leading-relaxed text-[#12332A]/75">{body}</p>
            </section>
          ))}
        </div>
      </div>

      <div className="px-6 pb-6 pt-2 space-y-4">
        {showIOSHint && (
          <p className="text-sm text-center text-[#12332A]/75 bg-white rounded-2xl px-4 py-3 shadow-sm">
            To install on iPhone, tap the Share icon in Safari, then choose Add to Home Screen.
          </p>
        )}
        {showInstall && (
          <button
            onClick={install}
            className="w-full min-h-[48px] rounded-2xl border-2 border-[#C9A961] text-[#0B4D3A] font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A961]"
          >
            Install app
          </button>
        )}

        <div className="flex justify-center gap-2" role="tablist" aria-label="Onboarding progress">
          {SLIDES.map((s, i) => (
            <button
              key={s.title}
              role="tab"
              aria-selected={i === index}
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => go(i)}
              className={`h-2 rounded-full transition-all motion-reduce:transition-none ${
                i === index ? "w-6 bg-[#C9A961]" : "w-2 bg-[#0B4D3A]/25"
              }`}
            />
          ))}
        </div>

        <button
          onClick={last ? finish : () => go(index + 1)}
          className="w-full min-h-[52px] rounded-2xl bg-[#0B4D3A] text-[#FBF8F1] text-base font-medium active:scale-[0.98] transition-transform motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A961]"
        >
          {last ? "Get started" : "Next"}
        </button>
      </div>
    </main>
  );
}
