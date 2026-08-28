import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, Clock, Send, Megaphone, Trash2, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { adminApi } from "@/lib/api";
import type { EmergencyBroadcast } from "@/lib/api";
import { toast } from "sonner";

export default function AdminEmergency() {
    // Form state
    const [title, setTitle] = useState("");
    const [severity, setSeverity] = useState<"CRITICAL" | "WARNING" | "INFO">("CRITICAL");
    const [message, setMessage] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // History state
    const [broadcasts, setBroadcasts] = useState<EmergencyBroadcast[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Load broadcast history from backend
    const loadHistory = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await adminApi.getEmergencyBroadcasts();
            setBroadcasts(data.broadcasts || []);
        } catch (err: unknown) {
            setError("Unable to load broadcast history. Please refresh.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadHistory();
    }, [loadHistory]);

    // Handle form submit
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!title.trim() || !message.trim()) {
            toast.error("Please fill in both alert title and message content.");
            return;
        }

        setIsSubmitting(true);
        try {
            await adminApi.createEmergencyBroadcast({
                title: title.trim(),
                message: message.trim(),
                severity,
                targetGroup: "All Active Members",
            });

            toast.success("Emergency broadcast alert sent successfully!");
            setTitle("");
            setMessage("");
            setSeverity("CRITICAL");
            await loadHistory();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Failed to send emergency broadcast.";
            toast.error(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle delete broadcast record
    const handleDelete = async (id: string) => {
        setDeletingId(id);
        try {
            await adminApi.deleteEmergencyBroadcast(id);
            toast.success("Broadcast record removed.");
            await loadHistory();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Failed to delete broadcast record.";
            toast.error(msg);
        } finally {
            setDeletingId(null);
        }
    };

    const formatDate = (iso: string) => {
        try {
            return new Intl.DateTimeFormat("en-IN", {
                dateStyle: "medium",
                timeStyle: "short",
            }).format(new Date(iso));
        } catch {
            return iso;
        }
    };

    return (
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 md:p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <AlertTriangle className="size-8 text-amber-500" />
                        <span>Emergency Messages</span>
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Broadcast system-wide critical alerts and review dispatch history.
                    </p>
                </div>
                <Button variant="outline" onClick={loadHistory} className="self-start gap-2">
                    <Clock className="size-4" />
                    <span>Refresh History</span>
                </Button>
            </div>

            {/* Error Alert */}
            {error && (
                <Alert variant="destructive">
                    <AlertDescription className="flex items-center justify-between">
                        <span>{error}</span>
                        <Button size="sm" variant="ghost" onClick={loadHistory} className="text-white hover:text-white/80">
                            Retry
                        </Button>
                    </AlertDescription>
                </Alert>
            )}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Send Alert Form */}
                <div className="space-y-6">
                    <Card className="border-amber-500/20">
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Megaphone className="size-4 text-amber-500" />
                                <span>Create Broadcast Alert</span>
                            </CardTitle>
                            <CardDescription>Dispatch a push notification to members</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-muted-foreground">Alert Title</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Urgent System Outage"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        disabled={isSubmitting}
                                        className="w-full text-sm border rounded p-2 bg-background focus:ring-1 focus:ring-amber-500 outline-none"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-muted-foreground">Severity Level</label>
                                    <select
                                        value={severity}
                                        onChange={(e) => setSeverity(e.target.value as "CRITICAL" | "WARNING" | "INFO")}
                                        disabled={isSubmitting}
                                        className="w-full text-sm border rounded p-2 bg-background focus:ring-1 focus:ring-amber-500 outline-none"
                                    >
                                        <option value="CRITICAL">CRITICAL (Immediate Action Required)</option>
                                        <option value="WARNING">WARNING (Notice / Precautionary)</option>
                                        <option value="INFO">INFO (General Announcement)</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-muted-foreground">Message Content</label>
                                    <textarea
                                        rows={4}
                                        placeholder="Type emergency alert body..."
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        disabled={isSubmitting}
                                        className="w-full text-sm border rounded p-2 bg-background focus:ring-1 focus:ring-amber-500 outline-none resize-none"
                                    />
                                </div>

                                <Button
                                    type="submit"
                                    disabled={isSubmitting || !title.trim() || !message.trim()}
                                    className="w-full gap-2 text-xs bg-amber-500 text-white hover:bg-amber-600"
                                >
                                    {isSubmitting ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                                    <span>{isSubmitting ? "Dispatching Alert..." : "Send Broadcast Alert"}</span>
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>

                {/* History Section */}
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Clock className="size-4 text-primary" />
                                <span>Broadcast History</span>
                            </CardTitle>
                            <CardDescription>Log of past emergency notifications dispatched</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0 overflow-auto">
                            {isLoading ? (
                                <div className="space-y-3 p-6">
                                    <Skeleton className="h-6 w-full" />
                                    <Skeleton className="h-12 w-full" />
                                    <Skeleton className="h-12 w-full" />
                                </div>
                            ) : broadcasts.length === 0 ? (
                                <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground space-y-3">
                                    <ShieldAlert className="size-12 text-muted-foreground" strokeWidth={1.5} />
                                    <p className="text-lg font-medium">No emergency broadcasts sent yet</p>
                                    <p className="text-xs max-w-sm">
                                        Use the broadcast form on the left to dispatch your first emergency notification.
                                    </p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Alert ID</TableHead>
                                            <TableHead>Title</TableHead>
                                            <TableHead>Severity</TableHead>
                                            <TableHead>Target</TableHead>
                                            <TableHead>Sent At</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {broadcasts.map((alert) => (
                                            <TableRow key={alert._id || alert.alertId}>
                                                <TableCell className="font-mono text-xs font-semibold">{alert.alertId}</TableCell>
                                                <TableCell>
                                                    <div className="text-xs font-semibold">{alert.title}</div>
                                                    <p className="text-[10px] text-muted-foreground line-clamp-1 max-w-[250px]">{alert.message}</p>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant="outline"
                                                        className={
                                                            alert.severity === "CRITICAL"
                                                                ? "bg-rose-500/10 text-rose-600 border-rose-500/20 text-[10px]"
                                                                : alert.severity === "WARNING"
                                                                ? "bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]"
                                                                : "bg-blue-500/10 text-blue-600 border-blue-500/20 text-[10px]"
                                                        }
                                                    >
                                                        {alert.severity}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground">{alert.targetGroup || "All Active Members"}</TableCell>
                                                <TableCell className="text-[10px] text-muted-foreground whitespace-nowrap">{formatDate(alert.createdAt)}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="size-8 text-destructive hover:bg-destructive/10"
                                                        onClick={() => handleDelete(alert._id)}
                                                        disabled={deletingId === alert._id}
                                                    >
                                                        {deletingId === alert._id ? (
                                                            <Loader2 className="size-3.5 animate-spin" />
                                                        ) : (
                                                            <Trash2 className="size-3.5" />
                                                        )}
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
