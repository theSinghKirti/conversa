import { AlertTriangle, Clock, Send, ShieldAlert, BadgeAlert, Megaphone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

// Mock emergency records for preview
const MOCK_EMERGENCY_ALERTS = [
    {
        alertId: "EMG-2983",
        sender: "Security Admin",
        title: "Severe Weather Warning: Flash Floods",
        message: "Emergency broadcast to all members in City North: Please stay indoors due to torrential rains and flooding warnings.",
        severity: "CRITICAL",
        targetGroup: "All North District Members",
        timestamp: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
        status: "DELIVERED"
    },
    {
        alertId: "EMG-1029",
        sender: "System Bot",
        title: "Database Maintenance Cooldown",
        message: "System warning: The community directories may be slow or offline for 10 minutes starting at midnight.",
        severity: "WARNING",
        targetGroup: "All Active Members",
        timestamp: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
        status: "DELIVERED"
    }
];

export default function AdminEmergency() {
    const formatDate = (iso: string) => {
        try {
            return new Intl.DateTimeFormat("en-IN", {
                dateStyle: "medium",
                timeStyle: "short"
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
            </div>

            {/* Warning Alert: Missing Endpoint */}
            <Alert className="bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-300">
                <ShieldAlert className="size-5 text-amber-600 dark:text-amber-400" />
                <AlertTitle className="font-semibold text-sm">Missing Backend API Endpoint</AlertTitle>
                <AlertDescription className="text-xs leading-relaxed mt-1">
                    The backend endpoint for creating and listing emergency broadcasts (e.g. <code>GET /admin/emergency-messages</code>) is currently missing or not implemented.
                    Showing offline layout preview with mock historical records.
                </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Send Alert form (Disabled) */}
                <div className="space-y-6">
                    <Card className="border-amber-500/20">
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Megaphone className="size-4 text-amber-500" />
                                <span>Create Broadcast Alert</span>
                            </CardTitle>
                            <CardDescription>Dispatch a push notification to members</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-muted-foreground">Alert Title</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Urgent System Outage"
                                    disabled
                                    className="w-full text-sm border rounded p-2 bg-muted/50 cursor-not-allowed"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-muted-foreground">Severity Level</label>
                                <select disabled className="w-full text-sm border rounded p-2 bg-muted/50 cursor-not-allowed">
                                    <option>CRITICAL (Immediate Action Required)</option>
                                    <option>WARNING (Notice / Precautionary)</option>
                                    <option>INFO (General Announcement)</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-muted-foreground">Message Content</label>
                                <textarea
                                    rows={4}
                                    placeholder="Type emergency alert body..."
                                    disabled
                                    className="w-full text-sm border rounded p-2 bg-muted/50 cursor-not-allowed resize-none"
                                />
                            </div>

                            <Alert className="bg-destructive/5 border-destructive/10 text-destructive text-[11px] p-2 leading-relaxed">
                                <BadgeAlert className="size-4 text-destructive shrink-0" />
                                <span>Dispatch action requires: <code>POST /admin/emergency/broadcast</code></span>
                            </Alert>

                            <Button disabled className="w-full gap-2 text-xs bg-amber-500 text-white hover:bg-amber-600">
                                <Send className="size-3.5" />
                                <span>Send Broadcast Alert</span>
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                {/* History Section */}
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Clock className="size-4 text-primary" />
                                <span>Broadcast History (Preview)</span>
                            </CardTitle>
                            <CardDescription>Log of past emergency notifications dispatched</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0 overflow-auto">
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
                                    {MOCK_EMERGENCY_ALERTS.map((alert) => (
                                        <TableRow key={alert.alertId}>
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
                                                            : "bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]"
                                                    }
                                                >
                                                    {alert.severity}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">{alert.targetGroup}</TableCell>
                                            <TableCell className="text-[10px] text-muted-foreground whitespace-nowrap">{formatDate(alert.timestamp)}</TableCell>
                                            <TableCell className="text-right">
                                                <Button size="icon" variant="ghost" className="size-8 text-destructive" disabled>
                                                    <Trash2 className="size-3.5" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
