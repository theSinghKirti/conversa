import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, ClipboardList } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { applicationApi } from "@/lib/api"
import { Link } from "react-router-dom"

/* ─── constants ─────────────────────────────────────────────────────────── */

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const

const INDIAN_STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
    "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
    "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
    "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
    "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
    "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
    "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
]

/* ─── types ─────────────────────────────────────────────────────────────── */

interface FormFields {
    name: string
    email: string
    phone: string
    city: string
    state: string
    occupation: string
    organisation: string
    education: string
    bloodGroup: string
    communityDetails: string
    consentAccepted: boolean
}

type FieldErrors = Partial<Record<keyof FormFields, string>>

/* ─── validation ─────────────────────────────────────────────────────────── */

const PHONE_RE = /^(\+91[\s-]?|0)?[6-9]\d{9}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validate(f: FormFields): FieldErrors {
    const errs: FieldErrors = {}

    const trimmedName = f.name.trim()
    if (!trimmedName) errs.name = "Full name is required."
    else if (trimmedName.length < 3) errs.name = "Name must be at least 3 characters."
    else if (trimmedName.length > 80) errs.name = "Name must not exceed 80 characters."

    const trimmedEmail = f.email.trim()
    if (!trimmedEmail) errs.email = "Email address is required."
    else if (!EMAIL_RE.test(trimmedEmail)) errs.email = "Please enter a valid email address."

    const trimmedPhone = f.phone.trim()
    if (!trimmedPhone) errs.phone = "Phone number is required."
    else if (!PHONE_RE.test(trimmedPhone)) errs.phone = "Enter a valid 10-digit Indian mobile number."

    if (!f.city.trim()) errs.city = "City is required."
    if (!f.state) errs.state = "State is required."
    if (!f.occupation.trim()) errs.occupation = "Occupation is required."

    if (f.bloodGroup && !BLOOD_GROUPS.includes(f.bloodGroup as typeof BLOOD_GROUPS[number])) {
        errs.bloodGroup = "Please select a valid blood group."
    }

    if (f.communityDetails.length > 500) {
        errs.communityDetails = "Community details must not exceed 500 characters."
    }

    if (!f.consentAccepted) {
        errs.consentAccepted = "You must accept the consent terms to submit your application."
    }

    return errs
}

/* ─── component ─────────────────────────────────────────────────────────── */

export default function MembershipApplication() {
    const navigate = useNavigate()

    const [form, setForm] = useState<FormFields>({
        name: "",
        email: "",
        phone: "",
        city: "",
        state: "",
        occupation: "",
        organisation: "",
        education: "",
        bloodGroup: "",
        communityDetails: "",
        consentAccepted: false,
    })

    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
    const [serverError, setServerError] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)

    /* ── field helpers ───────────────────────────────────────────────── */

    const set = (key: keyof FormFields, value: string | boolean) => {
        setForm(prev => ({ ...prev, [key]: value }))
        // Clear field-level error on change
        if (fieldErrors[key]) {
            setFieldErrors(prev => ({ ...prev, [key]: undefined }))
        }
        setServerError(null)
    }

    /* ── submission ──────────────────────────────────────────────────── */

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setServerError(null)

        const errs = validate(form)
        if (Object.keys(errs).length > 0) {
            setFieldErrors(errs)
            // Scroll to the first error
            const firstKey = Object.keys(errs)[0]
            document.getElementById(`field-${firstKey}`)?.focus()
            return
        }

        setIsSubmitting(true)
        try {
            const payload = {
                name: form.name.trim(),
                email: form.email.trim().toLowerCase(),
                phone: form.phone.trim(),
                city: form.city.trim(),
                state: form.state,
                occupation: form.occupation.trim(),
                organisation: form.organisation.trim(),
                education: form.education.trim(),
                bloodGroup: form.bloodGroup || undefined,
                communityDetails: form.communityDetails.trim(),
                consentAccepted: true as const,
            }

            const data = await applicationApi.submit(payload)

            // Navigate to the success page – pass only what's needed for display
            navigate("/application-submitted", {
                state: {
                    applicationId: data.application.applicationId,
                    name: data.application.name,
                    email: data.application.email,
                    status: data.application.status,
                    submittedAt: data.application.submittedAt,
                },
                replace: true,
            })
        } catch (err: unknown) {
            const message =
                err instanceof Error ? err.message : "Something went wrong. Please try again."
            setServerError(message)
        } finally {
            setIsSubmitting(false)
        }
    }

    /* ── render helpers ──────────────────────────────────────────────── */

    const FieldError = ({ field }: { field: keyof FormFields }) =>
        fieldErrors[field] ? (
            <p className="text-destructive text-xs mt-1" role="alert" aria-live="polite">
                {fieldErrors[field]}
            </p>
        ) : null

    /* ── render ──────────────────────────────────────────────────────── */

    return (
        <div className="h-full w-full overflow-y-auto bg-background">
            {/* ── header ─────────────────────────────────────────────── */}
            <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur-sm">
                <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
                    <Link to="/" aria-label="Back to home">
                        <Button variant="ghost" size="icon" className="shrink-0">
                            <ArrowLeft className="size-5" />
                        </Button>
                    </Link>
                    <div className="flex items-center gap-2">
                        <ClipboardList className="size-5 text-primary" />
                        <span className="font-semibold text-base">Membership Application</span>
                    </div>
                </div>
            </header>

            {/* ── form ───────────────────────────────────────────────── */}
            <main className="mx-auto max-w-2xl px-4 py-6 pb-16">
                {/* Intro */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold tracking-tight">Apply for Membership</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Fill in the details below. Your application will be reviewed by an administrator.
                        Fields marked <span className="text-destructive font-medium">*</span> are required.
                    </p>
                </div>

                {/* Server-level error */}
                {serverError && (
                    <Alert variant="destructive" className="mb-6">
                        <AlertDescription>{serverError}</AlertDescription>
                    </Alert>
                )}

                <form onSubmit={handleSubmit} noValidate className="space-y-6">
                    {/* ── Section: Personal Information ─────────────── */}
                    <section aria-labelledby="section-personal">
                        <h2
                            id="section-personal"
                            className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground"
                        >
                            Personal Information
                        </h2>
                        <div className="space-y-4">
                            {/* Full name */}
                            <div>
                                <Label htmlFor="field-name">
                                    Full Name <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="field-name"
                                    value={form.name}
                                    onChange={e => set("name", e.target.value)}
                                    placeholder="e.g. Kirti Singh"
                                    autoComplete="name"
                                    aria-invalid={!!fieldErrors.name}
                                    aria-describedby={fieldErrors.name ? "err-name" : undefined}
                                    className="mt-1"
                                    maxLength={80}
                                />
                                <FieldError field="name" />
                            </div>

                            {/* Email */}
                            <div>
                                <Label htmlFor="field-email">
                                    Email Address <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="field-email"
                                    type="email"
                                    value={form.email}
                                    onChange={e => set("email", e.target.value)}
                                    placeholder="you@example.com"
                                    autoComplete="email"
                                    aria-invalid={!!fieldErrors.email}
                                    className="mt-1"
                                />
                                <FieldError field="email" />
                            </div>

                            {/* Phone */}
                            <div>
                                <Label htmlFor="field-phone">
                                    Phone Number <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="field-phone"
                                    type="tel"
                                    value={form.phone}
                                    onChange={e => set("phone", e.target.value)}
                                    placeholder="9876543210"
                                    autoComplete="tel"
                                    aria-invalid={!!fieldErrors.phone}
                                    className="mt-1"
                                    maxLength={15}
                                />
                                <p className="text-muted-foreground text-xs mt-1">
                                    Indian mobile number, e.g. 9876543210 or +919876543210
                                </p>
                                <FieldError field="phone" />
                            </div>

                            {/* Blood group */}
                            <div>
                                <Label htmlFor="field-bloodGroup">Blood Group</Label>
                                <Select
                                    value={form.bloodGroup}
                                    onValueChange={val => set("bloodGroup", val)}
                                >
                                    <SelectTrigger
                                        id="field-bloodGroup"
                                        className="mt-1 w-full"
                                        aria-invalid={!!fieldErrors.bloodGroup}
                                    >
                                        <SelectValue placeholder="Select blood group (optional)" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {BLOOD_GROUPS.map(bg => (
                                            <SelectItem key={bg} value={bg}>
                                                {bg}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FieldError field="bloodGroup" />
                            </div>
                        </div>
                    </section>

                    {/* ── Section: Location ─────────────────────────── */}
                    <section aria-labelledby="section-location">
                        <h2
                            id="section-location"
                            className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground"
                        >
                            Location
                        </h2>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {/* City */}
                            <div>
                                <Label htmlFor="field-city">
                                    City <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="field-city"
                                    value={form.city}
                                    onChange={e => set("city", e.target.value)}
                                    placeholder="e.g. Lucknow"
                                    autoComplete="address-level2"
                                    aria-invalid={!!fieldErrors.city}
                                    className="mt-1"
                                />
                                <FieldError field="city" />
                            </div>

                            {/* State */}
                            <div>
                                <Label htmlFor="field-state">
                                    State <span className="text-destructive">*</span>
                                </Label>
                                <Select
                                    value={form.state}
                                    onValueChange={val => set("state", val)}
                                >
                                    <SelectTrigger
                                        id="field-state"
                                        className="mt-1 w-full"
                                        aria-invalid={!!fieldErrors.state}
                                    >
                                        <SelectValue placeholder="Select state" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {INDIAN_STATES.map(s => (
                                            <SelectItem key={s} value={s}>
                                                {s}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FieldError field="state" />
                            </div>
                        </div>
                    </section>

                    {/* ── Section: Professional Details ─────────────── */}
                    <section aria-labelledby="section-professional">
                        <h2
                            id="section-professional"
                            className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground"
                        >
                            Professional Details
                        </h2>
                        <div className="space-y-4">
                            {/* Occupation */}
                            <div>
                                <Label htmlFor="field-occupation">
                                    Occupation <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="field-occupation"
                                    value={form.occupation}
                                    onChange={e => set("occupation", e.target.value)}
                                    placeholder="e.g. Software Engineer, Student, Doctor"
                                    aria-invalid={!!fieldErrors.occupation}
                                    className="mt-1"
                                />
                                <FieldError field="occupation" />
                            </div>

                            {/* Organisation */}
                            <div>
                                <Label htmlFor="field-organisation">Organisation</Label>
                                <Input
                                    id="field-organisation"
                                    value={form.organisation}
                                    onChange={e => set("organisation", e.target.value)}
                                    placeholder="e.g. SRMCEM (optional)"
                                    className="mt-1"
                                />
                            </div>

                            {/* Education */}
                            <div>
                                <Label htmlFor="field-education">Education</Label>
                                <Input
                                    id="field-education"
                                    value={form.education}
                                    onChange={e => set("education", e.target.value)}
                                    placeholder="e.g. B.Tech CSE (optional)"
                                    className="mt-1"
                                />
                            </div>
                        </div>
                    </section>

                    {/* ── Section: Community Details ────────────────── */}
                    <section aria-labelledby="section-community">
                        <h2
                            id="section-community"
                            className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground"
                        >
                            Community Details
                        </h2>
                        <div>
                            <Label htmlFor="field-communityDetails">
                                About your connection to the community
                            </Label>
                            <Textarea
                                id="field-communityDetails"
                                value={form.communityDetails}
                                onChange={e => set("communityDetails", e.target.value)}
                                placeholder="Tell us briefly about yourself and your connection to the community (optional, max 500 characters)"
                                className="mt-1 min-h-[100px] resize-y"
                                maxLength={500}
                                aria-invalid={!!fieldErrors.communityDetails}
                                aria-describedby="communityDetails-count"
                            />
                            <div className="flex justify-between mt-1">
                                <FieldError field="communityDetails" />
                                <p
                                    id="communityDetails-count"
                                    className="text-xs text-muted-foreground ml-auto"
                                    aria-live="polite"
                                >
                                    {form.communityDetails.length}/500
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* ── Consent ───────────────────────────────────── */}
                    <section
                        aria-labelledby="section-consent"
                        className="rounded-lg border p-4 bg-muted/40"
                    >
                        <div className="flex items-start gap-3">
                            <Checkbox
                                id="field-consentAccepted"
                                checked={form.consentAccepted}
                                onCheckedChange={checked => set("consentAccepted", checked === true)}
                                aria-invalid={!!fieldErrors.consentAccepted}
                                aria-describedby={
                                    fieldErrors.consentAccepted ? "err-consent" : undefined
                                }
                                className="mt-0.5 shrink-0"
                            />
                            <div>
                                <Label
                                    htmlFor="field-consentAccepted"
                                    className="text-sm leading-snug cursor-pointer"
                                >
                                    I confirm that the information provided is correct and I consent to
                                    its use for community membership verification.{" "}
                                    <span className="text-destructive">*</span>
                                </Label>
                                {fieldErrors.consentAccepted && (
                                    <p
                                        id="err-consent"
                                        className="text-destructive text-xs mt-1"
                                        role="alert"
                                        aria-live="polite"
                                    >
                                        {fieldErrors.consentAccepted}
                                    </p>
                                )}
                            </div>
                        </div>
                    </section>

                    {/* ── Submit ────────────────────────────────────── */}
                    <Button
                        type="submit"
                        className="w-full"
                        size="lg"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <span className="flex items-center gap-2">
                                <Spinner className="size-4" />
                                Submitting…
                            </span>
                        ) : (
                            "Submit Application"
                        )}
                    </Button>

                    <p className="text-center text-xs text-muted-foreground">
                        Already an approved member?{" "}
                        <Link to="/login" className="underline underline-offset-4 hover:text-foreground">
                            Log in here
                        </Link>
                    </p>
                </form>
            </main>
        </div>
    )
}
