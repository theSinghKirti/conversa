import { useState, useEffect, useCallback } from "react";
import { RotateCw, Eye, ShieldAlert, BadgeAlert, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
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

export default function AdminActiveMembers() {
    // Search/filter state
    const [search, setSearch] = useState("");
    const [searchInput, setSearchInput] = useState("");
    const [city, setCity] = useState("");
    const [state, setState] = useState("");
    const [occupation, setOccupation] = useState("");
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
                city: city.trim() || undefined,
                state: state.trim() || undefined,
                occupation: occupation.trim() || undefined,
                page,
                limit: 20,
            });
            setMembers(data.members);
            setTotal(data.pagination.total);
            setTotalPages(data.pagination.totalPages || 1);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to load active members list.";
            setError(message);
        } finally {
            setIsLoading(false);
        }
    }, [search, city, state, occupation, page]);

    useEffect(() => {
        fetchMembers();
    }, [fetchMembers]);

    // Handle search form submit
    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSearch(searchInput);
        setPage(1);
    };

    // Reset filters
    const handleResetFilters = () => {
        setSearchInput("");
        setSearch("");
        setCity("");
        setState("");
        setOccupation("");
        setPage(1);
    };

    // Open member profile detail
    const handleViewDetail = async (memberId: string) => {
        setIsDetailLoading(true);
        try {
            const data = await directoryApi.getMember(memberId);
            setSelectedMember(data.member);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Failed to fetch member details.";
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
                    <h1 className="text-3xl font-bold tracking-tight">Active Members Directory</h1>
                    <p className="text-sm text-muted-foreground">
                        Search and view active community directory profiles.
                    </p>
                </div>
                <Button variant="outline" onClick={fetchMembers} className="self-start gap-2">
                    <RotateCw className="size-4" />
                    <span>Refresh</span>
                </Button>
            </div>

            {/* Filter Card */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold">Directory Search & Filters</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
                        <div className="space-y-1">
                            <Label htmlFor="search-input" className="text-xs">Search Name/ID</Label>
                            <Input
                                id="search-input"
                                placeholder="Search member name or ID"
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                className="h-9"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="city-input" className="text-xs">City</Label>
                            <Input
                                id="city-input"
                                placeholder="Filter by city"
                                value={city}
                                onChange={(e) => { setCity(e.target.value); setPage(1); }}
                                className="h-9"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="state-input" className="text-xs">State</Label>
                            <Input
                                id="state-input"
                                placeholder="Filter by state"
                                value={state}
                                onChange={(e) => { setState(e.target.value); setPage(1); }}
                                className="h-9"
                            />
                        </div>
                        <div className="flex items-end gap-2">
                            <Button type="submit" size="sm" className="flex-1 h-9">Search</Button>
                            <Button type="button" variant="outline" size="sm" onClick={handleResetFilters} className="h-9">
                                Reset
                            </Button>
                        </div>
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

            {/* Members Table */}
            <Card className="flex-1 min-h-0 flex flex-col">
                <CardContent className="p-0 flex-1 overflow-auto thin-scrollbar">
                    {isLoading ? (
                        <div className="space-y-4 p-6">
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-20 w-full" />
                            <Skeleton className="h-20 w-full" />
                        </div>
                    ) : members.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground space-y-3">
                            <ShieldAlert className="size-12 text-muted-foreground" strokeWidth={1.5} />
                            <p className="text-lg font-medium">No active members found</p>
                            <p className="text-xs max-w-sm">
                                There are no members matching the selected search criteria.
                            </p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Member ID</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Occupation</TableHead>
                                    <TableHead>Location</TableHead>
                                    <TableHead>Status</TableHead>
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
                                        <TableCell className="text-xs text-muted-foreground">
                                            {member.occupation || "Not provided"}
                                        </TableCell>
                                        <TableCell className="text-xs">
                                            {member.city ? `${member.city}, ${member.state}` : "Not provided"}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">Active</Badge>
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
                                                <span>Profile</span>
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
                        Showing page <span className="font-semibold">{page}</span> of <span className="font-semibold">{totalPages}</span> ({total} members)
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

            {/* Member Detail Dialog */}
            <Dialog open={!!selectedMember} onOpenChange={(open) => !open && setSelectedMember(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Member Profile Detail</DialogTitle>
                        <DialogDescription>
                            Detailed verified information for Member ID: {selectedMember?.memberId}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedMember && (
                        <div className="space-y-4 text-sm py-2">
                            {/* Profile Pic & Basic Details */}
                            <div className="flex items-center gap-4">
                                <img
                                    src={selectedMember.profilePic}
                                    alt={selectedMember.name}
                                    className="size-14 rounded-full object-cover border bg-muted"
                                />
                                <div>
                                    <h3 className="font-bold text-base leading-tight">{selectedMember.name}</h3>
                                    <p className="text-xs text-muted-foreground mt-0.5">{selectedMember.memberId}</p>
                                </div>
                            </div>

                            <hr />

                            <div className="grid grid-cols-2 gap-3 text-xs leading-relaxed">
                                <div>
                                    <span className="text-muted-foreground block">Email</span>
                                    <span className="font-medium">{selectedMember.email || "Confidential (Not shared by user)"}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block">Phone</span>
                                    <span className="font-medium">{selectedMember.phone || "Confidential (Not shared by user)"}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block">Location</span>
                                    <span className="font-medium">{selectedMember.city ? `${selectedMember.city}, ${selectedMember.state}` : "Not provided"}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block">Blood Group</span>
                                    <Badge variant="outline" className="mt-0.5">
                                        {selectedMember.bloodGroup || "Not Shared"}
                                    </Badge>
                                </div>
                                <div className="col-span-2">
                                    <span className="text-muted-foreground block">Occupation & Organisation</span>
                                    <span className="font-medium">
                                        {selectedMember.occupation} {selectedMember.organisation ? `at ${selectedMember.organisation}` : ""}
                                    </span>
                                </div>
                                <div className="col-span-2">
                                    <span className="text-muted-foreground block">Education</span>
                                    <span className="font-medium">{selectedMember.education || "Not shared"}</span>
                                </div>
                                <div className="col-span-2">
                                    <span className="text-muted-foreground block">About Member</span>
                                    <p className="whitespace-pre-wrap mt-0.5 text-muted-foreground bg-muted/30 border rounded p-2 text-[11px] leading-normal">
                                        {selectedMember.about || "No profile bio written."}
                                    </p>
                                </div>
                            </div>

                            {/* Suspension Notice Area (Destructive action check) */}
                            <Alert className="bg-destructive/5 border-destructive/10 text-destructive mt-4">
                                <BadgeAlert className="size-4 text-destructive" />
                                <AlertTitle className="text-xs font-semibold">Administrative Actions</AlertTitle>
                                <AlertDescription className="text-[10px] leading-relaxed mt-1">
                                    Account suspension and status toggle endpoints (e.g. <code>PATCH /admin/users/:id/suspend</code>) are currently missing in the backend. These actions are disabled.
                                </AlertDescription>
                            </Alert>

                            <DialogFooter className="pt-2">
                                <Button
                                    variant="destructive"
                                    disabled={true}
                                    className="w-full sm:w-auto text-xs"
                                    title="Backend suspension endpoint is missing"
                                >
                                    Suspend Account
                                </Button>
                                <Button variant="outline" onClick={() => setSelectedMember(null)} className="w-full sm:w-auto text-xs">
                                    Close Detail
                                </Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
