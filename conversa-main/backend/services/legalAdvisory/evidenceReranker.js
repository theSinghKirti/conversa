const MAX_LEGAL_SOURCES = Number.parseInt(process.env.LEGAL_ADVISORY_MAX_LEGAL_SOURCES || "5", 10) || 5;
const MAX_PRECEDENTS = Number.parseInt(process.env.LEGAL_ADVISORY_MAX_PRECEDENTS || "4", 10) || 4;

const STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "that", "this", "have", "has", "was", "were",
  "are", "is", "in", "on", "of", "to", "by", "or", "as", "an", "a", "be", "at",
  "it", "their", "your", "my", "our", "his", "her", "its", "about", "under", "into",
]);

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenSet(value) {
  return new Set(
    normalizeText(value)
      .split(/\s+/)
      .filter((token) => token.length >= 3 && !STOPWORDS.has(token))
  );
}

function collectIntakeTerms(intake = {}) {
  const terms = new Set();
  [intake.caseType, intake.legalDomain, intake.summary, intake.jurisdiction].forEach((part) => {
    for (const token of tokenSet(part)) terms.add(token);
  });
  if (Array.isArray(intake.keywords)) {
    intake.keywords.forEach((keyword) => {
      for (const token of tokenSet(keyword)) terms.add(token);
    });
  }
  if (Array.isArray(intake.relevantEntities)) {
    intake.relevantEntities.forEach((entity) => {
      for (const token of tokenSet(entity)) terms.add(token);
    });
  }
  return terms;
}

function overlapScore(terms, text) {
  if (!terms.size) return 0;
  const textTokens = tokenSet(text);
  let matched = 0;
  for (const term of terms) {
    if (textTokens.has(term)) matched += 1;
  }
  return matched / terms.size;
}

function hasTextMatch(fields, needle) {
  const normalizedNeedle = normalizeText(needle);
  if (!normalizedNeedle) return false;
  return fields.some((field) => normalizeText(field).includes(normalizedNeedle));
}

function clampScore(value) {
  return Math.max(0, Math.min(100, value));
}

function getStatus(result) {
  return result?.status || "FAILED";
}

function scoreLegalSource(source, intakeTerms, intake = {}) {
  const similarity = Number(source?.relevanceScore) || 0;
  const legalDomain = normalizeText(source?.legalDomain);
  const jurisdiction = normalizeText(intake.jurisdiction);

  const textBlob = [source?.title, source?.content, source?.source, source?.sourceUrl, source?.legalDomain].join(" ");
  const keywordOverlap = overlapScore(intakeTerms, textBlob);

  const domainMatch = legalDomain && normalizeText(intake.legalDomain) && legalDomain === normalizeText(intake.legalDomain)
    ? 1
    : (hasTextMatch([source?.title, source?.content, source?.source], intake.legalDomain) ? 0.75 : 0);

  const jurisdictionMatch = jurisdiction
    ? (hasTextMatch([source?.title, source?.content, source?.source, source?.sourceUrl], intake.jurisdiction) ? 1 : 0)
    : 0;

  const sourceQuality = [source?.title, source?.content, source?.source, source?.sourceUrl, source?.legalDomain]
    .filter((field) => String(field || "").trim().length > 0).length / 5;

  const score =
    similarity * 20 +
    jurisdictionMatch * 30 +
    domainMatch * 25 +
    keywordOverlap * 15 +
    sourceQuality * 10;

  const reasons = [];
  if (similarity > 0) reasons.push(`similarity=${similarity.toFixed(3)}`);
  if (jurisdictionMatch) reasons.push("jurisdiction-match");
  if (domainMatch) reasons.push("domain-match");
  if (keywordOverlap > 0) reasons.push(`keyword-overlap=${keywordOverlap.toFixed(2)}`);
  if (sourceQuality > 0.6) reasons.push("complete-metadata");

  return { finalScore: clampScore(score), rankingReasons: reasons };
}

function scorePrecedent(precedent, intakeTerms, intake = {}) {
  const similarity = Number(precedent?.relevanceScore) || 0;
  const jurisdictionText = [precedent?.jurisdiction, precedent?.court, precedent?.source, precedent?.sourceUrl].join(" ");
  const textBlob = [
    precedent?.caseName,
    precedent?.court,
    precedent?.citation,
    precedent?.summary,
    precedent?.relevanceExplanation,
    precedent?.source,
  ].join(" ");

  const jurisdictionMatch = hasTextMatch([jurisdictionText], intake.jurisdiction) ? 1 : 0;
  const domainMatch = normalizeText(precedent?.legalDomain) === normalizeText(intake.legalDomain)
    ? 1
    : (hasTextMatch([textBlob], intake.legalDomain) ? 0.7 : 0);
  const factualOverlap = overlapScore(intakeTerms, textBlob);

  const courtText = normalizeText(precedent?.court);
  const authority = courtText.includes("supreme court")
    ? 1
    : courtText.includes("high court")
      ? 0.8
      : courtText.includes("tribunal")
        ? 0.55
        : courtText.includes("district")
          ? 0.45
          : courtText
            ? 0.3
            : 0;

  const yearMatch = String(precedent?.dateOrYear || precedent?.year || "").match(/(19|20)\d{2}/);
  const year = yearMatch ? Number.parseInt(yearMatch[0], 10) : null;
  const recency = year ? Math.max(0, 1 - Math.min(30, Math.max(0, new Date().getFullYear() - year)) / 30) : 0;

  const score =
    similarity * 15 +
    jurisdictionMatch * 25 +
    domainMatch * 15 +
    factualOverlap * 10 +
    authority * 30 +
    recency * 5;

  const reasons = [];
  if (similarity > 0) reasons.push(`similarity=${similarity.toFixed(3)}`);
  if (jurisdictionMatch) reasons.push("jurisdiction-match");
  if (domainMatch) reasons.push("domain-match");
  if (factualOverlap > 0) reasons.push(`factual-overlap=${factualOverlap.toFixed(2)}`);
  if (authority > 0.8) reasons.push("high-authority-court");
  else if (authority > 0.5) reasons.push("mid-authority-court");
  if (recency > 0) reasons.push(`recency=${recency.toFixed(2)}`);

  return { finalScore: clampScore(score), rankingReasons: reasons };
}

function legalSourceDedupKey(source) {
  const directKey = normalizeText(source?.sourceUrl || source?.citation || "");
  if (directKey) return `url:${directKey}`;
  return [source?.title, source?.source, source?.legalDomain, source?.content?.slice(0, 160)].map(normalizeText).join("|");
}

function precedentDedupKey(precedent) {
  const directKey = normalizeText(precedent?.citation || "");
  if (directKey) return `cite:${directKey}`;
  return [precedent?.caseName, precedent?.court, precedent?.dateOrYear, precedent?.sourceUrl].map(normalizeText).join("|");
}

function rerankAndDedupe(list, getKey, scoreFn, intakeTerms, intake, limit) {
  const seen = new Set();
  const ranked = [];

  for (const item of list) {
    const key = getKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const scored = scoreFn(item, intakeTerms, intake);
    ranked.push({
      ...item,
      finalScore: scored.finalScore,
      rankingReasons: scored.rankingReasons,
    });
  }

  return ranked.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    const aName = normalizeText(a.title || a.caseName || "");
    const bName = normalizeText(b.title || b.caseName || "");
    return aName.localeCompare(bName);
  }).slice(0, limit);
}

function rerankEvidence({ intake = {}, ragResult = {}, precedentResult = {} } = {}, options = {}) {
  console.log("[Evidence Reranker] START");

  const legalSources = Array.isArray(ragResult.sources) ? ragResult.sources : [];
  const precedents = Array.isArray(precedentResult.precedents) ? precedentResult.precedents : [];
  const intakeTerms = collectIntakeTerms(intake);

  const maxLegalSources = Number.parseInt(options.maxLegalSources || process.env.LEGAL_ADVISORY_MAX_LEGAL_SOURCES || MAX_LEGAL_SOURCES, 10) || MAX_LEGAL_SOURCES;
  const maxPrecedents = Number.parseInt(options.maxPrecedents || process.env.LEGAL_ADVISORY_MAX_PRECEDENTS || MAX_PRECEDENTS, 10) || MAX_PRECEDENTS;

  const rankedLegalSources = rerankAndDedupe(
    legalSources,
    legalSourceDedupKey,
    scoreLegalSource,
    intakeTerms,
    intake,
    maxLegalSources
  );

  const rankedPrecedents = rerankAndDedupe(
    precedents,
    precedentDedupKey,
    scorePrecedent,
    intakeTerms,
    intake,
    maxPrecedents
  );

  const legalStatus = getStatus(ragResult);
  const precedentStatus = getStatus(precedentResult);

  console.log(`[Evidence Reranker] Legal: retrieved=${legalSources.length} selected=${rankedLegalSources.length} status=${legalStatus}`);
  console.log(`[Evidence Reranker] Precedents: retrieved=${precedents.length} selected=${rankedPrecedents.length} status=${precedentStatus}`);
  console.log("[Evidence Reranker] COMPLETE");

  return {
    legalSources: rankedLegalSources,
    precedents: rankedPrecedents,
    retrievalStatus: {
      legal: legalStatus,
      precedents: precedentStatus,
    },
    summary: {
      totalLegalSourcesRetrieved: legalSources.length,
      totalPrecedentsRetrieved: precedents.length,
      legalSourcesSelected: rankedLegalSources.length,
      precedentsSelected: rankedPrecedents.length,
    },
  };
}

module.exports = {
  rerankEvidence,
  normalizeText,
};
