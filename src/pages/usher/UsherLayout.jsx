import { Link, NavLink, Outlet } from "react-router-dom";
import { Activity, Home, ScanLine, User } from "lucide-react";
import ConnectionStatus from "../../components/ConnectionStatus";
import InstallBanner from "../../components/InstallBanner";

const tab = ({ isActive }) =>
  `flex flex-1 flex-col items-center justify-center gap-1 min-h-[56px] text-xs ${
    isActive ? "text-[#0B4D3A] font-semibold" : "text-[#12332A]/60"}`;

export default function UsherLayout() {
  return (
    <div className="min-h-screen bg-[#FBF8F1] text-[#12332A]">
      <header className="flex items-center justify-between px-5 pb-2"
              style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}>
        <span className="text-lg text-[#0B4D3A]" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600 }}>
          Guest check-in
        </span>
        <ConnectionStatus />
      </header>

      <main className="px-5 pb-32 pt-2"><InstallBanner /><Outlet /></main>

      <nav aria-label="Usher navigation"
           className="fixed inset-x-0 bottom-0 z-10 flex items-end border-t border-[#0B4D3A]/10 bg-white/95 backdrop-blur"
           style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <NavLink to="/usher" end className={tab}><Home size={22} />Home</NavLink>
        <div className="flex flex-1 justify-center">
          <Link to="/usher/scan" aria-label="Scan invitation"
                className="-mt-6 mb-1 flex h-16 w-16 flex-col items-center justify-center rounded-full bg-[#0B4D3A] text-[#FBF8F1] shadow-lg ring-4 ring-[#FBF8F1] active:scale-95 transition-transform motion-reduce:transition-none">
            <ScanLine size={28} />
          </Link>
        </div>
        <NavLink to="/usher/activity" className={tab}><Activity size={22} />Activity</NavLink>
        <NavLink to="/usher/profile" className={tab}><User size={22} />Profile</NavLink>
      </nav>
    </div>
  );
}
