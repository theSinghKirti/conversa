import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Search, RotateCw, Eye, Check, X, ClipboardList, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { adminApi } from "@/lib/api";
import type { MembershipApplication, ApplicationStatus } from "@/lib/api";
import { toast } from "sonner";

export default function AdminApplications() {
    // ── query state ──────────────────────────────────────────────────
    const [status, setStatus] = useState<ApplicationStatus>("PENDING");
    const [search, setSearch] = useState("");
    const [searchInput, setSearchInput] = useState("");
    const [page, setPage] = useState(1);

    // ── data state ───────────────────────────────────────────────────
    const [applications, setApplications] = useState<MembershipApplication[]>([]);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // ── action state ─────────────────────────────────────────────────
    const [actionLoading, setActionLoading] = useState(false);
    const [appToApprove, setAppToApprove] = useState<MembershipApplication | null>(null);
    const [appToReject, setAppToReject] = useState<MembershipApplication | null>(null);
    const [rejectionReason, setRejectionReason] = useState("");
    const [rejectionError, setRejectionError] = useState<string | null>(null);

    // ── fetch data ───────────────────────────────────────────────────
    const fetchApplications = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await adminApi.listApplications({
                status,
                search: search.trim() || undefined,
                page,
                limit: 20,
            });
            setApplications(data.applications);
            setTotal(data.pagination.total);
            setTotalPages(data.pagination.totalPages || 1);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to load applications.";
            setError(message);
        } finally {
            setIsLoading(false);
        }
    }, [status, search, page]);

    useEffect(() => {
        fetchApplications();
    }, [fetchApplications]);

    // Handle search submission
    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSearch(searchInput);
        setPage(1);
    };

    // Reset search
    const handleClearSearch = () => {
        setSearchInput("");
        setSearch("");
        setPage(1);
    };

    // ── approval action ──────────────────────────────────────────────
    const handleApprove = async () => {
        if (!appToApprove) return;
        setActionLoading(true);
        try {
            const data = await adminApi.approveApplication(appToApprove.applicationId);
            toast.success(`Application approved! Member ID: ${data.application.memberId}`, {
                duration: 6000,
            });
            setAppToApprove(null);
            fetchApplications();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to approve application.";
            toast.error(message);
        } finally {
            setActionLoading(false);
        }
    };

    // ── rejection action ─────────────────────────────────────────────
    const handleReject = async () => {
        if (!appToReject) return;
        setRejectionError(null);

        const reason = rejectionReason.trim();
        if (!reason) {
            setRejectionError("Rejection reason is required.");
            return;
        }
        if (reason.length < 5) {
            setRejectionError("Rejection reason must be at least 5 characters.");
            return;
        }
        if (reason.length > 500) {
            setRejectionError("Rejection reason must not exceed 500 characters.");
            return;
        }

        setActionLoading(true);
        try {
            await adminApi.rejectApplication(appToReject.applicationId, reason);
            toast.success("Application rejected successfully.");
            setAppToReject(null);
            setRejectionReason("");
            fetchApplications();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to reject application.";
            setRejectionError(message);
        } finally {
            setActionLoading(false);
        }
    };

    // Status Badge generator
    const getStatusBadge = (statusVal: ApplicationStatus) => {
        switch (statusVal) {
            case "PENDING":
                return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">Pending</Badge>;
            case "APPROVED_PENDING_VERIFICATION":
                return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">Approved (Pending Verification)</Badge>;
            case "ACTIVE":
                return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">Active</Badge>;
            case "REJECTED":
                return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">Rejected</Badge>;
            default:
                return <Badge variant="outline">{statusVal}</Badge>;
        }
    };

    return (
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 md:p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Membership Applications</h1>
                    <p className="text-sm text-muted-foreground">
                        Review, approve or reject community directory membership requests.
                    </p>
                </div>
                <Button variant="outline" onClick={fetchApplications} className="self-start gap-2">
                    <RotateCw className="size-4" />
                    <span>Refresh</span>
                </Button>
            </div>

            {/* Filters and Search */}
            <Card>
                <CardContent className="pt-6">
                    <form onSubmit={handleSearchSubmit} className="flex flex-col gap-4 md:flex-row md:items-center">
                        {/* Search Input */}
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Search by Application ID, name, email or phone"
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                className="pl-9 pr-8"
                            />
                            {searchInput && (
                                <button
                                    type="button"
                                    onClick={handleClearSearch}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                                >
                                    Clear
                                </button>
                            )}
                        </div>

                        {/* Status Select */}
                        <div className="flex gap-4">
                            <Select
                                value={status}
                                onValueChange={(val) => {
                                    setStatus(val as ApplicationStatus);
                                    setPage(1);
                                }}
                            >
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Status Filter" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="PENDING">Pending</SelectItem>
                                    <SelectItem value="APPROVED_PENDING_VERIFICATION">Approved</SelectItem>
                                    <SelectItem value="REJECTED">Rejected</SelectItem>
                                </SelectContent>
                            </Select>

                            <Button type="submit">Search</Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            {/* Error Alert */}
            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* Table / List */}
            <Card className="flex-1 min-h-0 flex flex-col">
                <CardContent className="p-0 flex-1 overflow-auto thin-scrollbar">
                    {isLoading ? (
                        <div className="space-y-4 p-6">
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-20 w-full" />
                            <Skeleton className="h-20 w-full" />
                            <Skeleton className="h-20 w-full" />
                        </div>
                    ) : applications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground space-y-3">
                            <ClipboardList className="size-12 text-muted" strokeWidth={1.5} />
                            <p className="text-lg font-medium">No applications found</p>
                            <p className="text-sm max-w-sm">
                                There are no applications matching the selected criteria.
                            </p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Reference</TableHead>
                                    <TableHead>Applicant Name</TableHead>
                                    <TableHead className="hidden md:table-cell">Contact</TableHead>
                                    <TableHead className="hidden lg:table-cell">Location</TableHead>
                                    <TableHead className="hidden sm:table-cell">Occupation</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {applications.map((app) => (
                                    <TableRow key={app.applicationId}>
                                        <TableCell className="font-mono font-medium text-xs">
                                            {app.applicationId}
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-medium text-sm">{app.name}</div>
                                            <div className="text-xs text-muted-foreground md:hidden">
                                                {app.email} | {app.phone}
                                            </div>
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell text-xs space-y-0.5">
                                            <p className="truncate max-w-[200px]">{app.email}</p>
                                            <p className="text-muted-foreground">{app.phone}</p>
                                        </TableCell>
                                        <TableCell className="hidden lg:table-cell text-xs">
                                            {app.city}, {app.state}
                                        </TableCell>
                                        <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                                            {app.occupation}
                                        </TableCell>
                                        <TableCell>
                                            <div className="space-y-1">
                                                <div>{getStatusBadge(app.status)}</div>
                                                {app.status === "APPROVED_PENDING_VERIFICATION" && (
                                                    <div className="text-[10px] text-muted-foreground whitespace-nowrap">
                                                        Invite: {app.activationInviteStatus === "SENT" ? (
                                                            <span className="text-emerald-600 font-medium">Sent</span>
                                                        ) : app.activationInviteStatus === "FAILED" ? (
                                                            <span className="text-destructive font-medium">Failed</span>
                                                        ) : (
                                                            <span>Not Sent</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right space-x-1.5 whitespace-nowrap">
                                            <Link to={`/admin/applications/${app.applicationId}`}>
                                                <Button size="icon" variant="ghost" className="size-8" title="View details">
                                                    <Eye className="size-4" />
                                                </Button>
                                            </Link>
                                            {app.status === "PENDING" && (
                                                <>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="size-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                                                        onClick={() => setAppToApprove(app)}
                                                        title="Approve"
                                                    >
                                                        <Check className="size-4" />
                                                    </Button>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                        onClick={() => setAppToReject(app)}
                                                        title="Reject"
                                                    >
                                                        <X className="size-4" />
                                                    </Button>
                                                </>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between px-2 py-4">
                    <p className="text-sm text-muted-foreground">
                        Showing page <span className="font-semibold">{page}</span> of <span className="font-semibold">{totalPages}</span> ({total} total results)
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="icon"
                            disabled={page === 1 || isLoading}
                            onClick={() => setPage((p) => p - 1)}
                            aria-label="Previous page"
                        >
                            <ChevronLeft className="size-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            disabled={page === totalPages || isLoading}
                            onClick={() => setPage((p) => p + 1)}
                            aria-label="Next page"
                        >
                            <ChevronRight className="size-4" />
                        </Button>
                    </div>
                </div>
            )}

            {/* ── Approval Dialog ─────────────────────────────────────── */}
            <AlertDialog open={!!appToApprove} onOpenChange={(open) => !open && setAppToApprove(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Approve Membership Application?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to approve the application for <strong>{appToApprove?.name}</strong>?
                            <br /><br />
                            Approving will generate a Member ID and move the application to pending verification. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleApprove();
                            }}
                            disabled={actionLoading}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            {actionLoading ? "Approving…" : "Approve Application"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ── Rejection Dialog ────────────────────────────────────── */}
            <Dialog open={!!appToReject} onOpenChange={(open) => !open && !actionLoading && setAppToReject(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reject Membership Application</DialogTitle>
                        <DialogDescription>
                            Provide a reason for rejecting the application of <strong>{appToReject?.name}</strong>.
                        </DialogDescription>
                    </DialogHeader>

                    {rejectionError && (
                        <Alert variant="destructive">
                            <AlertDescription>{rejectionError}</AlertDescription>
                        </Alert>
                    )}

                    <div className="space-y-2 py-2">
                        <Label htmlFor="rejection-reason">Rejection Reason (min 5, max 500 chars)</Label>
                        <Textarea
                            id="rejection-reason"
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            placeholder="e.g. Membership details could not be verified."
                            rows={4}
                            maxLength={500}
                            disabled={actionLoading}
                        />
                        <div className="text-right text-xs text-muted-foreground">
                            {rejectionReason.length}/500
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAppToReject(null)} disabled={actionLoading}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleReject}
                            disabled={actionLoading}
                        >
                            {actionLoading ? "Rejecting…" : "Reject Application"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
