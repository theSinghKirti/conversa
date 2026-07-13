import { History, ShieldAlert, RotateCw, Download, FileSpreadsheet } from "lucide-react";
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

// Mock audit log history
const MOCK_AUDIT_LOGS = [
    {
        id: "AUD-9912",
        actor: "Admin (administrator@example.com)",
        action: "APPROVE_APPLICATION",
        target: "MEM-8K4P2Q (applicant@example.com)",
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        status: "SUCCESS"
    },
    {
        id: "AUD-9883",
        actor: "Admin (administrator@example.com)",
        action: "REJECT_APPLICATION",
        target: "APP-09412 (fake_user@example.com)",
        timestamp: new Date(Date.now() - 150 * 60 * 1000).toISOString(),
        status: "SUCCESS"
    },
    {
        id: "AUD-9871",
        actor: "System Scheduler",
        action: "STALE_USERS_CLEANUP",
        target: "System database",
        timestamp: new Date(Date.now() - 360 * 60 * 1000).toISOString(),
        status: "SUCCESS"
    },
    {
        id: "AUD-9840",
        actor: "Admin (administrator@example.com)",
        action: "HIDE_POST",
        target: "POST-89U1LA (Violative text content)",
        timestamp: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
        status: "SUCCESS"
    },
    {
        id: "AUD-9811",
        actor: "Admin (administrator@example.com)",
        action: "RESEND_ACTIVATION_EMAIL",
        target: "MEM-9A3X2P (applicant2@example.com)",
        timestamp: new Date(Date.now() - 28 * 3600 * 1000).toISOString(),
        status: "FAILED"
    }
];

export default function AdminAuditLogs() {
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
                        <History className="size-8 text-primary" />
                        <span>System Audit Logs</span>
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Inspect action logs, administrative overrides, and system cron task results.
                    </p>
                </div>
                <div className="flex gap-2 self-start">
                    <Button variant="outline" className="gap-2" disabled>
                        <Download className="size-4" />
                        <span>Export CSV</span>
                    </Button>
                    <Button variant="outline" className="gap-2" disabled>
                        <RotateCw className="size-4" />
                        <span>Refresh</span>
                    </Button>
                </div>
            </div>

            {/* Warning Alert: Missing Endpoint */}
            <Alert className="bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-300">
                <ShieldAlert className="size-5 text-amber-600 dark:text-amber-400" />
                <AlertTitle className="font-semibold text-sm">Missing Backend API Endpoint</AlertTitle>
                <AlertDescription className="text-xs leading-relaxed mt-1">
                    The backend endpoint for fetching system audit logs (e.g. <code>GET /admin/audit-logs</code>) is currently missing or not implemented.
                    Showing offline layout preview with mock action logs.
                </AlertDescription>
            </Alert>

            {/* Logs Table */}
            <Card className="flex-1 min-h-0 flex flex-col">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <FileSpreadsheet className="size-4 text-primary" />
                        <span>Action History Log</span>
                    </CardTitle>
                    <CardDescription>Administrative audit trail database events</CardDescription>
                </CardHeader>
                <CardContent className="p-0 overflow-auto thin-scrollbar">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Log ID</TableHead>
                                <TableHead>Actor</TableHead>
                                <TableHead>Action</TableHead>
                                <TableHead>Target Entity</TableHead>
                                <TableHead>Timestamp</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {MOCK_AUDIT_LOGS.map((log) => (
                                <TableRow key={log.id}>
                                    <TableCell className="font-mono text-xs font-semibold">{log.id}</TableCell>
                                    <TableCell className="text-xs font-medium">{log.actor}</TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className="text-[10px] font-semibold font-mono uppercase">
                                            {log.action}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-xs font-mono max-w-[200px] truncate" title={log.target}>
                                        {log.target}
                                    </TableCell>
                                    <TableCell className="text-[10px] text-muted-foreground whitespace-nowrap">
                                        {formatDate(log.timestamp)}
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant="outline"
                                            className={
                                                log.status === "SUCCESS"
                                                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]"
                                                    : "bg-rose-500/10 text-rose-600 border-rose-500/20 text-[10px]"
                                            }
                                        >
                                            {log.status}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
