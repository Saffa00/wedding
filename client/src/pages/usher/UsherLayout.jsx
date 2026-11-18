import { Link, NavLink, Outlet } from "react-router-dom";
import { Activity, Home, QrCode, User } from "lucide-react";
import ConnectionStatus from "../../components/ConnectionStatus";
import InstallBanner from "../../components/InstallBanner";

export default function UsherLayout() {
  const tabClass = ({ isActive }) =>
    `flex flex-1 flex-col items-center justify-center py-1 text-xs transition-colors ${
      isActive ? "text-[#0B4D3A] font-semibold" : "text-[#12332A]/60 hover:text-[#0B4D3A]"
    }`;

  return (
    <div className="min-h-screen bg-[#FBF8F1] text-[#12332A] flex flex-col">
      <header
        className="flex items-center justify-between px-5 pb-2 bg-[#FBF8F1]"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
      >
        <span
          className="text-xl text-[#0B4D3A]"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600 }}
        >
          Guest Check-in
        </span>
        <ConnectionStatus />
      </header>

      <main className="flex-1 px-5 pb-32 pt-2">
        <InstallBanner />
        <Outlet />
      </main>

      {/* Accurately aligned, balanced bottom navigation bar */}
      <nav
        aria-label="Usher navigation"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-[#0B4D3A]/10 bg-white/95 backdrop-blur shadow-[0_-4px_25px_rgba(0,0,0,0.05)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="relative flex items-center justify-between h-16 max-w-md mx-auto px-4">
          {/* Home */}
          <NavLink to="/usher" end className={tabClass}>
            <Home size={22} className="mb-0.5" />
            <span className="text-[11px] leading-tight">Home</span>
          </NavLink>

          {/* Elevated Center Scan Button */}
          <div className="flex flex-1 flex-col items-center justify-center -mt-6">
            <Link
              to="/usher/scan"
              aria-label="Scan invitation QR code"
              className="group flex h-14 w-14 items-center justify-center rounded-full bg-[#0B4D3A] text-[#FBF8F1] shadow-lg shadow-[#0B4D3A]/30 ring-4 ring-[#FBF8F1] active:scale-95 transition-all"
            >
              <QrCode size={26} className="group-hover:scale-105 transition-transform" />
            </Link>
            <span className="mt-1 text-[11px] font-semibold text-[#0B4D3A] tracking-tight">Scan</span>
          </div>

          {/* Activity */}
          <NavLink to="/usher/activity" className={tabClass}>
            <Activity size={22} className="mb-0.5" />
            <span className="text-[11px] leading-tight">Activity</span>
          </NavLink>

          {/* Profile */}
          <NavLink to="/usher/profile" className={tabClass}>
            <User size={22} className="mb-0.5" />
            <span className="text-[11px] leading-tight">Profile</span>
          </NavLink>
        </div>
      </nav>
    </div>
  );
}
