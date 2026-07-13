import { useState, useEffect } from "react";
import { User, Shield, Lock, Save, Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { userApi } from "@/lib/api";
import { toast } from "sonner";

export default function AdminProfile() {
    const { user, setUser } = useAuth();

    // Form states
    const [name, setName] = useState(user?.name || "");
    const [about, setAbout] = useState(user?.about || "");
    const [profilePic, setProfilePic] = useState(user?.profilePic || "");

    // Password change states
    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showOldPassword, setShowOldPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);

    // Operation states
    const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
    const [isChangingPassword, setIsChangingPassword] = useState(false);

    useEffect(() => {
        if (user) {
            setName(user.name);
            setAbout(user.about || "");
            setProfilePic(user.profilePic || "");
        }
    }, [user]);

    // Handle Profile Details update
    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            toast.error("Name is required.");
            return;
        }
        setIsUpdatingProfile(true);
        try {
            await userApi.updateProfile({
                name: name.trim(),
                about: about.trim(),
                profilePic: profilePic.trim() || undefined
            });
            // Update auth context
            if (user) {
                setUser({
                    ...user,
                    name: name.trim(),
                    about: about.trim(),
                    profilePic: profilePic.trim()
                });
            }
            toast.success("Profile details updated successfully.");
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Failed to update profile.";
            toast.error(msg);
        } finally {
            setIsUpdatingProfile(false);
        }
    };

    // Handle Password Change
    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!oldPassword) {
            toast.error("Current password is required.");
            return;
        }
        if (newPassword.length < 6) {
            toast.error("New password must be at least 6 characters.");
            return;
        }
        if (newPassword !== confirmPassword) {
            toast.error("New password confirmation does not match.");
            return;
        }

        setIsChangingPassword(true);
        try {
            await userApi.updateProfile({
                oldpassword: oldPassword,
                newpassword: newPassword
            });
            toast.success("Password changed successfully.");
            setOldPassword("");
            setNewPassword("");
            setConfirmPassword("");
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Failed to change password.";
            toast.error(msg);
        } finally {
            setIsChangingPassword(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 md:p-6 space-y-6 thin-scrollbar">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Admin Profile</h1>
                <p className="text-sm text-muted-foreground">
                    Manage your administrator account details and security settings.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Profile Detail Card */}
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <User className="size-4 text-primary" />
                                <span>Profile Information</span>
                            </CardTitle>
                            <CardDescription>Update your personal administrator identity details</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleUpdateProfile} className="space-y-4">
                                <div className="flex flex-col items-center gap-4 sm:flex-row pb-2">
                                    <img
                                        src={profilePic || "https://ui-avatars.com/api/?name=Admin&background=random"}
                                        alt="Profile Avatar"
                                        className="size-16 rounded-full object-cover border bg-muted"
                                    />
                                    <div className="space-y-1.5 flex-1 w-full">
                                        <Label htmlFor="avatar-url" className="text-xs">Avatar Image URL</Label>
                                        <Input
                                            id="avatar-url"
                                            value={profilePic}
                                            onChange={(e) => setProfilePic(e.target.value)}
                                            placeholder="https://example.com/avatar.jpg"
                                            className="h-9 text-xs"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="admin-name" className="text-xs">Full Name</Label>
                                        <Input
                                            id="admin-name"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            required
                                            className="h-9"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="admin-email" className="text-xs">Registered Email Address (Locked)</Label>
                                        <Input
                                            id="admin-email"
                                            value={user?.email || ""}
                                            disabled
                                            className="h-9 bg-muted/60 cursor-not-allowed text-muted-foreground"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="admin-about" className="text-xs">Bio / Role Details</Label>
                                    <Input
                                        id="admin-about"
                                        value={about}
                                        onChange={(e) => setAbout(e.target.value)}
                                        placeholder="e.g. Lead Administrator for Conversa Platform"
                                        className="h-9"
                                    />
                                </div>

                                <div className="pt-2 flex justify-end">
                                    <Button type="submit" disabled={isUpdatingProfile} className="gap-2 text-xs">
                                        {isUpdatingProfile ? (
                                            <Loader2 className="animate-spin size-4" />
                                        ) : (
                                            <Save className="size-4" />
                                        )}
                                        <span>Save Changes</span>
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>

                {/* Password / Security Settings */}
                <div className="space-y-6">
                    <Card className="border-rose-500/20">
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Lock className="size-4 text-rose-500" />
                                <span>Change Security Password</span>
                            </CardTitle>
                            <CardDescription>Update authorization password credentials</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleChangePassword} className="space-y-4">
                                <div className="space-y-1.5 relative">
                                    <Label htmlFor="old-pass" className="text-xs">Current Password</Label>
                                    <div className="relative">
                                        <Input
                                            id="old-pass"
                                            type={showOldPassword ? "text" : "password"}
                                            value={oldPassword}
                                            onChange={(e) => setOldPassword(e.target.value)}
                                            required
                                            className="h-9 pr-9"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowOldPassword(!showOldPassword)}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        >
                                            {showOldPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-1.5 relative">
                                    <Label htmlFor="new-pass" className="text-xs">New Password (min 6 chars)</Label>
                                    <div className="relative">
                                        <Input
                                            id="new-pass"
                                            type={showNewPassword ? "text" : "password"}
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            required
                                            className="h-9 pr-9"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowNewPassword(!showNewPassword)}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        >
                                            {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="confirm-pass" className="text-xs">Confirm New Password</Label>
                                    <Input
                                        id="confirm-pass"
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                        className="h-9"
                                    />
                                </div>

                                <div className="pt-2">
                                    <Button
                                        type="submit"
                                        variant="destructive"
                                        disabled={isChangingPassword}
                                        className="w-full text-xs gap-2"
                                    >
                                        {isChangingPassword && <Loader2 className="animate-spin size-4" />}
                                        <span>Update Security Password</span>
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-xs flex items-center gap-2">
                                <Shield className="size-3.5 text-primary" />
                                <span>Security Level</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground space-y-1.5 leading-relaxed">
                            <p>You are logged in with role <Badge className="text-[9px] uppercase font-bold">Admin</Badge>.</p>
                            <p>All administrative requests utilize digital JWT signature authorization headers to guarantee tamper-proof operations.</p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
