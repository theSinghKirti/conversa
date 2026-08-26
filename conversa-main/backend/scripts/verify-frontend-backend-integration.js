"use strict";

const jwt = require("jsonwebtoken");

async function runEndToEndVerification() {
  const token = jwt.sign({ user: { id: "6a544b8decdcc22313d0b7a0" } }, "yourverysecurekey");

  console.log("===========================================================");
  console.log(" SCENARIO 1: Real Theft Advisory Query");
  console.log(" Query: \"My purse was stolen. What should I do?\"");
  console.log("===========================================================");

  const start1 = Date.now();
  const res1 = await fetch("http://localhost:5500/api/legal-advisory/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json", "auth-token": token },
    body: JSON.stringify({
      query: "My purse was stolen. What should I do?",
      jurisdiction: "India",
    }),
  });
  const data1 = await res1.json();
  const duration1 = Date.now() - start1;

  console.log("HTTP Status:", res1.status);
  console.log("Duration:", duration1 + "ms");
  console.log("success:", data1.success);
  console.log("advisory.caseType:", data1.advisory?.caseType);
  console.log("advisory.legalDomain:", data1.advisory?.legalDomain);
  console.log("advisory.ragSearchStatus:", data1.advisory?.ragSearchStatus);
  console.log("advisory.retrievedSources count:", data1.advisory?.retrievedSources?.length);
  if (data1.advisory?.retrievedSources?.length > 0) {
    console.log("  Top Source Title:", data1.advisory.retrievedSources[0].title);
    console.log("  Top Source:", data1.advisory.retrievedSources[0].source);
    console.log("  Top Source Domain:", data1.advisory.retrievedSources[0].legalDomain);
  }
  console.log("advisory.precedents count:", data1.advisory?.precedents?.length);
  console.log("advisory.possibleNextSteps count:", data1.advisory?.possibleNextSteps?.length);
  console.log("advisory.documentsToGather count:", data1.advisory?.documentsToGather?.length);
  console.log("advisory.issueIdentified:", data1.advisory?.issueIdentified?.slice(0, 100) + "...");

  console.log("\n===========================================================");
  console.log(" SCENARIO 2: Non-matching / Unrelated Query (NO_RESULTS)");
  console.log(" Query: \"I am researching quantum entanglement of photons in deep space astrophysics.\"");
  console.log("===========================================================");

  const res2 = await fetch("http://localhost:5500/api/legal-advisory/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json", "auth-token": token },
    body: JSON.stringify({
      query: "I am researching quantum entanglement of photons in deep space astrophysics.",
      jurisdiction: "India",
    }),
  });
  const data2 = await res2.json();
  console.log("HTTP Status 2:", res2.status);
  console.log("success 2:", data2.success);
  console.log("advisory 2 ragSearchStatus:", data2.advisory?.ragSearchStatus);
  console.log("advisory 2 retrievedSources count:", data2.advisory?.retrievedSources?.length || 0);

  console.log("\n===========================================================");
  console.log(" SCENARIO 3: Validation Error (Query < 20 chars)");
  console.log(" Query: \"Stolen wallet\"");
  console.log("===========================================================");

  const res3 = await fetch("http://localhost:5500/api/legal-advisory/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json", "auth-token": token },
    body: JSON.stringify({ query: "Stolen wallet", jurisdiction: "India" }),
  });
  const data3 = await res3.json();
  console.log("HTTP Status 3:", res3.status);
  console.log("error 3:", data3.error);
}

runEndToEndVerification().catch((e) => {
  console.error("Verification failed:", e);
  process.exit(1);
});
