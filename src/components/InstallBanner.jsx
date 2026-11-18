import { useEffect, useState } from "react";
import { X } from "lucide-react";

const KEY = "install_dismissed_at";
const QUIET_DAYS = 14;

const standalone = () => window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
const ios = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);
const recentlyDismissed = () => {
  try { return Date.now() - Number(localStorage.getItem(KEY) || 0) < QUIET_DAYS * 864e5; } catch { return false; }
};

// Install card for staff: native prompt on Android/Chrome, Add to Home Screen steps on iPhone
export default function InstallBanner() {
  const [evt, setEvt] = useState(null);
  const [hidden, setHidden] = useState(recentlyDismissed);

  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setEvt(e); };
    const onInstalled = () => setEvt(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  if (hidden || standalone()) return null;
  const showIOS = ios() && !evt;
  if (!evt && !showIOS) return null;

  const dismiss = () => { try { localStorage.setItem(KEY, String(Date.now())); } catch { /* storage unavailable */ } setHidden(true); };
  const install = async () => { evt.prompt(); await evt.userChoice; setEvt(null); };

  return (
    <section className="mb-4 flex items-start gap-3 rounded-2xl bg-white p-4 shadow-sm" aria-label="Install the app">
      <div className="flex-1">
        <p className="font-medium">Install the app</p>
        <p className="mt-0.5 text-sm text-[#12332A]/75">
          {evt ? "Open it from your home screen, full screen, like any other app." : "Tap the Share icon in Safari, then choose Add to Home Screen."}
        </p>
        {evt && <button onClick={install} className="mt-3 min-h-[44px] rounded-xl bg-[#0B4D3A] px-4 font-medium text-[#FBF8F1]">Install</button>}
      </div>
      <button onClick={dismiss} aria-label="Dismiss" className="grid h-11 w-11 shrink-0 place-items-center"><X size={20} /></button>
    </section>
  );
}
