import { useLocation } from "react-router-dom";
import { useRegisterSW } from "virtual:pwa-register/react";

// Tells the user when a new version is ready, and when the app can open offline.
// Hidden on the scanner and on guest invitation pages so it never gets in the way.
export default function PwaUpdatePrompt() {
  const { pathname } = useLocation();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) setInterval(() => registration.update(), 60 * 60 * 1000); // check hourly
    },
  });

  if ((!needRefresh && !offlineReady) || pathname.startsWith("/usher/scan") || pathname.startsWith("/i/")) return null;

  return (
    <div role="status" className="fixed inset-x-4 z-50 mx-auto max-w-md rounded-2xl bg-[#0B4D3A] p-4 text-[#FBF8F1] shadow-lg"
         style={{ top: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}>
      <p className="font-medium">{needRefresh ? "A new version is ready" : "Ready to open offline"}</p>
      <p className="mt-0.5 text-sm text-[#FBF8F1]/80">
        {needRefresh ? "Update when you are not in the middle of checking guests in." : "Check-ins still need an internet connection."}
      </p>
      <div className="mt-3 flex gap-2">
        {needRefresh && <button onClick={() => updateServiceWorker(true)} className="min-h-[44px] flex-1 rounded-xl bg-[#C9A961] font-medium text-[#12332A]">Update now</button>}
        <button onClick={() => (needRefresh ? setNeedRefresh(false) : setOfflineReady(false))} className="min-h-[44px] flex-1 rounded-xl border border-white/30">
          {needRefresh ? "Later" : "Dismiss"}
        </button>
      </div>
    </div>
  );
}
