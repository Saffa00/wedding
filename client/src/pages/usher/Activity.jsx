import { RefreshCw } from "lucide-react";
import { CheckInRow, useLive } from "./Home";

export default function Activity() {
  const { data, error, reload } = useLive("/api/activity");
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl text-[#0B4D3A]" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600 }}>Activity</h1>
        <button onClick={reload} aria-label="Refresh" className="h-11 w-11 grid place-items-center rounded-full text-[#0B4D3A]"><RefreshCw size={20} /></button>
      </div>
      {error && <p role="alert" className="rounded-xl bg-[#FBEAEA] px-4 py-3 text-sm text-[#8A1F1F]">{error}</p>}
      {data?.length ? (
        <ul className="space-y-2">{data.map((r) => <CheckInRow key={r.checked_in_at + r.guests?.full_name} row={r} />)}</ul>
      ) : !error && <p className="py-10 text-center text-[#12332A]/60">{data ? "No check-ins yet." : "Loading"}</p>}
      {data?.length === 20 && <p className="text-center text-sm text-[#12332A]/60">Showing the 20 most recent check-ins.</p>}
    </div>
  );
}
