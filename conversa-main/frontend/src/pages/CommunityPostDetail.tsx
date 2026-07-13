import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MessageSquare, Trash2 } from "lucide-react";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, inboxApi } from "@/lib/api";
import type { CommunityPost, CommunityPostCategory, CommunityReply } from "@/lib/api";
import socket, { emitJoinCommunityInbox } from "@/lib/socket";
import { useAuth } from "@/hooks/use-auth";

const CATEGORIES: Record<CommunityPostCategory, string> = {
    ANNOUNCEMENT: "Announcement",
    GENERAL: "General",
    HELP_REQUEST: "Help Request",
    OPPORTUNITY: "Opportunity",
    EVENT: "Event",
    COMMUNITY_NOTICE: "Community Notice",
};

function initials(name: string) {
    return name.split(" ").map((part) => part[0]).join("").toUpperCase().slice(0, 2) || "?";
}

function formatDate(value: string) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function isPostOwner(post: CommunityPost) {
    return Boolean(post.isOwner ?? post.isOwnPost);
}

function isReplyOwner(reply: CommunityReply) {
    return Boolean(reply.isOwner ?? reply.isOwnReply);
}

function AuthorLine({ author, createdAt }: Pick<CommunityPost, "author" | "createdAt">) {
    return (
        <div className="flex min-w-0 items-center gap-3">
            <Avatar className="size-11">
                <AvatarImage src={author.profilePic} alt={author.name} />
                <AvatarFallback className="bg-primary/15 text-sm font-semibold">{initials(author.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold">{author.name}</span>
                    <Badge variant="outline" className="font-mono text-[10px]">{author.memberId}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{formatDate(createdAt)}</p>
            </div>
        </div>
    );
}

function DetailSkeleton() {
    return (
        <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
            <Skeleton className="h-9 w-44" />
            <Card><CardContent className="space-y-4 p-5"><Skeleton className="h-12 w-full" /><Skeleton className="h-28 w-full" /></CardContent></Card>
            <Card><CardContent className="space-y-3 p-5"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></CardContent></Card>
        </div>
    );
}

export default function CommunityPostDetail() {
    const { postId } = useParams<{ postId: string }>();
    const navigate = useNavigate();
    const { logout } = useAuth();
    const [post, setPost] = useState<CommunityPost | null>(null);
    const [replies, setReplies] = useState<CommunityReply[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [replyText, setReplyText] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [deletePostOpen, setDeletePostOpen] = useState(false);
    const [deleteReplyTarget, setDeleteReplyTarget] = useState<CommunityReply | null>(null);
    const [actionLoading, setActionLoading] = useState(false);

    const handleAccessError = useCallback((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) {
            toast.error("Please sign in again.");
            logout();
            navigate("/login", { replace: true });
            return true;
        }
        if (err instanceof ApiError && err.status === 403) {
            setError("An active verified membership is required to view this discussion.");
            return true;
        }
        if (err instanceof ApiError && err.status === 404) {
            setError("This community post was not found or is no longer visible.");
            return true;
        }
        return false;
    }, [logout, navigate]);

    const fetchDetail = useCallback(async () => {
        if (!postId) return;
        setLoading(true);
        setError(null);
        try {
            const [postData, replyData] = await Promise.all([
                inboxApi.getPost(postId),
                inboxApi.listReplies(postId, { page: 1, limit: 50, sort: "oldest" }),
            ]);
            setPost(postData.post);
            setReplies(replyData.replies);
        } catch (err) {
            if (!handleAccessError(err)) setError(err instanceof Error ? err.message : "Failed to load discussion.");
        } finally {
            setLoading(false);
        }
    }, [handleAccessError, postId]);

    useEffect(() => {
        fetchDetail();
    }, [fetchDetail]);

    useEffect(() => {
        emitJoinCommunityInbox();

        const onReplyCreated = (reply: CommunityReply) => {
            if (reply.postId !== postId) return;
            setReplies((current) => current.some((item) => item.replyId === reply.replyId) ? current : [...current, reply]);
            setPost((current) => current ? { ...current, replyCount: current.replyCount + 1 } : current);
        };
        const removeReply = ({ replyId, postId: eventPostId }: { replyId: string; postId?: string }) => {
            if (eventPostId && eventPostId !== postId) return;
            setReplies((current) => current.filter((reply) => reply.replyId !== replyId));
            setPost((current) => current ? { ...current, replyCount: Math.max(0, current.replyCount - 1) } : current);
        };
        const removePost = ({ postId: eventPostId }: { postId: string }) => {
            if (eventPostId === postId) {
                setError("This post is no longer visible.");
                setPost(null);
            }
        };
        const updatePost = (incoming: CommunityPost) => {
            if (incoming.postId === postId) setPost((current) => current ? { ...current, ...incoming } : incoming);
        };

        socket.on("community-reply-created", onReplyCreated);
        socket.on("community-reply-removed", removeReply);
        socket.on("community-reply-hidden", removeReply);
        socket.on("community-post-removed", removePost);
        socket.on("community-post-hidden", removePost);
        socket.on("community-post-updated", updatePost);
        socket.on("community-post-restored", updatePost);

        return () => {
            socket.off("community-reply-created", onReplyCreated);
            socket.off("community-reply-removed", removeReply);
            socket.off("community-reply-hidden", removeReply);
            socket.off("community-post-removed", removePost);
            socket.off("community-post-hidden", removePost);
            socket.off("community-post-updated", updatePost);
            socket.off("community-post-restored", updatePost);
        };
    }, [postId]);

    const submitReply = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!postId) return;
        const clean = replyText.trim();
        if (!clean) {
            toast.error("Reply text is required.");
            return;
        }
        if (clean.length > 1000) {
            toast.error("Reply must not exceed 1000 characters.");
            return;
        }
        setSubmitting(true);
        try {
            const data = await inboxApi.createReply(postId, { text: clean });
            setReplies((current) => current.some((item) => item.replyId === data.reply.replyId) ? current : [...current, data.reply]);
            setPost((current) => current ? { ...current, replyCount: current.replyCount + 1 } : current);
            setReplyText("");
            toast.success("Reply posted");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to post reply");
        } finally {
            setSubmitting(false);
        }
    };

    const deletePost = async () => {
        if (!post) return;
        setActionLoading(true);
        try {
            await inboxApi.deletePost(post.postId);
            toast.success("Post deleted");
            navigate("/user/inbox", { replace: true });
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to delete post");
        } finally {
            setActionLoading(false);
        }
    };

    const deleteReply = async () => {
        if (!deleteReplyTarget) return;
        setActionLoading(true);
        try {
            await inboxApi.deleteReply(deleteReplyTarget.replyId);
            setReplies((current) => current.filter((reply) => reply.replyId !== deleteReplyTarget.replyId));
            setPost((current) => current ? { ...current, replyCount: Math.max(0, current.replyCount - 1) } : current);
            setDeleteReplyTarget(null);
            toast.success("Reply deleted");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to delete reply");
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) return <DetailSkeleton />;

    return (
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="mx-auto max-w-4xl space-y-5">
                <Button asChild variant="outline" className="gap-2">
                    <Link to="/user/inbox"><ArrowLeft className="size-4" />Back to Community Inbox</Link>
                </Button>

                {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

                {post && (
                    <>
                        <Card>
                            <CardHeader className="space-y-4">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <AuthorLine author={post.author} createdAt={post.createdAt} />
                                    {isPostOwner(post) && (
                                        <Button variant="ghost" className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeletePostOpen(true)}>
                                            <Trash2 className="size-4" />Delete Post
                                        </Button>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Badge variant="secondary">{CATEGORIES[post.category]}</Badge>
                                    {post.isPinned && <Badge className="bg-amber-500 text-white hover:bg-amber-500">Pinned</Badge>}
                                    <Badge variant="outline" className="gap-1"><MessageSquare className="size-3" />{post.replyCount} replies</Badge>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <p className="whitespace-pre-wrap break-words text-sm leading-7">{post.text}</p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Replies</CardTitle>
                                <CardDescription>Text replies from verified members.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {replies.length === 0 ? (
                                    <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                                        No replies yet.
                                    </div>
                                ) : (
                                    replies.map((reply) => (
                                        <div key={reply.replyId} className="rounded-md border p-3">
                                            <div className="flex items-start justify-between gap-3">
                                                <AuthorLine author={reply.author} createdAt={reply.createdAt} />
                                                {isReplyOwner(reply) && (
                                                    <Button variant="ghost" size="icon" className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeleteReplyTarget(reply)} aria-label="Delete reply">
                                                        <Trash2 className="size-4" />
                                                    </Button>
                                                )}
                                            </div>
                                            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">{reply.text}</p>
                                        </div>
                                    ))
                                )}

                                <form onSubmit={submitReply} className="space-y-3 border-t pt-4">
                                    <Label htmlFor="reply-text">Add reply</Label>
                                    <Textarea id="reply-text" rows={4} value={replyText} maxLength={1000} disabled={submitting} onChange={(event) => setReplyText(event.target.value)} />
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-xs text-muted-foreground">{replyText.trim().length}/1000</span>
                                        <Button type="submit" disabled={submitting || replyText.trim().length === 0 || replyText.trim().length > 1000}>
                                            {submitting ? "Posting..." : "Post Reply"}
                                        </Button>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>

            <AlertDialog open={deletePostOpen} onOpenChange={setDeletePostOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete post?</AlertDialogTitle>
                        <AlertDialogDescription>This post will no longer be visible in the Community Inbox.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={(event) => { event.preventDefault(); deletePost(); }} disabled={actionLoading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            {actionLoading ? "Deleting..." : "Delete Post"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!deleteReplyTarget} onOpenChange={(open) => !open && setDeleteReplyTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete reply?</AlertDialogTitle>
                        <AlertDialogDescription>This reply will be removed from the discussion.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={(event) => { event.preventDefault(); deleteReply(); }} disabled={actionLoading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            {actionLoading ? "Deleting..." : "Delete Reply"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
