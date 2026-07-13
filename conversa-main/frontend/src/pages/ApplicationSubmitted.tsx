import { useLocation, Link } from "react-router-dom"
import { CheckCircle2, ClipboardList, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"

/* ─── types ─────────────────────────────────────────────────────────────── */

interface SuccessState {
    applicationId: string
    name: string
    email: string
    status: string
    submittedAt: string
}

/* ─── helpers ────────────────────────────────────────────────────────────── */

function formatDate(iso: string): string {
    try {
        return new Intl.DateTimeFormat("en-IN", {
            dateStyle: "long",
            timeStyle: "short",
        }).format(new Date(iso))
    } catch {
        return iso
    }
}

/* ─── component ─────────────────────────────────────────────────────────── */

export default function ApplicationSubmitted() {
    const { state } = useLocation()

    // Safely narrow the location state – handle direct access / refresh
    const success: SuccessState | null =
        state &&
        typeof state === "object" &&
        "applicationId" in state &&
        typeof state.applicationId === "string"
            ? (state as SuccessState)
            : null

    return (
        <div className="h-full w-full overflow-y-auto bg-background flex flex-col items-center justify-center px-4 py-12">
            <div className="w-full max-w-md space-y-6">
                {/* ── Icon ──────────────────────────────────────────── */}
                <div className="flex flex-col items-center gap-3 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                        <CheckCircle2 className="h-8 w-8 text-primary" strokeWidth={1.5} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Application Submitted</h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {success
                                ? `Thank you, ${success.name.split(" ")[0]}!`
                                : "Your application has been received."}
                        </p>
                    </div>
                </div>

                {/* ── Details card ───────────────────────────────────── */}
                <div className="rounded-xl border bg-card text-card-foreground shadow-sm divide-y divide-border">
                    {success ? (
                        <>
                            {/* Reference */}
                            <div className="flex items-start gap-3 p-4">
                                <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                                <div className="min-w-0">
                                    <p className="text-xs text-muted-foreground">Application Reference</p>
                                    <p className="font-mono font-semibold text-primary text-lg tracking-wider">
                                        {success.applicationId}
                                    </p>
                                </div>
                            </div>

                            {/* Status */}
                            <div className="flex items-start gap-3 p-4">
                                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                                <div>
                                    <p className="text-xs text-muted-foreground">Status</p>
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400 border border-amber-500/20 mt-0.5">
                                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                        {success.status}
                                    </span>
                                </div>
                            </div>

                            {/* Applicant info */}
                            <div className="p-4 space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Name</span>
                                    <span className="font-medium">{success.name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Email</span>
                                    <span className="font-medium truncate max-w-[55%] text-right">
                                        {success.email}
                                    </span>
                                </div>
                                {success.submittedAt && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Submitted</span>
                                        <span className="font-medium">{formatDate(success.submittedAt)}</span>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        /* Fallback for direct access / refresh */
                        <div className="p-6 text-center">
                            <p className="text-sm text-muted-foreground">
                                Your membership application has been received and is awaiting review.
                            </p>
                        </div>
                    )}
                </div>

                {/* ── Message ────────────────────────────────────────── */}
                <div className="rounded-lg border bg-muted/40 p-4 text-sm space-y-2">
                    <p className="font-medium">
                        Your membership application has been submitted and is awaiting admin approval.
                    </p>
                    <p className="text-muted-foreground">
                        After the administrator approves your application, you will receive a Member ID and activation link on your registered email.
                    </p>
                </div>

                {/* ── Action ─────────────────────────────────────────── */}
                <div className="flex flex-col gap-3">
                    <Link to="/activate" className="w-full">
                        <Button className="w-full" size="lg" variant="outline">
                            Already approved? Activate Membership
                        </Button>
                    </Link>
                    <Link to="/" replace className="w-full">
                        <Button className="w-full" size="lg">
                            Return to Home
                        </Button>
                    </Link>
                </div>

                {/* Explicit: no dashboard link */}
            </div>
        </div>
    )
}
