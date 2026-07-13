import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { ShieldCheck, ArrowLeft, RefreshCw, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks/use-auth";
import { activationApi } from "@/lib/api";
import { toast } from "sonner";

/* ─── helper ────────────────────────────────────────────────────────────── */

function maskEmail(email: string): string {
    const parts = email.split("@");
    if (parts.length !== 2) return email;
    const name = parts[0];
    const domain = parts[1];
    if (name.length <= 2) {
        return `${name[0]}*@${domain}`;
    }
    return `${name[0]}${"*".repeat(name.length - 2)}${name[name.length - 1]}@${domain}`;
}

/* ─── component ─────────────────────────────────────────────────────────── */

export default function ActivateMembership() {
    const navigate = useNavigate();
    const { completeActivation } = useAuth();
    const [searchParams] = useSearchParams();

    // ── form states ──────────────────────────────────────────────────
    const [memberId, setMemberId] = useState("");
    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState("");

    // ── flow control states ──────────────────────────────────────────
    const [step, setStep] = useState<1 | 2>(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ── resend countdown states ──────────────────────────────────────
    const [cooldown, setCooldown] = useState(0);

    // ── prefill inputs from query parameters ─────────────────────────
    useEffect(() => {
        const qMemberId = searchParams.get("memberId");
        const qEmail = searchParams.get("email");
        if (qMemberId) setMemberId(qMemberId.trim().toUpperCase());
        if (qEmail) setEmail(qEmail.trim().toLowerCase());
    }, [searchParams]);

    // ── cooldown timer ───────────────────────────────────────────────
    useEffect(() => {
        if (cooldown <= 0) return;
        const timer = setInterval(() => {
            setCooldown((prev) => prev - 1);
        }, 1000);
        return () => clearInterval(timer);
    }, [cooldown]);

    // ── validation ───────────────────────────────────────────────────
    const validateStep1 = () => {
        setError(null);
        if (!memberId.trim()) {
            setError("Member ID is required.");
            return false;
        }
        if (!/^[a-zA-Z0-9-]{3,15}$/.test(memberId.trim())) {
            setError("Please enter a valid Member ID.");
            return false;
        }
        if (!email.trim()) {
            setError("Registered email address is required.");
            return false;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            setError("Please enter a valid email address.");
            return false;
        }
        return true;
    };

    const validateStep2 = () => {
        setError(null);
        if (!otp.trim()) {
            setError("OTP code is required.");
            return false;
        }
        if (!/^\d{6}$/.test(otp.trim())) {
            setError("Verification OTP must be a 6-digit number.");
            return false;
        }
        return true;
    };

    // ── actions ──────────────────────────────────────────────────────
    const handleRequestOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateStep1()) return;

        setIsSubmitting(true);
        setError(null);

        try {
            const payload = {
                memberId: memberId.trim().toUpperCase(),
                email: email.trim().toLowerCase(),
            };
            const res = await activationApi.requestOtp(payload);
            toast.success(res.message || "Activation OTP sent successfully.");
            setStep(2);
            setCooldown(60); // 60s resend lock
        } catch (err: any) {
            // Map common backend errors to user-friendly copy
            let msg = err.message || "Failed to request verification code.";
            if (err.status === 404 || msg.toLowerCase().includes("invalid")) {
                msg = "We could not verify those membership details. Please check your Member ID and email.";
            } else if (err.status === 403) {
                msg = "This application is blocked or has not been approved yet.";
            } else if (err.status === 409) {
                msg = "This membership is already active. Please use the member login.";
            }
            setError(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateStep2()) return;

        setIsSubmitting(true);
        setError(null);

        try {
            const payload = {
                memberId: memberId.trim().toUpperCase(),
                email: email.trim().toLowerCase(),
                otp: otp.trim(),
            };
            const res = await activationApi.verifyOtp(payload);
            toast.success("Account activated successfully!");
            
            // Log user in using existing provider mechanism
            await completeActivation(res.authtoken, res.user);

            // Redirect to chat workspace
            navigate("/user/conversations", { replace: true });
        } catch (err: any) {
            let msg = err.message || "Verification failed.";
            if (msg.toLowerCase().includes("expired")) {
                msg = "The OTP has expired. Please request a new OTP.";
            } else if (msg.toLowerCase().includes("attempts") || err.status === 429) {
                msg = "Too many incorrect attempts. Please request a new OTP.";
            } else if (msg.toLowerCase().includes("invalid otp")) {
                msg = "Incorrect OTP code. Please try again.";
            }
            setError(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResendOtp = async () => {
        if (cooldown > 0 || isSubmitting) return;
        setOtp("");
        setIsSubmitting(true);
        setError(null);

        try {
            const payload = {
                memberId: memberId.trim().toUpperCase(),
                email: email.trim().toLowerCase(),
            };
            await activationApi.requestOtp(payload);
            toast.success("A new verification code has been sent.");
            setCooldown(60);
        } catch (err: any) {
            setError(err.message || "Failed to resend code.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleReset = () => {
        setStep(1);
        setOtp("");
        setError(null);
    };

    /* ── renders ────────────────────────────────────────────────────── */

    return (
        <div className="min-h-dvh w-full flex items-center justify-center bg-background px-4 py-12">
            <div className="w-full max-w-md space-y-6">
                
                {/* Branding */}
                <div className="flex flex-col items-center gap-2 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <ShieldCheck className="h-6 w-6" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight">Conversa Community</h1>
                    <p className="text-sm text-muted-foreground">Account Activation Portal</p>
                </div>

                <Card>
                    <CardHeader className="space-y-1">
                        <CardTitle className="text-xl">
                            {step === 1 ? "Activate Membership" : "Verify Activation Code"}
                        </CardTitle>
                        <CardDescription>
                            {step === 1
                                ? "Enter your approved Member ID and email to start activation."
                                : `We've sent a 6-digit OTP verification code to ${maskEmail(email)}.`}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {error && (
                            <Alert variant="destructive" className="mb-4">
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        {step === 1 ? (
                            /* ── STEP 1 FORM ────────────────────────────────── */
                            <form onSubmit={handleRequestOtp} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="memberId">Member ID</Label>
                                    <Input
                                        id="memberId"
                                        placeholder="e.g. MEM-G0UPQS"
                                        value={memberId}
                                        onChange={(e) => setMemberId(e.target.value.toUpperCase())}
                                        disabled={isSubmitting}
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="email">Registered Email Address</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="user@example.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        disabled={isSubmitting}
                                        required
                                    />
                                </div>

                                <Button type="submit" className="w-full" disabled={isSubmitting}>
                                    {isSubmitting ? (
                                        <span className="flex items-center gap-2">
                                            <Spinner className="size-4" />
                                            Verifying Details…
                                        </span>
                                    ) : (
                                        "Request Activation OTP"
                                    )}
                                </Button>
                            </form>
                        ) : (
                            /* ── STEP 2 FORM ────────────────────────────────── */
                            <form onSubmit={handleVerifyOtp} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="otp">6-Digit Verification OTP</Label>
                                    <div className="relative">
                                        <Input
                                            id="otp"
                                            placeholder="Enter 6-digit code"
                                            maxLength={6}
                                            value={otp}
                                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                                            className="tracking-[0.5em] text-center font-mono font-bold text-lg"
                                            disabled={isSubmitting}
                                            required
                                        />
                                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                                    </div>
                                </div>

                                <Button type="submit" className="w-full" disabled={isSubmitting}>
                                    {isSubmitting ? (
                                        <span className="flex items-center gap-2">
                                            <Spinner className="size-4" />
                                            Activating Account…
                                        </span>
                                    ) : (
                                        "Verify & Activate"
                                    )}
                                </Button>

                                <div className="flex flex-col gap-2 pt-2 border-t text-sm">
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground">Didn't receive code?</span>
                                        <Button
                                            type="button"
                                            variant="link"
                                            size="sm"
                                            className="h-auto p-0 font-medium"
                                            onClick={handleResendOtp}
                                            disabled={cooldown > 0 || isSubmitting}
                                        >
                                            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend OTP"}
                                        </Button>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="w-full justify-start text-xs text-muted-foreground hover:text-foreground p-0 h-auto gap-1"
                                        onClick={handleReset}
                                        disabled={isSubmitting}
                                    >
                                        <RefreshCw className="size-3" />
                                        <span>Change Member ID or email</span>
                                    </Button>
                                </div>
                            </form>
                        )}
                    </CardContent>
                </Card>

                <div className="text-center">
                    <Link to="/login">
                        <Button variant="link" size="sm" className="text-muted-foreground text-xs h-8">
                            <ArrowLeft className="w-3 h-3 mr-1" />
                            Return to Login
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
