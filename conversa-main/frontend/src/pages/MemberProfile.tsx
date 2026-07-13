import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BadgeCheck, Building2, GraduationCap, HeartPulse, MapPin, Phone, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, directoryApi } from "@/lib/api";
import type { DirectoryMemberProfile } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

function initials(name: string) {
    return name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) || "?";
}

function valueOrNotShared(value?: string | null) {
    return value && value.trim() ? value : "Not shared";
}

function DetailRow({
    label,
    value,
}: {
    label: string;
    value?: string | null;
}) {
    return (
        <div className="flex flex-col gap-1 rounded-md border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="text-sm font-medium">{valueOrNotShared(value)}</dd>
        </div>
    );
}

function ProfileSkeleton() {
    return (
        <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
            <Skeleton className="h-9 w-36" />
            <Card>
                <CardContent className="space-y-5 p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                        <Skeleton className="size-24 rounded-full" />
                        <div className="space-y-3">
                            <Skeleton className="h-7 w-56" />
                            <Skeleton className="h-4 w-28" />
                        </div>
                    </div>
                    <Skeleton className="h-16 w-full" />
                </CardContent>
            </Card>
        </div>
    );
}

export default function MemberProfile() {
    const { memberId } = useParams<{ memberId: string }>();
    const navigate = useNavigate();
    const { logout } = useAuth();
    const [member, setMember] = useState<DirectoryMemberProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchMember = useCallback(async () => {
        if (!memberId) {
            setError("Member ID is missing.");
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const data = await directoryApi.getMember(memberId);
            setMember(data.member);
        } catch (err) {
            if (err instanceof ApiError && err.status === 401) {
                toast.error("Please sign in again to view member profiles.");
                logout();
                navigate("/login", { replace: true });
                return;
            }
            if (err instanceof ApiError && err.status === 403) {
                setError("An active verified membership is required to view this profile.");
                return;
            }
            if (err instanceof ApiError && err.status === 404) {
                setError("Member not found or no longer active.");
                return;
            }
            setError(err instanceof Error ? err.message : "Failed to load this member profile.");
        } finally {
            setLoading(false);
        }
    }, [logout, memberId, navigate]);

    useEffect(() => {
        fetchMember();
    }, [fetchMember]);

    if (loading) return <ProfileSkeleton />;

    return (
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="mx-auto max-w-5xl space-y-5">
                <Button asChild variant="outline" className="gap-2">
                    <Link to="/user/directory">
                        <ArrowLeft className="size-4" />
                        Back to Directory
                    </Link>
                </Button>

                {error && (
                    <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {member && (
                    <>
                        <Card>
                            <CardContent className="p-5 md:p-6">
                                <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                                    <Avatar className="size-24 text-xl">
                                        <AvatarImage src={member.profilePic} alt={member.name} />
                                        <AvatarFallback className="bg-primary/15 font-semibold">
                                            {initials(member.name)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0 flex-1 space-y-3">
                                        <div className="space-y-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{member.name}</h1>
                                                <Badge className="gap-1 bg-emerald-600 text-white hover:bg-emerald-600">
                                                    <BadgeCheck className="size-3.5" />
                                                    Verified Member
                                                </Badge>
                                            </div>
                                            <p className="font-mono text-sm text-muted-foreground">{member.memberId}</p>
                                        </div>
                                        <p className="text-sm leading-6 text-muted-foreground">
                                            {valueOrNotShared(member.about)}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-lg">
                                        <UserRound className="size-5 text-primary" />
                                        Member Details
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <dl className="grid gap-3">
                                        <DetailRow label="City" value={member.city} />
                                        <DetailRow label="State" value={member.state} />
                                        <DetailRow label="Occupation" value={member.occupation} />
                                        <DetailRow label="Organisation" value={member.organisation} />
                                        <DetailRow label="Education" value={member.education} />
                                        <DetailRow label="Blood group" value={member.bloodGroup} />
                                    </dl>
                                </CardContent>
                            </Card>

                            <div className="space-y-5">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2 text-lg">
                                            <Phone className="size-5 text-primary" />
                                            Shared Contact
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <dl className="grid gap-3">
                                            <DetailRow label="Email" value={member.email} />
                                            <DetailRow label="Phone" value={member.phone} />
                                        </dl>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2 text-lg">
                                            <MapPin className="size-5 text-primary" />
                                            Community
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <p className="rounded-md border bg-muted/20 p-3 text-sm leading-6">
                                            {valueOrNotShared(member.communityDetails)}
                                        </p>
                                        <Separator />
                                        <div className="grid gap-3 text-sm">
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <Building2 className="size-4" />
                                                <span>{valueOrNotShared(member.organisation)}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <GraduationCap className="size-4" />
                                                <span>{valueOrNotShared(member.education)}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <HeartPulse className="size-4" />
                                                <span>{valueOrNotShared(member.bloodGroup)}</span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
