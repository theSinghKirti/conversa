import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Inbox, MessageSquare, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { ApiError, inboxApi } from "@/lib/api";
import type { CommunityInboxSort, CommunityPost, CommunityPostCategory, CommunityPostListParams } from "@/lib/api";
import socket, { emitJoinCommunityInbox } from "@/lib/socket";
import { useAuth } from "@/hooks/use-auth";

const LIMIT = 10;
const ALL = "__all__";

const CATEGORIES: { value: CommunityPostCategory; label: string }[] = [
    { value: "ANNOUNCEMENT", label: "Announcement" },
    { value: "GENERAL", label: "General" },
    { value: "HELP_REQUEST", label: "Help Request" },
    { value: "OPPORTUNITY", label: "Opportunity" },
    { value: "EVENT", label: "Event" },
    { value: "COMMUNITY_NOTICE", label: "Community Notice" },
];

const SORTS: { value: CommunityInboxSort; label: string }[] = [
    { value: "newest", label: "Newest" },
    { value: "oldest", label: "Oldest" },
    { value: "most_replied", label: "Most Replied" },
];

function useDebounce<T>(value: T, delay: number) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const id = window.setTimeout(() => setDebounced(value), delay);
        return () => window.clearTimeout(id);
    }, [value, delay]);
    return debounced;
}

function initials(name: string) {
    return name.split(" ").map((part) => part[0]).join("").toUpperCase().slice(0, 2) || "?";
}

function formatDate(value: string) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function categoryLabel(category: CommunityPostCategory) {
    return CATEGORIES.find((item) => item.value === category)?.label ?? category;
}

function readParams(searchParams: URLSearchParams) {
    return {
        search: searchParams.get("search") ?? "",
        category: ((searchParams.get("category") as CommunityPostCategory | null) ?? "") as CommunityPostCategory | "",
        sort: (searchParams.get("sort") as CommunityInboxSort | null) ?? "newest",
        page: Math.max(Number(searchParams.get("page") ?? "1") || 1, 1),
    };
}

function matchesFilters(post: CommunityPost, params: ReturnType<typeof readParams>) {
    if (params.category && post.category !== params.category) return false;
    const q = params.search.trim().toLowerCase();
    if (!q) return true;
    return [post.text, post.author.name, post.author.memberId, categoryLabel(post.category)]
        .join(" ")
        .toLowerCase()
        .includes(q);
}

function PostCard({
    post,
    onDelete,
}: {
    post: CommunityPost;
    onDelete: (post: CommunityPost) => void;
}) {
    const isOwner = Boolean(post.isOwner ?? post.isOwnPost);
    return (
        <Card className="overflow-hidden">
            <CardContent className="space-y-4 p-4">
                <div className="flex items-start gap-3">
                    <Avatar className="size-11 shrink-0">
                        <AvatarImage src={post.author.profilePic} alt={post.author.name} />
                        <AvatarFallback className="bg-primary/15 text-sm font-semibold">{initials(post.author.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="truncate text-sm font-semibold">{post.author.name}</h2>
                            <Badge variant="outline" className="font-mono text-[10px]">{post.author.memberId}</Badge>
                            {post.isPinned && <Badge className="bg-amber-500 text-white hover:bg-amber-500">Pinned</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">{formatDate(post.createdAt)}</p>
                    </div>
                    {isOwner && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => onDelete(post)}
                            aria-label="Delete post"
                            title="Delete post"
                        >
                            <Trash2 className="size-4" />
                        </Button>
                    )}
                </div>

                <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{categoryLabel(post.category)}</Badge>
                </div>

                <p className="whitespace-pre-wrap break-words text-sm leading-6">
                    {post.text.length > 420 ? `${post.text.slice(0, 420)}...` : post.text}
                </p>

                <div className="flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MessageSquare className="size-4" />
                        {post.replyCount} repl{post.replyCount === 1 ? "y" : "ies"}
                    </span>
                    <Button asChild variant="outline" size="sm">
                        <Link to={`/user/inbox/${encodeURIComponent(post.postId)}`}>View discussion</Link>
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

function FeedSkeleton() {
    return (
        <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
                <Card key={index}>
                    <CardContent className="space-y-4 p-4">
                        <div className="flex gap-3">
                            <Skeleton className="size-11 rounded-full" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-4 w-48" />
                                <Skeleton className="h-3 w-32" />
                            </div>
                        </div>
                        <Skeleton className="h-16 w-full" />
                        <Skeleton className="h-9 w-32" />
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

export default function CommunityInbox() {
    const [searchParams, setSearchParams] = useSearchParams();
    const params = useMemo(() => readParams(searchParams), [searchParams]);
    const navigate = useNavigate();
    const { logout, user } = useAuth();
    const [posts, setPosts] = useState<CommunityPost[]>([]);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchInput, setSearchInput] = useState(params.search);
    const debouncedSearch = useDebounce(searchInput, 400);
    const [refreshKey, setRefreshKey] = useState(0);
    const [composeOpen, setComposeOpen] = useState(false);
    const [category, setCategory] = useState<CommunityPostCategory>("GENERAL");
    const [text, setText] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<CommunityPost | null>(null);
    const [deleting, setDeleting] = useState(false);
    const lastRequestKey = useRef("");

    useEffect(() => {
        setSearchInput(params.search);
    }, [params.search]);

    useEffect(() => {
        if (debouncedSearch === params.search) return;
        const next = new URLSearchParams(searchParams);
        if (debouncedSearch.trim()) next.set("search", debouncedSearch.trim());
        else next.delete("search");
        next.set("page", "1");
        setSearchParams(next);
    }, [debouncedSearch, params.search, searchParams, setSearchParams]);

    const updateParam = (key: string, value: string) => {
        const next = new URLSearchParams(searchParams);
        if (value) next.set(key, value);
        else next.delete(key);
        next.set("page", "1");
        setSearchParams(next);
    };

    const updatePage = (page: number) => {
        const next = new URLSearchParams(searchParams);
        next.set("page", String(page));
        setSearchParams(next);
    };

    const handleAccessError = useCallback((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) {
            toast.error("Please sign in again to view the Community Inbox.");
            logout();
            navigate("/login", { replace: true });
            return true;
        }
        if (err instanceof ApiError && err.status === 403) {
            setError("An active verified membership is required to view the Community Inbox.");
            return true;
        }
        return false;
    }, [logout, navigate]);

    const fetchPosts = useCallback(async () => {
        const request: CommunityPostListParams = {
            search: params.search || undefined,
            category: params.category || undefined,
            sort: params.sort,
            page: params.page,
            limit: LIMIT,
        };
        const key = JSON.stringify({ ...request, refreshKey });
        if (key === lastRequestKey.current) return;
        lastRequestKey.current = key;
        setLoading(true);
        setError(null);
        try {
            const data = await inboxApi.listPosts(request);
            setPosts(data.posts);
            setTotalPages(data.pagination.totalPages || 1);
            setTotal(data.pagination.total);
        } catch (err) {
            if (!handleAccessError(err)) {
                setError(err instanceof Error ? err.message : "Failed to load community posts.");
            }
        } finally {
            setLoading(false);
        }
    }, [handleAccessError, params, refreshKey]);

    useEffect(() => {
        fetchPosts();
    }, [fetchPosts]);

    useEffect(() => {
        emitJoinCommunityInbox();

        const addPost = (post: CommunityPost) => {
            setPosts((current) => {
                if (current.some((item) => item.postId === post.postId)) return current;
                if (!matchesFilters(post, params)) return current;
                return [post, ...current];
            });
        };
        const updatePost = (post: CommunityPost) => {
            setPosts((current) => current.map((item) => item.postId === post.postId ? { ...item, ...post } : item));
        };
        const removePost = ({ postId }: { postId: string }) => {
            setPosts((current) => current.filter((item) => item.postId !== postId));
        };
        const bumpReply = (reply: { postId?: string }) => {
            if (!reply.postId) return;
            setPosts((current) => current.map((item) => item.postId === reply.postId ? { ...item, replyCount: item.replyCount + 1 } : item));
        };
        const dropReply = (reply: { postId?: string }) => {
            if (!reply.postId) return;
            setPosts((current) => current.map((item) => item.postId === reply.postId ? { ...item, replyCount: Math.max(0, item.replyCount - 1) } : item));
        };
        const onInboxError = (payload: { error?: string }) => {
            if (payload.error) setError(payload.error);
        };

        socket.on("community-post-created", addPost);
        socket.on("community-post-updated", updatePost);
        socket.on("community-post-restored", addPost);
        socket.on("community-post-removed", removePost);
        socket.on("community-post-hidden", removePost);
        socket.on("community-reply-created", bumpReply);
        socket.on("community-reply-removed", dropReply);
        socket.on("community-reply-hidden", dropReply);
        socket.on("community-inbox-error", onInboxError);

        return () => {
            socket.off("community-post-created", addPost);
            socket.off("community-post-updated", updatePost);
            socket.off("community-post-restored", addPost);
            socket.off("community-post-removed", removePost);
            socket.off("community-post-hidden", removePost);
            socket.off("community-reply-created", bumpReply);
            socket.off("community-reply-removed", dropReply);
            socket.off("community-reply-hidden", dropReply);
            socket.off("community-inbox-error", onInboxError);
        };
    }, [params]);

    const submitPost = async (event: React.FormEvent) => {
        event.preventDefault();
        const clean = text.trim();
        if (!clean) {
            toast.error("Post text is required.");
            return;
        }
        if (clean.length > 2000) {
            toast.error("Post text must not exceed 2000 characters.");
            return;
        }
        setSubmitting(true);
        try {
            const data = await inboxApi.createPost({ category, text: clean });
            const safePost: CommunityPost = {
                ...data.post,
                author: data.post.author ?? {
                    name: user?.name ?? "Verified Member",
                    memberId: user?.memberId ?? "MEMBER",
                    profilePic: user?.profilePic,
                },
                isOwner: true,
            };
            setPosts((current) => current.some((item) => item.postId === safePost.postId) ? current : [safePost, ...current]);
            setText("");
            setCategory("GENERAL");
            setComposeOpen(false);
            toast.success("Community post created");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to create post");
        } finally {
            setSubmitting(false);
        }
    };

    const deletePost = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await inboxApi.deletePost(deleteTarget.postId);
            setPosts((current) => current.filter((post) => post.postId !== deleteTarget.postId));
            setDeleteTarget(null);
            toast.success("Post deleted");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to delete post");
        } finally {
            setDeleting(false);
        }
    };

    const pinnedPosts = posts.filter((post) => post.isPinned);
    const regularPosts = posts.filter((post) => !post.isPinned);
    const hasFilters = Boolean(params.search || params.category);

    return (
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="mx-auto flex max-w-5xl flex-col gap-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Community Inbox</h1>
                        <p className="text-sm text-muted-foreground">Announcements, opportunities and community updates from verified members.</p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setRefreshKey((value) => value + 1)} disabled={loading} className="gap-2">
                            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
                            Refresh
                        </Button>
                        <Button onClick={() => setComposeOpen(true)} className="gap-2">
                            <Plus className="size-4" />
                            Create Post
                        </Button>
                    </div>
                </div>

                <Card>
                    <CardContent className="grid gap-3 p-4 lg:grid-cols-[1fr_190px_170px_auto]">
                        <div className="relative">
                            <Label htmlFor="inbox-search" className="sr-only">Search posts</Label>
                            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                id="inbox-search"
                                value={searchInput}
                                onChange={(event) => setSearchInput(event.target.value)}
                                placeholder="Search posts, authors or member IDs"
                                className="pl-9"
                            />
                        </div>
                        <Select value={params.category || ALL} onValueChange={(value) => updateParam("category", value === ALL ? "" : value)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL}>All categories</SelectItem>
                                {CATEGORIES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={params.sort} onValueChange={(value) => updateParam("sort", value)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {SORTS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Button variant="ghost" onClick={() => { setSearchInput(""); setSearchParams(new URLSearchParams({ page: "1" })); }} disabled={!hasFilters && params.sort === "newest"}>
                            Clear Filters
                        </Button>
                    </CardContent>
                </Card>

                {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

                {loading ? <FeedSkeleton /> : posts.length === 0 ? (
                    <Card>
                        <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
                            <Inbox className="size-10 text-muted-foreground" />
                            <CardTitle className="text-lg">{hasFilters ? "No community posts matched your filters." : "The Community Inbox is empty."}</CardTitle>
                            <CardDescription>Start a verified-member discussion or refresh the feed.</CardDescription>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-5">
                        {pinnedPosts.length > 0 && (
                            <section className="space-y-3">
                                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Pinned posts</h2>
                                {pinnedPosts.map((post) => <PostCard key={post.postId} post={post} onDelete={setDeleteTarget} />)}
                            </section>
                        )}
                        <section className="space-y-3">
                            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Recent posts</h2>
                            {regularPosts.map((post) => <PostCard key={post.postId} post={post} onDelete={setDeleteTarget} />)}
                        </section>
                    </div>
                )}

                {totalPages > 1 && (
                    <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-muted-foreground">Page {params.page} of {totalPages} ({total} posts)</p>
                        <div className="flex gap-2">
                            <Button variant="outline" disabled={params.page <= 1 || loading} onClick={() => updatePage(params.page - 1)}>Previous</Button>
                            <Button variant="outline" disabled={params.page >= totalPages || loading} onClick={() => updatePage(params.page + 1)}>Next</Button>
                        </div>
                    </div>
                )}
            </div>

            <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create Community Post</DialogTitle>
                        <DialogDescription>Text posts only. Your verified member identity is attached by the server.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={submitPost} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Category</Label>
                            <Select value={category} onValueChange={(value) => setCategory(value as CommunityPostCategory)} disabled={submitting}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {CATEGORIES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="post-text">Post text</Label>
                            <Textarea id="post-text" value={text} onChange={(event) => setText(event.target.value)} rows={7} maxLength={2000} disabled={submitting} />
                            <p className="text-right text-xs text-muted-foreground">{text.trim().length}/2000</p>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setComposeOpen(false)} disabled={submitting}>Cancel</Button>
                            <Button type="submit" disabled={submitting || text.trim().length === 0 || text.trim().length > 2000}>
                                {submitting ? "Posting..." : "Post"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete post?</AlertDialogTitle>
                        <AlertDialogDescription>This removes the post from the Community Inbox for verified members.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={(event) => { event.preventDefault(); deletePost(); }} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            {deleting ? "Deleting..." : "Delete Post"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
