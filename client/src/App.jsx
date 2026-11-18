import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, roleHome, useAuth } from "./context/AuthContext";
import ProtectedRoute, { Splash } from "./components/ProtectedRoute";
import Onboarding, { hasSeenOnboarding } from "./pages/Onboarding";
import Login from "./pages/Login";
import UsherLayout from "./pages/usher/UsherLayout";
import UsherHome from "./pages/usher/Home";
import UsherActivity from "./pages/usher/Activity";
import UsherProfile from "./pages/usher/Profile";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminGuests from "./pages/admin/Guests";
import AdminTables from "./pages/admin/Tables";
import AdminInvitations from "./pages/admin/Invitations";
import InvitationPage from "./pages/InvitationPage";
import AdminSettings from "./pages/admin/Settings";
import AdminAttendance from "./pages/admin/Attendance";
import AdminUshers from "./pages/admin/Ushers";
import AdminReports from "./pages/admin/Reports";
import PwaUpdatePrompt from "./components/PwaUpdatePrompt";
import MustChangePasswordModal from "./components/MustChangePasswordModal";

// The QR scanner library is large, so it loads only when an usher opens the scanner
const Scan = lazy(() => import("./pages/usher/Scan"));

function RootRedirect() {
  const { profile, loading } = useAuth();
  if (loading) return <Splash />;
  if (!hasSeenOnboarding()) return <Navigate to="/onboarding" replace />;
  return <Navigate to={profile ? roleHome(profile.role) : "/login"} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PwaUpdatePrompt />
        <MustChangePasswordModal />
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/login" element={<Login />} />
          <Route path="/i/:token" element={<InvitationPage />} />

          {/* Both Admin and Usher can use the QR Scanner */}
          <Route element={<ProtectedRoute roles={["admin", "usher"]} />}>
            <Route path="/usher/scan" element={<Suspense fallback={<Splash />}><Scan /></Suspense>} />
          </Route>

          <Route element={<ProtectedRoute roles={["admin"]} />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="guests" element={<AdminGuests />} />
              <Route path="invitations" element={<AdminInvitations />} />
              <Route path="attendance" element={<AdminAttendance />} />
              <Route path="tables" element={<AdminTables />} />
              <Route path="ushers" element={<AdminUshers />} />
              <Route path="reports" element={<AdminReports />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute roles={["usher"]} />}>
            <Route path="/usher" element={<UsherLayout />}>
              <Route index element={<UsherHome />} />
              <Route path="activity" element={<UsherActivity />} />
              <Route path="profile" element={<UsherProfile />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
