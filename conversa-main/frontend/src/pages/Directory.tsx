import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Filter, RefreshCw, Search, Users } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { directoryApi, ApiError } from "@/lib/api";
import type {
    DirectoryListParams,
    DirectoryMemberSummary,
    DirectoryPagination,
    DirectorySort,
} from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

const LIMIT = 12;
const ALL = "__all__";

const SORT_OPTIONS: { value: DirectorySort; label: string }[] = [
    { value: "name_asc", label: "Name A-Z" },
    { value: "name_desc", label: "Name Z-A" },
    { value: "newest", label: "Newest" },
    { value: "city_asc", label: "City A-Z" },
];

function getInitials(name: string) {
    return name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) || "?";
}

function useDebounce<T>(value: T, delay: number) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const id = window.setTimeout(() => setDebounced(value), delay);
        return () => window.clearTimeout(id);
    }, [value, delay]);
    return debounced;
}

function readParams(searchParams: URLSearchParams) {
    return {
        search: searchParams.get("search") ?? "",
        city: searchParams.get("city") ?? "",
        state: searchParams.get("state") ?? "",
        occupation: searchParams.get("occupation") ?? "",
        bloodGroup: searchParams.get("bloodGroup") ?? "",
        education: searchParams.get("education") ?? "",
        sort: (searchParams.get("sort") as DirectorySort | null) ?? "name_asc",
        page: Math.max(Number(searchParams.get("page") ?? "1") || 1, 1),
    };
}

function setParam(next: URLSearchParams, key: string, value: string) {
    if (value.trim()) next.set(key, value.trim());
    else next.delete(key);
}

function SelectFilter({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value: string;
    options: string[];
    onChange: (value: string) => void;
}) {
    return (
        <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">{label}</Label>
            <Select value={value || ALL} onValueChange={(next) => onChange(next === ALL ? "" : next)}>
                <SelectTrigger className="h-10">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={ALL}>All</SelectItem>
                    {options.map((option) => (
                        <SelectItem key={option} value={option}>
                            {option}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

function MemberCard({ member }: { member: DirectoryMemberSummary }) {
    const location = [member.city, member.state].filter(Boolean).join(", ");

    return (
        <Card className="h-full">
            <CardContent className="flex h-full flex-col gap-4 p-4">
                <div className="flex gap-3">
                    <Avatar className="size-12 shrink-0">
                        <AvatarImage src={member.profilePic} alt={member.name} />
                        <AvatarFallback className="bg-primary/15 font-semibold">
                            {getInitials(member.name)}
                        </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="truncate text-base font-semibold">{member.name}</h2>
                            <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                                Verified
                            </Badge>
                        </div>
                        <p className="font-mono text-xs text-muted-foreground">{member.memberId}</p>
                    </div>
                </div>

                <dl className="grid gap-2 text-sm">
                    <DirectoryField label="Location" value={location} />
                    <DirectoryField label="Occupation" value={member.occupation} />
                    <DirectoryField label="Organisation" value={member.organisation} />
                    <DirectoryField label="Education" value={member.education} />
                    <DirectoryField label="Blood group" value={member.bloodGroup} />
                </dl>

                <Button asChild className="mt-auto w-full">
                    <Link to={`/user/directory/${encodeURIComponent(member.memberId)}`}>View Profile</Link>
                </Button>
            </CardContent>
        </Card>
    );
}

function DirectoryField({ label, value }: { label: string; value?: string | null }) {
    return (
        <div className="flex items-start justify-between gap-3">
            <dt className="shrink-0 text-muted-foreground">{label}</dt>
            <dd className="text-right font-medium">{value || "Not shared"}</dd>
        </div>
    );
}

function DirectorySkeleton() {
    return (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
                <Card key={index}>
                    <CardContent className="space-y-4 p-4">
                        <div className="flex gap-3">
                            <Skeleton className="size-12 rounded-full" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-4 w-2/3" />
                                <Skeleton className="h-3 w-1/3" />
                            </div>
                        </div>
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-5/6" />
                        <Skeleton className="h-9 w-full" />
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

export default function Directory() {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const { logout } = useAuth();
    const params = useMemo(() => readParams(searchParams), [searchParams]);

    const [searchInput, setSearchInput] = useState(params.search);
    const debouncedSearch = useDebounce(searchInput, 400);
    const [members, setMembers] = useState<DirectoryMemberSummary[]>([]);
    const [pagination, setPagination] = useState<DirectoryPagination>({
        page: params.page,
        limit: LIMIT,
        total: 0,
        totalPages: 1,
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const lastRequestKey = useRef("");

    useEffect(() => {
        setSearchInput(params.search);
    }, [params.search]);

    useEffect(() => {
        if (debouncedSearch === params.search) return;
        const next = new URLSearchParams(searchParams);
        setParam(next, "search", debouncedSearch);
        next.set("page", "1");
        setSearchParams(next);
    }, [debouncedSearch, params.search, searchParams, setSearchParams]);

    const updateFilter = (key: keyof Omit<DirectoryListParams, "page" | "limit">, value: string) => {
        const next = new URLSearchParams(searchParams);
        setParam(next, key, value);
        next.set("page", "1");
        setSearchParams(next);
    };

    const updatePage = (page: number) => {
        const next = new URLSearchParams(searchParams);
        next.set("page", String(page));
        setSearchParams(next);
    };

    const clearFilters = () => {
        setSearchInput("");
        setSearchParams(new URLSearchParams({ page: "1" }));
    };

    const handleAccessError = useCallback((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) {
            toast.error("Please sign in again to view the directory.");
            logout();
            navigate("/login", { replace: true });
            return true;
        }
        if (err instanceof ApiError && err.status === 403) {
            setError("An active verified membership is required to view the directory.");
            return true;
        }
        return false;
    }, [logout, navigate]);

    const fetchMembers = useCallback(async () => {
        const request: DirectoryListParams = {
            search: params.search || undefined,
            city: params.city || undefined,
            state: params.state || undefined,
            occupation: params.occupation || undefined,
            bloodGroup: params.bloodGroup || undefined,
            education: params.education || undefined,
            sort: params.sort,
            page: params.page,
            limit: LIMIT,
        };
        const requestKey = JSON.stringify({ ...request, refreshKey });
        if (requestKey === lastRequestKey.current) return;
        lastRequestKey.current = requestKey;

        setLoading(true);
        setError(null);
        try {
            const data = await directoryApi.listMembers(request);
            setMembers(data.members);
            setPagination(data.pagination);
        } catch (err) {
            if (!handleAccessError(err)) {
                setError(err instanceof Error ? err.message : "Failed to load the directory.");
            }
        } finally {
            setLoading(false);
        }
    }, [handleAccessError, params, refreshKey]);

    useEffect(() => {
        fetchMembers();
    }, [fetchMembers]);

    const filterOptions = useMemo(() => {
        const values = (key: keyof DirectoryMemberSummary) =>
            Array.from(new Set(members.map((member) => member[key]).filter((value): value is string => typeof value === "string" && value.length > 0))).sort();
        return {
            city: values("city"),
            state: values("state"),
            occupation: values("occupation"),
            bloodGroup: values("bloodGroup"),
            education: values("education"),
        };
    }, [members]);

    const hasFilters = Boolean(params.search || params.city || params.state || params.occupation || params.bloodGroup || params.education);
    const emptyMessage = hasFilters ? "No verified members matched your search." : "The verified member directory is empty.";

    return (
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="mx-auto flex max-w-7xl flex-col gap-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Directory</h1>
                        <p className="text-sm text-muted-foreground">Find verified members in your community.</p>
                    </div>
                    <Button variant="outline" className="gap-2 self-start" onClick={() => setRefreshKey((value) => value + 1)} disabled={loading}>
                        <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                </div>

                <Card>
                    <CardContent className="space-y-4 p-4">
                        <div className="flex flex-col gap-3 lg:flex-row">
                            <div className="relative flex-1">
                                <Label htmlFor="directory-search" className="sr-only">Search directory</Label>
                                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    id="directory-search"
                                    value={searchInput}
                                    onChange={(event) => setSearchInput(event.target.value)}
                                    placeholder="Search by name, member ID, city, occupation, organisation or education"
                                    className="pl-9"
                                />
                            </div>
                            <div className="flex gap-2">
                                <Select value={params.sort} onValueChange={(value) => updateFilter("sort", value)}>
                                    <SelectTrigger className="w-full sm:w-[180px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {SORT_OPTIONS.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button variant="outline" className="gap-2 md:hidden" onClick={() => setFiltersOpen((open) => !open)}>
                                    <Filter className="size-4" />
                                    Filters
                                </Button>
                            </div>
                        </div>

                        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen} className="md:hidden">
                            <CollapsibleTrigger asChild>
                                <button className="sr-only">Toggle filters</button>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="space-y-3">
                                <FilterGrid params={params} options={filterOptions} updateFilter={updateFilter} />
                            </CollapsibleContent>
                        </Collapsible>

                        <div className="hidden md:block">
                            <FilterGrid params={params} options={filterOptions} updateFilter={updateFilter} />
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-sm text-muted-foreground">
                                {pagination.total} verified member{pagination.total === 1 ? "" : "s"}
                            </p>
                            <Button variant="ghost" onClick={clearFilters} disabled={!hasFilters && params.sort === "name_asc"} className="self-start">
                                Clear filters
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {error && (
                    <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {loading ? (
                    <DirectorySkeleton />
                ) : members.length === 0 ? (
                    <Card>
                        <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
                            <Users className="size-10 text-muted-foreground" />
                            <CardTitle className="text-lg">{emptyMessage}</CardTitle>
                            <p className="max-w-md text-sm text-muted-foreground">
                                Try changing your filters or refreshing the directory.
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {members.map((member) => (
                            <MemberCard key={member.memberId} member={member} />
                        ))}
                    </div>
                )}

                {pagination.totalPages > 1 && (
                    <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-muted-foreground">
                            Page {pagination.page} of {pagination.totalPages}
                        </p>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                disabled={loading || pagination.page <= 1}
                                onClick={() => updatePage(pagination.page - 1)}
                                className="gap-2"
                            >
                                <ChevronLeft className="size-4" />
                                Previous
                            </Button>
                            <Button
                                variant="outline"
                                disabled={loading || pagination.page >= pagination.totalPages}
                                onClick={() => updatePage(pagination.page + 1)}
                                className="gap-2"
                            >
                                Next
                                <ChevronRight className="size-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function FilterGrid({
    params,
    options,
    updateFilter,
}: {
    params: ReturnType<typeof readParams>;
    options: {
        city: string[];
        state: string[];
        occupation: string[];
        bloodGroup: string[];
        education: string[];
    };
    updateFilter: (key: keyof Omit<DirectoryListParams, "page" | "limit">, value: string) => void;
}) {
    return (
        <div className="grid gap-3 md:grid-cols-5">
            <SelectFilter label="City" value={params.city} options={options.city} onChange={(value) => updateFilter("city", value)} />
            <SelectFilter label="State" value={params.state} options={options.state} onChange={(value) => updateFilter("state", value)} />
            <SelectFilter label="Occupation" value={params.occupation} options={options.occupation} onChange={(value) => updateFilter("occupation", value)} />
            <SelectFilter label="Blood group" value={params.bloodGroup} options={options.bloodGroup} onChange={(value) => updateFilter("bloodGroup", value)} />
            <SelectFilter label="Education" value={params.education} options={options.education} onChange={(value) => updateFilter("education", value)} />
        </div>
    );
}
