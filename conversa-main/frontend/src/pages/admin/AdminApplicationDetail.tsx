import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Check, X, Shield, MapPin, Briefcase, Award, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { adminApi } from "@/lib/api";
import type { MembershipApplication, ApplicationStatus } from "@/lib/api";
import { toast } from "sonner";

export default function AdminApplicationDetail() {
    const { applicationId } = useParams<{ applicationId: string }>();

    const [application, setApplication] = useState<MembershipApplication | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Actions state
    const [actionLoading, setActionLoading] = useState(false);
    const [showApproveDialog, setShowApproveDialog] = useState(false);
    const [showRejectDialog, setShowRejectDialog] = useState(false);
    const [rejectionReason, setRejectionReason] = useState("");
    const [rejectionError, setRejectionError] = useState<string | null>(null);
    const [showInviteDialog, setShowInviteDialog] = useState(false);

    const fetchDetail = async () => {
        if (!applicationId) return;
        setIsLoading(true);
        setError(null);
        try {
            const data = await adminApi.getApplication(applicationId);
            setApplication(data.application);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to load application detail.";
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchDetail();
    }, [applicationId]);

    const handleApprove = async () => {
        if (!applicationId) return;
        setActionLoading(true);
        try {
            const data = await adminApi.approveApplication(applicationId);
            toast.success(`Application approved! Member ID: ${data.application.memberId}`, {
                duration: 6000,
            });
            setShowApproveDialog(false);
            fetchDetail(); // Refresh details on page
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to approve application.";
            toast.error(message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleResendInvite = async () => {
        if (!applicationId) return;
        setActionLoading(true);
        try {
            const data = await adminApi.sendActivationInvite(applicationId);
            toast.success(data.message || "Activation invitation sent successfully.");
            setShowInviteDialog(false);
            fetchDetail(); // Refresh the details
        } catch (err: any) {
            let msg = err.message || "Failed to resend invitation email.";
            if (err.status === 429) {
                msg = "Please wait 60 seconds before resending another invitation.";
            }
            toast.error(msg);
        } finally {
            setActionLoading(false);
        }
    };

    const handleReject = async () => {
        if (!applicationId) return;
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
            await adminApi.rejectApplication(applicationId, reason);
            toast.success("Application rejected successfully.");
            setShowRejectDialog(false);
            setRejectionReason("");
            fetchDetail(); // Refresh details on page
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to reject application.";
            setRejectionError(message);
        } finally {
            setActionLoading(false);
        }
    };

    const formatDate = (iso?: string) => {
        if (!iso) return "N/A";
        try {
            return new Intl.DateTimeFormat("en-IN", {
                dateStyle: "long",
                timeStyle: "short",
            }).format(new Date(iso));
        } catch {
            return iso;
        }
    };

    const getStatusBadge = (statusVal?: ApplicationStatus) => {
        if (!statusVal) return null;
        switch (statusVal) {
            case "PENDING":
                return <Badge className="bg-amber-500 hover:bg-amber-600">Pending</Badge>;
            case "APPROVED_PENDING_VERIFICATION":
                return <Badge className="bg-blue-500 hover:bg-blue-600">Approved (Pending Verification)</Badge>;
            case "ACTIVE":
                return <Badge className="bg-emerald-500 hover:bg-emerald-600">Active</Badge>;
            case "REJECTED":
                return <Badge variant="destructive">Rejected</Badge>;
            default:
                return <Badge variant="secondary">{statusVal}</Badge>;
        }
    };

    if (isLoading) {
        return (
            <div className="flex-1 p-6 space-y-6 overflow-y-auto">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-60 w-full" />
            </div>
        );
    }

    if (error || !application) {
        return (
            <div className="flex-1 p-6 space-y-4 overflow-y-auto">
                <Link to="/admin/applications">
                    <Button variant="ghost" size="sm" className="gap-2">
                        <ArrowLeft className="size-4" />
                        Back to Applications
                    </Button>
                </Link>
                <Alert variant="destructive">
                    <AlertDescription>{error || "Application not found."}</AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 md:p-6 space-y-6">
            {/* Header / Nav */}
            <div className="flex items-center gap-3">
                <Link to="/admin/applications" aria-label="Back to application list">
                    <Button variant="ghost" size="icon" className="shrink-0">
                        <ArrowLeft className="size-5" />
                    </Button>
                </Link>
                <div>
                    <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{application.applicationId}</span>
                        {getStatusBadge(application.status)}
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight">{application.name}</h1>
                </div>
            </div>

            {/* Application review card */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Details Section */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Basic Info */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Shield className="size-4 text-primary" />
                                <span>Applicant Information</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
                            <div>
                                <span className="text-muted-foreground block">Email Address</span>
                                <span className="font-medium">{application.email}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground block">Phone Number</span>
                                <span className="font-medium">{application.phone}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground block">Blood Group</span>
                                <span className="font-medium">{application.bloodGroup || "Not provided"}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground block">Submitted On</span>
                                <span className="font-medium">{formatDate(application.createdAt)}</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Location */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <MapPin className="size-4 text-primary" />
                                <span>Location Details</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
                            <div>
                                <span className="text-muted-foreground block">City</span>
                                <span className="font-medium">{application.city}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground block">State</span>
                                <span className="font-medium">{application.state}</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Professional info */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Briefcase className="size-4 text-primary" />
                                <span>Professional & Education Details</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3 text-sm">
                            <div>
                                <span className="text-muted-foreground block">Occupation</span>
                                <span className="font-medium">{application.occupation}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground block">Organisation</span>
                                <span className="font-medium">{application.organisation || "N/A"}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground block">Education</span>
                                <span className="font-medium">{application.education || "N/A"}</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Community statement */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Award className="size-4 text-primary" />
                                <span>Connection to Community</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm">
                            <p className="whitespace-pre-wrap font-medium">
                                {application.communityDetails || "No details provided."}
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Status and Action Panel */}
                <div className="space-y-6">
                    {/* Status Summary */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Review Overview</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm">
                            <div>
                                <span className="text-muted-foreground block">Current Status</span>
                                <div className="mt-1">{getStatusBadge(application.status)}</div>
                            </div>
                            
                            {application.memberId && (
                                <div>
                                    <span className="text-muted-foreground block">Assigned Member ID</span>
                                    <span className="font-mono font-bold text-lg text-primary tracking-wider mt-0.5 block">
                                        {application.memberId}
                                    </span>
                                </div>
                            )}

                            {application.status === "APPROVED_PENDING_VERIFICATION" && (
                                <div className="space-y-1.5">
                                    <span className="text-muted-foreground block">Activation Invitation</span>
                                    <div className="flex flex-col gap-1">
                                        <div>
                                            {application.activationInviteStatus === "SENT" ? (
                                                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">Sent</Badge>
                                            ) : application.activationInviteStatus === "FAILED" ? (
                                                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">Failed</Badge>
                                            ) : (
                                                <Badge variant="outline" className="bg-muted text-muted-foreground">Not Sent</Badge>
                                            )}
                                        </div>
                                        {application.activationInviteSentAt && (
                                            <p className="text-xs text-muted-foreground">
                                                Sent: {formatDate(application.activationInviteSentAt)}
                                            </p>
                                        )}
                                        {application.activationInviteError && (
                                            <p className="text-xs text-destructive bg-destructive/5 rounded p-1.5 border border-destructive/10 leading-relaxed max-h-16 overflow-y-auto">
                                                {application.activationInviteError}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {application.rejectionReason && (
                                <div>
                                    <span className="text-muted-foreground block">Rejection Reason</span>
                                    <span className="text-destructive mt-0.5 block font-medium">
                                        {application.rejectionReason}
                                    </span>
                                </div>
                            )}

                            {application.reviewedAt && (
                                <div>
                                    <span className="text-muted-foreground block">Reviewed On</span>
                                    <span className="font-medium block mt-0.5">
                                        {formatDate(application.reviewedAt)}
                                    </span>
                                </div>
                            )}

                            <div className="pt-2 border-t flex flex-col gap-3">
                                <span className="text-xs text-muted-foreground">
                                    Consent confirmation: {application.consentAccepted ? "Yes (Agreed)" : "No"}
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Decision Panel */}
                    {application.status === "PENDING" && (
                        <Card className="border-primary/20 bg-primary/5">
                            <CardHeader>
                                <CardTitle className="text-base">Action Required</CardTitle>
                                <CardDescription>
                                    Perform verification checks before making a final decision.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-3">
                                <Button
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                                    onClick={() => setShowApproveDialog(true)}
                                >
                                    <Check className="size-4" />
                                    <span>Approve Member</span>
                                </Button>
                                <Button
                                    variant="destructive"
                                    className="w-full gap-2"
                                    onClick={() => setShowRejectDialog(true)}
                                >
                                    <X className="size-4" />
                                    <span>Reject Application</span>
                                </Button>
                            </CardContent>
                        </Card>
                    )}

                    {/* Resend Invite Panel */}
                    {application.status === "APPROVED_PENDING_VERIFICATION" && (
                        <Card className="border-primary/20 bg-primary/5">
                            <CardHeader>
                                <CardTitle className="text-base">Activation Invitation</CardTitle>
                                <CardDescription>
                                    Resend the membership approval & activation email to the registered address.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-3">
                                <Button
                                    className="w-full gap-2"
                                    onClick={() => setShowInviteDialog(true)}
                                    disabled={actionLoading}
                                >
                                    <Mail className="size-4" />
                                    <span>Resend Invitation</span>
                                </Button>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            {/* ── Resend Invite Dialog ─────────────────────────────────── */}
            <AlertDialog open={showInviteDialog} onOpenChange={(open) => !open && setShowInviteDialog(false)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Resend Activation Invitation?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to resend the approval invitation email to <strong>{application.email}</strong>?
                            <br /><br />
                            A 60-second resend cooldown applies to this request.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleResendInvite();
                            }}
                            disabled={actionLoading}
                        >
                            {actionLoading ? "Sending invite…" : "Resend Invitation"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ── Approval Dialog ─────────────────────────────────────── */}
            <AlertDialog open={showApproveDialog} onOpenChange={(open) => !open && setShowApproveDialog(false)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Approve Membership Application?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to approve the application for <strong>{application.name}</strong>?
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
            <Dialog open={showRejectDialog} onOpenChange={(open) => !open && !actionLoading && setShowRejectDialog(false)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reject Membership Application</DialogTitle>
                        <DialogDescription>
                            Provide a reason for rejecting the application of <strong>{application.name}</strong>.
                        </DialogDescription>
                    </DialogHeader>

                    {rejectionError && (
                        <Alert variant="destructive">
                            <AlertDescription>{rejectionError}</AlertDescription>
                        </Alert>
                    )}

                    <div className="space-y-2 py-2">
                        <Label htmlFor="rejection-reason-detail">Rejection Reason (min 5, max 500 chars)</Label>
                        <Textarea
                            id="rejection-reason-detail"
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
                        <Button variant="outline" onClick={() => setShowRejectDialog(false)} disabled={actionLoading}>
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
