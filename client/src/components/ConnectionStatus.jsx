import { useEffect, useState } from "react";

export function useOnline() {
  const [on, setOn] = useState(navigator.onLine);
  useEffect(() => {
    const up = () => setOn(true), down = () => setOn(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);
  return on;
}

export default function ConnectionStatus() {
  const online = useOnline();
  return (
    <span role="status" className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
      online ? "bg-[#0B4D3A]/10 text-[#0B4D3A]" : "bg-[#8A1F1F] text-white"}`}>
      <span className={`h-2 w-2 rounded-full ${online ? "bg-[#0B4D3A]" : "bg-white"}`} />
      {online ? "Online" : "Offline"}
    </span>
  );
}
