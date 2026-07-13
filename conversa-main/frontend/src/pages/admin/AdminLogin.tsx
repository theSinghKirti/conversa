import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, Shield, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks/use-auth";
import { authApi } from "@/lib/api";

export default function AdminLogin() {
    const navigate = useNavigate();
    const { login, logout, user } = useAuth();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPass, setShowPass] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Redirect if already logged in
    useEffect(() => {
        if (user) {
            if (user.role === "ADMIN") {
                navigate("/admin", { replace: true });
            } else {
                navigate("/user/conversations", { replace: true });
            }
        }
    }, [user, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!email.trim() || !password) {
            setError("Please fill in all fields.");
            return;
        }

        setIsLoading(true);
        try {
            // Reuses the existing authentication login method
            await login(email.trim().toLowerCase(), password);
            
            // Wait slightly for the setUser context update to propagate
            // In the bootstrap, requireAdmin or user object check we look at the role.
            // But wait, the login function sets the user in the state. Let's inspect the active user object.
            // Since useAuth is active, we can immediately fetch the user in our component or wait.
            // Actually, we can check the returned user in localStorage or check context.
            // Wait, useAuth login method:
            //   const login = async (email: string, password: string) => {
            //       const data = await authApi.login({ email, password });
            //       await _postLogin(data.authtoken, data.user as User | undefined);
            //   };
            // Since useAuth state is updated synchronously inside _postLogin, we can query it or check the role.
            // But wait, is there a cleaner way to inspect role? Let's import authApi to login and manage session directly,
            // or let the useAuth context update and check it?
            // Actually, we can call authApi.login directly here, so we have exact control over the role check BEFORE setting user state or redirecting!
            // Wait! If we call authApi.login directly:
            //   1. Call authApi.login({ email, password })
            //   2. Read response user.role.
            //   3. If user.role === "ADMIN", then call _postLogin from useAuth (or we can just login normally and check).
            // Wait, useAuth exposes the `login` function which doesn't return the data. But it sets the user context.
            // If we login via useAuth, it updates the state. If the user is not an admin, we must immediately call `logout()` to clear the token and state, and show the error!
            // Let's do that! That's very clean and keeps all token storing and socket-connecting logic encapsulated inside useAuth.
            // Let's check:
            //   await login(email, password);
            // But wait! If we login successfully, it sets the user in useAuth context.
            // Let's check if we can inspect the role from the response or check it after.
            // Wait, we can also import `authApi` and perform the fetch ourselves:
            //   const res = await authApi.login({ email, password });
            //   if (res.user?.role !== "ADMIN") {
            //       throw new Error("This account does not have administrator access.");
            //   }
            //   // If it is admin, we proceed with normal login or set user.
            //   // Since useAuth register/login calls _postLogin internally, we can call useAuth's login or we can trigger it.
            // But wait! If we call useAuth's `login()`, it internally runs `authApi.login` and `_postLogin`.
            // Let's check `use-auth.ts` again:
            //   const login = async (email: string, password: string) => {
            //       const data = await authApi.login({ email, password });
            //       await _postLogin(data.authtoken, data.user as User | undefined);
            //   };
            // Yes! It runs `authApi.login`. If we call useAuth's `login()`, it will log the user in and set `user` state.
            // If we then check that the logged-in user is not an ADMIN, we can call `logout()` immediately and throw an error.
            // Wait, this might briefly flash the logged-in state.
            // To prevent this completely, we can import `authApi` and call it first:
            //   const data = await authApi.login({ email, password });
            //   if (data.user?.role !== "ADMIN") {
            //       setError("This account does not have administrator access.");
            //       setIsLoading(false);
            //       return;
            //   }
            //   // If they ARE admin, we can complete the authentication using useAuth's existing _postLogin?
            //   Wait, useAuth does not expose `_postLogin` publicly, it only exposes `login`, `loginWithOtp`, `register`, `logout`, etc.
            //   So if we do that, we can't call `_postLogin` directly.
            //   But wait, if we call useAuth's `login()`, it will succeed. If we check the user role in the try/catch, we can immediately logout if not admin!
            //   Let's check what the component does:
            //   Since useAuth.login updates the context, we can just do:
            //   try {
            //       await login(email, password);
            //       // Wait, useAuthProvider updates the state. We can check the localStorage token and fetch the role, or read from a temporary call.
            //       // Actually, we can check role by simply fetching me or doing a quick verification:
            //       const me = await authApi.getMe<{ role: string }>();
            //       if (me.role !== "ADMIN") {
            //           await logout();
            //           setError("This account does not have administrator access.");
            //           setIsLoading(false);
            //           return;
            //       }
            //       navigate("/admin/applications", { replace: true });
            //   }
            //   This is extremely simple, secure, and uses the centralized auth provider completely!
            
            // Let's implement exactly this flow:
            await login(email.trim().toLowerCase(), password);
            
            // Fetch live role to verify
            const me = await authApi.getMe<{ role: string }>();
            if (me.role !== "ADMIN") {
                logout(); // Clears token, state, and socket
                setError("This account does not have administrator access.");
                return;
            }

            navigate("/admin", { replace: true });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Invalid credentials.";
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-dvh w-full flex items-center justify-center bg-background px-4 py-12">
            <div className="w-full max-w-md space-y-6">
                <div className="flex flex-col items-center gap-2 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                        <Shield className="h-6 w-6 text-primary" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight">Conversa Portal</h1>
                    <p className="text-sm text-muted-foreground">Admin Portal Access</p>
                </div>

                <Card>
                    <CardHeader className="space-y-1">
                        <CardTitle className="text-xl">Admin Sign In</CardTitle>
                        <CardDescription>
                            Enter your administrator email and password to log in.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {error && (
                            <Alert variant="destructive" className="mb-4">
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email Address</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="admin@conversa.dev"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    autoComplete="email"
                                    required
                                    disabled={isLoading}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        type={showPass ? "text" : "password"}
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        autoComplete="current-password"
                                        required
                                        disabled={isLoading}
                                    />
                                    <button
                                        type="button"
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        onClick={() => setShowPass(!showPass)}
                                        aria-label={showPass ? "Hide password" : "Show password"}
                                    >
                                        {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                                    </button>
                                </div>
                            </div>

                            <Button type="submit" className="w-full" disabled={isLoading}>
                                {isLoading ? (
                                    <span className="flex items-center gap-2">
                                        <Spinner className="size-4" />
                                        Verifying…
                                    </span>
                                ) : (
                                    "Sign In as Admin"
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                <div className="text-center">
                    <Link to="/login">
                        <Button variant="link" size="sm" className="text-muted-foreground text-xs h-8">
                            <ArrowLeft className="w-3 h-3 mr-1" />
                            Return to Member Login
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
