import { Link, useLocation, useNavigate } from "react-router-dom"
import { Bot, ContactRound, Inbox, LogOut, MessagesSquare, Settings, Star, Shield } from "lucide-react"
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarMenu,
    SidebarMenuBadge,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
    useSidebar,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "@/hooks/use-auth"
import { useConversations } from "@/hooks/use-conversations"
import { cn } from "@/lib/utils"
import { Separator } from "../ui/separator"
import { conversationApi } from "@/lib/api"
import { toast } from "sonner"
import type { Conversation } from "@/hooks/use-conversations"

const NAV_ITEMS = [
    {
        label: "Conversations",
        href: "/user/conversations",
        icon: MessagesSquare,
        tooltip: "Conversations",
    },
    {
        label: "Starred Messages",
        href: "/user/starred",
        icon: Star,
        tooltip: "Starred Messages",
    },
    {
        label: "Directory",
        href: "/user/directory",
        icon: ContactRound,
        tooltip: "Directory",
    },
    {
        label: "Community Inbox",
        href: "/user/inbox",
        icon: Inbox,
        tooltip: "Community Inbox",
    },
]

export default function DashboardSidebar() {
    const { user, logout } = useAuth()
    const { conversationsList, aiChatbotConversationId } = useConversations()
    const { state, isMobile } = useSidebar()
    const location = useLocation()
    const navigate = useNavigate()

    // number of conversations that have at least 1 unread message for the current user
    const unreadChatsCount = conversationsList.filter((c) =>
        c.unreadCounts.some((u) => u.userId === user?._id && u.count > 0)
    ).length

    const handleLogout = () => {
        logout()
        navigate("/", { replace: true })
    }

    const handleAIChatbotClick = async (e: React.MouseEvent) => {
        e.preventDefault()
        if (aiChatbotConversationId && aiChatbotConversationId !== "null") {
            navigate(`/user/conversations/${aiChatbotConversationId}`)
            return
        }

        try {
            toast.loading("Initializing AI Chatbot...", { id: "ai-init" })
            const data = await conversationApi.list<Conversation[]>()
            const chatbotConversation = data.find((c) => c.members.some((m) => m.isBot))
            if (chatbotConversation?._id) {
                toast.success("AI Chatbot ready!", { id: "ai-init" })
                navigate(`/user/conversations/${chatbotConversation._id}`)
            } else {
                toast.error("Failed to initialize AI Chatbot conversation.", { id: "ai-init" })
            }
        } catch {
            toast.error("Failed to initialize AI Chatbot conversation.", { id: "ai-init" })
        }
    }

    const initials = user?.name
        ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
        : "?"

    return (
        <Sidebar collapsible="icon">
            {/* ── Nav ─────────────────────────────────────────── */}
            <SidebarContent>
                <SidebarGroup >
                    <SidebarGroupContent>
                        <SidebarMenu className={"mt-1 w-full" + (!isMobile && state === "collapsed" ? " items-center" : "")}>
                            {NAV_ITEMS.map(({ label, href, icon: Icon, tooltip }) => {
                                const isActive =
                                    href === "/user/conversations"
                                        ? location.pathname.startsWith("/user/conversations")
                                        : href === "/user/directory"
                                            ? location.pathname.startsWith("/user/directory")
                                        : href === "/user/inbox"
                                            ? location.pathname.startsWith("/user/inbox")
                                        : location.pathname === href
                                const isConversations = href === "/user/conversations"
                                const showBadge = isConversations && unreadChatsCount > 0
                                return (
                                    <SidebarMenuItem key={label} className="min-w-10 min-h-10">
                                        <SidebarMenuButton
                                            asChild
                                            isActive={isActive}
                                            title={tooltip}
                                            className={`min-w-10 min-h-10 p-4 ${isActive ? "bg-muted-foreground/10!" : ""}`}
                                        >
                                            <Link to={href} className="flex items-center gap-2">
                                                {/* icon — with overlay badge in collapsed/icon mode */}
                                                <div className="relative shrink-0">
                                                    <Icon className={`mx-0.5 min-h-5 min-w-5 text-muted-foreground`} />
                                                    {showBadge && state === "collapsed" && (
                                                        <span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white leading-none">
                                                            {unreadChatsCount > 9 ? "9+" : unreadChatsCount}
                                                        </span>
                                                    )}
                                                </div>
                                                <span>{label}</span>
                                            </Link>
                                        </SidebarMenuButton>
                                        {/* badge in expanded mode — SidebarMenuBadge auto-hides when collapsed */}
                                        {showBadge && (
                                            <SidebarMenuBadge className="bg-primary text-white! rounded-full">
                                                {unreadChatsCount > 99 ? "99+" : unreadChatsCount}
                                            </SidebarMenuBadge>
                                        )}
                                    </SidebarMenuItem>
                                )
                            })}
                            {user?.role === "ADMIN" && (
                                <SidebarMenuItem title="Admin Dashboard" key="admin-dashboard" className="min-w-10 min-h-10 mb-2">
                                    <SidebarMenuButton
                                        asChild
                                        className="min-w-10 min-h-10 p-4 bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary border border-primary/20"
                                    >
                                        <Link to="/admin" className="flex items-center gap-2">
                                            <Shield className="min-h-5 min-w-5 shrink-0" />
                                            <span>Admin Dashboard</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            )}
                            <Separator className="mt-1 mb-3" />
                            <SidebarMenuItem title="AI Chatbot" key={"ai-chatbot"} className="min-w-10 min-h-10">
                                <SidebarMenuButton
                                    onClick={handleAIChatbotClick}
                                    className={`min-w-10 min-h-10 cursor-pointer ${state=="collapsed"&&"rounded-full"} bg-primary hover:bg-primary p-4 border-2 border-primary text-background hover:text-background`}
                                >
                                    <div className="flex items-center gap-2">
                                        <div className="relative shrink-0">
                                            <Bot className="mx relative min-h-5 min-w-5" />
                                        </div>
                                        <span>AI Chatbot</span>
                                    </div>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            {/* ── Footer ──────────────────────────────────────── */}
            <SidebarFooter>
                <SidebarMenu className={"w-full mb-1" + (!isMobile && state === "collapsed" ? " items-center" : "")}>

                    {/* settings */}
                    <SidebarMenuItem key={"Account Settings"} className="flex min-w-10 min-h-10 items-center justify-center">
                        <SidebarMenuButton
                            asChild
                            title="Account Settings"
                            className="min-w-9 min-h-9"
                        >
                            <Link to={"/user/profile"} className="flex items-center gap-2">
                                {/* icon — with overlay badge in collapsed/icon mode */}
                                <div className="relative shrink-0">
                                    <Settings className="min-h-5 min-w-5 text-muted-foreground" />
                                </div>
                                <span>Account Settings</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>

                    <Separator className="mb-2" />

                    {/* User info row */}
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            size="lg"
                            // tooltip={user?.name ?? "Account"}
                            className="cursor-default hover:bg-transparent active:bg-transparent p-1"
                        >
                            <Avatar className="size-7 shrink-0 rounded-lg">
                                <AvatarImage src={user?.profilePic} alt={user?.name} />
                                <AvatarFallback className="rounded-lg bg-primary/20  text-xs font-semibold">
                                    {initials}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex min-w-0 flex-col">
                                <span className="truncate text-sm font-medium leading-tight">{user?.name}</span>
                                <span className={cn(
                                    "truncate text-xs leading-tight",
                                    state === "expanded" ? "text-muted-foreground" : "hidden"
                                )}>{user?.email}</span>
                            </div>
                        </SidebarMenuButton>
                    </SidebarMenuItem>

                    {/* Logout */}
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            title="Log out"
                            onClick={handleLogout}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 active:bg-destructive/10 min-h-10 min-w-10"
                        >
                            <LogOut className="min-h-5 min-w-5" />
                            <span>Log out</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>

            <SidebarRail />
        </Sidebar>
    )
}
