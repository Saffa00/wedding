import { Navigate, Outlet, useLocation } from "react-router-dom";
import { roleHome, useAuth } from "../context/AuthContext";

export function Splash() {
  return (
    <div className="fixed inset-0 grid place-items-center bg-[#FBF8F1]">
      <div className="h-10 w-10 rounded-full border-4 border-[#C9A961] border-t-transparent animate-spin motion-reduce:animate-none"
           role="status" aria-label="Loading" />
    </div>
  );
}

// <Route element={<ProtectedRoute roles={["admin"]} />}> ...children... </Route>
export default function ProtectedRoute({ roles }) {
  const { profile, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Splash />;
  if (!profile) return <Navigate to="/login" replace state={{ from: location }} />;
  if (roles && !roles.includes(profile.role)) return <Navigate to={roleHome(profile.role)} replace />;
  return <Outlet />;
}
