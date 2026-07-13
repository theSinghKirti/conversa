import { useState, useEffect, useCallback } from "react";
import { Search, RotateCw, Eye, ShieldAlert, BadgeAlert, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { directoryApi } from "@/lib/api";
import type { DirectoryMemberSummary, DirectoryMemberProfile } from "@/lib/api";
import { toast } from "sonner";

export default function AdminUsers() {
    // Search/filter state
    const [search, setSearch] = useState("");
    const [searchInput, setSearchInput] = useState("");
    const [page, setPage] = useState(1);

    // Data state
    const [members, setMembers] = useState<DirectoryMemberSummary[]>([]);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Selected member detail state
    const [selectedMember, setSelectedMember] = useState<DirectoryMemberProfile | null>(null);
    const [isDetailLoading, setIsDetailLoading] = useState(false);

    // Fetch members list
    const fetchMembers = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await directoryApi.listMembers({
                search: search.trim() || undefined,
                page,
                limit: 20,
            });
            setMembers(data.members);
            setTotal(data.pagination.total);
            setTotalPages(data.pagination.totalPages || 1);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to load directory users.";
            setError(message);
        } finally {
            setIsLoading(false);
        }
    }, [search, page]);

    useEffect(() => {
        fetchMembers();
    }, [fetchMembers]);

    // Handle search form submit
    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSearch(searchInput);
        setPage(1);
    };

    // Open profile detail
    const handleViewDetail = async (memberId: string) => {
        setIsDetailLoading(true);
        try {
            const data = await directoryApi.getMember(memberId);
            setSelectedMember(data.member);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Failed to fetch profile details.";
            toast.error(msg);
        } finally {
            setIsDetailLoading(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 md:p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight font-sans">User Directory</h1>
                    <p className="text-sm text-muted-foreground">
                        Admin view of registered directory member accounts.
                    </p>
                </div>
                <Button variant="outline" onClick={fetchMembers} className="self-start gap-2">
                    <RotateCw className="size-4" />
                    <span>Refresh</span>
                </Button>
            </div>

            {/* Warning Alert: Missing Endpoint */}
            <Alert className="bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-300">
                <AlertCircle className="size-5 text-amber-600 dark:text-amber-400" />
                <AlertTitle className="font-semibold text-sm">Missing Backend API Endpoint</AlertTitle>
                <AlertDescription className="text-xs leading-relaxed mt-1">
                    A general user management API endpoint (e.g. <code>GET /admin/users</code>) does not exist in the current backend.
                    Admins cannot create new admin users, change member roles, or delete users directly.
                    Currently listing active directory members as a fallback.
                </AlertDescription>
            </Alert>

            {/* Search Card */}
            <Card>
                <CardContent className="pt-6">
                    <form onSubmit={handleSearchSubmit} className="flex gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Search by name, Member ID, city, or occupation..."
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                className="pl-9 h-9"
                            />
                        </div>
                        <Button type="submit" size="sm" className="h-9">Search</Button>
                    </form>
                </CardContent>
            </Card>

            {/* Error Alert */}
            {error && (
                <Alert variant="destructive">
                    <AlertDescription className="flex items-center justify-between">
                        <span>{error}</span>
                        <Button size="sm" variant="ghost" onClick={fetchMembers} className="text-white hover:text-white/80">Retry</Button>
                    </AlertDescription>
                </Alert>
            )}

            {/* Table */}
            <Card className="flex-1 min-h-0 flex flex-col">
                <CardContent className="p-0 flex-1 overflow-auto thin-scrollbar">
                    {isLoading ? (
                        <div className="space-y-4 p-6">
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-20 w-full" />
                        </div>
                    ) : members.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground space-y-3">
                            <ShieldAlert className="size-12 text-muted-foreground" strokeWidth={1.5} />
                            <p className="text-lg font-medium">No users found</p>
                            <p className="text-xs max-w-sm">
                                There are no users matching the selected criteria.
                            </p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User / Member ID</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Organisation</TableHead>
                                    <TableHead>Account Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {members.map((member) => (
                                    <TableRow key={member.memberId}>
                                        <TableCell className="font-mono font-medium text-xs">
                                            {member.memberId}
                                        </TableCell>
                                        <TableCell className="font-medium text-sm">
                                            {member.name}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className="text-[10px] uppercase font-semibold">
                                                Member
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {member.organisation || "Not provided"}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs">
                                                Active
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-8 gap-2"
                                                onClick={() => handleViewDetail(member.memberId)}
                                                disabled={isDetailLoading}
                                            >
                                                <Eye className="size-4" />
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
                        Showing page <span className="font-semibold">{page}</span> of <span className="font-semibold">{totalPages}</span> ({total} users)
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

            {/* Detail Dialog */}
            <Dialog open={!!selectedMember} onOpenChange={(open) => !open && setSelectedMember(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>User Profile details</DialogTitle>
                        <DialogDescription>
                            Full profile overview for user record: {selectedMember?.memberId}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedMember && (
                        <div className="space-y-4 text-xs py-2">
                            <div className="flex items-center gap-4">
                                <img
                                    src={selectedMember.profilePic}
                                    alt={selectedMember.name}
                                    className="size-12 rounded-full object-cover border bg-muted"
                                />
                                <div>
                                    <h3 className="font-bold text-base leading-tight">{selectedMember.name}</h3>
                                    <div className="flex gap-1.5 mt-1">
                                        <Badge variant="secondary" className="text-[9px]">MEMBER ROLE</Badge>
                                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[9px]">ACTIVE</Badge>
                                    </div>
                                </div>
                            </div>

                            <hr />

                            <div className="grid grid-cols-2 gap-3 text-xs leading-relaxed">
                                <div>
                                    <span className="text-muted-foreground block">Email</span>
                                    <span className="font-medium">{selectedMember.email || "Confidential"}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block">Phone</span>
                                    <span className="font-medium">{selectedMember.phone || "Confidential"}</span>
                                </div>
                                <div className="col-span-2">
                                    <span className="text-muted-foreground block">Bio</span>
                                    <p className="mt-0.5 text-muted-foreground leading-normal">
                                        {selectedMember.about || "No profile bio written."}
                                    </p>
                                </div>
                            </div>

                            {/* Warning Section */}
                            <Alert className="bg-destructive/5 border-destructive/10 text-destructive mt-4">
                                <BadgeAlert className="size-4 text-destructive" />
                                <AlertTitle className="text-xs font-semibold">User Administration Warning</AlertTitle>
                                <AlertDescription className="text-[10px] leading-relaxed mt-1">
                                    Account deletion or role alteration endpoints (e.g. <code>DELETE /admin/users/:id</code> or <code>PATCH /admin/users/:id/role</code>) are not supported by the current backend and are disabled.
                                </AlertDescription>
                            </Alert>

                            <DialogFooter className="pt-2 gap-2">
                                <Button
                                    variant="destructive"
                                    disabled={true}
                                    className="w-full sm:w-auto text-xs"
                                >
                                    Delete User
                                </Button>
                                <Button variant="outline" onClick={() => setSelectedMember(null)} className="w-full sm:w-auto text-xs">
                                    Close
                                </Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
