import { useAuth } from "@/hooks/use-auth";
import { Loader } from "lucide-react"
import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import MainLayout from "./MainLayout";
import Login from "./pages/Login";
import DashboardLayout from "./components/layout/DashboardLayout";
import Conversations from "./pages/Conversations";
import ConversationDetail from "./pages/ConversationDetail";
import User from "./pages/User";
import ConversationLayout from "./components/layout/ConversationLayout";
import UserProfile from "./pages/UserProfile";
import StarredMessages from "./pages/StarredMessages";
import VerifyEmail from "./pages/VerifyEmail";
import MembershipApplication from "./pages/MembershipApplication";
import ApplicationSubmitted from "./pages/ApplicationSubmitted";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminRoute from "./components/auth/AdminRoute";
import AdminLayout from "./components/admin/AdminLayout";
import AdminApplications from "./pages/admin/AdminApplications";
import AdminApplicationDetail from "./pages/admin/AdminApplicationDetail";
import ActivateMembership from "./pages/ActivateMembership";
import Directory from "./pages/Directory";
import MemberProfile from "./pages/MemberProfile";
import CommunityInbox from "./pages/CommunityInbox";
import CommunityPostDetail from "./pages/CommunityPostDetail";
import AdminInbox from "./pages/admin/AdminInbox";
import AdminInboxPostDetail from "./pages/admin/AdminInboxPostDetail";
import AdminDashboardOverview from "./pages/admin/AdminDashboardOverview";
import AdminActiveMembers from "./pages/admin/AdminActiveMembers";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminEmergency from "./pages/admin/AdminEmergency";
import AdminAuditLogs from "./pages/admin/AdminAuditLogs";
import AdminSecurityLogs from "./pages/admin/AdminSecurityLogs";
import AdminProfile from "./pages/admin/AdminProfile";

export function App() {

  const { isUserLoading } = useAuth();

  if (isUserLoading) {
    return (
      <div className="flex gap-2 min-h-dvh items-center justify-center p-6">
        <p className="text-lg">Please wait while we authenticate you</p>
        <Loader className="animate-spin" />
      </div>
    )
  }

  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Navigate to="/apply" replace />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/apply" element={<MembershipApplication />} />
        <Route path="/application-submitted" element={<ApplicationSubmitted />} />
        <Route path="/activate" element={<ActivateMembership />} />
        <Route element={<DashboardLayout />}>
          <Route path="/user" element={<User />} />
          <Route path="/user/profile" element={<UserProfile />} />
          <Route path="/user/directory" element={<Directory />} />
          <Route path="/user/directory/:memberId" element={<MemberProfile />} />
          <Route path="/user/inbox" element={<CommunityInbox />} />
          <Route path="/user/inbox/:postId" element={<CommunityPostDetail />} />
          <Route path="/user/starred" element={<StarredMessages />} />
          <Route element={<ConversationLayout />}>
            <Route path="/user/conversations" element={<Conversations />} />
            <Route path="/user/conversations/:id" element={<ConversationDetail />} />
          </Route>
        </Route>
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route index element={<AdminDashboardOverview />} />
          <Route path="applications" element={<AdminApplications />} />
          <Route path="applications/:applicationId" element={<AdminApplicationDetail />} />
          <Route path="members" element={<AdminActiveMembers />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="inbox" element={<AdminInbox />} />
          <Route path="inbox/:postId" element={<AdminInboxPostDetail />} />
          <Route path="emergency" element={<AdminEmergency />} />
          <Route path="audit-logs" element={<AdminAuditLogs />} />
          <Route path="security-logs" element={<AdminSecurityLogs />} />
          <Route path="profile" element={<AdminProfile />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App
