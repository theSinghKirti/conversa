/**
 * domainMatcher.js — Canonical Legal Domain Normalization & Compatibility Engine
 *
 * Provides bidirectional mapping and compatibility verification between
 * user/case-intake domain terms and stored database domain classifications.
 */

const CANONICAL_DOMAINS = {
  CRIMINAL_LAW: "Criminal Law",
  TENANT_LANDLORD_LAW: "Tenant-Landlord Law",
  LABOUR_LAW: "Labour Law",
  CONSUMER_LAW: "Consumer Law",
};

// Aliases mapping to canonical domains
const DOMAIN_ALIAS_MAP = {
  // Criminal Law
  "criminal law": CANONICAL_DOMAINS.CRIMINAL_LAW,
  "criminal": CANONICAL_DOMAINS.CRIMINAL_LAW,
  "theft": CANONICAL_DOMAINS.CRIMINAL_LAW,
  "ipc": CANONICAL_DOMAINS.CRIMINAL_LAW,
  "bns": CANONICAL_DOMAINS.CRIMINAL_LAW,
  "indian penal code": CANONICAL_DOMAINS.CRIMINAL_LAW,
  "bharatiya nyaya sanhita": CANONICAL_DOMAINS.CRIMINAL_LAW,
  "cheating": CANONICAL_DOMAINS.CRIMINAL_LAW,
  "fraud": CANONICAL_DOMAINS.CRIMINAL_LAW,
  "assault": CANONICAL_DOMAINS.CRIMINAL_LAW,
  "robbery": CANONICAL_DOMAINS.CRIMINAL_LAW,
  "fir": CANONICAL_DOMAINS.CRIMINAL_LAW,
  "bail": CANONICAL_DOMAINS.CRIMINAL_LAW,
  "cyber crime": CANONICAL_DOMAINS.CRIMINAL_LAW,
  "cybercrime": CANONICAL_DOMAINS.CRIMINAL_LAW,
  "lost property / theft": CANONICAL_DOMAINS.CRIMINAL_LAW,
  "criminal matter": CANONICAL_DOMAINS.CRIMINAL_LAW,

  // Tenant-Landlord Law
  "tenant-landlord law": CANONICAL_DOMAINS.TENANT_LANDLORD_LAW,
  "tenant landlord law": CANONICAL_DOMAINS.TENANT_LANDLORD_LAW,
  "landlord-tenant law": CANONICAL_DOMAINS.TENANT_LANDLORD_LAW,
  "landlord tenant law": CANONICAL_DOMAINS.TENANT_LANDLORD_LAW,
  "tenant": CANONICAL_DOMAINS.TENANT_LANDLORD_LAW,
  "landlord": CANONICAL_DOMAINS.TENANT_LANDLORD_LAW,
  "tenancy": CANONICAL_DOMAINS.TENANT_LANDLORD_LAW,
  "tenancy law": CANONICAL_DOMAINS.TENANT_LANDLORD_LAW,
  "rent dispute": CANONICAL_DOMAINS.TENANT_LANDLORD_LAW,
  "rental law": CANONICAL_DOMAINS.TENANT_LANDLORD_LAW,
  "rent control": CANONICAL_DOMAINS.TENANT_LANDLORD_LAW,
  "property law": CANONICAL_DOMAINS.TENANT_LANDLORD_LAW,
  "property dispute": CANONICAL_DOMAINS.TENANT_LANDLORD_LAW,
  "real estate": CANONICAL_DOMAINS.TENANT_LANDLORD_LAW,
  "eviction": CANONICAL_DOMAINS.TENANT_LANDLORD_LAW,
  "lease": CANONICAL_DOMAINS.TENANT_LANDLORD_LAW,
  "housing": CANONICAL_DOMAINS.TENANT_LANDLORD_LAW,

  // Labour Law
  "labour law": CANONICAL_DOMAINS.LABOUR_LAW,
  "labor law": CANONICAL_DOMAINS.LABOUR_LAW,
  "employment law": CANONICAL_DOMAINS.LABOUR_LAW,
  "employment": CANONICAL_DOMAINS.LABOUR_LAW,
  "employment dispute": CANONICAL_DOMAINS.LABOUR_LAW,
  "wrongful termination": CANONICAL_DOMAINS.LABOUR_LAW,
  "workplace": CANONICAL_DOMAINS.LABOUR_LAW,
  "workplace law": CANONICAL_DOMAINS.LABOUR_LAW,
  "industrial dispute": CANONICAL_DOMAINS.LABOUR_LAW,
  "industrial disputes": CANONICAL_DOMAINS.LABOUR_LAW,
  "industrial law": CANONICAL_DOMAINS.LABOUR_LAW,
  "termination": CANONICAL_DOMAINS.LABOUR_LAW,
  "employee rights": CANONICAL_DOMAINS.LABOUR_LAW,
  "gratuity": CANONICAL_DOMAINS.LABOUR_LAW,
  "provident fund": CANONICAL_DOMAINS.LABOUR_LAW,
  "pf": CANONICAL_DOMAINS.LABOUR_LAW,
  "unpaid wages": CANONICAL_DOMAINS.LABOUR_LAW,

  // Consumer Law
  "consumer law": CANONICAL_DOMAINS.CONSUMER_LAW,
  "consumer protection": CANONICAL_DOMAINS.CONSUMER_LAW,
  "consumer dispute": CANONICAL_DOMAINS.CONSUMER_LAW,
  "consumer complaint": CANONICAL_DOMAINS.CONSUMER_LAW,
  "defective product": CANONICAL_DOMAINS.CONSUMER_LAW,
  "deficiency of service": CANONICAL_DOMAINS.CONSUMER_LAW,
  "deficiency in service": CANONICAL_DOMAINS.CONSUMER_LAW,
  "unfair trade practice": CANONICAL_DOMAINS.CONSUMER_LAW,
  "copra": CANONICAL_DOMAINS.CONSUMER_LAW,
  "consumer rights": CANONICAL_DOMAINS.CONSUMER_LAW,
  "e-commerce dispute": CANONICAL_DOMAINS.CONSUMER_LAW,
};

const GENERIC_TERMS = new Set([
  "unknown",
  "generic",
  "general",
  "other",
  "n/a",
  "none",
  "not applicable",
  "non-legal",
  "civil",
  "information",
  "question",
]);

/**
 * Checks if a domain string is generic, ambiguous, or non-legal.
 */
function isGenericOrUnknownDomain(domain) {
  if (!domain || typeof domain !== "string") return true;
  const d = domain.toLowerCase().trim();
  if (GENERIC_TERMS.has(d)) return true;
  for (const term of GENERIC_TERMS) {
    if (d.includes(term)) return true;
  }
  return false;
}

/**
 * Normalizes a raw domain string to its canonical database representation.
 *
 * @param {string} domain
 * @returns {string|null} Canonical domain or null if unrecognized
 */
function normalizeDomain(domain) {
  if (!domain || typeof domain !== "string") return null;
  const cleaned = domain.toLowerCase().trim();

  if (DOMAIN_ALIAS_MAP[cleaned]) {
    return DOMAIN_ALIAS_MAP[cleaned];
  }

  // Substring matching against known aliases
  for (const [alias, canonical] of Object.entries(DOMAIN_ALIAS_MAP)) {
    if (cleaned.includes(alias) || alias.includes(cleaned)) {
      return canonical;
    }
  }

  return null;
}

/**
 * Checks whether storedDomain is compatible with requestedDomain.
 * Controlled and explicit compatibility logic.
 *
 * @param {string} storedDomain - Domain in DB chunk / precedent
 * @param {string} requestedDomain - Domain from user or intake
 * @param {boolean} [logDetails=false] - Whether to log the decision
 * @returns {boolean}
 */
function isDomainCompatible(storedDomain, requestedDomain, logDetails = false) {
  const normStored = normalizeDomain(storedDomain) || storedDomain?.trim();
  const normRequested = normalizeDomain(requestedDomain);

  // If requestedDomain is generic/unknown/unrecognized, it is NOT compatible with specific legal domains by default
  let matchDecision = false;
  if (!normRequested || isGenericOrUnknownDomain(requestedDomain)) {
    matchDecision = false;
  } else if (normStored && normRequested && normStored.toLowerCase() === normRequested.toLowerCase()) {
    matchDecision = true;
  } else if (storedDomain && requestedDomain) {
    const s = storedDomain.toLowerCase();
    const q = requestedDomain.toLowerCase();
    matchDecision = s === q || s.includes(q) || q.includes(s);
  }

  if (logDetails || process.env.DEBUG_DOMAIN_MATCH) {
    console.log(
      `[DomainMatcher] requestedDomain="${requestedDomain}" | storedDomain="${storedDomain}" | normalizedDomain="${normRequested || "Unknown"}" | matchDecision=${matchDecision}`
    );
  }

  return matchDecision;
}

/**
 * Returns an array of domain names compatible with requestedDomain for MongoDB query filter ($in).
 *
 * @param {string} requestedDomain
 * @returns {string[]}
 */
function getDomainFilter(requestedDomain) {
  if (!requestedDomain || typeof requestedDomain !== "string") return [];
  const canonical = normalizeDomain(requestedDomain);

  const filterSet = new Set();
  if (canonical) {
    filterSet.add(canonical);
  }
  filterSet.add(requestedDomain.trim());

  // Also include relevant aliases if stored in legacy records
  if (canonical === CANONICAL_DOMAINS.TENANT_LANDLORD_LAW) {
    filterSet.add("Tenant-Landlord Law");
    filterSet.add("Property Law");
    filterSet.add("Tenancy Law");
  } else if (canonical === CANONICAL_DOMAINS.LABOUR_LAW) {
    filterSet.add("Labour Law");
    filterSet.add("Labor Law");
    filterSet.add("Employment Law");
  } else if (canonical === CANONICAL_DOMAINS.CRIMINAL_LAW) {
    filterSet.add("Criminal Law");
    filterSet.add("Criminal");
  } else if (canonical === CANONICAL_DOMAINS.CONSUMER_LAW) {
    filterSet.add("Consumer Law");
    filterSet.add("Consumer Protection");
  }

  return Array.from(filterSet);
}

module.exports = {
  CANONICAL_DOMAINS,
  normalizeDomain,
  isDomainCompatible,
  getDomainFilter,
  isGenericOrUnknownDomain,
};
