import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    ClipboardList,
    FileCheck,
    Users,
    FileX,
    Inbox,
    AlertOctagon,
    Shield,
    Clock,
    MailWarning,
    ArrowRight,
    Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { adminApi, adminInboxApi } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

export default function AdminDashboardOverview() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [stats, setStats] = useState({
        pendingCount: 0,
        approvedCount: 0,
        activeCount: 0,
        rejectedCount: 0,
        unreadInboxCount: 0, // active posts count since unread tracking is missing
        failedActivationCount: 0 // counted from APPROVED_PENDING_VERIFICATION items
    });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadStats = async () => {
        setIsLoading(true);
        setError(null);
        try {
            // Fetch counts by making parallel requests with limit=1 to read pagination.total
            const [pendingData, approvedData, activeData, rejectedData, inboxData] = await Promise.all([
                adminApi.listApplications({ status: "PENDING", limit: 1 }),
                adminApi.listApplications({ status: "APPROVED_PENDING_VERIFICATION", limit: 50 }), // Load approved to count failures
                adminApi.listApplications({ status: "ACTIVE", limit: 1 }),
                adminApi.listApplications({ status: "REJECTED", limit: 1 }),
                adminInboxApi.listPosts({ status: "ACTIVE", limit: 1 })
            ]);

            // Count activation failures in loaded approved applications
            const failedEmailsCount = approvedData.applications.filter(
                (app) => app.activationInviteStatus === "FAILED"
            ).length;

            setStats({
                pendingCount: pendingData.pagination.total,
                approvedCount: approvedData.pagination.total,
                activeCount: activeData.pagination.total,
                rejectedCount: rejectedData.pagination.total,
                unreadInboxCount: inboxData.pagination.total, // fallback to active posts
                failedActivationCount: failedEmailsCount
            });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Failed to load dashboard summary stats.";
            setError(msg);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadStats();
    }, []);

    if (isLoading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-4">
                <Loader2 className="animate-spin text-primary size-8" />
                <p className="text-sm text-muted-foreground font-medium">Aggregating summary data...</p>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 thin-scrollbar">
            {/* Header section with profile overview */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-card border rounded-xl p-6 shadow-sm">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                        <Shield className="size-4" />
                        <span>Administrator Workspace</span>
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight">Welcome, {user?.name || "Admin"}</h1>
                    <p className="text-sm text-muted-foreground">
                        Manage community directories, inspect applications, and moderate posts.
                    </p>
                </div>
                <Button onClick={loadStats} variant="outline" className="self-start gap-2">
                    <Clock className="size-4" />
                    <span>Refresh Stats</span>
                </Button>
            </div>

            {/* Missing Backend stats Alert */}
            <Alert className="bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-300">
                <AlertOctagon className="size-5 text-amber-600 dark:text-amber-400" />
                <AlertTitle className="font-semibold text-sm">API Endpoint Availability Notice</AlertTitle>
                <AlertDescription className="text-xs leading-relaxed mt-1">
                    A dedicated backend summary statistics endpoint (e.g. <code>GET /admin/stats</code>) does not exist.
                    Stats are dynamically compiled on the client. Unread inbox count displays total active posts (no read/unread endpoint exists), and failed email activations are sampled from the approved applications list.
                </AlertDescription>
            </Alert>

            {error && (
                <Alert variant="destructive">
                    <AlertDescription className="flex items-center justify-between">
                        <span>{error}</span>
                        <Button size="sm" variant="ghost" onClick={loadStats} className="text-white hover:text-white/80">Retry</Button>
                    </AlertDescription>
                </Alert>
            )}

            {/* Dashboard Summary Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {/* Pending */}
                <Card 
                    className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-amber-500 bg-card"
                    onClick={() => navigate("/admin/applications?status=PENDING")}
                >
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <div className="space-y-1">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Applications</CardTitle>
                            <CardDescription className="text-xs">Awaiting admin review</CardDescription>
                        </div>
                        <div className="p-2 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                            <ClipboardList className="size-5" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-extrabold tracking-tight">{stats.pendingCount}</div>
                        <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 mt-2 font-medium">
                            <span>Requires verification decision</span>
                            <ArrowRight className="size-3" />
                        </div>
                    </CardContent>
                </Card>

                {/* Approved (Pending Verification) */}
                <Card 
                    className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-blue-500 bg-card"
                    onClick={() => navigate("/admin/applications?status=APPROVED_PENDING_VERIFICATION")}
                >
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <div className="space-y-1">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Approved Applications</CardTitle>
                            <CardDescription className="text-xs">Pending account activation</CardDescription>
                        </div>
                        <div className="p-2 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400">
                            <FileCheck className="size-5" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-extrabold tracking-tight">{stats.approvedCount}</div>
                        <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 mt-2 font-medium">
                            <span>Waiting for member OTP validation</span>
                            <ArrowRight className="size-3" />
                        </div>
                    </CardContent>
                </Card>

                {/* Active Members */}
                <Card 
                    className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-emerald-500 bg-card"
                    onClick={() => navigate("/admin/members")}
                >
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <div className="space-y-1">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Active Members</CardTitle>
                            <CardDescription className="text-xs">Verified database directory users</CardDescription>
                        </div>
                        <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                            <Users className="size-5" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-extrabold tracking-tight">{stats.activeCount}</div>
                        <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 mt-2 font-medium">
                            <span>View profile list directory</span>
                            <ArrowRight className="size-3" />
                        </div>
                    </CardContent>
                </Card>

                {/* Rejected */}
                <Card 
                    className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-rose-500 bg-card"
                    onClick={() => navigate("/admin/applications?status=REJECTED")}
                >
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <div className="space-y-1">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Rejected Applications</CardTitle>
                            <CardDescription className="text-xs">Denied with moderation reason</CardDescription>
                        </div>
                        <div className="p-2 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400">
                            <FileX className="size-5" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-extrabold tracking-tight">{stats.rejectedCount}</div>
                        <div className="flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 mt-2 font-medium">
                            <span>Review rejection histories</span>
                            <ArrowRight className="size-3" />
                        </div>
                    </CardContent>
                </Card>

                {/* Inbox Count */}
                <Card 
                    className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-indigo-500 bg-card"
                    onClick={() => navigate("/admin/inbox")}
                >
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <div className="space-y-1">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Inbox Posts</CardTitle>
                            <CardDescription className="text-xs">Active community board posts</CardDescription>
                        </div>
                        <div className="p-2 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                            <Inbox className="size-5" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-extrabold tracking-tight">{stats.unreadInboxCount}</div>
                        <div className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 mt-2 font-medium">
                            <span>Moderate feed messages</span>
                            <ArrowRight className="size-3" />
                        </div>
                    </CardContent>
                </Card>

                {/* Failed Activation Emails */}
                <Card 
                    className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-zinc-500 bg-card"
                    onClick={() => navigate("/admin/applications?status=APPROVED_PENDING_VERIFICATION")}
                >
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <div className="space-y-1">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Failed Activations</CardTitle>
                            <CardDescription className="text-xs">Emails that failed delivery</CardDescription>
                        </div>
                        <div className="p-2 rounded-lg bg-zinc-500/15 text-zinc-600 dark:text-zinc-400">
                            <MailWarning className="size-5 animate-pulse" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-extrabold tracking-tight text-destructive">{stats.failedActivationCount}</div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2 font-medium">
                            <span>Resend invite from application page</span>
                            <ArrowRight className="size-3" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Quick Shortcuts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg font-bold">Admin Directory Controls</CardTitle>
                        <CardDescription>Shortcut list of system views</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-3">
                        <Button variant="outline" className="justify-start gap-2 h-10" asChild>
                            <Link to="/admin/members">
                                <Users className="size-4 text-emerald-600" />
                                <span>Members list</span>
                            </Link>
                        </Button>
                        <Button variant="outline" className="justify-start gap-2 h-10" asChild>
                            <Link to="/admin/users">
                                <Users className="size-4 text-primary" />
                                <span>Users directory</span>
                            </Link>
                        </Button>
                        <Button variant="outline" className="justify-start gap-2 h-10" asChild>
                            <Link to="/admin/audit-logs">
                                <Clock className="size-4 text-indigo-500" />
                                <span>Audit logs</span>
                            </Link>
                        </Button>
                        <Button variant="outline" className="justify-start gap-2 h-10" asChild>
                            <Link to="/admin/security-logs">
                                <Shield className="size-4 text-rose-500" />
                                <span>Security logs</span>
                            </Link>
                        </Button>
                        <Button variant="outline" className="justify-start gap-2 h-10 col-span-2" asChild>
                            <Link to="/admin/profile">
                                <Shield className="size-4 text-zinc-500" />
                                <span>Manage profile & security settings</span>
                            </Link>
                        </Button>
                    </CardContent>
                </Card>

                <Card className="flex flex-col justify-between">
                    <CardHeader>
                        <CardTitle className="text-lg font-bold">Inbox Moderation Guide</CardTitle>
                        <CardDescription>Rules & expectations for admin control</CardDescription>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground space-y-3">
                        <div className="flex items-start gap-2">
                            <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20 shrink-0">PIN</Badge>
                            <p>Pin critical announcement posts to keep them at the top of the member community board.</p>
                        </div>
                        <div className="flex items-start gap-2">
                            <Badge className="bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20 shrink-0">HIDE</Badge>
                            <p>Hide posts or replies that violate guidelines. A moderation reason is required and stored internally.</p>
                        </div>
                        <div className="flex items-start gap-2">
                            <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 shrink-0">RESTORE</Badge>
                            <p>Restore hidden posts/replies if moderation is overturned or resolved.</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
