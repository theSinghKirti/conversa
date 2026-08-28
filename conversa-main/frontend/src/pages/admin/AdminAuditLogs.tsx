import { useState, useEffect, useCallback } from "react";
import { History, ShieldAlert, RotateCw, Download, FileSpreadsheet } from "lucide-react";
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
import type { AuditLog } from "@/lib/api";

export default function AdminAuditLogs() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchLogs = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await adminApi.listAuditLogs();
            setLogs(data.logs || []);
        } catch (err: unknown) {
            setError("Unable to load audit logs. Please refresh.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const handleExportCsv = () => {
        if (logs.length === 0) return;
        const csvHeaders = ["Log ID", "Actor", "Action", "Target Entity", "Timestamp", "Status"];
        const csvRows = logs.map((log) => [
            log.id || log.logId || "",
            `"${(log.actor || "").replace(/"/g, '""')}"`,
            log.action || "",
            `"${(log.target || "").replace(/"/g, '""')}"`,
            log.timestamp || log.createdAt || "",
            log.status || "SUCCESS",
        ]);

        const csvContent = [csvHeaders.join(","), ...csvRows.map((r) => r.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `conversa-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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
                        <History className="size-8 text-primary" />
                        <span>System Audit Logs</span>
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Inspect action logs, administrative overrides, and system cron task results.
                    </p>
                </div>
                <div className="flex gap-2 self-start">
                    <Button variant="outline" className="gap-2" onClick={handleExportCsv} disabled={isLoading || logs.length === 0}>
                        <Download className="size-4" />
                        <span>Export CSV</span>
                    </Button>
                    <Button variant="outline" className="gap-2" onClick={fetchLogs} disabled={isLoading}>
                        <RotateCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
                        <span>Refresh</span>
                    </Button>
                </div>
            </div>

            {/* Error Alert */}
            {error && (
                <Alert variant="destructive">
                    <AlertDescription className="flex items-center justify-between">
                        <span>{error}</span>
                        <Button size="sm" variant="ghost" onClick={fetchLogs} className="text-white hover:text-white/80">
                            Retry
                        </Button>
                    </AlertDescription>
                </Alert>
            )}

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
                    {isLoading ? (
                        <div className="space-y-3 p-6">
                            <Skeleton className="h-6 w-full" />
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-12 w-full" />
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground space-y-3">
                            <ShieldAlert className="size-12 text-muted-foreground" strokeWidth={1.5} />
                            <p className="text-lg font-medium">No audit logs available yet</p>
                            <p className="text-xs max-w-sm">
                                Administrative actions such as approvals, rejections, and broadcasts will automatically record here.
                            </p>
                        </div>
                    ) : (
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
                                {logs.map((log) => (
                                    <TableRow key={log.id || log._id}>
                                        <TableCell className="font-mono text-xs font-semibold">{log.id || log.logId}</TableCell>
                                        <TableCell className="text-xs font-medium">{log.actor}</TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className="text-[10px] font-semibold font-mono uppercase">
                                                {log.action}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-xs font-mono max-w-[200px] truncate" title={log.target}>
                                            {log.target}
                                        </TableCell>
                                        <TableCell className="text-[9px] text-muted-foreground whitespace-nowrap">
                                            {formatDate(log.timestamp || log.createdAt || "")}
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
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
