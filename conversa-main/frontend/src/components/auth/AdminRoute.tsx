import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminRoute({ children }: { children: ReactNode }) {
    const { user, isUserLoading, logout } = useAuth();

    if (isUserLoading) {
        return (
            <div className="flex gap-2 min-h-dvh items-center justify-center p-6 bg-background">
                <p className="text-lg text-muted-foreground">Please wait while we authenticate you</p>
                <Loader2 className="animate-spin text-primary size-6" />
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/admin/login" replace />;
    }

    if (user.role !== "ADMIN") {
        return (
            <div className="min-h-dvh flex flex-col items-center justify-center bg-background px-4 text-center">
                <div className="max-w-md space-y-6">
                    <div className="flex justify-center">
                        <div className="p-4 rounded-full bg-destructive/10">
                            <ShieldAlert className="size-12 text-destructive" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <h1 className="text-3xl font-bold tracking-tight">Access Denied</h1>
                        <p className="text-muted-foreground">
                            This account does not have administrator access. If you are a member, please use the main app login.
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Button variant="default" onClick={() => logout()}>
                            Log Out
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
