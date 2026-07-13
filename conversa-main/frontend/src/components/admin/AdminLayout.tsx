import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { ClipboardList, Inbox, LogOut, Menu, X, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export default function AdminLayout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [mobileOpen, setMobileOpen] = useState(false);

    const handleLogout = () => {
        logout();
        navigate("/admin/login", { replace: true });
    };

    const isActive = (path: string) => location.pathname.startsWith(path);

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
                <nav className="flex-1 space-y-1 px-4 py-6">
                    <Link
                        to="/admin/applications"
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                            isActive("/admin/applications")
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                    >
                        <ClipboardList className="size-4 shrink-0" />
                        <span>Pending Applications</span>
                    </Link>
                    <Link
                        to="/admin/inbox"
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                            isActive("/admin/inbox")
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                    >
                        <Inbox className="size-4 shrink-0" />
                        <span>Community Inbox</span>
                    </Link>
                </nav>

                {/* Logged in User Profile + Logout */}
                <div className="border-t p-4 space-y-3 bg-muted/40">
                    <div className="min-w-0 px-2">
                        <p className="text-sm font-semibold truncate">{user?.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                    </div>
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
