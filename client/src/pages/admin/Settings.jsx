import { useEffect, useState } from "react";
import { api } from "../../lib/api";

const serif = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600 };
const field = "w-full min-h-[52px] rounded-2xl border border-[#0B4D3A]/20 bg-white px-4 text-base focus:outline-none focus:ring-2 focus:ring-[#C9A961]";

const ZONES = (() => {
  try { return Intl.supportedValuesOf("timeZone"); }
  catch { return ["Africa/Freetown", "Africa/Lagos", "Africa/Accra", "Europe/London", "America/New_York", "UTC"]; }
})();
const validZone = (z) => { try { new Intl.DateTimeFormat("en", { timeZone: z }); return true; } catch { return false; } };

// Offset (minutes) of a time zone from UTC at a given instant
function zoneOffset(ts, tz) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }).formatToParts(new Date(ts));
  const o = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return (Date.UTC(o.year, o.month - 1, o.day, o.hour, o.minute, o.second) - ts) / 60000;
}
// "2027-01-16T15:00" typed as venue wall-clock time -> exact UTC instant
function wallToISO(local, tz) {
  const [d, t] = local.split("T");
  const [y, m, da] = d.split("-").map(Number);
  const [h, mi] = t.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, da, h, mi);
  let ts = guess - zoneOffset(guess, tz) * 60000;
  ts = guess - zoneOffset(ts, tz) * 60000; // second pass settles daylight-saving edges
  return new Date(ts).toISOString();
}
// UTC instant -> "YYYY-MM-DDTHH:mm" in the venue time zone for the input
function isoToWall(iso, tz) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(iso));
  const o = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${o.year}-${o.month}-${o.day}T${o.hour}:${o.minute}`;
}

export default function Settings() {
  const [f, setF] = useState({ brideName: "", groomName: "", venue: "", when: "", timezone: "Africa/Freetown" });
  const [state, setState] = useState("loading"); // loading | ready | error
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const set = (k) => (e) => { setSaved(false); setF((x) => ({ ...x, [k]: e.target.value })); };

  useEffect(() => {
    let live = true;
    api("/api/settings").then((s) => {
      if (!live) return;
      if (s) setF({ brideName: s.brideName, groomName: s.groomName, venue: s.venue, timezone: s.timezone, when: isoToWall(s.eventDate, s.timezone) });
      setState("ready");
    }).catch((e) => { if (live) { setError(e.message); setState("error"); } });
    return () => { live = false; };
  }, []);

  const save = async (e) => {
    e.preventDefault();
    if (!validZone(f.timezone)) return setError("Choose a valid time zone, for example Africa/Freetown.");
    setBusy(true); setError(""); setSaved(false);
    try {
      await api("/api/settings", { method: "PUT", body: { brideName: f.brideName, groomName: f.groomName, venue: f.venue, timezone: f.timezone, eventDate: wallToISO(f.when, f.timezone) } });
      setSaved(true);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const complete = f.brideName.trim() && f.groomName.trim() && f.venue.trim() && f.when && f.timezone;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-4xl text-[#0B4D3A]" style={serif}>Settings</h1>
        <p className="text-sm text-[#12332A]/70">These details appear on every guest invitation.</p>
      </div>

      {state === "loading" && <p className="text-[#12332A]/60">Loading</p>}
      {state === "error" && <p role="alert" className="rounded-xl bg-[#FBEAEA] px-4 py-3 text-sm text-[#8A1F1F]">{error}</p>}

      {state === "ready" && (
        <form onSubmit={save} className="max-w-lg space-y-4 rounded-3xl bg-white p-5 shadow-sm" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="s-bride" className="mb-1.5 block text-sm font-medium">Bride’s name</label>
              <input id="s-bride" value={f.brideName} onChange={set("brideName")} autoComplete="off" className={field} />
            </div>
            <div>
              <label htmlFor="s-groom" className="mb-1.5 block text-sm font-medium">Groom’s name</label>
              <input id="s-groom" value={f.groomName} onChange={set("groomName")} autoComplete="off" className={field} />
            </div>
          </div>
          <div>
            <label htmlFor="s-when" className="mb-1.5 block text-sm font-medium">Wedding date and time</label>
            <input id="s-when" type="datetime-local" value={f.when} onChange={set("when")} className={field} />
          </div>
          <div>
            <label htmlFor="s-zone" className="mb-1.5 block text-sm font-medium">Venue time zone</label>
            <input id="s-zone" list="zones" value={f.timezone} onChange={set("timezone")} autoComplete="off" autoCapitalize="none" className={field} />
            <datalist id="zones">{ZONES.map((z) => <option key={z} value={z} />)}</datalist>
            <p className="mt-1 text-sm text-[#12332A]/60">Guests anywhere see the time as it is at the venue.</p>
          </div>
          <div>
            <label htmlFor="s-venue" className="mb-1.5 block text-sm font-medium">Venue</label>
            <input id="s-venue" value={f.venue} onChange={set("venue")} autoComplete="off" className={field} />
          </div>
          {error && <p role="alert" className="rounded-xl bg-[#FBEAEA] px-4 py-3 text-sm text-[#8A1F1F]">{error}</p>}
          {saved && <p role="status" className="rounded-xl bg-[#0B4D3A]/10 px-4 py-3 text-sm text-[#0B4D3A]">Saved. Invitations now show these details.</p>}
          <button type="submit" disabled={busy || !complete} className="min-h-[52px] w-full rounded-2xl bg-[#0B4D3A] font-medium text-[#FBF8F1] disabled:opacity-50 active:scale-[0.98] transition-transform motion-reduce:transition-none">
            {busy ? "Saving" : "Save details"}
          </button>
        </form>
      )}
    </div>
  );
}
