import { Link, Outlet, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import {
    ClipboardList,
    Inbox,
    LogOut,
    Menu,
    X,
    Shield,
    LayoutDashboard,
    FileCheck,
    FileX,
    Users,
    AlertOctagon,
    UserCheck,
    History,
    ShieldAlert,
    User,
    MessagesSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export default function AdminLayout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const [mobileOpen, setMobileOpen] = useState(false);

    const handleLogout = () => {
        logout();
        navigate("/admin/login", { replace: true });
    };

    const isActive = (path: string, status?: string) => {
        if (status) {
            return location.pathname.startsWith(path) && searchParams.get("status") === status;
        }
        if (path === "/admin") {
            return location.pathname === "/admin";
        }
        if (path === "/admin/applications") {
            return location.pathname.startsWith("/admin/applications") && !searchParams.get("status");
        }
        return location.pathname.startsWith(path);
    };

    return (
        <div className="flex h-dvh w-dvw flex-col overflow-hidden bg-background text-foreground md:flex-row">
            {/* ── Mobile Header ─────────────────────────────────────────── */}
            <header className="flex items-center justify-between border-b px-4 py-3 md:hidden shrink-0 bg-card">
                <div className="flex items-center gap-2">
                    <Shield className="size-5 text-primary" />
                    <span className="font-bold">Conversa Admin</span>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setMobileOpen(!mobileOpen)}
                    aria-label="Toggle menu"
                >
                    {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
                </Button>
            </header>

            {/* ── Sidebar (Desktop & Mobile Panel) ────────────────────────── */}
            <aside
                className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-card transition-transform duration-300 md:static md:translate-x-0 ${
                    mobileOpen ? "translate-x-0" : "-translate-x-full"
                }`}
            >
                {/* Brand Logo */}
                <div className="hidden items-center gap-2 border-b px-6 py-4 md:flex">
                    <Shield className="size-6 text-primary" />
                    <div>
                        <h1 className="font-bold text-lg leading-tight">Conversa</h1>
                        <p className="text-xs text-muted-foreground">Admin Dashboard</p>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto space-y-0.5 px-4 py-6 thin-scrollbar">
                    <Link
                        to="/admin"
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                            isActive("/admin")
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                    >
                        <LayoutDashboard className="size-4 shrink-0" />
                        <span>Dashboard Overview</span>
                    </Link>

                    <div className="pt-2 pb-1">
                        <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Applications</p>
                    </div>

                    <Link
                        to="/admin/applications?status=PENDING"
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                            isActive("/admin/applications", "PENDING")
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                    >
                        <ClipboardList className="size-4 shrink-0" />
                        <span>Pending Applications</span>
                    </Link>

                    <Link
                        to="/admin/applications?status=APPROVED_PENDING_VERIFICATION"
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                            isActive("/admin/applications", "APPROVED_PENDING_VERIFICATION")
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                    >
                        <FileCheck className="size-4 shrink-0" />
                        <span>Approved Applications</span>
                    </Link>

                    <Link
                        to="/admin/applications?status=REJECTED"
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                            isActive("/admin/applications", "REJECTED")
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                    >
                        <FileX className="size-4 shrink-0" />
                        <span>Rejected Applications</span>
                    </Link>

                    <div className="pt-3 pb-1">
                        <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Members & Users</p>
                    </div>

                    <Link
                        to="/admin/members"
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                            isActive("/admin/members")
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                    >
                        <Users className="size-4 shrink-0" />
                        <span>Active Members</span>
                    </Link>

                    <Link
                        to="/admin/users"
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                            isActive("/admin/users")
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                    >
                        <UserCheck className="size-4 shrink-0" />
                        <span>Users / Members</span>
                    </Link>

                    <div className="pt-3 pb-1">
                        <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Moderation</p>
                    </div>

                    <Link
                        to="/admin/inbox"
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                            isActive("/admin/inbox")
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                    >
                        <Inbox className="size-4 shrink-0" />
                        <span>Community Inbox</span>
                    </Link>

                    <Link
                        to="/admin/emergency"
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                            isActive("/admin/emergency")
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                    >
                        <AlertOctagon className="size-4 shrink-0 text-amber-500" />
                        <span>Emergency Messages</span>
                    </Link>

                    <div className="pt-3 pb-1">
                        <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">System</p>
                    </div>

                    <Link
                        to="/admin/audit-logs"
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                            isActive("/admin/audit-logs")
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                    >
                        <History className="size-4 shrink-0" />
                        <span>Audit Logs</span>
                    </Link>

                    <Link
                        to="/admin/security-logs"
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                            isActive("/admin/security-logs")
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                    >
                        <ShieldAlert className="size-4 shrink-0" />
                        <span>Security Logs</span>
                    </Link>

                    <Link
                        to="/admin/profile"
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                            isActive("/admin/profile")
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                    >
                        <User className="size-4 shrink-0" />
                        <span>Admin Profile</span>
                    </Link>
                </nav>

                {/* Logged in User Profile + Logout */}
                <div className="border-t p-4 space-y-2 bg-muted/40">
                    <div className="min-w-0 px-2 pb-1">
                        <p className="text-sm font-semibold truncate">{user?.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                    </div>
                    <Button
                        variant="outline"
                        className="w-full justify-start gap-2 text-sm border-primary/20 text-primary hover:bg-primary/10"
                        onClick={() => {
                            setMobileOpen(false);
                            navigate("/user/conversations");
                        }}
                    >
                        <MessagesSquare className="size-4" />
                        <span>Back to Community</span>
                    </Button>
                    <Button
                        variant="destructive"
                        className="w-full justify-start gap-2 text-sm"
                        onClick={handleLogout}
                    >
                        <LogOut className="size-4" />
                        <span>Logout</span>
                    </Button>
                </div>
            </aside>

            {/* Mobile Overlay */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* ── Main Content Area ────────────────────────────────────── */}
            <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <Outlet />
            </main>
        </div>
    );
}
