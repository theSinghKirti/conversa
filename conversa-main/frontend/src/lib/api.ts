/**
 * Centralized API client.
 *
 * Every HTTP call in the app goes through this file.  If the base URL, auth
 * header, or error-handling logic ever needs to change, there is exactly one
 * place to update.
 */

const API_BASE: string =
    import.meta.env.VITE_API_URL ?? "http://localhost:5500";

/* ─── payload / response types ─────────────────────────────────────────── */

export interface LoginPayload {
    email: string;
    password?: string;
    otp?: string;
}

export interface AuthTokenResponse {
    authtoken: string;
    user?: {
        _id: string;
        name: string;
        email: string;
        profilePic: string;
        isEmailVerified: boolean;
        role: "MEMBER" | "ADMIN";
    };
}

export interface RegisterPayload {
    name: string;
    email: string;
    password: string;
}

export interface UpdateProfilePayload {
    name?: string;
    about?: string;
    profilePic?: string;
    oldpassword?: string;
    newpassword?: string;
    emailNotificationsEnabled?: boolean;
}

export type NonFriendsSort = "name_asc" | "name_desc" | "last_seen_recent" | "last_seen_oldest";

export interface NonFriendsParams {
    search?: string;
    sort?: NonFriendsSort;
    page?: number;
    limit?: number;
}

export type DirectorySort = "name_asc" | "name_desc" | "newest" | "city_asc";

export interface DirectoryMemberSummary {
    memberId: string;
    name: string;
    profilePic?: string;
    about?: string;
    city?: string;
    state?: string;
    occupation?: string;
    organisation?: string | null;
    education?: string | null;
    bloodGroup?: string | null;
}

export interface DirectoryMemberProfile extends DirectoryMemberSummary {
    communityDetails?: string | null;
    email?: string | null;
    phone?: string | null;
}

export interface DirectoryVisibility {
    showEmail: boolean;
    showPhone: boolean;
    showOrganisation: boolean;
    showEducation: boolean;
    showBloodGroup: boolean;
    showCommunityDetails: boolean;
}

export interface DirectoryPagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export interface DirectoryListParams {
    search?: string;
    city?: string;
    state?: string;
    occupation?: string;
    bloodGroup?: string;
    education?: string;
    page?: number;
    limit?: number;
    sort?: DirectorySort;
}

export interface DirectoryListResponse {
    success: boolean;
    members: DirectoryMemberSummary[];
    pagination: DirectoryPagination;
    filters: {
        search: string;
        city: string;
        state: string;
        occupation: string;
        bloodGroup: string;
        education: string;
    };
}

export interface DirectoryMemberResponse {
    success: boolean;
    member: DirectoryMemberProfile;
}

export interface DirectoryPrivacyResponse {
    success: boolean;
    message?: string;
    directoryVisibility: DirectoryVisibility;
}

export type CommunityPostCategory =
    | "ANNOUNCEMENT"
    | "GENERAL"
    | "HELP_REQUEST"
    | "OPPORTUNITY"
    | "EVENT"
    | "COMMUNITY_NOTICE";

export type CommunityContentStatus = "ACTIVE" | "HIDDEN" | "DELETED";

export type CommunityInboxSort = "newest" | "oldest" | "most_replied";

export interface CommunityAuthor {
    memberId: string;
    name: string;
    profilePic?: string;
}

export interface CommunityPost {
    postId: string;
    author: CommunityAuthor;
    category: CommunityPostCategory;
    text: string;
    status?: CommunityContentStatus;
    isPinned: boolean;
    replyCount: number;
    createdAt: string;
    updatedAt?: string;
    isOwner?: boolean;
    isOwnPost?: boolean;
    moderationReason?: string;
}

export interface CommunityReply {
    replyId: string;
    postId?: string;
    author: CommunityAuthor;
    text: string;
    status?: CommunityContentStatus;
    createdAt: string;
    updatedAt?: string;
    isOwner?: boolean;
    isOwnReply?: boolean;
    moderationReason?: string;
}

export interface CommunityPagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export interface CommunityPostListParams {
    search?: string;
    category?: CommunityPostCategory;
    status?: CommunityContentStatus;
    page?: number;
    limit?: number;
    sort?: CommunityInboxSort;
}

export interface CommunityPostListResponse {
    success: boolean;
    posts: CommunityPost[];
    pagination: CommunityPagination;
}

export interface CommunityPostResponse {
    success: boolean;
    message?: string;
    post: CommunityPost;
}

export interface CommunityReplyListParams {
    page?: number;
    limit?: number;
    sort?: "newest" | "oldest";
}

export interface CommunityReplyListResponse {
    success: boolean;
    replies: CommunityReply[];
    pagination: CommunityPagination;
}

export interface CommunityReplyResponse {
    success: boolean;
    message?: string;
    reply: CommunityReply;
}

/* ─── helpers ──────────────────────────────────────────────────────────── */

const getToken = (): string => localStorage.getItem("auth-token") ?? "";

const headers = (extra: Record<string, string> = {}): Record<string, string> => ({
    "Content-Type": "application/json",
    "auth-token": getToken(),
    ...extra,
});

export class ApiError extends Error {
    status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = "ApiError";
        this.status = status;
    }
}

const handleResponse = async <T = unknown>(res: Response): Promise<T> => {
    const data = await res.json().catch(() => ({})) as T & { error?: string; message?: string };
    if (!res.ok) throw new ApiError(data.error ?? data.message ?? "Request failed", res.status);
    return data;
};

/* ─── auth ─────────────────────────────────────────────────────────────── */

export const authApi = {
    login: (payload: LoginPayload) =>
        fetch(`${API_BASE}/auth/login`, {
            method: "POST",
            headers: headers(),
            body: JSON.stringify(payload),
        }).then((res) => handleResponse<AuthTokenResponse>(res)),

    register: (payload: RegisterPayload) =>
        fetch(`${API_BASE}/auth/register`, {
            method: "POST",
            headers: headers(),
            body: JSON.stringify(payload),
        }).then((res) => handleResponse<AuthTokenResponse>(res)),

    getMe: <T = unknown>() =>
        fetch(`${API_BASE}/auth/me`, {
            headers: headers(),
        }).then((res) => handleResponse<T>(res)),

    sendOtp: (email: string) =>
        fetch(`${API_BASE}/auth/getotp`, {
            method: "POST",
            headers: headers(),
            body: JSON.stringify({ email }),
        }).then(handleResponse),

    sendVerificationOtp: () =>
        fetch(`${API_BASE}/auth/send-verification-otp`, {
            method: "POST",
            headers: headers(),
        }).then(handleResponse),

    verifyEmail: (otp: string) =>
        fetch(`${API_BASE}/auth/verify-email`, {
            method: "POST",
            headers: headers(),
            body: JSON.stringify({ otp }),
        }).then(handleResponse),
};

/* ─── conversations ────────────────────────────────────────────────────── */

export const conversationApi = {
    list: <T = unknown>() =>
        fetch(`${API_BASE}/conversation/`, {
            headers: headers(),
        }).then((res) => handleResponse<T>(res)),

    get: <T = unknown>(id: string) =>
        fetch(`${API_BASE}/conversation/${id}`, {
            headers: headers(),
        }).then((res) => handleResponse<T>(res)),

    create: (memberIds: string[]) =>
        fetch(`${API_BASE}/conversation/`, {
            method: "POST",
            headers: headers(),
            body: JSON.stringify({ members: memberIds }),
        }).then(handleResponse),

    togglePin: (id: string) =>
        fetch(`${API_BASE}/conversation/${id}/pin`, {
            method: "POST",
            headers: headers(),
        }).then((res) => handleResponse<{ isPinned: boolean }>(res)),
};

/* ─── messages ─────────────────────────────────────────────────────────── */

export const messageApi = {
    list: (conversationId: string, page: number = 1, limit: number = 50) =>
        fetch(`${API_BASE}/message/${conversationId}?page=${page}&limit=${limit}`, {
            headers: headers(),
        }).then(handleResponse),

    delete: (messageId: string, scope: "me" | "everyone") =>
        fetch(`${API_BASE}/message/${messageId}`, {
            method: "DELETE",
            headers: headers(),
            body: JSON.stringify({ scope }),
        }).then(handleResponse),

    bulkDelete: (messageIds: string[]) =>
        fetch(`${API_BASE}/message/bulk/hide`, {
            method: "DELETE",
            headers: headers(),
            body: JSON.stringify({ messageIds }),
        }).then(handleResponse),

    clearChat: (conversationId: string) =>
        fetch(`${API_BASE}/message/clear/${conversationId}`, {
            method: "POST",
            headers: headers(),
        }).then(handleResponse),

    toggleStar: (messageId: string) =>
        fetch(`${API_BASE}/message/${messageId}/star`, {
            method: "POST",
            headers: headers(),
        }).then((res) => handleResponse<{ isStarred: boolean; starredBy: string[] }>(res)),

    getStarred: <T = unknown>() =>
        fetch(`${API_BASE}/message/starred`, {
            headers: headers(),
        }).then((res) => handleResponse<T>(res)),
};

/* ─── users ────────────────────────────────────────────────────────────── */

export const userApi = {
    getOnlineStatus: (userId: string) =>
        fetch(`${API_BASE}/user/online-status/${userId}`, {
            headers: headers(),
        }).then(handleResponse),

    getNonFriends: (params: NonFriendsParams = {}) => {
        const qs = new URLSearchParams()
        if (params.search) qs.set("search", params.search)
        if (params.sort)   qs.set("sort",   params.sort)
        if (params.page)   qs.set("page",   String(params.page))
        if (params.limit)  qs.set("limit",  String(params.limit))
        return fetch(`${API_BASE}/user/non-friends?${qs.toString()}`, {
            headers: headers(),
        }).then(handleResponse)
    },

    updateProfile: (payload: UpdateProfilePayload) =>
        fetch(`${API_BASE}/user/update`, {
            method: "PUT",
            headers: headers(),
            body: JSON.stringify(payload),
        }).then(handleResponse),

    getPresignedUrl: (filename: string, filetype: string) =>
        fetch(
            `${API_BASE}/user/presigned-url?filename=${encodeURIComponent(filename)}&filetype=${encodeURIComponent(filetype)}`,
            { headers: headers() }
        ).then(handleResponse),

    blockUser: (userId: string) =>
        fetch(`${API_BASE}/user/block/${userId}`, {
            method: "POST",
            headers: headers(),
        }).then(handleResponse),

    unblockUser: (userId: string) =>
        fetch(`${API_BASE}/user/block/${userId}`, {
            method: "DELETE",
            headers: headers(),
        }).then(handleResponse),

    getBlockStatus: (userId: string) =>
        fetch(`${API_BASE}/user/block-status/${userId}`, {
            headers: headers(),
        }).then((res) => handleResponse<{ iBlockedThem: boolean; theyBlockedMe: boolean }>(res)),

    deleteAccount: () =>
        fetch(`${API_BASE}/user/delete`, {
            method: "DELETE",
            headers: headers(),
        }).then(handleResponse),
};

/* ─── verified community directory ───────────────────────────────────────── */

export const directoryApi = {
    listMembers: (params: DirectoryListParams = {}) => {
        const query = new URLSearchParams();
        if (params.search) query.set("search", params.search);
        if (params.city) query.set("city", params.city);
        if (params.state) query.set("state", params.state);
        if (params.occupation) query.set("occupation", params.occupation);
        if (params.bloodGroup) query.set("bloodGroup", params.bloodGroup);
        if (params.education) query.set("education", params.education);
        if (params.page) query.set("page", String(params.page));
        if (params.limit) query.set("limit", String(params.limit));
        if (params.sort) query.set("sort", params.sort);

        const suffix = query.toString() ? `?${query.toString()}` : "";
        return fetch(`${API_BASE}/directory/members${suffix}`, {
            headers: headers(),
        }).then((res) => handleResponse<DirectoryListResponse>(res));
    },

    getMember: (memberId: string) =>
        fetch(`${API_BASE}/directory/members/${encodeURIComponent(memberId)}`, {
            headers: headers(),
        }).then((res) => handleResponse<DirectoryMemberResponse>(res)),

    getMyPrivacy: () =>
        fetch(`${API_BASE}/directory/me/privacy`, {
            headers: headers(),
        }).then((res) => handleResponse<DirectoryPrivacyResponse>(res)),

    updateMyPrivacy: (settings: DirectoryVisibility) =>
        fetch(`${API_BASE}/directory/me/privacy`, {
            method: "PATCH",
            headers: headers(),
            body: JSON.stringify(settings),
        }).then((res) => handleResponse<DirectoryPrivacyResponse>(res)),
};

/* ─── shared community inbox ─────────────────────────────────────────────── */

export const inboxApi = {
    listPosts: (params: CommunityPostListParams = {}) => {
        const query = new URLSearchParams();
        if (params.search) query.set("search", params.search);
        if (params.category) query.set("category", params.category);
        if (params.page) query.set("page", String(params.page));
        if (params.limit) query.set("limit", String(params.limit));
        if (params.sort) query.set("sort", params.sort);
        const suffix = query.toString() ? `?${query.toString()}` : "";
        return fetch(`${API_BASE}/inbox/posts${suffix}`, {
            headers: headers(),
        }).then((res) => handleResponse<CommunityPostListResponse>(res));
    },

    createPost: (data: { category: CommunityPostCategory; text: string }) =>
        fetch(`${API_BASE}/inbox/posts`, {
            method: "POST",
            headers: headers(),
            body: JSON.stringify(data),
        }).then((res) => handleResponse<CommunityPostResponse>(res)),

    getPost: (postId: string) =>
        fetch(`${API_BASE}/inbox/posts/${encodeURIComponent(postId)}`, {
            headers: headers(),
        }).then((res) => handleResponse<CommunityPostResponse>(res)),

    deletePost: (postId: string) =>
        fetch(`${API_BASE}/inbox/posts/${encodeURIComponent(postId)}`, {
            method: "DELETE",
            headers: headers(),
        }).then((res) => handleResponse<{ success: boolean; message: string; postId: string }>(res)),

    listReplies: (postId: string, params: CommunityReplyListParams = {}) => {
        const query = new URLSearchParams();
        if (params.page) query.set("page", String(params.page));
        if (params.limit) query.set("limit", String(params.limit));
        if (params.sort) query.set("sort", params.sort);
        const suffix = query.toString() ? `?${query.toString()}` : "";
        return fetch(`${API_BASE}/inbox/posts/${encodeURIComponent(postId)}/replies${suffix}`, {
            headers: headers(),
        }).then((res) => handleResponse<CommunityReplyListResponse>(res));
    },

    createReply: (postId: string, data: { text: string }) =>
        fetch(`${API_BASE}/inbox/posts/${encodeURIComponent(postId)}/replies`, {
            method: "POST",
            headers: headers(),
            body: JSON.stringify(data),
        }).then((res) => handleResponse<CommunityReplyResponse>(res)),

    deleteReply: (replyId: string) =>
        fetch(`${API_BASE}/inbox/replies/${encodeURIComponent(replyId)}`, {
            method: "DELETE",
            headers: headers(),
        }).then((res) => handleResponse<{ success: boolean; message: string; replyId: string }>(res)),
};

export const adminInboxApi = {
    listPosts: (params: CommunityPostListParams = {}) => {
        const query = new URLSearchParams();
        if (params.search) query.set("search", params.search);
        if (params.category) query.set("category", params.category);
        if (params.status) query.set("status", params.status);
        if (params.page) query.set("page", String(params.page));
        if (params.limit) query.set("limit", String(params.limit));
        if (params.sort) query.set("sort", params.sort);
        const suffix = query.toString() ? `?${query.toString()}` : "";
        return fetch(`${API_BASE}/admin/inbox/posts${suffix}`, {
            headers: headers(),
        }).then((res) => handleResponse<CommunityPostListResponse>(res));
    },

    pinPost: (postId: string, pinned: boolean) =>
        fetch(`${API_BASE}/admin/inbox/posts/${encodeURIComponent(postId)}/pin`, {
            method: "PATCH",
            headers: headers(),
            body: JSON.stringify({ pinned }),
        }).then((res) => handleResponse<CommunityPostResponse>(res)),

    hidePost: (postId: string, reason: string) =>
        fetch(`${API_BASE}/admin/inbox/posts/${encodeURIComponent(postId)}/hide`, {
            method: "PATCH",
            headers: headers(),
            body: JSON.stringify({ reason }),
        }).then((res) => handleResponse<CommunityPostResponse>(res)),

    restorePost: (postId: string) =>
        fetch(`${API_BASE}/admin/inbox/posts/${encodeURIComponent(postId)}/restore`, {
            method: "PATCH",
            headers: headers(),
        }).then((res) => handleResponse<CommunityPostResponse>(res)),

    hideReply: (replyId: string, reason: string) =>
        fetch(`${API_BASE}/admin/inbox/replies/${encodeURIComponent(replyId)}/hide`, {
            method: "PATCH",
            headers: headers(),
            body: JSON.stringify({ reason }),
        }).then((res) => handleResponse<CommunityReplyResponse>(res)),

    restoreReply: (replyId: string) =>
        fetch(`${API_BASE}/admin/inbox/replies/${encodeURIComponent(replyId)}/restore`, {
            method: "PATCH",
            headers: headers(),
        }).then((res) => handleResponse<CommunityReplyResponse>(res)),
};

/* ─── membership application (public – no auth required) ───────────────── */

export interface ApplicationPayload {
    name: string;
    email: string;
    phone: string;
    city: string;
    state: string;
    occupation: string;
    organisation?: string;
    education?: string;
    bloodGroup?: string;
    communityDetails?: string;
    consentAccepted: true;
}

export interface ApplicationSubmitResponse {
    success: boolean;
    message: string;
    application: {
        applicationId: string;
        name: string;
        email: string;
        status: string;
        submittedAt: string;
    };
}

export const applicationApi = {
    submit: (payload: ApplicationPayload) =>
        fetch(`${API_BASE}/application/apply`, {
            method: "POST",
            // No auth-token header — this is a public endpoint
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        }).then((res) => handleResponse<ApplicationSubmitResponse>(res)),
};

export type ApplicationStatus =
    | "PENDING"
    | "APPROVED_PENDING_VERIFICATION"
    | "ACTIVE"
    | "REJECTED"
    | "SUSPENDED";

export interface MembershipApplication {
    applicationId: string;
    memberId?: string;
    name: string;
    email: string;
    phone: string;
    city: string;
    state: string;
    occupation: string;
    organisation?: string;
    education?: string;
    bloodGroup?: string;
    communityDetails?: string;
    consentAccepted: boolean;
    status: ApplicationStatus;
    rejectionReason?: string;
    reviewedAt?: string;
    createdAt: string;
    updatedAt: string;
    activationInviteStatus?: "NOT_SENT" | "SENT" | "FAILED";
    activationInviteSentAt?: string;
    activationInviteError?: string;
    activatedAt?: string;
    activatedUser?: string;
}

export interface PaginationInfo {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export interface ListApplicationsResponse {
    success: boolean;
    applications: MembershipApplication[];
    pagination: PaginationInfo;
}

export interface GetApplicationResponse {
    success: boolean;
    application: MembershipApplication;
}

export interface ApproveApplicationResponse {
    success: boolean;
    message: string;
    application: {
        applicationId: string;
        memberId: string;
        name: string;
        email: string;
        status: ApplicationStatus;
        reviewedAt: string;
    };
}

export interface RejectApplicationResponse {
    success: boolean;
    message: string;
    application: {
        applicationId: string;
        status: ApplicationStatus;
        rejectionReason: string;
        reviewedAt: string;
    };
}

export const adminApi = {
    listApplications: (params: {
        status?: ApplicationStatus;
        search?: string;
        page?: number;
        limit?: number;
        sort?: string;
    } = {}) => {
        const query = new URLSearchParams();
        if (params.status) query.set("status", params.status);
        if (params.search) query.set("search", params.search);
        if (params.page) query.set("page", String(params.page));
        if (params.limit) query.set("limit", String(params.limit));
        if (params.sort) query.set("sort", params.sort);

        return fetch(`${API_BASE}/admin/applications?${query.toString()}`, {
            method: "GET",
            headers: headers(),
        }).then((res) => handleResponse<ListApplicationsResponse>(res));
    },

    getApplication: (applicationId: string) =>
        fetch(`${API_BASE}/admin/applications/${applicationId}`, {
            method: "GET",
            headers: headers(),
        }).then((res) => handleResponse<GetApplicationResponse>(res)),

    approveApplication: (applicationId: string) =>
        fetch(`${API_BASE}/admin/applications/${applicationId}/approve`, {
            method: "PATCH",
            headers: headers(),
        }).then((res) => handleResponse<ApproveApplicationResponse>(res)),

    rejectApplication: (applicationId: string, reason: string) =>
        fetch(`${API_BASE}/admin/applications/${applicationId}/reject`, {
            method: "PATCH",
            headers: headers(),
            body: JSON.stringify({ reason }),
        }).then((res) => handleResponse<RejectApplicationResponse>(res)),

    sendActivationInvite: (applicationId: string) =>
        fetch(`${API_BASE}/admin/applications/${applicationId}/send-activation-invite`, {
            method: "POST",
            headers: headers(),
        }).then((res) => handleResponse<{
            success: boolean;
            message: string;
            invitation: { status: "SENT" | "FAILED"; sentAt: string };
        }>(res)),
};

/* ─── public activation routes (no auth required) ───────────────────────── */

export interface ActivationOtpRequest {
    memberId: string;
    email: string;
}

export interface ActivationOtpVerification {
    memberId: string;
    email: string;
    otp: string;
}

export const activationApi = {
    requestOtp: (payload: ActivationOtpRequest) =>
        fetch(`${API_BASE}/activation/request-otp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        }).then((res) => handleResponse<{ success: boolean; message: string; expiresInSeconds: number }>(res)),

    verifyOtp: (payload: ActivationOtpVerification) =>
        fetch(`${API_BASE}/activation/verify-otp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        }).then((res) => handleResponse<{
            success: boolean;
            message: string;
            authtoken: string;
            user: any; // User type matches return contract
        }>(res)),
};

export { API_BASE };
