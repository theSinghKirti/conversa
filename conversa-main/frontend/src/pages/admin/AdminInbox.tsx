import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Eye, Pin, RefreshCw, RotateCcw, Search, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { adminInboxApi } from "@/lib/api";
import type { CommunityContentStatus, CommunityInboxSort, CommunityPost, CommunityPostCategory } from "@/lib/api";

const ALL = "__all__";
const LIMIT = 20;

const CATEGORIES: { value: CommunityPostCategory; label: string }[] = [
    { value: "ANNOUNCEMENT", label: "Announcement" },
    { value: "GENERAL", label: "General" },
    { value: "HELP_REQUEST", label: "Help Request" },
    { value: "OPPORTUNITY", label: "Opportunity" },
    { value: "EVENT", label: "Event" },
    { value: "COMMUNITY_NOTICE", label: "Community Notice" },
];

const STATUSES: CommunityContentStatus[] = ["ACTIVE", "HIDDEN", "DELETED"];

function formatDate(value: string) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function statusBadge(status?: CommunityContentStatus) {
    if (status === "HIDDEN") return <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300">Hidden</Badge>;
    if (status === "DELETED") return <Badge variant="destructive">Deleted</Badge>;
    return <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">Active</Badge>;
}

function categoryLabel(category: CommunityPostCategory) {
    return CATEGORIES.find((item) => item.value === category)?.label ?? category;
}

function readParams(searchParams: URLSearchParams) {
    return {
        search: searchParams.get("search") ?? "",
        category: ((searchParams.get("category") as CommunityPostCategory | null) ?? "") as CommunityPostCategory | "",
        status: (searchParams.get("status") as CommunityContentStatus | null) ?? "ACTIVE",
        page: Math.max(Number(searchParams.get("page") ?? "1") || 1, 1),
        sort: (searchParams.get("sort") as CommunityInboxSort | null) ?? "newest",
    };
}

export default function AdminInbox() {
    const [searchParams, setSearchParams] = useSearchParams();
    const params = useMemo(() => readParams(searchParams), [searchParams]);
    const [searchInput, setSearchInput] = useState(params.search);
    const [posts, setPosts] = useState<CommunityPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [actionId, setActionId] = useState<string | null>(null);
    const [hideTarget, setHideTarget] = useState<CommunityPost | null>(null);
    const [reason, setReason] = useState("");
    const [reasonError, setReasonError] = useState<string | null>(null);

    const setParam = (key: string, value: string) => {
        const next = new URLSearchParams(searchParams);
        if (value) next.set(key, value);
        else next.delete(key);
        next.set("page", "1");
        setSearchParams(next);
    };

    const setPageParam = (page: number) => {
        const next = new URLSearchParams(searchParams);
        next.set("page", String(page));
        setSearchParams(next);
    };

    const fetchPosts = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await adminInboxApi.listPosts({
                search: params.search || undefined,
                category: params.category || undefined,
                status: params.status || undefined,
                page: params.page,
                limit: LIMIT,
                sort: params.sort,
            });
            setPosts(data.posts);
            setTotalPages(data.pagination.totalPages || 1);
            setTotal(data.pagination.total);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load admin inbox.");
        } finally {
            setLoading(false);
        }
    }, [params]);

    useEffect(() => {
        fetchPosts();
    }, [fetchPosts]);

    const submitSearch = (event: React.FormEvent) => {
        event.preventDefault();
        setParam("search", searchInput.trim());
    };

    const updatePost = (updated: CommunityPost) => {
        setPosts((current) => current.map((post) => post.postId === updated.postId ? { ...post, ...updated } : post));
    };

    const pinPost = async (post: CommunityPost, pinned: boolean) => {
        setActionId(post.postId);
        try {
            const data = await adminInboxApi.pinPost(post.postId, pinned);
            updatePost(data.post);
            toast.success(pinned ? "Post pinned" : "Post unpinned");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to update pin state");
        } finally {
            setActionId(null);
        }
    };

    const restorePost = async (post: CommunityPost) => {
        setActionId(post.postId);
        try {
            const data = await adminInboxApi.restorePost(post.postId);
            updatePost(data.post);
            toast.success("Post restored");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to restore post");
        } finally {
            setActionId(null);
        }
    };

    const hidePost = async () => {
        if (!hideTarget) return;
        const clean = reason.trim();
        if (clean.length < 5) {
            setReasonError("Reason must be at least 5 characters.");
            return;
        }
        if (clean.length > 500) {
            setReasonError("Reason must not exceed 500 characters.");
            return;
        }
        setActionId(hideTarget.postId);
        setReasonError(null);
        try {
            const data = await adminInboxApi.hidePost(hideTarget.postId, clean);
            updatePost(data.post);
            setHideTarget(null);
            setReason("");
            toast.success("Post hidden");
        } catch (err) {
            setReasonError(err instanceof Error ? err.message : "Failed to hide post");
        } finally {
            setActionId(null);
        }
    };

    return (
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Community Inbox</h1>
                    <p className="text-sm text-muted-foreground">Moderate shared verified-member posts.</p>
                </div>
                <Button variant="outline" onClick={fetchPosts} disabled={loading} className="gap-2 self-start">
                    <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
                    Refresh
                </Button>
            </div>

            <Card>
                <CardContent className="p-4">
                    <form onSubmit={submitSearch} className="grid gap-3 lg:grid-cols-[1fr_160px_190px_160px_auto]">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search posts, authors or reasons" className="pl-9" />
                        </div>
                        <Select value={params.status || ALL} onValueChange={(value) => setParam("status", value === ALL ? "" : value)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={params.category || ALL} onValueChange={(value) => setParam("category", value === ALL ? "" : value)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL}>All categories</SelectItem>
                                {CATEGORIES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={params.sort} onValueChange={(value) => setParam("sort", value)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="newest">Newest</SelectItem>
                                <SelectItem value="oldest">Oldest</SelectItem>
                                <SelectItem value="most_replied">Most Replied</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button type="submit">Search</Button>
                    </form>
                </CardContent>
            </Card>

            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

            <Card>
                <CardContent className="p-0 overflow-auto">
                    {loading ? (
                        <div className="space-y-3 p-5">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-16 w-full" />
                        </div>
                    ) : posts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-3 p-12 text-center text-muted-foreground">
                            <ShieldAlert className="size-10" />
                            <p className="font-medium">No inbox posts found.</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Post</TableHead>
                                    <TableHead>Author</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Replies</TableHead>
                                    <TableHead>Created</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {posts.map((post) => (
                                    <TableRow key={post.postId}>
                                        <TableCell className="min-w-[260px]">
                                            <div className="font-mono text-xs text-muted-foreground">{post.postId}</div>
                                            <div className="line-clamp-2 text-sm">{post.text}</div>
                                            {post.isPinned && <Badge className="mt-1 bg-amber-500 text-white hover:bg-amber-500">Pinned</Badge>}
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-sm font-medium">{post.author.name}</div>
                                            <div className="font-mono text-xs text-muted-foreground">{post.author.memberId}</div>
                                        </TableCell>
                                        <TableCell>{categoryLabel(post.category)}</TableCell>
                                        <TableCell>{statusBadge(post.status)}</TableCell>
                                        <TableCell>{post.replyCount}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground">{formatDate(post.createdAt)}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button asChild variant="ghost" size="icon" title="View">
                                                    <Link to={`/admin/inbox/${post.postId}`}><Eye className="size-4" /></Link>
                                                </Button>
                                                {post.status !== "DELETED" && (
                                                    <Button variant="ghost" size="icon" disabled={actionId === post.postId} onClick={() => pinPost(post, !post.isPinned)} title={post.isPinned ? "Unpin" : "Pin"}>
                                                        <Pin className="size-4" />
                                                    </Button>
                                                )}
                                                {post.status === "ACTIVE" && (
                                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" disabled={actionId === post.postId} onClick={() => { setHideTarget(post); setReason(""); setReasonError(null); }} title="Hide">
                                                        <ShieldAlert className="size-4" />
                                                    </Button>
                                                )}
                                                {post.status === "HIDDEN" && (
                                                    <Button variant="ghost" size="icon" disabled={actionId === post.postId} onClick={() => restorePost(post)} title="Restore">
                                                        <RotateCcw className="size-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {totalPages > 1 && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">Page {params.page} of {totalPages} ({total} posts)</p>
                    <div className="flex gap-2">
                        <Button variant="outline" disabled={params.page <= 1 || loading} onClick={() => setPageParam(params.page - 1)}>Previous</Button>
                        <Button variant="outline" disabled={params.page >= totalPages || loading} onClick={() => setPageParam(params.page + 1)}>Next</Button>
                    </div>
                </div>
            )}

            <Dialog open={!!hideTarget} onOpenChange={(open) => !open && setHideTarget(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Hide community post</DialogTitle>
                        <DialogDescription>Provide a moderation reason. This is visible in admin tooling only.</DialogDescription>
                    </DialogHeader>
                    {reasonError && <Alert variant="destructive"><AlertDescription>{reasonError}</AlertDescription></Alert>}
                    <div className="space-y-2">
                        <Label htmlFor="hide-reason">Reason</Label>
                        <Textarea id="hide-reason" value={reason} onChange={(event) => setReason(event.target.value)} rows={4} maxLength={500} disabled={Boolean(actionId)} />
                        <p className="text-right text-xs text-muted-foreground">{reason.trim().length}/500</p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setHideTarget(null)} disabled={Boolean(actionId)}>Cancel</Button>
                        <Button variant="destructive" onClick={hidePost} disabled={Boolean(actionId) || reason.trim().length < 5}>
                            {actionId ? "Hiding..." : "Hide Post"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
