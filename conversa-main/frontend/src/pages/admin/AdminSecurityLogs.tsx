import { ShieldAlert, RotateCw, Download, FileSpreadsheet, Lock } from "lucide-react";
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

// Mock security logs
const MOCK_SECURITY_LOGS = [
    {
        id: "SEC-4412",
        ipAddress: "192.168.1.45",
        actor: "Unknown (test.user@hacker.com)",
        action: "FAILED_LOGIN_ATTEMPT",
        target: "POST /auth/login (Invalid password match)",
        timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        severity: "HIGH",
        status: "BLOCKED"
    },
    {
        id: "SEC-4401",
        ipAddress: "182.16.29.102",
        actor: "Admin (administrator@example.com)",
        action: "SUCCESSFUL_ADMIN_LOGIN",
        target: "POST /auth/login (JWT authtoken generated)",
        timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        severity: "INFO",
        status: "ALLOWED"
    },
    {
        id: "SEC-4389",
        ipAddress: "192.168.1.189",
        actor: "Suspended Member ID (MEM-928A)",
        action: "BLOCKED_RESOURCE_ACCESS",
        target: "GET /directory/members (requireActiveAccount blocked)",
        timestamp: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
        severity: "MEDIUM",
        status: "BLOCKED"
    },
    {
        id: "SEC-4351",
        ipAddress: "127.0.0.1",
        actor: "Local Host Daemon",
        action: "ENV_VARIABLES_VALIDATION",
        target: "Secrets verification loaded OK",
        timestamp: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
        severity: "INFO",
        status: "SUCCESS"
    }
];

export default function AdminSecurityLogs() {
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
                        <Lock className="size-8 text-rose-500" />
                        <span>Security & Login Logs</span>
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Inspect authentication checks, JWT signature verification failures, and rate limit blocks.
                    </p>
                </div>
                <div className="flex gap-2 self-start">
                    <Button variant="outline" className="gap-2" disabled>
                        <Download className="size-4" />
                        <span>Export Logs</span>
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
                    The backend endpoint for fetching security logs (e.g. <code>GET /admin/security-logs</code>) is currently missing or not implemented.
                    Showing offline layout preview with mock security logs.
                </AlertDescription>
            </Alert>

            {/* Logs Table */}
            <Card className="flex-1 min-h-0 flex flex-col">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <FileSpreadsheet className="size-4 text-rose-500" />
                        <span>Security Event Log</span>
                    </CardTitle>
                    <CardDescription>Realtime network security events & access decisions</CardDescription>
                </CardHeader>
                <CardContent className="p-0 overflow-auto thin-scrollbar">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Log ID</TableHead>
                                <TableHead>IP Address</TableHead>
                                <TableHead>Actor Entity</TableHead>
                                <TableHead>Event Action</TableHead>
                                <TableHead>Target URI</TableHead>
                                <TableHead>Severity</TableHead>
                                <TableHead>Time</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {MOCK_SECURITY_LOGS.map((log) => (
                                <TableRow key={log.id}>
                                    <TableCell className="font-mono text-xs font-semibold">{log.id}</TableCell>
                                    <TableCell className="font-mono text-xs">{log.ipAddress}</TableCell>
                                    <TableCell className="text-xs max-w-[150px] truncate" title={log.actor}>{log.actor}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="text-[9px] font-mono font-bold uppercase border-rose-500/25 bg-rose-500/5 text-rose-600">
                                            {log.action}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-xs font-mono max-w-[180px] truncate" title={log.target}>{log.target}</TableCell>
                                    <TableCell>
                                        <Badge
                                            variant="outline"
                                            className={
                                                log.severity === "HIGH"
                                                    ? "bg-rose-500/10 text-rose-600 border-rose-500/20 text-[9px]"
                                                    : log.severity === "MEDIUM"
                                                    ? "bg-amber-500/10 text-amber-600 border-amber-500/20 text-[9px]"
                                                    : "bg-blue-500/10 text-blue-600 border-blue-500/20 text-[9px]"
                                            }
                                        >
                                            {log.severity}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-[9px] text-muted-foreground whitespace-nowrap">
                                        {formatDate(log.timestamp)}
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            className={
                                                log.status === "ALLOWED" || log.status === "SUCCESS"
                                                    ? "bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-bold"
                                                    : "bg-rose-600 hover:bg-rose-700 text-white text-[9px] font-bold"
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
