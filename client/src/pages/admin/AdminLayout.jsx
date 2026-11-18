import { useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { BarChart3, Home, LayoutGrid, LogOut, Mail, MoreHorizontal, Settings, UserCheck, UserCog, Users, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import ConnectionStatus from "../../components/ConnectionStatus";
import InstallBanner from "../../components/InstallBanner";

const serif = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600 };
const MAIN = [
  { to: "/admin", label: "Home", icon: Home, end: true },
  { to: "/admin/guests", label: "Guests", icon: Users },
  { to: "/admin/invitations", label: "Invitations", icon: Mail },
  { to: "/admin/attendance", label: "Attendance", icon: UserCheck },
];
const MORE = [
  { to: "/admin/tables", label: "Tables and seating", icon: LayoutGrid },
  { to: "/admin/ushers", label: "Usher accounts", icon: UserCog },
  { to: "/admin/reports", label: "Reports", icon: BarChart3 },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = MORE.some((m) => pathname.startsWith(m.to));

  const logout = async () => { await signOut(); navigate("/login", { replace: true }); };

  const mobileTab = ({ isActive }) =>
    `flex flex-1 flex-col items-center justify-center h-full py-1 text-xs transition-colors ${
      isActive ? "text-[#0B4D3A] font-semibold" : "text-[#12332A]/60 hover:text-[#0B4D3A]"
    }`;
  const sideLink = ({ isActive }) =>
    `flex items-center gap-3 rounded-xl px-4 min-h-[44px] ${isActive ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10"}`;

  return (
    <div className="min-h-screen bg-[#FBF8F1] text-[#12332A]">
      {/* desktop and large tablet sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col bg-[#0B4D3A] p-5 lg:flex">
        <p className="mb-6 text-3xl text-[#FBF8F1]" style={serif}>Berchelle admin</p>
        <nav aria-label="Administrator navigation" className="flex-1 space-y-1">
          {[...MAIN, ...MORE].map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={sideLink}><Icon size={20} />{label}</NavLink>
          ))}
        </nav>
        <p className="mb-2 px-4 text-sm text-white/70">{profile.full_name}</p>
        <button onClick={logout} className="flex min-h-[44px] items-center gap-3 rounded-xl px-4 text-white/75 hover:bg-white/10"><LogOut size={20} />Sign out</button>
      </aside>

      <div className="lg:pl-64">
        <header className="flex items-center justify-between px-5 pb-2 lg:px-10 lg:pt-6"
                style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}>
          <span className="text-lg text-[#0B4D3A] lg:invisible" style={serif}>Berchelle admin</span>
          <ConnectionStatus />
        </header>
        <main className="mx-auto max-w-5xl px-5 pb-32 pt-2 lg:px-10 lg:pb-12"><InstallBanner /><Outlet /></main>
      </div>

      {/* phone bottom navigation */}
      <nav
        aria-label="Administrator navigation"
        className="fixed inset-x-0 bottom-0 z-10 border-t border-[#0B4D3A]/10 bg-white/95 backdrop-blur shadow-[0_-4px_25px_rgba(0,0,0,0.05)] lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex items-center justify-between h-16 max-w-md mx-auto px-2">
          {MAIN.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={mobileTab}>
              <Icon size={21} className="mb-0.5" />
              <span className="text-[11px] leading-tight">{label}</span>
            </NavLink>
          ))}
          <button
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            className={`flex flex-1 flex-col items-center justify-center h-full py-1 text-xs transition-colors ${
              moreActive ? "font-semibold text-[#0B4D3A]" : "text-[#12332A]/60 hover:text-[#0B4D3A]"
            }`}
          >
            <MoreHorizontal size={21} className="mb-0.5" />
            <span className="text-[11px] leading-tight">More</span>
          </button>
        </div>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-30 flex flex-col justify-end bg-black/50 lg:hidden" onClick={() => setMoreOpen(false)}>
          <div role="dialog" aria-label="More" onClick={(e) => e.stopPropagation()}
               className="rounded-t-3xl bg-[#FBF8F1] p-5" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.25rem)" }}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-2xl text-[#0B4D3A]" style={serif}>More</h2>
              <button onClick={() => setMoreOpen(false)} aria-label="Close" className="grid h-11 w-11 place-items-center"><X size={22} /></button>
            </div>
            <ul className="space-y-2">
              {MORE.map(({ to, label, icon: Icon }) => (
                <li key={to}>
                  <Link to={to} onClick={() => setMoreOpen(false)} className="flex min-h-[56px] items-center gap-3 rounded-2xl bg-white px-4 font-medium shadow-sm">
                    <Icon size={20} className="text-[#0B4D3A]" />{label}
                  </Link>
                </li>
              ))}
              <li>
                <button onClick={logout} className="flex min-h-[56px] w-full items-center gap-3 rounded-2xl bg-white px-4 font-medium text-[#8A1F1F] shadow-sm">
                  <LogOut size={20} />Sign out
                </button>
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
