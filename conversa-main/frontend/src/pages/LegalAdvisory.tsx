import { useState } from "react"
import { Scale, Loader2, AlertTriangle, ChevronDown } from "lucide-react"
import { legalAdvisoryApi, type LegalAdvisoryResult } from "@/lib/api"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

/* ─── Constants ──────────────────────────────────────────────────────────── */
const MIN_CHARS = 20
const MAX_CHARS = 3000

const JURISDICTIONS = [
    "India",
    "United States",
    "United Kingdom",
    "Canada",
    "Australia",
    "European Union",
    "Singapore",
    "UAE",
    "Other",
]

/* ─── Helper: parse advisory response into named sections ────────────────── */
interface AdvisorySections {
    issueIdentified: string
    generalLegalContext: string
    possibleNextSteps: string
    documentsToGather: string
    disclaimer: string
}

function parseSections(raw: string): AdvisorySections {
    const extract = (label: string, nextLabels: string[]): string => {
        const startRe = new RegExp(`${label}[:\\s]*`, "i")
        const startMatch = raw.search(startRe)
        if (startMatch === -1) return ""
        const contentStart = startMatch + raw.slice(startMatch).search(/\n/) + 1
        let contentEnd = raw.length
        for (const next of nextLabels) {
            const nextRe = new RegExp(next, "i")
            const idx = raw.slice(contentStart).search(nextRe)
            if (idx !== -1 && contentStart + idx < contentEnd) {
                contentEnd = contentStart + idx
            }
        }
        return raw.slice(contentStart, contentEnd).trim()
    }

    const allLabels = [
        "ISSUE IDENTIFIED",
        "GENERAL LEGAL CONTEXT",
        "POSSIBLE NEXT STEPS",
        "DOCUMENTS",
        "IMPORTANT DISCLAIMER",
    ]

    return {
        issueIdentified: extract("ISSUE IDENTIFIED", allLabels.slice(1)),
        generalLegalContext: extract("GENERAL LEGAL CONTEXT", allLabels.slice(2)),
        possibleNextSteps: extract("POSSIBLE NEXT STEPS", allLabels.slice(3)),
        documentsToGather: extract("DOCUMENTS", allLabels.slice(4)),
        disclaimer: extract("IMPORTANT DISCLAIMER", []),
    }
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

function SectionCard({
    title,
    content,
    accent = false,
}: {
    title: string
    content: string
    accent?: boolean
}) {
    return (
        <div
            className={`rounded-xl border p-4 space-y-2 ${
                accent
                    ? "border-primary/30 bg-primary/5"
                    : "border-border bg-card"
            }`}
        >
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {content || "—"}
            </p>
        </div>
    )
}

function MetaBadge({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-muted/50 px-3 py-2 min-w-0">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {label}
            </span>
            <span className="text-sm font-medium text-foreground truncate">
                {value || "—"}
            </span>
        </div>
    )
}

function ResultSkeleton() {
    return (
        <div className="space-y-4 mt-6">
            <div className="flex gap-3">
                <Skeleton className="h-14 flex-1 rounded-lg" />
                <Skeleton className="h-14 flex-1 rounded-lg" />
            </div>
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-36 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
        </div>
    )
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */
export default function LegalAdvisory() {
    const [query, setQuery] = useState("")
    const [jurisdiction, setJurisdiction] = useState("India")
    const [isLoading, setIsLoading] = useState(false)
    const [result, setResult] = useState<LegalAdvisoryResult | null>(null)
    const [validationError, setValidationError] = useState("")

    const charCount = query.length
    const isUnderMin = charCount > 0 && charCount < MIN_CHARS
    const isOverMax = charCount > MAX_CHARS

    const handleSubmit = async () => {
        // Client-side validation
        if (!query.trim()) {
            setValidationError("Please describe your legal issue.")
            return
        }
        if (query.trim().length < MIN_CHARS) {
            setValidationError(`Please provide at least ${MIN_CHARS} characters.`)
            return
        }
        if (query.length > MAX_CHARS) {
            setValidationError(`Please keep your description under ${MAX_CHARS} characters.`)
            return
        }

        setValidationError("")
        setResult(null)
        setIsLoading(true)

        try {
            const data = await legalAdvisoryApi.analyze(query.trim(), jurisdiction)
            setResult(data.advisory)
            // Scroll to result
            setTimeout(() => {
                document.getElementById("legal-advisory-result")?.scrollIntoView({ behavior: "smooth", block: "start" })
            }, 100)
        } catch (err: unknown) {
            const message =
                err instanceof Error ? err.message : "Failed to generate advisory. Please try again."
            toast.error(message)
        } finally {
            setIsLoading(false)
        }
    }

    const sections = result ? parseSections(result.advisoryResponse) : null

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* ── Header ────────────────────────────────────────── */}
            <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                    <Scale className="size-4 text-primary" />
                </div>
                <div>
                    <h1 className="text-base font-semibold leading-tight">Legal Advisory</h1>
                    <p className="text-xs text-muted-foreground">
                        AI-powered legal information — describe your issue and get structured guidance
                    </p>
                </div>
            </div>

            {/* ── Scrollable content ────────────────────────────── */}
            <div className="flex-1 overflow-y-auto thin-scrollbar px-4 py-5 space-y-5 max-w-3xl w-full mx-auto">

                {/* ── Input card ─────────────────────────────────── */}
                <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                    {/* Jurisdiction */}
                    <div className="space-y-1.5">
                        <label
                            htmlFor="legal-jurisdiction"
                            className="text-sm font-medium text-foreground"
                        >
                            Jurisdiction
                        </label>
                        <div className="relative">
                            <select
                                id="legal-jurisdiction"
                                value={jurisdiction}
                                onChange={(e) => setJurisdiction(e.target.value)}
                                disabled={isLoading}
                                className="w-full appearance-none rounded-lg border border-input bg-background px-3 py-2 pr-9 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {JURISDICTIONS.map((j) => (
                                    <option key={j} value={j}>
                                        {j}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        </div>
                    </div>

                    {/* Query textarea */}
                    <div className="space-y-1.5">
                        <label
                            htmlFor="legal-query"
                            className="text-sm font-medium text-foreground"
                        >
                            Describe Your Legal Issue
                        </label>
                        <textarea
                            id="legal-query"
                            rows={7}
                            placeholder="e.g. My landlord has not returned my security deposit of ₹50,000 even after 3 months of vacating the property. I have receipts and a signed rental agreement. What are my options?"
                            value={query}
                            onChange={(e) => {
                                setQuery(e.target.value)
                                if (validationError) setValidationError("")
                            }}
                            disabled={isLoading}
                            maxLength={MAX_CHARS + 50} // allow slight overtype so counter turns red
                            className={`w-full resize-none rounded-lg border bg-background px-3 py-2.5 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed thin-scrollbar transition-colors ${
                                validationError || isOverMax
                                    ? "border-destructive focus:ring-destructive/40"
                                    : "border-input"
                            }`}
                        />
                        {/* Character counter + validation */}
                        <div className="flex items-center justify-between gap-2">
                            <p
                                className={`text-xs ${
                                    validationError || isOverMax
                                        ? "text-destructive"
                                        : isUnderMin
                                        ? "text-amber-500"
                                        : "text-muted-foreground"
                                }`}
                            >
                                {validationError ||
                                    (isOverMax
                                        ? `${MAX_CHARS} character limit reached`
                                        : isUnderMin
                                        ? `Minimum ${MIN_CHARS} characters required`
                                        : `Describe your issue in detail for a more accurate advisory`)}
                            </p>
                            <span
                                className={`text-xs tabular-nums shrink-0 ${
                                    isOverMax
                                        ? "text-destructive font-semibold"
                                        : charCount >= MAX_CHARS * 0.9
                                        ? "text-amber-500"
                                        : "text-muted-foreground"
                                }`}
                            >
                                {charCount} / {MAX_CHARS}
                            </span>
                        </div>
                    </div>

                    {/* Submit */}
                    <Button
                        id="legal-advisory-submit"
                        onClick={handleSubmit}
                        disabled={isLoading || isOverMax}
                        className="w-full sm:w-auto"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="size-4 mr-2 animate-spin" />
                                Analyzing your issue…
                            </>
                        ) : (
                            <>
                                <Scale className="size-4 mr-2" />
                                Analyze My Issue
                            </>
                        )}
                    </Button>
                </div>

                {/* ── Loading skeleton ──────────────────────────── */}
                {isLoading && <ResultSkeleton />}

                {/* ── Result ───────────────────────────────────── */}
                {result && sections && !isLoading && (
                    <div id="legal-advisory-result" className="space-y-4">
                        {/* Disclaimer banner (top) */}
                        <div className="flex items-start gap-3 rounded-xl border border-amber-400/40 bg-amber-50/60 dark:bg-amber-900/10 dark:border-amber-500/30 px-4 py-3">
                            <AlertTriangle className="size-4 text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                                This information is generated by AI for general informational purposes and does{" "}
                                <strong>not</strong> constitute professional legal advice. Always consult a
                                qualified lawyer before taking any legal action.
                            </p>
                        </div>

                        {/* Meta badges */}
                        <div className="grid grid-cols-2 gap-3">
                            <MetaBadge label="Case Type" value={result.caseType} />
                            <MetaBadge label="Legal Domain" value={result.legalDomain} />
                        </div>

                        {/* Case summary */}
                        <SectionCard title="Case Summary" content={result.caseSummary} accent />

                        {/* Advisory sections */}
                        {sections.issueIdentified && (
                            <SectionCard title="Issue Identified" content={sections.issueIdentified} />
                        )}
                        {sections.generalLegalContext && (
                            <SectionCard
                                title="General Legal Context"
                                content={sections.generalLegalContext}
                            />
                        )}
                        {sections.possibleNextSteps && (
                            <SectionCard
                                title="Possible Next Steps"
                                content={sections.possibleNextSteps}
                            />
                        )}
                        {sections.documentsToGather && (
                            <SectionCard
                                title="Documents / Information to Gather"
                                content={sections.documentsToGather}
                            />
                        )}

                        {/* If sections couldn't be parsed, show raw response */}
                        {!sections.issueIdentified &&
                            !sections.generalLegalContext &&
                            result.advisoryResponse && (
                                <SectionCard
                                    title="Advisory Response"
                                    content={result.advisoryResponse}
                                />
                            )}

                        {/* Disclaimer (bottom, prominent) */}
                        <div className="rounded-xl border border-border bg-muted/40 px-4 py-3">
                            <p className="text-xs text-muted-foreground leading-relaxed text-center">
                                ⚖️ This information is generated by AI for general informational purposes and
                                does <strong>not</strong> constitute professional legal advice. Laws and
                                procedures vary and change over time. Consult a qualified lawyer licensed in{" "}
                                <strong>{result.jurisdiction}</strong> before taking any legal action.
                            </p>
                        </div>

                        {/* Ask another question */}
                        <div className="flex justify-center pb-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setResult(null)
                                    setQuery("")
                                    document
                                        .getElementById("legal-query")
                                        ?.focus()
                                }}
                            >
                                Ask Another Question
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
