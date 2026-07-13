import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Pin, RotateCcw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { adminInboxApi, inboxApi } from "@/lib/api";
import type { CommunityPost, CommunityPostCategory, CommunityReply } from "@/lib/api";

const CATEGORIES: Record<CommunityPostCategory, string> = {
    ANNOUNCEMENT: "Announcement",
    GENERAL: "General",
    HELP_REQUEST: "Help Request",
    OPPORTUNITY: "Opportunity",
    EVENT: "Event",
    COMMUNITY_NOTICE: "Community Notice",
};

function formatDate(value?: string) {
    if (!value) return "N/A";
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function statusBadge(status?: string) {
    if (status === "HIDDEN") return <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300">Hidden</Badge>;
    if (status === "DELETED") return <Badge variant="destructive">Deleted</Badge>;
    return <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">Active</Badge>;
}

export default function AdminInboxPostDetail() {
    const { postId } = useParams<{ postId: string }>();
    const [post, setPost] = useState<CommunityPost | null>(null);
    const [replies, setReplies] = useState<CommunityReply[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [hidePostOpen, setHidePostOpen] = useState(false);
    const [hideReplyTarget, setHideReplyTarget] = useState<CommunityReply | null>(null);
    const [reason, setReason] = useState("");
    const [reasonError, setReasonError] = useState<string | null>(null);

    const fetchDetail = useCallback(async () => {
        if (!postId) return;
        setLoading(true);
        setError(null);
        try {
            const list = await adminInboxApi.listPosts({ search: postId, limit: 10 });
            const found = list.posts.find((item) => item.postId === postId);
            if (!found) {
                setError("Post not found.");
                setPost(null);
                setReplies([]);
                return;
            }
            setPost(found);
            if (found.status === "ACTIVE") {
                const replyData = await inboxApi.listReplies(postId, { page: 1, limit: 50, sort: "oldest" });
                setReplies(replyData.replies);
            } else {
                setReplies([]);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load admin post detail.");
        } finally {
            setLoading(false);
        }
    }, [postId]);

    useEffect(() => {
        fetchDetail();
    }, [fetchDetail]);

    const updatePost = (updated: CommunityPost) => setPost((current) => current ? { ...current, ...updated } : updated);

    const pinPost = async (pinned: boolean) => {
        if (!post) return;
        setActionLoading(true);
        try {
            const data = await adminInboxApi.pinPost(post.postId, pinned);
            updatePost(data.post);
            toast.success(pinned ? "Post pinned" : "Post unpinned");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to update pin state");
        } finally {
            setActionLoading(false);
        }
    };

    const validateReason = () => {
        const clean = reason.trim();
        if (clean.length < 5) {
            setReasonError("Reason must be at least 5 characters.");
            return null;
        }
        if (clean.length > 500) {
            setReasonError("Reason must not exceed 500 characters.");
            return null;
        }
        setReasonError(null);
        return clean;
    };

    const hidePost = async () => {
        if (!post) return;
        const clean = validateReason();
        if (!clean) return;
        setActionLoading(true);
        try {
            const data = await adminInboxApi.hidePost(post.postId, clean);
            updatePost(data.post);
            setReplies([]);
            setHidePostOpen(false);
            setReason("");
            toast.success("Post hidden");
        } catch (err) {
            setReasonError(err instanceof Error ? err.message : "Failed to hide post");
        } finally {
            setActionLoading(false);
        }
    };

    const restorePost = async () => {
        if (!post) return;
        setActionLoading(true);
        try {
            const data = await adminInboxApi.restorePost(post.postId);
            updatePost(data.post);
            toast.success("Post restored");
            fetchDetail();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to restore post");
        } finally {
            setActionLoading(false);
        }
    };

    const hideReply = async () => {
        if (!hideReplyTarget) return;
        const clean = validateReason();
        if (!clean) return;
        setActionLoading(true);
        try {
            const data = await adminInboxApi.hideReply(hideReplyTarget.replyId, clean);
            setReplies((current) => current.map((reply) => reply.replyId === data.reply.replyId ? { ...reply, ...data.reply } : reply));
            setPost((current) => current ? { ...current, replyCount: Math.max(0, current.replyCount - 1) } : current);
            setHideReplyTarget(null);
            setReason("");
            toast.success("Reply hidden");
        } catch (err) {
            setReasonError(err instanceof Error ? err.message : "Failed to hide reply");
        } finally {
            setActionLoading(false);
        }
    };

    const restoreReply = async (reply: CommunityReply) => {
        setActionLoading(true);
        try {
            const data = await adminInboxApi.restoreReply(reply.replyId);
            setReplies((current) => current.map((item) => item.replyId === reply.replyId ? { ...item, ...data.reply } : item));
            setPost((current) => current ? { ...current, replyCount: current.replyCount + 1 } : current);
            toast.success("Reply restored");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to restore reply");
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex-1 space-y-4 overflow-y-auto p-4 md:p-6">
                <Skeleton className="h-9 w-44" />
                <Skeleton className="h-60 w-full" />
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="mx-auto max-w-5xl space-y-5">
                <Button asChild variant="outline" className="gap-2">
                    <Link to="/admin/inbox"><ArrowLeft className="size-4" />Back to Admin Inbox</Link>
                </Button>

                {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

                {post && (
                    <>
                        <Card>
                            <CardHeader className="space-y-4">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-mono text-xs text-muted-foreground">{post.postId}</span>
                                            {statusBadge(post.status)}
                                            <Badge variant="secondary">{CATEGORIES[post.category]}</Badge>
                                            {post.isPinned && <Badge className="bg-amber-500 text-white hover:bg-amber-500">Pinned</Badge>}
                                        </div>
                                        <CardTitle className="mt-2 text-2xl">{post.author.name}</CardTitle>
                                        <p className="font-mono text-xs text-muted-foreground">{post.author.memberId} • {formatDate(post.createdAt)}</p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {post.status !== "DELETED" && (
                                            <Button variant="outline" onClick={() => pinPost(!post.isPinned)} disabled={actionLoading} className="gap-2">
                                                <Pin className="size-4" />{post.isPinned ? "Unpin" : "Pin"}
                                            </Button>
                                        )}
                                        {post.status === "ACTIVE" && (
                                            <Button variant="destructive" onClick={() => { setReason(""); setReasonError(null); setHidePostOpen(true); }} disabled={actionLoading} className="gap-2">
                                                <ShieldAlert className="size-4" />Hide
                                            </Button>
                                        )}
                                        {post.status === "HIDDEN" && (
                                            <Button onClick={restorePost} disabled={actionLoading} className="gap-2">
                                                <RotateCcw className="size-4" />Restore
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <p className="whitespace-pre-wrap break-words text-sm leading-7">{post.text}</p>
                                {post.moderationReason && (
                                    <Alert>
                                        <AlertDescription>Moderation reason: {post.moderationReason}</AlertDescription>
                                    </Alert>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Replies ({post.replyCount})</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {replies.length === 0 ? (
                                    <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                                        No active replies are available for this post.
                                    </p>
                                ) : (
                                    replies.map((reply) => (
                                        <div key={reply.replyId} className="rounded-md border p-3">
                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                <div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="text-sm font-medium">{reply.author.name}</span>
                                                        <Badge variant="outline" className="font-mono text-[10px]">{reply.author.memberId}</Badge>
                                                        {statusBadge(reply.status)}
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">{formatDate(reply.createdAt)}</p>
                                                </div>
                                                <div className="flex gap-2">
                                                    {reply.status === "HIDDEN" ? (
                                                        <Button size="sm" variant="outline" onClick={() => restoreReply(reply)} disabled={actionLoading}>Restore Reply</Button>
                                                    ) : (
                                                        <Button size="sm" variant="destructive" onClick={() => { setHideReplyTarget(reply); setReason(""); setReasonError(null); }} disabled={actionLoading}>Hide Reply</Button>
                                                    )}
                                                </div>
                                            </div>
                                            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">{reply.text}</p>
                                            {reply.moderationReason && <p className="mt-2 text-xs text-muted-foreground">Reason: {reply.moderationReason}</p>}
                                        </div>
                                    ))
                                )}
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>

            <Dialog open={hidePostOpen || !!hideReplyTarget} onOpenChange={(open) => {
                if (!open) {
                    setHidePostOpen(false);
                    setHideReplyTarget(null);
                }
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{hideReplyTarget ? "Hide reply" : "Hide post"}</DialogTitle>
                        <DialogDescription>Reason is required and must be 5 to 500 characters.</DialogDescription>
                    </DialogHeader>
                    {reasonError && <Alert variant="destructive"><AlertDescription>{reasonError}</AlertDescription></Alert>}
                    <div className="space-y-2">
                        <Label htmlFor="moderation-reason">Moderation reason</Label>
                        <Textarea id="moderation-reason" rows={4} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} disabled={actionLoading} />
                        <p className="text-right text-xs text-muted-foreground">{reason.trim().length}/500</p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setHidePostOpen(false); setHideReplyTarget(null); }} disabled={actionLoading}>Cancel</Button>
                        <Button variant="destructive" onClick={hideReplyTarget ? hideReply : hidePost} disabled={actionLoading || reason.trim().length < 5}>
                            {actionLoading ? "Hiding..." : "Hide"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
