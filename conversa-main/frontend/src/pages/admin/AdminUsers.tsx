import { useState, useEffect, useCallback } from "react";
import { Search, RotateCw, Eye, ShieldAlert, ChevronLeft, ChevronRight, CheckCircle2, XCircle, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { adminApi } from "@/lib/api";
import type { AdminUser } from "@/lib/api";

export default function AdminUsers() {
    // Search/filter & pagination state
    const [search, setSearch] = useState("");
    const [searchInput, setSearchInput] = useState("");
    const [page, setPage] = useState(1);

    // Data state
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Selected user detail modal state
    const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

    // Fetch users from backend API
    const fetchUsers = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await adminApi.listUsers({
                search: search.trim() || undefined,
                page,
                limit: 20,
            });
            setUsers(data.users || []);
            setTotal(data.pagination?.total || 0);
            setTotalPages(data.pagination?.totalPages || 1);
        } catch (err: unknown) {
            setError("Unable to load users. Please refresh and try again.");
        } finally {
            setIsLoading(false);
        }
    }, [search, page]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    // Handle search form submit
    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSearch(searchInput);
        setPage(1);
    };

    // Reset search filter
    const handleResetSearch = () => {
        setSearchInput("");
        setSearch("");
        setPage(1);
    };

    // Client-side filter for instant responsiveness while typing
    const filteredUsers = users.filter((u) => {
        if (!searchInput.trim()) return true;
        const q = searchInput.trim().toLowerCase();
        return (
            u.name.toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q) ||
            (u.memberId && u.memberId.toLowerCase().includes(q)) ||
            u._id.toLowerCase().includes(q)
        );
    });

    return (
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 md:p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight font-sans">User Directory</h1>
                    <p className="text-sm text-muted-foreground">
                        Comprehensive administrative directory of registered accounts.
                    </p>
                </div>
                <Button variant="outline" onClick={fetchUsers} className="self-start gap-2">
                    <RotateCw className="size-4" />
                    <span>Refresh</span>
                </Button>
            </div>

            {/* Search Card */}
            <Card>
                <CardContent className="pt-6">
                    <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Search by name, email, or Member ID..."
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                className="pl-9 h-9"
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button type="submit" size="sm" className="h-9">
                                Search
                            </Button>
                            {searchInput && (
                                <Button type="button" variant="outline" size="sm" onClick={handleResetSearch} className="h-9">
                                    Clear
                                </Button>
                            )}
                        </div>
                    </form>
                </CardContent>
            </Card>

            {/* Error Alert */}
            {error && (
                <Alert variant="destructive">
                    <AlertDescription className="flex items-center justify-between">
                        <span>{error}</span>
                        <Button size="sm" variant="ghost" onClick={fetchUsers} className="text-white hover:text-white/80">
                            Retry
                        </Button>
                    </AlertDescription>
                </Alert>
            )}

            {/* Users Table */}
            <Card className="flex-1 min-h-0 flex flex-col">
                <CardContent className="p-0 flex-1 overflow-auto thin-scrollbar">
                    {isLoading ? (
                        <div className="space-y-4 p-6">
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-16 w-full" />
                        </div>
                    ) : filteredUsers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground space-y-3">
                            <ShieldAlert className="size-12 text-muted-foreground" strokeWidth={1.5} />
                            <p className="text-lg font-medium">No users found</p>
                            <p className="text-xs max-w-sm">
                                {search || searchInput
                                    ? "There are no users matching your current search criteria."
                                    : "There are currently no registered users in the database."}
                            </p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User / Member ID</TableHead>
                                    <TableHead>User Name</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Account Status</TableHead>
                                    <TableHead>Presence</TableHead>
                                    <TableHead>Email Status</TableHead>
                                    <TableHead>Joined Date</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredUsers.map((user) => (
                                    <TableRow key={user._id}>
                                        <TableCell className="font-mono font-medium text-xs">
                                            {user.memberId || user._id.slice(-8)}
                                        </TableCell>
                                        <TableCell className="font-medium text-sm">
                                            <div className="flex items-center gap-2">
                                                <img
                                                    src={
                                                        user.profilePic ||
                                                        `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`
                                                    }
                                                    alt={user.name}
                                                    className="size-7 rounded-full object-cover border shrink-0 bg-muted"
                                                />
                                                <span className="truncate max-w-[160px]">{user.name}</span>
                                                {user.isBot && (
                                                    <Badge variant="outline" className="bg-indigo-500/10 text-indigo-500 border-indigo-500/20 text-[9px] px-1 py-0 gap-1">
                                                        <Bot className="size-3" />
                                                        BOT
                                                    </Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground truncate max-w-[180px]">
                                            {user.email}
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={user.role === "ADMIN" ? "default" : "secondary"}
                                                className="text-[10px] uppercase font-semibold"
                                            >
                                                {user.role}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant="outline"
                                                className={
                                                    user.accountStatus === "ACTIVE"
                                                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs"
                                                        : "bg-destructive/10 text-destructive border-destructive/20 text-xs"
                                                }
                                            >
                                                {user.accountStatus || "ACTIVE"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1.5 text-xs">
                                                <span
                                                    className={`size-2 rounded-full shrink-0 ${
                                                        user.isOnline ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/40"
                                                    }`}
                                                />
                                                <span className="text-muted-foreground">
                                                    {user.isOnline ? "Online" : "Offline"}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {user.isEmailVerified ? (
                                                <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 text-[10px] gap-1">
                                                    <CheckCircle2 className="size-3" /> Verified
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px] gap-1">
                                                    <XCircle className="size-3" /> Unverified
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                            {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "N/A"}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-8 gap-1.5"
                                                onClick={() => setSelectedUser(user)}
                                            >
                                                <Eye className="size-3.5" />
                                                <span>Details</span>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between px-2 py-2 shrink-0">
                    <p className="text-sm text-muted-foreground">
                        Showing page <span className="font-semibold">{page}</span> of <span className="font-semibold">{totalPages}</span> ({total} users total)
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="icon"
                            disabled={page === 1 || isLoading}
                            onClick={() => setPage((p) => p - 1)}
                        >
                            <ChevronLeft className="size-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            disabled={page === totalPages || isLoading}
                            onClick={() => setPage((p) => p + 1)}
                        >
                            <ChevronRight className="size-4" />
                        </Button>
                    </div>
                </div>
            )}

            {/* User Detail Dialog */}
            <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>User Account Overview</DialogTitle>
                        <DialogDescription>
                            Detailed record for user ID: {selectedUser?._id}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedUser && (
                        <div className="space-y-4 text-xs py-2">
                            {/* Profile Header */}
                            <div className="flex items-center gap-4">
                                <img
                                    src={
                                        selectedUser.profilePic ||
                                        `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedUser.name)}&background=random`
                                    }
                                    alt={selectedUser.name}
                                    className="size-14 rounded-full object-cover border bg-muted"
                                />
                                <div>
                                    <h3 className="font-bold text-base leading-tight flex items-center gap-2">
                                        {selectedUser.name}
                                        {selectedUser.isBot && (
                                            <Badge variant="outline" className="bg-indigo-500/10 text-indigo-500 text-[9px]">
                                                BOT
                                            </Badge>
                                        )}
                                    </h3>
                                    <p className="text-xs text-muted-foreground mt-0.5">{selectedUser.email}</p>
                                    <div className="flex gap-1.5 mt-1.5">
                                        <Badge variant={selectedUser.role === "ADMIN" ? "default" : "secondary"} className="text-[9px]">
                                            {selectedUser.role} ROLE
                                        </Badge>
                                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[9px]">
                                            {selectedUser.accountStatus || "ACTIVE"}
                                        </Badge>
                                    </div>
                                </div>
                            </div>

                            <hr />

                            {/* Details Grid */}
                            <div className="grid grid-cols-2 gap-3 text-xs leading-relaxed">
                                <div>
                                    <span className="text-muted-foreground block">Member ID</span>
                                    <span className="font-mono font-medium">{selectedUser.memberId || "N/A"}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block">Account ID</span>
                                    <span className="font-mono text-[11px] truncate block">{selectedUser._id}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block">Online Status</span>
                                    <span className="font-medium flex items-center gap-1.5 mt-0.5">
                                        <span className={`size-2 rounded-full ${selectedUser.isOnline ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                                        {selectedUser.isOnline ? "Online Now" : "Offline"}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block">Email Verification</span>
                                    <span className="font-medium">
                                        {selectedUser.isEmailVerified ? "Verified ✅" : "Unverified ❌"}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block">Registration Date</span>
                                    <span className="font-medium">
                                        {selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleString() : "N/A"}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block">Last Active</span>
                                    <span className="font-medium">
                                        {selectedUser.lastSeen ? new Date(selectedUser.lastSeen).toLocaleString() : "N/A"}
                                    </span>
                                </div>
                                <div className="col-span-2">
                                    <span className="text-muted-foreground block">Profile Bio</span>
                                    <p className="mt-0.5 text-muted-foreground bg-muted/30 border rounded p-2 text-[11px] leading-normal whitespace-pre-wrap">
                                        {selectedUser.about || "No profile bio provided."}
                                    </p>
                                </div>
                            </div>

                            <DialogFooter className="pt-2">
                                <Button variant="outline" onClick={() => setSelectedUser(null)} className="w-full sm:w-auto text-xs">
                                    Close Overview
                                </Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
